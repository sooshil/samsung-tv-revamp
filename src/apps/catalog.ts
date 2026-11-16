// Turns the raw installed-app list into what the dashboard shows.
import type { InstalledApp } from '../platform/tizen';
import type { Settings } from '../settings/store';

export interface AppEntry extends InstalledApp {
  label: string;
  /** A Samsung system panel (opens on top of the dashboard) rather than an app. */
  shortcut?: { icon: string };
}

// Visible-but-not-useful entries reported by getAppsInfo on this TV.
const EXCLUDE = /(-dummy$|^org\.tizen\.(?!browser$|netflix-app$|primevideo$)|^com\.samsung\.tv\.(?!aria-video$|gallery$)|^com\.samsung\.(?!tv\.)|^tvrvmprobe\.|^tvrevamp00\.|^[a-z-]+$)/;

// Store-format IDs that are promotions or helpers rather than apps a person opens.
const EXCLUDE_IDS: Record<string, true> = { 'yL49PNFmjW.PromotionApp': true, 'aQjWjLsPaO.MultiScreenWebLauncher': true };

// Store names are often long marketing titles; trim them for cards.
const SHORT: Record<string, string> = {
  'wKDM33Rods.ZEE5': 'ZEE5', '3KA0pm7a7V.TubiTV': 'Tubi', 'rJeHak5zRg.Spotify': 'Spotify',
  'gzcc4LRFBF.Peacock': 'Peacock', 'org.tizen.browser': 'Internet', 'GHI3a0zMSx.XboxGamePass': 'Xbox',
};

export function buildCatalog(installed: InstalledApp[], s: Settings, selfId: string): { favorites: AppEntry[]; others: AppEntry[] } {
  const usable = installed.filter((a) => a.id !== selfId && !EXCLUDE.test(a.id) && !EXCLUDE_IDS[a.id]);
  const byId: Record<string, InstalledApp> = {};
  usable.forEach((a) => { byId[a.id] = a; });
  const label = (a: InstalledApp): string => s.labels[a.id] || SHORT[a.id] || a.name;
  const entry = (a: InstalledApp): AppEntry => ({ ...a, label: label(a) });

  const favorites = s.favorites.filter((id) => byId[id]).map((id) => entry(byId[id]));
  const favSet = new Set(s.favorites);
  const hidden = new Set(s.hidden);
  const others = usable
    .filter((a) => !favSet.has(a.id) && !hidden.has(a.id))
    .map(entry)
    .sort((a, b) => a.label.localeCompare(b.label));
  return { favorites, others };
}
