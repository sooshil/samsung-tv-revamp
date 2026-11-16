// Date/time header. Ticks once per minute on the minute boundary; paused while hidden.
import { el } from './dom';
import { onVisibility } from '../platform/lifecycle';

export function greeting(h: number): string {
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export class Clock {
  readonly root = el('div.clock');
  private time = el('div.clock-time');
  private date = el('div.clock-date');
  private timer = 0;

  constructor() {
    this.root.appendChild(this.time);
    this.root.appendChild(this.date);
    this.tick();
    onVisibility((v) => (v ? this.tick() : window.clearTimeout(this.timer)));
  }

  private tick(): void {
    window.clearTimeout(this.timer);
    const now = new Date();
    this.time.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    this.date.textContent = greeting(now.getHours()) + '  ·  ' + now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    this.timer = window.setTimeout(() => this.tick(), 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }
}
