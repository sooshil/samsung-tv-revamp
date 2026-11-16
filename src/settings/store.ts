// Versioned settings document in localStorage. Survives app restarts (verified on the TV).
import type { FocusPos } from '../navigation/focus';
import type { Place } from '../services/weather';

export interface Settings {
  version: 2;
  theme: 'midnight' | 'graphite';
  backgroundId: string | 'rotate';
  favorites: string[];            // app IDs, in display order
  hidden: string[];               // app IDs hidden from "All apps"
  labels: Record<string, string>; // custom display names
  animations: 'full' | 'reduced';
  screensaverMinutes: number;     // 0 = off
  returnAfterApp: boolean;        // bring the dashboard back when an app it opened closes
  weatherEnabled: boolean;
  weatherUnits: 'F' | 'C';
  weatherPlace: Place | null;
  photoSet: 'nepal' | 'nature' | 'all';     
}

export interface SessionState { focus: FocusPos | null; screen: string; }

const KEY = 'tvr.settings';
const SESSION_KEY = 'tvr.session';

// Only used by the v1 → v2 migration (an early private build); new installs hide nothing.
export const UNUSED_APPS = [
  'gzcc4LRFBF.Peacock', 'zigzSWa1hy.InstagramAirwave', 'jAfAs7yVDX.TheSix', 'ZmmGjO6VKO.slingtv', 'rJeHak5zRg.Spotify',
  '3KA0pm7a7V.TubiTV', 'GHI3a0zMSx.XboxGamePass', 'LBUAQX1exg.Hulu', 'HupEmjIB4I.Glance', 'com.samsung.tv.aria-video',
  'MCmYXNxgcu.DisneyPlus', 'oKZtnuTBW8.emanual',
];

// Defaults for a fresh install. Favourites that are not installed on the TV are simply skipped.
export const DEFAULTS: Settings = {
  version: 2,
  theme: 'midnight',
  backgroundId: 'rotate',
  favorites: ['9Ur5IzDKqV.TizenYouTube', 'org.tizen.netflix-app', 'org.tizen.primevideo'],
  hidden: [],
  labels: {},
  animations: 'full',
  screensaverMinutes: 10,
  returnAfterApp: true,
  weatherEnabled: true,
  weatherUnits: 'F',
  weatherPlace: __WEATHER_PLACE__,
  photoSet: 'all',
};

export function migrate(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const r = raw as Partial<Settings> & { version?: number };
  // v1 → v2: ZEE5 leaves favourites (stays in All apps); unused apps are hidden.
  if ((r.version || 1) < 2) {
    if (Array.isArray(r.favorites)) r.favorites = r.favorites.filter((id) => id !== 'wKDM33Rods.ZEE5');
    r.hidden = (Array.isArray(r.hidden) ? r.hidden : []).concat(UNUSED_APPS.filter((id) => !(r.hidden || []).includes(id)));
  }
  // Unknown or missing fields fall back to defaults; arrays and maps are type-checked.
  return {
    version: 2,
    theme: r.theme === 'graphite' ? 'graphite' : 'midnight',
    backgroundId: typeof r.backgroundId === 'string' ? r.backgroundId : DEFAULTS.backgroundId,
    favorites: Array.isArray(r.favorites) ? r.favorites.filter((x) => typeof x === 'string') : DEFAULTS.favorites.slice(),
    hidden: Array.isArray(r.hidden) ? r.hidden.filter((x) => typeof x === 'string') : DEFAULTS.hidden.slice(),
    labels: r.labels && typeof r.labels === 'object' ? { ...r.labels } : {},
    animations: r.animations === 'reduced' ? 'reduced' : 'full',
    screensaverMinutes: typeof r.screensaverMinutes === 'number' && r.screensaverMinutes >= 0 ? r.screensaverMinutes : DEFAULTS.screensaverMinutes,
    returnAfterApp: typeof r.returnAfterApp === 'boolean' ? r.returnAfterApp : DEFAULTS.returnAfterApp,
    weatherEnabled: typeof r.weatherEnabled === 'boolean' ? r.weatherEnabled : DEFAULTS.weatherEnabled,
    weatherUnits: r.weatherUnits === 'C' ? 'C' : 'F',
    photoSet: r.photoSet === 'nature' || r.photoSet === 'all' ? r.photoSet : r.photoSet === 'nepal' ? 'nepal' : DEFAULTS.photoSet,
    weatherPlace: validPlace(r.weatherPlace) ? { ...(r.weatherPlace as Place) } : DEFAULTS.weatherPlace,
  };
}

function validPlace(p: unknown): boolean {
  const x = p as Place | null;
  return !!x && typeof x.name === 'string' && typeof x.lat === 'number' && typeof x.lon === 'number' &&
    Math.abs(x.lat) <= 90 && Math.abs(x.lon) <= 180;
}

function read(key: string): unknown {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function write(key: string, v: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable: run with in-memory state */ }
}

let current: Settings = migrate(read(KEY));
const listeners: ((s: Settings) => void)[] = [];

export const settings = {
  get: (): Settings => current,
  update(patch: Partial<Settings>): void {
    current = migrate({ ...current, ...patch });
    write(KEY, current);
    listeners.forEach((l) => l(current));
  },
  onChange(l: (s: Settings) => void): void { listeners.push(l); },
  reset(): void { settings.update({ ...DEFAULTS }); },
};

export const session = {
  load: (): SessionState | null => read(SESSION_KEY) as SessionState | null,
  save: (s: SessionState): void => write(SESSION_KEY, s),
};
