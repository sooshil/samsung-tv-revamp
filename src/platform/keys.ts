// Normalises remote and keyboard input into a small set of intents.
export type Intent = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'exit' | 'info' | 'red' | 'green' | 'yellow' | 'blue';

const CODES: Record<number, Intent> = {
  37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'select',
  10009: 'back', 8: 'back',          // Back on the remote; Backspace on desktop
  10182: 'exit', 27: 'exit',         // Exit on the remote; Escape on desktop
  457: 'info', 73: 'info',           // Info; "i" on desktop
  403: 'red', 404: 'green', 405: 'yellow', 406: 'blue',
};

/** Keys outside the default set that we ask Tizen to deliver to us. */
export const REGISTERED_KEYS = ['Info', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'];

export function intentFor(e: KeyboardEvent): Intent | null {
  return CODES[e.keyCode] || null;
}
