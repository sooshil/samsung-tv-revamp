import { el } from '../components/dom';
import { FocusModel } from '../navigation/focus';
import { settings, Settings } from '../settings/store';
import { photos } from '../services/backgrounds';
import { exitApp, memoryInfo } from '../platform/tizen';
import type { Intent } from '../platform/keys';
import type { Router, Screen } from './screen';


interface Choice<T> { label: string; value: T; }
interface Item {
  label: string;
  hint?: string;
  choices?: Choice<unknown>[] | (() => Choice<unknown>[]);
  get?: (s: Settings) => unknown;
  set?: (v: unknown) => void;
  action?: () => void;
}

const ROW_PITCH = 118;  // row height 104 + gap 14, see .setting in index.css
const VISIBLE_ROWS = 6;
const MB = (n: number): string => Math.round(n / 1048576) + ' MB';

export class SettingsScreen implements Screen {
  readonly root = el('div.screen.settings');
  private list = el('div.settings-list');
  private viewport = el('div.settings-viewport', null, [this.list]);
  private rows: HTMLElement[] = [];
  private items: Item[];
  private focus: FocusModel;

  constructor(private router: Router) {
    this.items = [
      {
        label: 'Photos', hint: 'For the background and the screensaver',
        choices: [{ label: 'Nepal', value: 'nepal' }, { label: 'Nature', value: 'nature' }, { label: 'Nepal and nature', value: 'all' }],
        get: (s) => s.photoSet, set: (v) => settings.update({ photoSet: v as Settings['photoSet'], backgroundId: 'rotate' }),
      },
      {
        label: 'Background', choices: () => [{ label: 'Rotate every 5 min', value: 'rotate' }].concat(photos().map((b) => ({ label: b.name, value: b.id }))),
        get: (s) => s.backgroundId, set: (v) => settings.update({ backgroundId: v as string }),
      },
      {
        label: 'Animations', choices: [{ label: 'Full', value: 'full' }, { label: 'Reduced', value: 'reduced' }],
        get: (s) => s.animations, set: (v) => settings.update({ animations: v as Settings['animations'] }),
      },
      {
        label: 'Weather', hint: (() => { const p = settings.get().weatherPlace; return p ? p.name + '  ·  Open-Meteo' : 'No location set'; })(),
        choices: [{ label: 'On', value: true }, { label: 'Off', value: false }],
        get: (s) => s.weatherEnabled, set: (v) => settings.update({ weatherEnabled: v as boolean }),
      },
      {
        label: 'Temperature', choices: [{ label: '°F', value: 'F' }, { label: '°C', value: 'C' }],
        get: (s) => s.weatherUnits, set: (v) => settings.update({ weatherUnits: v as 'F' | 'C' }),
      },
      {
        label: 'When an app closes', hint: 'Bring this dashboard back instead of Samsung\u2019s home screen',
        choices: [{ label: 'Come back here', value: true }, { label: 'Samsung home', value: false }],
        get: (s) => s.returnAfterApp, set: (v) => settings.update({ returnAfterApp: v as boolean }),
      },
      {
        label: 'Screensaver after', hint: 'Starts when the remote is idle on this screen',
        choices: [0, 5, 10, 20, 30].map((m) => ({ label: m ? m + ' minutes' : 'Off', value: m })),
        get: (s) => s.screensaverMinutes, set: (v) => settings.update({ screensaverMinutes: v as number }),
      },
      { label: 'Edit favourites', hint: 'Add, remove and reorder the big tiles', action: () => router.push('favorites') },
      { label: 'Reset dashboard settings', action: () => { settings.reset(); this.refresh(); router.toast('Settings reset'); } },
      { label: 'Exit dashboard', hint: 'Returns to the Samsung home screen', action: () => exitApp() },
    ];
    this.root.appendChild(el('h1.settings-title', null, ['Settings']));
    this.root.appendChild(this.viewport);
    this.root.appendChild(el('div.settings-about', null, [this.about()]));
    this.items.forEach((it) => {
      const value = el('div.setting-value');
      const row = el('div.setting', null, [el('div.setting-text', null, [el('div.setting-label', null, [it.label]), it.hint ? el('div.setting-hint', null, [it.hint]) : null]), value]);
      this.rows.push(row);
      this.list.appendChild(row);
    });
    // One zone per row: up/down moves between rows; left/right changes the value.
    this.focus = new FocusModel(this.items.map((_, i) => ({ id: 'r' + i, size: () => 1, centerX: () => 0 })));
    this.refresh();
  }

  onShow(): void { this.focus.set({ zone: 'r0', index: 0 }); this.refresh(); }

  private about(): string {
    const m = memoryInfo();
    return 'Dashboard v' + __VERSION__ + (m ? '  ·  Memory ' + MB(m.available) + ' free of ' + MB(m.total) : '') + '  ·  Photos: Unsplash, Wikimedia Commons';
  }

  private refresh(): void {
    const s = settings.get();
    const cur = Number(this.focus.pos.zone.slice(1));
    this.items.forEach((it, i) => {
      const valueEl = this.rows[i].querySelector('.setting-value') as HTMLElement;
      const choices = it.choices ? (typeof it.choices === 'function' ? it.choices() : it.choices) : null;
      if (choices && it.get) {
        const v = it.get(s);
        const c = choices.find((x) => x.value === v);
        valueEl.textContent = (i === cur ? '‹  ' : '') + (c ? c.label : String(v)) + (i === cur ? '  ›' : '');
      } else valueEl.textContent = i === cur ? 'OK' : '';
      this.rows[i].classList.toggle('focused', i === cur);
    });
    // Scroll so the focused row stays inside the window (the list is taller than the screen).
    const first = Math.max(0, Math.min(cur - Math.floor(VISIBLE_ROWS / 2), this.items.length - VISIBLE_ROWS));
    this.list.style.transform = 'translate3d(0,' + -first * ROW_PITCH + 'px,0)';
  }

  handle(intent: Intent): boolean {
    const i = Number(this.focus.pos.zone.slice(1));
    const it = this.items[i];
    switch (intent) {
      case 'up': case 'down':
        if (this.focus.move(intent)) this.refresh();
        return true;
      case 'left': case 'right': {
        const choices = it.choices ? (typeof it.choices === 'function' ? it.choices() : it.choices) : null;
        if (!choices || !it.get || !it.set) return true;
        const idx = choices.findIndex((c) => c.value === it.get!(settings.get()));
        // Cycles: past the last option comes the first, and before the first comes the last.
        const next = (idx + (intent === 'left' ? -1 : 1) + choices.length) % choices.length;
        if (next !== idx) { it.set(choices[next].value); this.refresh(); }
        return true;
      }
      case 'select':
        if (it.action) it.action();
        return true;
      case 'back':
        this.router.pop();
        return true;
      default:
        return false;
    }
  }
}
