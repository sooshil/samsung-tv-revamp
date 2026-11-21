// Favourites editor. Works with arrows, OK and Back only (the Samsung Smart Remote has no colour keys).
//   OK on an app that isn't a favourite  → adds it to the end and picks it up
//   OK on a favourite                    → picks it up; ▲▼ reorder, ◀ removes, OK or Back puts it down
// Changes are saved immediately, so leaving the screen never loses anything.
import { el } from '../components/dom';
import { buildCatalog } from '../apps/catalog';
import { tileGradient } from '../apps/artwork';
import { addFavorite, removeFavorite, moveFavorite, MAX_FAVORITES } from '../apps/favorites';
import { cachedApps, currentAppId, refreshApps, InstalledApp } from '../platform/tizen';
import { settings } from '../settings/store';
import type { Intent } from '../platform/keys';
import type { Router, Screen } from './screen';

const ROW_H = 76;       // row height + gap, for scrolling
const VISIBLE = 9;

export class FavoritesScreen implements Screen {
  readonly root = el('div.screen.favs');
  private list = el('div.favs-list');
  private viewport = el('div.favs-viewport', null, [this.list]);
  private hint = el('div.favs-hint');
  private labels: Record<string, string> = {};
  private favs: string[] = [];
  private others: string[] = [];
  private cursor = 0;
  private grabbed: string | null = null;
  private visit = 0;
  private refreshing = false;

  constructor(private router: Router) {
    this.root.appendChild(el('h1.settings-title', null, ['Favourites']));
    this.root.appendChild(el('div.favs-sub', null, ['The big tiles on your home screen, in this order']));
    this.root.appendChild(this.viewport);
    this.root.appendChild(this.hint);
  }

  onShow(): void {
    this.build(cachedApps() || [], null);
    this.grabbed = null;
    // The cached list can be stale (an app installed since the launcher started), so ask the TV again.
    const visit = ++this.visit;
    this.refreshing = true;
    this.render();
    refreshApps().then((apps) => {
      if (visit !== this.visit) return;
      this.refreshing = false;
      // Don't reshuffle rows under an app the user is holding; the cache is already updated for next time.
      if (!this.grabbed) this.build(apps, this.id(this.cursor));
      this.render();
    }, () => {
      if (visit !== this.visit) return;
      this.refreshing = false;
      this.render();
    });
  }

  /** Builds the favourites/others lists from `installed`; keeps the cursor on `keepId` when it is still listed. */
  private build(installed: InstalledApp[], keepId: string | null): void {
    const c = buildCatalog(installed, settings.get(), currentAppId());
    this.labels = {};
    c.favorites.concat(c.others).forEach((a) => { this.labels[a.id] = a.label; });
    this.favs = c.favorites.map((a) => a.id);
    this.others = c.others.map((a) => a.id);
    const at = keepId ? this.favs.concat(this.others).indexOf(keepId) : -1;
    this.cursor = at >= 0 ? at : 0;
  }

  private id(i: number): string { return i < this.favs.length ? this.favs[i] : this.others[i - this.favs.length]; }
  private count(): number { return this.favs.length + this.others.length; }

  private save(): void { settings.update({ favorites: this.favs.slice() }); }

  private render(): void {
    this.list.textContent = '';
    const rows: HTMLElement[] = [];
    for (let i = 0; i < this.count(); i++) {
      const id = this.id(i);
      const isFav = i < this.favs.length;
      const swatch = el('div.favs-swatch');
      swatch.style.backgroundImage = tileGradient(id);
      const status = this.grabbed === id ? 'Moving' : isFav ? '' : 'OK to add';
      const row = el('div.favs-row' + (isFav ? '.fav' : '') + (i === this.cursor ? '.focused' : '') + (this.grabbed === id ? '.grabbed' : ''), null, [
        el('div.favs-num', null, [isFav ? String(i + 1) : '']),
        swatch,
        el('div.favs-name', null, [this.labels[id] || id]),
        el('div.favs-status', null, [status]),
      ]);
      if (i === this.favs.length && this.others.length) row.classList.add('first-other');
      rows.push(row);
      this.list.appendChild(row);
    }
    // Keep the cursor inside the window of visible rows.
    const first = Math.max(0, Math.min(this.cursor - Math.floor(VISIBLE / 2), this.count() - VISIBLE));
    this.list.style.transform = 'translate3d(0,' + -first * ROW_H + 'px,0)';
    this.hint.textContent = this.refreshing && !this.grabbed ? 'Refreshing apps…  ·  Back: close' : this.grabbed
      ? '▲ ▼ move  ·  ◀ remove from favourites  ·  OK or Back: done'
      : this.favs.length >= MAX_FAVORITES ? 'Favourites are full (' + MAX_FAVORITES + '). Remove one to add another  ·  Back: close'
      : 'OK on a favourite: move or remove it  ·  OK on another app: add it  ·  Back: close';
  }

  handle(intent: Intent): boolean {
    const g = this.grabbed;
    switch (intent) {
      case 'up': case 'down': {
        const d = intent === 'up' ? -1 : 1;
        if (g) {
          this.favs = moveFavorite(this.favs, g, d);
          this.cursor = this.favs.indexOf(g);
          this.save();
        } else this.cursor = Math.max(0, Math.min(this.count() - 1, this.cursor + d));
        this.render();
        return true;
      }
      case 'left':
        if (g) {
          if (this.favs.length <= 1) { this.router.toast('Keep at least one favourite'); return true; }
          this.favs = removeFavorite(this.favs, g);
          this.others = this.others.concat(g).sort((a, b) => (this.labels[a] || a).localeCompare(this.labels[b] || b));
          this.grabbed = null;
          this.cursor = this.favs.length + this.others.indexOf(g);
          this.save();
          this.router.toast((this.labels[g] || 'App') + ' removed from favourites');
          this.render();
        }
        return true;
      case 'select': {
        if (g) { this.grabbed = null; this.render(); return true; }
        const id = this.id(this.cursor);
        if (this.cursor < this.favs.length) { this.grabbed = id; this.render(); return true; }
        if (this.favs.length >= MAX_FAVORITES) { this.router.toast('Favourites are full: remove one first'); return true; }
        this.favs = addFavorite(this.favs, id);
        this.others = this.others.filter((x) => x !== id);
        this.cursor = this.favs.indexOf(id);
        this.grabbed = id;
        this.save();
        this.render();
        return true;
      }
      case 'back':
        if (g) { this.grabbed = null; this.render(); } else this.router.pop();
        return true;
      default:
        return false;
    }
  }
}
