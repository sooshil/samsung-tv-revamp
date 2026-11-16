import { el } from '../components/dom';
import { Row } from '../components/row';
import { appCard, iconButton } from '../components/card';
import { ICONS } from '../components/icons';
import { Clock } from '../components/clock';
import { FocusModel, FocusPos, ZoneSpec } from '../navigation/focus';
import { buildCatalog, AppEntry } from '../apps/catalog';
import { launchApp, listApps, currentAppId, cachedApps, cacheApps, InstalledApp } from '../platform/tizen';
import { settings, session } from '../settings/store';
import type { Intent } from '../platform/keys';
import type { Router, Screen } from './screen';
import type { BackgroundStage } from '../services/backgrounds';
import { ReturnWatcher, FocusReclaimer } from '../services/returnWatcher';
import { WeatherWidget } from '../components/weatherWidget';
import { SHORTCUTS } from '../apps/shortcuts';

type TopAction = { label: string; icon: string; run: () => void };

export class HomeScreen implements Screen {
  readonly root = el('div.screen.home');
  private favRow = new Row({ id: 'fav', cardW: 400, gap: 36, className: 'row-fav' });
  private allRow = new Row({ id: 'all', title: 'All apps', cardW: 264, gap: 28, className: 'row-all' });
  private topBar = el('div.top-actions');
  private topButtons: HTMLElement[] = [];
  private heroTitle = el('h1.hero-title');
  private heroSub = el('div.hero-sub');
  private credit = el('div.credit');
  private favorites: AppEntry[] = [];
  private others: AppEntry[] = [];
  private focus!: FocusModel;
  private topActions: TopAction[];
  private heroTimer = 0;
  private shownKey = '';
  readonly weather = new WeatherWidget();
  private touched = false; // until the user moves, focus belongs on the first favourite
  readonly watcher = new ReturnWatcher(() => this.userAppIds(), () => settings.get().returnAfterApp);
  readonly reclaimer = new FocusReclaimer(() => settings.get().returnAfterApp);

  constructor(private router: Router, stage: BackgroundStage) {
    this.topActions = [
      { label: 'Screensaver', icon: ICONS.moon, run: () => router.screensaver() },
      { label: 'Favourites', icon: ICONS.star, run: () => router.push('favorites') },
      { label: 'Background', icon: ICONS.image, run: () => stage.next() },
      { label: 'Settings', icon: ICONS.settings, run: () => router.push('settings') },
    ];
    this.topButtons = this.topActions.map((a) => iconButton(a.icon, a.label));
    this.topButtons.forEach((b) => this.topBar.appendChild(b));

    this.root.appendChild(el('header.top', null, [el('div.top-left', null, [new Clock().root, this.weather.root]), this.topBar]));
    this.root.appendChild(el('div.hero', null, [this.heroTitle, this.heroSub]));
    this.root.appendChild(el('div.rows', null, [this.favRow.root, this.allRow.root]));
    this.root.appendChild(this.credit);
    stage.onChange = (b) => { this.credit.textContent = b.name + '  ·  ' + b.credit; };
    // A fresh start always lands on the first favourite; returning from an app resumes this same page, focus intact.
    this.buildFocus(null);
  }

  /** Renders instantly from the cached app list, then refreshes from the TV (slow: ~5.6 s) and re-renders if it changed. */
  async load(): Promise<{ cachedRender: boolean }> {
    const cached = cachedApps();
    if (cached) this.applyApps(cached);
    const fresh = await listApps();
    if (!cached || JSON.stringify(cached) !== JSON.stringify(fresh)) {
      cacheApps(fresh);
      this.applyApps(fresh);
    }
    return { cachedRender: !!cached };
  }

  /** Rebuild rows from settings (favourites, labels) without re-querying the TV. */
  refreshCatalog(): void { const c = cachedApps(); if (c) this.applyApps(c); }

  private applyApps(installed: InstalledApp[]): void {
    const keep = this.touched ? this.focus.pos : null;
    const c = buildCatalog(installed, settings.get(), currentAppId());
    this.favorites = c.favorites;
    this.others = SHORTCUTS.concat(c.others);
    this.favRow.setItems(this.favorites.map((a) => appCard(a, 'large')));
    this.allRow.setItems(this.others.map((a) => appCard(a, 'small')));
    this.buildFocus(keep);
  }

  private buildFocus(start: FocusPos | null): void {
    const top: ZoneSpec = {
      id: 'top', size: () => this.topButtons.length,
      centerX: (i) => { const r = this.topButtons[i].getBoundingClientRect(); return r.left + r.width / 2; },
    };
    this.focus = new FocusModel([top, this.favRow.zone(), this.allRow.zone()], start || { zone: 'fav', index: 0 });
    this.render();
  }

  private render(): void {
    const p = this.focus.pos;
    this.topButtons.forEach((b, i) => b.classList.toggle('focused', p.zone === 'top' && p.index === i));
    this.favRow.setFocus(p.zone === 'fav' ? p.index : null);
    this.allRow.setFocus(p.zone === 'all' ? p.index : null);
    // Updating the large hero text on every move halved the frame rate on the TV,
    // so it changes only once focus settles, after the card transition has finished.
    window.clearTimeout(this.heroTimer);
    this.heroTimer = window.setTimeout(() => this.updateHero(), 260);
  }

  private updateHero(): void {
    const p = this.focus.pos;
    const app = this.appAt(p);
    const title = app ? app.label : p.zone === 'top' ? this.topActions[p.index].label : '';
    const sub = app ? 'Press OK to open' : '';
    const key = title + '|' + sub;
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.heroTitle.textContent = title;
    this.heroSub.textContent = sub;
  }

  private appAt(p: FocusPos): AppEntry | null {
    return p.zone === 'fav' ? this.favorites[p.index] || null : p.zone === 'all' ? this.others[p.index] || null : null;
  }

  handle(intent: Intent): boolean {
    this.touched = true;
    switch (intent) {
      case 'up': case 'down': case 'left': case 'right':
        if (intent === 'down' && this.focus.pos.zone === 'top') {
          this.focus.set({ zone: 'fav', index: 0 }); // the top bar sits right-aligned; Down always means "back to my apps"
          this.render();
          return true;
        }
        if (this.focus.move(intent)) this.render();
        return true;
      case 'select': {
        const p = this.focus.pos;
        if (p.zone === 'top') { this.topActions[p.index].run(); return true; }
        const app = this.appAt(p);
        if (app) this.open(app);
        return true;
      }
      case 'back':
        // Home is the root: Back returns to the first favourite instead of exiting by accident.
        this.focus.set({ zone: 'fav', index: 0 });
        this.render();
        return true;
      default:
        return false;
    }
  }

  open(app: { id: string; label: string; shortcut?: unknown }): void {
    session.save({ focus: this.focus.pos, screen: 'home' });
    if (app.shortcut) { // a panel over the dashboard: nothing to return from
      launchApp(app.id).catch(() => this.router.toast(app.label + " couldn't be opened"));
      return;
    }
    this.router.toast('Opening ' + app.label + '…');
    this.reclaimer.expectReturn();
    this.watcher.arm(app.id)
      .then(() => launchApp(app.id))
      .catch(() => { this.watcher.disarm('launch-failed'); this.router.toast(app.label + " couldn't be opened"); });
  }

  private userAppIds(): Set<string> {
    const ids = new Set<string>();
    (cachedApps() || []).forEach((a) => ids.add(a.id));
    return ids;
  }

  saveState(): void { session.save({ focus: this.focus.pos, screen: 'home' }); }
}
