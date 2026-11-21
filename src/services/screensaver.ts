// In-app screensaver: slow pan-and-zoom photography with a drifting clock.
// Runs only inside the dashboard. The TV's own screensaver can't be replaced (docs/technical-feasibility.md).
// While ours is showing, the TV's own screensaver is held off (webapis.appcommon.setScreenSaver) and handed back
// when ours ends or the dashboard is hidden. Approved by the owner on 2026-11-15.
//
// Burn-in care: nothing static. Photos change every 40 s, and the clock fades out and moves to a new spot
// every 60 s. Only opacity and transform animate (measured rule, docs/performance.md).
import { el } from '../components/dom';
import { photos } from './backgrounds';
import { Deck } from './shuffle';
import { setSystemScreensaver } from '../platform/tizen';
import { onVisibility } from '../platform/lifecycle';

const HOLD_TV_SCREENSAVER = true; // approved by the owner 2026-11-15
const PHOTO_MS = __SELFTEST__ === 'saver' ? 12000 : 40000;
const CLOCK_MS = 60000;
const FADE_MS = 2000; // must match the opacity transition on .saver-photo.top in index.css
// Clock anchor spots (left, top) inside the 1920×1080 screen, spread so no pixel stays lit by the clock.
const SPOTS: [number, number][] = [[140, 120], [1180, 140], [160, 780], [1140, 760], [640, 420], [220, 460], [1200, 460]];
const PANS = ['pan-a', 'pan-b', 'pan-c', 'pan-d'];

export class Screensaver {
  readonly root = el('div.saver');
  private layers = [el<HTMLImageElement>('img.saver-photo', { alt: '' }), el<HTMLImageElement>('img.saver-photo', { alt: '' })];
  private clock = el('div.saver-clock');
  private time = el('div.saver-time');
  private date = el('div.saver-date');
  private weather = el('div.saver-weather');
  // Caption: a separate layer, so it stays still while the photo drifts.
  private capName = el('div.saver-cap-name');
  private capCredit = el('div.saver-cap-credit');
  private caption = el('div.saver-caption', null, [this.capName, this.capCredit]);
  weatherText: () => string = () => '';
  private front = 0;
  private photo = 0;
  private deck = new Deck();
  private spot = 0;
  private timers: number[] = [];
  active = false;

  constructor() {
    this.layers.forEach((l) => this.root.appendChild(l));
    this.root.appendChild(el('div.saver-scrim'));
    this.clock.appendChild(this.time);
    this.clock.appendChild(this.date);
    this.clock.appendChild(this.weather);
    this.root.appendChild(this.clock);
    this.root.appendChild(this.caption);
    onVisibility((v) => { if (!v) this.stop(); });
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.deck.reset();
    this.photo = this.deck.draw(photos().length);
    this.root.classList.add('on');
    document.body.classList.add('saver-on'); // lets the dashboard underneath drop its layers
    if (HOLD_TV_SCREENSAVER) setSystemScreensaver(false);
    this.showPhoto();
    this.tickClock(true);
    this.timers.push(window.setInterval(() => { this.photo = this.deck.draw(photos().length); this.showPhoto(); }, PHOTO_MS));
    this.timers.push(window.setInterval(() => this.tickClock(false), CLOCK_MS));
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.timers.forEach((t) => window.clearInterval(t));
    this.timers = [];
    this.root.classList.remove('on');
    this.caption.classList.remove('shown');
    document.body.classList.remove('saver-on');
    if (HOLD_TV_SCREENSAVER) setSystemScreensaver(true);
    // Free the decoded photos once the fade-out is done.
    window.setTimeout(() => { if (!this.active) this.layers.forEach((l) => { l.removeAttribute('src'); l.className = 'saver-photo'; }); }, 700);
  }

  private showPhoto(): void {
    const list = photos();
    const b = list[this.photo % list.length];
    const incoming = this.layers[1 - this.front];
    const outgoing = this.layers[this.front];
    const pan = PANS[this.photo % PANS.length];
    incoming.className = 'saver-photo';              // reset to the start of a pan, no transition
    incoming.src = b.file;
    // Decode off the main thread before it goes on screen (a plain swap stalled the TV for 3 s, measured).
    const ready = typeof incoming.decode === 'function' ? incoming.decode() : Promise.resolve();
    ready.catch(() => undefined).then(() => {
      if (!this.active) return;
      requestAnimationFrame(() => {
        // True crossfade: the new photo fades in ON TOP of the old one, which stays fully opaque (and keeps
        // drifting) underneath. Fading both at once dips to ~75% coverage and lets the black backdrop show.
        outgoing.classList.add('under');
        incoming.className = 'saver-photo visible top ' + pan;
        this.setCaption(b.name, b.credit);
        this.front = 1 - this.front;
        // Once the new photo is fully opaque the old one is hidden behind it: drop it and free its bitmap.
        window.setTimeout(() => {
          if (this.front === 1 - this.layers.indexOf(outgoing)) {
            outgoing.className = 'saver-photo';
            outgoing.removeAttribute('src');
          }
        }, FADE_MS + 200);
      });
    });
  }

  /** Fades the old caption out, swaps the text while it is invisible, and fades the new one in. */
  private setCaption(name: string, credit: string): void {
    this.caption.classList.remove('shown');
    window.setTimeout(() => {
      if (!this.active) return;
      this.capName.textContent = name;
      this.capCredit.textContent = credit;
      this.caption.classList.add('shown');
    }, 900);
  }

  private tickClock(first: boolean): void {
    const now = new Date();
    const place = (): void => {
      this.time.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      this.date.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      this.weather.textContent = this.weatherText();
      this.spot = (this.spot + 1 + Math.floor(Math.random() * (SPOTS.length - 1))) % SPOTS.length;
      const [x, y] = SPOTS[this.spot];
      this.clock.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      this.clock.classList.add('shown');
    };
    if (first) { place(); return; }
    this.clock.classList.remove('shown');
    window.setTimeout(place, 900); // move while invisible
  }
}

/** Starts the screensaver after `minutes()` without remote input while the dashboard is on screen. */
export class IdleTimer {
  private last = Date.now();
  constructor(private minutes: () => number, private fire: () => void) {
    window.setInterval(() => this.check(), 15000);
    onVisibility((v) => { if (v) this.poke(); });
  }
  poke(): void { this.last = Date.now(); }
  private check(): void {
    const m = this.minutes();
    if (m > 0 && !document.hidden && Date.now() - this.last >= m * 60000) { this.poke(); this.fire(); }
  }
}
