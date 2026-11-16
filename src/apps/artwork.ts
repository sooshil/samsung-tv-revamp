// Card artwork: a brand-tinted gradient tile with the app's own system icon (loaded from its install path).
// No third-party logos are bundled; the icon comes from the installed app itself.

const BRAND: Record<string, [string, string]> = {
  '9Ur5IzDKqV.TizenYouTube': ['#0d0d0f', '#3b3b42'],
  'org.tizen.netflix-app': ['#140405', '#b20710'],
  'org.tizen.primevideo': ['#05202e', '#00a8e1'],
  'MCmYXNxgcu.DisneyPlus': ['#050d2e', '#1f3fbf'],
  'LBUAQX1exg.Hulu': ['#04140c', '#17b26a'],
  'com.samsung.tv.aria-video': ['#0b0b0d', '#3a3a40'],
  'gzcc4LRFBF.Peacock': ['#0b0b0d', '#5a4bd6'],
  'rJeHak5zRg.Spotify': ['#06140b', '#1aa34a'],
  'wKDM33Rods.ZEE5': ['#1a0626', '#8230c6'],
  'ZmmGjO6VKO.slingtv': ['#06142a', '#1d6fe0'],
  '3KA0pm7a7V.TubiTV': ['#1a1203', '#e0a316'],
  'aR24dvmurV.SmartSTBplus': ['#08162a', '#2f6db5'],
  'w3k1Cc2pEu.ICC': ['#071a2a', '#1590c8'],
};

function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export function tileGradient(id: string): string {
  const b = BRAND[id];
  if (b) return `linear-gradient(135deg, ${b[0]} 0%, ${b[1]} 140%)`;
  const hue = hash(id) % 360;
  return `linear-gradient(135deg, hsl(${hue},35%,9%) 0%, hsl(${hue},45%,32%) 140%)`;
}

// Apps whose registered icon is Tizen's generic pinwheel placeholder (identical file, md5 9fc62020…, checked
// by pulling every icon from the TV on 2026-11-15). Samsung's own home bar fetches their artwork from its servers.
const PLACEHOLDER_ICON = new Set(['9Ur5IzDKqV.TizenYouTube']);

// Drawn marks for apps that have no usable icon on the TV. Simple shapes in brand colours, inline SVG.
const GLYPHS: Record<string, string> = {
  '9Ur5IzDKqV.TizenYouTube':
    '<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="70" rx="18" fill="#ff0000"/>' +
    '<path d="M40 20 L68 35 L40 50 Z" fill="#ffffff"/></svg>',
};

export function glyphFor(id: string): string | null { return GLYPHS[id] || null; }

export function iconUrl(iconPath: string | null, appId?: string): string | null {
  if (!iconPath || (appId && PLACEHOLDER_ICON.has(appId))) return null;
  return iconPath.indexOf('://') > 0 ? iconPath : 'file://' + iconPath;
}
