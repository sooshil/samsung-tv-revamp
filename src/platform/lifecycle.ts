// Pause/resume bus driven by page visibility (fires when another app takes the screen and when we come back).
type Listener = (visible: boolean) => void;
const listeners: Listener[] = [];

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const visible = !document.hidden;
    listeners.forEach((l) => l(visible));
  });
}

export function onVisibility(l: Listener): void { listeners.push(l); }
export function isVisible(): boolean { return typeof document === 'undefined' || !document.hidden; }
