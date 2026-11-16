import { el } from './dom';

export class Toast {
  readonly root = el('div.toast');
  private timer = 0;
  show(msg: string, ms = 2600): void {
    this.root.textContent = msg;
    this.root.classList.add('visible');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.root.classList.remove('visible'), ms);
  }
}
