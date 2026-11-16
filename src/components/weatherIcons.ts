// Weather glyphs, same line style as icons.ts.
const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18z"/>';
const SUN_RAYS = '<path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>';

export const WEATHER_ICONS: Record<string, string> = {
  sun: svg('<circle cx="12" cy="12" r="4.2"/>' + SUN_RAYS),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  partly: svg('<path d="M8.5 3v1.4M3.6 5.1l1 1M2 10h1.4M12.4 5.1l-1 1"/><path d="M5.3 11.6A3.6 3.6 0 0 1 11.6 8"/>' +
    '<path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.96 4.8 4.8 0 0 0-9.2-1.2A3.9 3.9 0 0 0 9 20z"/>'),
  partlyNight: svg('<path d="M11 5.5A4.5 4.5 0 0 0 5 10.8"/><path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.96 4.8 4.8 0 0 0-9.2-1.2A3.9 3.9 0 0 0 9 20z"/>'),
  cloud: svg(CLOUD),
  fog: svg('<path d="M7 13h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 4.6 4.2 4.2 0 0 0 7 13z"/><path d="M4 17h16M6 20.5h12"/>'),
  rain: svg('<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>'),
  snow: svg('<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M8 19h.01M12 19h.01M16 19h.01M10 21.5h.01M14 21.5h.01"/>'),
  storm: svg('<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>'),
};
