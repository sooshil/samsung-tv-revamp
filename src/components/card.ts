import { el } from './dom';
import type { AppEntry } from '../apps/catalog';
import { iconUrl, tileGradient, glyphFor } from '../apps/artwork';
import { ICONS } from './icons';

export function appCard(app: AppEntry, size: 'large' | 'small'): HTMLElement {
  const tile = el('div.tile');
  tile.style.backgroundImage = tileGradient(app.id);
  if (app.shortcut) {
    tile.style.backgroundImage = 'linear-gradient(135deg, #1c2030 0%, #3a4258 140%)';
    const g = el('div.shortcut-glyph');
    g.innerHTML = (ICONS as Record<string, string>)[app.shortcut.icon] || ''; // static, trusted markup
    tile.appendChild(g);
    tile.appendChild(el('div.shortcut-name', null, [app.label]));
    return wrap(app, size, tile);
  }
  const glyph = glyphFor(app.id);
  if (glyph) {
    const g = el('div.app-glyph');
    g.innerHTML = glyph; // static, trusted markup from artwork.ts
    tile.appendChild(g);
    return wrap(app, size, tile);
  }
  const mono = el('div.wordmark', null, [app.label]); // shown until (or unless) the system icon loads
  tile.appendChild(mono);
  const src = iconUrl(app.iconPath, app.id);
  if (src) {
    const img = el<HTMLImageElement>('img.app-icon', { alt: '' });
    img.onload = () => { mono.style.display = 'none'; };
    img.onerror = () => { img.remove(); };
    img.src = src;
    tile.appendChild(img);
  }
  return wrap(app, size, tile);
}

function wrap(app: AppEntry, size: 'large' | 'small', tile: HTMLElement): HTMLElement {
  return el('div.card.' + size, { 'data-app': app.id }, [tile, el('div.card-ring'), el('div.card-label', null, [app.label])]);
}

export function iconButton(svg: string, label: string): HTMLElement {
  const glyph = el('span.icon-glyph');
  glyph.innerHTML = svg; // static, trusted markup from icons.ts
  return el('div.icon-btn', { 'aria-label': label }, [glyph, el('span.icon-label', null, [label])]);
}
