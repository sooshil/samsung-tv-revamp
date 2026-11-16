// On-TV benchmark, compiled in only with `npm run build:bench`.
// Drives the real UI with synthetic remote keys and reports frame timing to the Mac listener.
import { memoryInfo } from './platform/tizen';
import { report } from './platform/report';
import type { BackgroundStage } from './services/backgrounds';



function press(code: number): void {
  const ev = new KeyboardEvent('keydown', { bubbles: true });
  Object.defineProperty(ev, 'keyCode', { get: () => code });
  document.dispatchEvent(ev);
}

export function measure(ms: number): Promise<{ fps: number; worstMs: number; over33: number; frames: number }> {
  return new Promise((resolve) => {
    let frames = 0, over = 0, worst = 0, start = 0, last = 0;
    const step = (now: number): void => {
      if (!start) { start = last = now; }
      else { const d = now - last; if (d > worst) worst = d; if (d > 33.4) over++; last = now; frames++; }
      if (now - start < ms) requestAnimationFrame(step);
      else resolve({ fps: Math.round((frames * 1000) / (now - start)), worstMs: Math.round(worst), over33: over, frames });
    };
    requestAnimationFrame(step);
  });
}

function sequence(codes: number[], gap: number): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const t = window.setInterval(() => { if (i >= codes.length) { window.clearInterval(t); resolve(); } else press(codes[i++]); }, gap);
  });
}

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const R = 39, L = 37, U = 38, D = 40;

export async function runBench(info: { scriptStartMs: number; firstPaintMs: number; cachedRender: boolean; appsReadyMs: number; stage: BackgroundStage }): Promise<void> {
  report('startup', { scriptStartMs: info.scriptStartMs, firstPaintMs: info.firstPaintMs, cachedRender: info.cachedRender, appsReadyMs: info.appsReadyMs, memory: memoryInfo() });
  await wait(3000);
  report('idle', await measure(2000));

  const nav = [R, R, R, R, D, R, R, R, R, R, R, R, R, R, R, R, R, U, L, L, L, L, U, D];
  const m1 = measure(nav.length * 180 + 400);
  await sequence(nav, 180);
  report('navigate-180ms', await m1);

  const fast = [R, R, R, R, R, R, R, R, L, L, L, L, L, L, L, L];
  const m2 = measure(fast.length * 90 + 400);
  await sequence([D].concat(fast), 90);
  report('navigate-90ms-held', await m2);

  await wait(1000);
  const m3 = measure(2500);
  info.stage.next();
  report('background-crossfade', await m3);

  await wait(2500);
  report('memory-after', memoryInfo());
  press(U); press(U); press(U); press(D); press(37); // settle back on the first favourite
  report('done', true);
}
