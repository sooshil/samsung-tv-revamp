// Full-screen background photography with slow CSS crossfades.
// Two layers only: the visible one and the incoming one (RAM is tight: ~190 MB free on this TV).
import { el } from '../components/dom';
import { onVisibility } from '../platform/lifecycle';

import { NEPAL } from './nepalPhotos';
import { settings } from '../settings/store';
import { Deck } from './shuffle';

export type PhotoSet = 'nepal' | 'nature';
export interface Background { id: string; name: string; file: string; set: PhotoSet; credit: string; }

const NATURE: Omit<Background, 'set' | 'credit'>[] = [
  { id: 'starlight', name: 'Starlight', file: 'assets/backgrounds/starlight.jpg' },
  { id: 'alpine-dusk', name: 'Alpine Dusk', file: 'assets/backgrounds/alpine-dusk.jpg' },
  { id: 'highlands', name: 'Highlands', file: 'assets/backgrounds/highlands.jpg' },
  { id: 'forest', name: 'Forest', file: 'assets/backgrounds/forest.jpg' },
  { id: 'lago', name: 'Lago di Braies', file: 'assets/backgrounds/lago.jpg' },
  { id: 'yukon', name: 'Yukon', file: 'assets/backgrounds/yukon.jpg' },
  { id: 'ocean', name: 'Ocean', file: 'assets/backgrounds/ocean.jpg' },
  { id: 'yosemite', name: 'Yosemite', file: 'assets/backgrounds/yosemite.jpg' },
  { id: 'forest-light', name: 'Forest Light', file: 'assets/backgrounds/forest-light.jpg' },
  { id: 'falls', name: 'Waterfall', file: 'assets/backgrounds/falls.jpg' },
  { id: 'meadow', name: 'Meadow at Dusk', file: 'assets/backgrounds/meadow.jpg' },
  { id: 'rainforest', name: 'Rainforest Bridge', file: 'assets/backgrounds/rainforest.jpg' },
  { id: 'misty-woods', name: 'Misty Woods', file: 'assets/backgrounds/misty-woods.jpg' },
  { id: 'valley', name: 'Green Valley', file: 'assets/backgrounds/valley.jpg' },
  { id: 'lake-cabin', name: 'Lake Cabin', file: 'assets/backgrounds/lake-cabin.jpg' },
  { id: 'fairy-glen', name: 'Fairy Glen', file: 'assets/backgrounds/fairy-glen.jpg' },
  { id: 'forest-river', name: 'Forest River', file: 'assets/backgrounds/forest-river.jpg' },
  { id: 'forest-road', name: 'Forest Road', file: 'assets/backgrounds/forest-road.jpg' },
  { id: 'lone-tree', name: 'Lone Tree', file: 'assets/backgrounds/lone-tree.jpg' },
  { id: 'forest-lake', name: 'Forest Lake', file: 'assets/backgrounds/forest-lake.jpg' },
  { id: 'blue-ridges', name: 'Blue Ridges', file: 'assets/backgrounds/blue-ridges.jpg' },
  { id: 'green-hills', name: 'Green Hills', file: 'assets/backgrounds/green-hills.jpg' },
  { id: 'green-canyon', name: 'Green Canyon', file: 'assets/backgrounds/green-canyon.jpg' },
  { id: 'valley-river', name: 'Valley River', file: 'assets/backgrounds/valley-river.jpg' },
  { id: 'pine-ridge', name: 'Pine Ridge', file: 'assets/backgrounds/pine-ridge.jpg' },
  { id: 'old-tree', name: 'Old Tree', file: 'assets/backgrounds/old-tree.jpg' },
  { id: 'lavender-lake', name: 'Lavender Lake', file: 'assets/backgrounds/lavender-lake.jpg' },
  { id: 'foggy-valley', name: 'Foggy Valley', file: 'assets/backgrounds/foggy-valley.jpg' },
];

export const BACKGROUNDS: Background[] = NATURE.map((b) => ({ ...b, set: 'nature' as PhotoSet, credit: 'Unsplash' })).concat(NEPAL);

/** Photos in the set chosen in Settings (Nepal, Nature, or both). */
export function photos(): Background[] {
  const set = settings.get().photoSet;
  const list = set === 'all' ? BACKGROUNDS : BACKGROUNDS.filter((b) => b.set === set);
  return list.length ? list : BACKGROUNDS;
}

const ROTATE_MS = 5 * 60 * 1000;

export class BackgroundStage {
  readonly root = el('div.bg-stage');
  private layers = [el('div.bg-layer'), el('div.bg-layer')];
  private front = 0;
  private index = 0;
  private timer = 0;
  private mode: string = 'rotate';
  private deck = new Deck();
  onChange: (b: Background) => void = () => undefined;

  constructor() {
    this.layers.forEach((l) => this.root.appendChild(l));
    this.root.appendChild(el('div.bg-scrim'));
    onVisibility((v) => (v ? this.schedule() : this.stop()));
  }

  get current(): Background { const l = photos(); return l[this.index % l.length]; }

  /** mode: a background id, or 'rotate'. */
  setMode(mode: string): void {
    this.mode = mode;
    this.deck.reset();
    const list = photos();
    const fixed = list.findIndex((b) => b.id === mode);
    this.show(fixed >= 0 ? fixed : this.index % list.length, true);
    this.schedule();
  }

  /** Next photo in shuffled order (every photo once before any repeats). */
  next(): void { this.show(this.deck.draw(photos().length), false); }

  private show(i: number, instant: boolean): void {
    this.index = i;
    const b = photos()[i];
    const img = new Image();
    img.onload = () => {
      const incoming = this.layers[1 - this.front];
      const outgoing = this.layers[this.front];
      incoming.style.backgroundImage = `url("${b.file}")`;
      incoming.classList.toggle('instant', instant);
      outgoing.classList.toggle('instant', instant);
      // Let the decode settle for one frame before starting the compositor-only opacity transition.
      requestAnimationFrame(() => {
        incoming.classList.add('visible');
        outgoing.classList.remove('visible');
        this.front = 1 - this.front;
        // Drop the old image after the fade so only one full-screen bitmap stays decoded.
        window.setTimeout(() => { if (!outgoing.classList.contains('visible')) outgoing.style.backgroundImage = ''; }, 2000);
      });
      this.onChange(b);
    };
    img.src = b.file;
  }

  private schedule(): void {
    this.stop();
    if (this.mode === 'rotate') this.timer = window.setInterval(() => this.next(), ROTATE_MS);
  }

  private stop(): void { window.clearInterval(this.timer); }
}
