import type { Intent } from '../platform/keys';

export interface Screen {
  readonly root: HTMLElement;
  /** Return true when the intent was consumed. */
  handle(intent: Intent): boolean;
  onShow?(): void;
}

export interface Router {
  push(name: 'settings' | 'favorites'): void;
  pop(): void;
  toast(msg: string): void;
  screensaver(): void;
}
