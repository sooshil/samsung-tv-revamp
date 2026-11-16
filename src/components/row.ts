// Horizontal row of cards. Scrolls its track with a compositor-only transform; no native scrolling.
import { el } from './dom';
import type { ZoneSpec } from '../navigation/focus';

export const SAFE_X = 96;
const VIEW_W = 1920;

export interface RowOptions { id: string; title?: string; cardW: number; gap: number; className: string; }

export class Row {
  readonly root: HTMLElement;
  readonly track = el('div.row-track');
  private items: HTMLElement[] = [];
  private offset = 0;
  private focused = -1;

  constructor(private opts: RowOptions) {
    this.root = el('section.row.' + opts.className, null, [opts.title ? el('h2.row-title', null, [opts.title]) : null, this.track]);
  }

  setItems(nodes: HTMLElement[]): void {
    this.track.innerHTML = '';
    this.items = nodes;
    nodes.forEach((n) => this.track.appendChild(n));
    this.root.style.display = nodes.length ? '' : 'none';
    this.offset = 0;
    this.focused = -1;
    this.track.style.transform = 'translate3d(0,0,0)';
  }

  get size(): number { return this.items.length; }

  /** Rendered x-centre on screen, accounting for the current scroll offset. */
  centerX(i: number): number { return SAFE_X + i * (this.opts.cardW + this.opts.gap) + this.opts.cardW / 2 - this.offset; }

  zone(): ZoneSpec { return { id: this.opts.id, size: () => this.size, centerX: (i) => this.centerX(i) }; }

  setFocus(i: number | null): void {
    if (this.focused >= 0 && this.items[this.focused]) this.items[this.focused].classList.remove('focused');
    this.focused = i === null ? -1 : i;
    if (i === null || !this.items[i]) return;
    this.items[i].classList.add('focused');
    this.scrollTo(i);
  }

  private scrollTo(i: number): void {
    const step = this.opts.cardW + this.opts.gap;
    const left = SAFE_X + i * step - this.offset;
    const right = left + this.opts.cardW;
    const peek = step * 0.6; // keep part of the next card visible so it's clear the row continues
    let next = this.offset;
    if (right > VIEW_W - SAFE_X - (i < this.size - 1 ? peek : 0)) next += right - (VIEW_W - SAFE_X - (i < this.size - 1 ? peek : 0));
    if (left < SAFE_X) next -= SAFE_X - left;
    if (next !== this.offset) {
      this.offset = Math.max(0, next);
      this.track.style.transform = `translate3d(${-this.offset}px,0,0)`;
    }
  }
}
