// The only module that touches tizen.* — everything else uses these typed wrappers.
// In desktop Chrome (no `tizen` global) it falls back to mock data.


export interface InstalledApp {
  id: string;
  name: string;
  iconPath: string | null;
  version: string;
}

interface TizenAppInfo { id: string; name: string; iconPath: string; version: string; show: boolean; }
interface TizenError { name: string; message: string; }
interface TizenGlobal {
  application: {
    getAppsInfo(ok: (apps: TizenAppInfo[]) => void, err?: (e: TizenError) => void): void;
    getAppsContext(ok: (ctx: { id: string; appId: string }[]) => void, err?: (e: TizenError) => void): void;
    launch(id: string, ok?: () => void, err?: (e: TizenError) => void): void;
    launchAppControl(ctl: unknown, id: string | null, ok?: () => void, err?: (e: TizenError) => void): void;
    getCurrentApplication(): { exit(): void; hide(): void; appInfo: { id: string } };
  };
  tvinputdevice: { registerKey(name: string): void; getSupportedKeys(): { name: string; code: number }[] };
  systeminfo: {
    getPropertyValue(p: string, ok: (v: Record<string, unknown>) => void, err?: (e: TizenError) => void): void;
    getTotalMemory(): number;
    getAvailableMemory(): number;
  };
}

declare global { interface Window { tizen?: TizenGlobal } }

export const isTV = typeof window.tizen !== 'undefined';
const tz = (): TizenGlobal => window.tizen as TizenGlobal;

export function listApps(): Promise<InstalledApp[]> {
  if (!isTV) return Promise.resolve(MOCK_APPS);
  return new Promise((resolve, reject) => {
    tz().application.getAppsInfo(
      (apps) => resolve(apps.filter((a) => a.show).map((a) => ({ id: a.id, name: a.name, iconPath: a.iconPath || null, version: a.version }))),
      (e) => reject(new Error(e.name + ': ' + e.message)),
    );
  });
}

const APPS_CACHE = 'tvr.appsCache';

/** Last known app list, for an instant first render (getAppsInfo takes ~5.6 s on this TV). */
export function cachedApps(): InstalledApp[] | null {
  try { const s = localStorage.getItem(APPS_CACHE); return s ? (JSON.parse(s) as InstalledApp[]) : null; } catch (e) { return null; }
}
export function cacheApps(apps: InstalledApp[]): void {
  try { localStorage.setItem(APPS_CACHE, JSON.stringify(apps)); } catch (e) { /* ignore */ }
}

const appListeners: ((apps: InstalledApp[]) => void)[] = [];
/** Called whenever refreshApps finds the installed list differs from the cached one. */
export function onAppsChanged(l: (apps: InstalledApp[]) => void): void { appListeners.push(l); }

let inflight: Promise<InstalledApp[]> | null = null;
/** Asks the TV for the installed apps (slow, ~5.6 s); caches them and notifies listeners if the list changed. */
export function refreshApps(): Promise<InstalledApp[]> {
  if (inflight) return inflight;
  const before = JSON.stringify(cachedApps());
  inflight = listApps().then((fresh) => {
    inflight = null;
    if (JSON.stringify(fresh) !== before) { cacheApps(fresh); appListeners.forEach((l) => l(fresh)); }
    return fresh;
  }, (e) => { inflight = null; throw e; });
  return inflight;
}

export function launchApp(id: string): Promise<void> {
  if (!isTV) { console.info('[mock] launch', id); return Promise.resolve(); }
  return new Promise((resolve, reject) => {
    tz().application.launch(id, () => resolve(), (e) => reject(new Error(e.name + ': ' + e.message)));
  });
}

/** IDs of apps currently running (foreground or background). Cheap: ~10 ms on this TV. */
export function runningAppIds(): Promise<Set<string>> {
  if (!isTV) return Promise.resolve(new Set<string>());
  return new Promise((resolve, reject) => {
    tz().application.getAppsContext((c) => resolve(new Set(c.map((x) => x.appId))), (e) => reject(new Error(e.name + ': ' + e.message)));
  });
}

/** Bring the dashboard back to the screen from the background. */
// tizen.application.launch(self) reloads the page on this TV (measured); an app control to ourselves is
// delivered to the running instance instead.
export function bringToFront(): Promise<void> {
  if (!isTV) return Promise.resolve();
  const T = window.tizen as unknown as { ApplicationControl: new (op: string) => unknown };
  return new Promise((resolve, reject) => {
    tz().application.launchAppControl(new T.ApplicationControl('http://tizen.org/appcontrol/operation/default'), currentAppId(),
      () => resolve(), (e) => reject(new Error(e.name + ': ' + e.message)));
  });
}

/** Allow or hold off the TV's own screensaver while the dashboard is on screen. */
export function setSystemScreensaver(on: boolean): string {
  const w = window as unknown as { webapis?: { appcommon?: { setScreenSaver(s: number): void; AppCommonScreenSaverState: Record<string, number> } } };
  const ac = w.webapis && w.webapis.appcommon;
  if (!ac) return 'no webapis';
  try { ac.setScreenSaver(ac.AppCommonScreenSaverState[on ? 'SCREEN_SAVER_ON' : 'SCREEN_SAVER_OFF']); return 'ok'; } catch (e) { return 'ERR ' + String(e); }
}

export function exitApp(): void {
  if (isTV) tz().application.getCurrentApplication().exit();
  else console.info('[mock] exit');
}

export function registerKeys(names: string[]): void {
  if (!isTV) return;
  const supported = new Set(tz().tvinputdevice.getSupportedKeys().map((k) => k.name));
  names.forEach((n) => { if (supported.has(n)) tz().tvinputdevice.registerKey(n); });
}

export function memoryInfo(): { total: number; available: number } | null {
  if (!isTV) return null;
  try { return { total: tz().systeminfo.getTotalMemory(), available: tz().systeminfo.getAvailableMemory() }; } catch (e) { return null; }
}

export function currentAppId(): string {
  return isTV ? tz().application.getCurrentApplication().appInfo.id : 'tvrevamp00.Dashboard';
}

// Mirrors the real inventory captured on 2026-11-14 (docs/system-audit.md), minus system components.
const MOCK_APPS: InstalledApp[] = __DESKTOP__ ? [
  ['9Ur5IzDKqV.TizenYouTube', 'YouTube'], ['org.tizen.netflix-app', 'Netflix'], ['org.tizen.primevideo', 'Prime Video'],
  ['wKDM33Rods.ZEE5', 'ZEE5 - Movies, Shows, LiveTV, Originals and Sports'], ['aR24dvmurV.SmartSTBplus', 'Smart STB+'],
  ['MCmYXNxgcu.DisneyPlus', 'Disney+'], ['LBUAQX1exg.Hulu', 'Hulu'], ['com.samsung.tv.aria-video', 'Apple TV'],
  ['gzcc4LRFBF.Peacock', 'Peacock TV'], ['ZmmGjO6VKO.slingtv', 'Sling TV'], ['3KA0pm7a7V.TubiTV', 'Tubi - Free Movies ＆ TV'],
  ['rJeHak5zRg.Spotify', 'Spotify - Music and Podcasts'], ['w3k1Cc2pEu.ICC', 'ICC.tv'], ['org.tizen.browser', 'Internet'],
  ['com.samsung.tv.gallery', 'Gallery'], ['GHI3a0zMSx.XboxGamePass', 'Xbox'],
  ['zigzSWa1hy.InstagramAirwave', 'Instagram'], ['com.samsung.tv.store', 'Apps'], ['com.samsung.tv.coba.setting', 'Setting'],
].map(([id, name]) => ({ id, name, iconPath: null, version: '1.0.0' })) : [];
