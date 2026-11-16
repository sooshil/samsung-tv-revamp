// "Return here when an app closes".
// Apps decide for themselves what Back does: some exit to Samsung's home screen, Netflix ignores it.
// We can't change that, but the dashboard stays alive in the background (multitasking.support), so it can
// watch for the app it launched to disappear from the running list and bring itself back to the front.
//
// When YouTube exits it returns to the dashboard by itself, but Samsung's home panel then sits on top of it for
// 20–30 s (owner's test). Bringing ourselves to the front dismisses that panel, so we do it even when the page
// already reports itself visible.
//
// Safety rules, so it never jumps over something the user chose:
//   - only for the app launched from the dashboard;
//   - stop as soon as the user presses a key in the dashboard (they're using it; no panel is covering it);
//   - if another user-visible app was started *well before* the launched app closed (picked from Samsung's
//     home bar), stand down. An app that starts at the moment ours closes is the TV's own fallback
//     (e.g. Samsung TV Plus after the Exit key), not the user's choice;
//   - give up if the launched app never shows up in the running list.
import { runningAppIds, bringToFront } from '../platform/tizen';
import { report } from '../platform/report';
import { onVisibility } from '../platform/lifecycle';

// Some apps run under a different process ID than their launch ID (measured with --selftest=ctx, 2026-11-15).
const PROCESS_ID: Record<string, string> = { '9Ur5IzDKqV.TizenYouTube': 'com.samsung.tv.cobalt-yt' };
// Apps the TV keeps running all the time: they never "close", so watching them can only misfire.
// Netflix stays in the running list before launch, after Exit, and after Back.
const NEVER_CLOSES = new Set(['org.tizen.netflix-app']);

const POLL_MS = 1500;
const APPEAR_TIMEOUT_MS = 20000;  // the launched app must show up in the running list within this time
const FALLBACK_WINDOW_MS = 4000;  // newcomers first seen this close to the close are the TV's fallback

export class ReturnWatcher {
  private target: string | null = null;
  private baseline = new Set<string>();
  private firstSeen: Record<string, number> = {};
  private seen = false;
  private armedAt = 0;
  private lastSeenAt = 0;
  private timer = 0;

  /** @param userApps IDs of user-visible apps; only these count as "the user opened something else". */
  constructor(private userApps: () => Set<string>, private enabled: () => boolean) {}

  async arm(appId: string): Promise<void> {
    this.disarm('rearm');
    if (!this.enabled() || NEVER_CLOSES.has(appId)) return;
    appId = PROCESS_ID[appId] || appId;
    let ids: Set<string>;
    try { ids = await runningAppIds(); } catch (e) { report('return', { err: String(e) }); return; }
    ids.delete(appId);
    this.baseline = ids;
    this.firstSeen = {};
    this.target = appId;
    this.seen = false;
    this.armedAt = Date.now();
    report('return', { armed: appId });
    this.timer = window.setInterval(() => { this.poll(); }, POLL_MS);
  }

  /** The user is interacting with the dashboard: nothing to bring back. */
  userActive(): void { if (this.target && this.seen) this.disarm('user-active'); }

  disarm(why: string): void {
    if (!this.target) return;
    window.clearInterval(this.timer);
    report('return', { disarmed: this.target, why, afterMs: Date.now() - this.armedAt });
    this.target = null;
  }

  private async poll(): Promise<void> {
    const target = this.target;
    if (!target) return;
    let ids: Set<string>;
    try { ids = await runningAppIds(); } catch (e) { return; }
    if (this.target !== target) return;
    const now = Date.now();
    const users = this.userApps();
    ids.forEach((id) => {
      if (id !== target && !this.baseline.has(id) && !(id in this.firstSeen)) {
        this.firstSeen[id] = now;
        if (users.has(id)) report('return', { newcomer: id });
      }
    });
    if (ids.has(target)) { this.seen = true; this.lastSeenAt = now; return; }
    if (!this.seen) {
      if (now - this.armedAt > APPEAR_TIMEOUT_MS) this.disarm('never-appeared');
      return;
    }
    // The app we launched has closed. Did the user start something else well before that?
    const chosen = Object.keys(this.firstSeen).filter((id) => users.has(id) && this.firstSeen[id] < this.lastSeenAt - FALLBACK_WINDOW_MS);
    const fallback = Object.keys(this.firstSeen).filter((id) => users.has(id) && chosen.indexOf(id) < 0);
    report('return', { closed: target, chosen, fallback, hidden: document.hidden });
    if (chosen.length) { this.disarm('user-opened-other'); return; }
    this.disarm('returning');
    bringToFront().then(
      () => report('return', { broughtToFront: true }),
      (e) => report('return', { broughtToFront: false, err: String(e) }),
    );
  }
}

// When an app hands the screen back to the dashboard (YouTube does on Back), Samsung's home panel can open on top
// of it and keep the remote's focus for 20–30 s. The panel holds window focus, so `document.hasFocus()` is false.
// Bringing ourselves to the front closes such a panel (measured with --selftest=panel using Quick Settings).
// Only runs right after returning from an app opened here, never after a shortcut panel the user asked for.
const RECLAIM_CHECKS_MS = [400, 1200, 2500, 4000, 6000];

export class FocusReclaimer {
  private armed = false;
  private keyPressed = false;
  private timers: number[] = [];

  constructor(private enabled: () => boolean) {
    onVisibility((v) => { if (v) this.onReturn(); else this.cancel(); });
  }

  /** Call when the dashboard opens an app (not a shortcut panel). */
  expectReturn(): void { this.armed = true; }
  /** Call on any key the dashboard receives. */
  userActive(): void { this.keyPressed = true; this.cancel(); }

  private onReturn(): void {
    if (!this.armed || !this.enabled()) return;
    this.armed = false;
    this.keyPressed = false;
    let tries = 0;
    RECLAIM_CHECKS_MS.forEach((ms) => this.timers.push(window.setTimeout(() => {
      if (this.keyPressed || document.hidden || document.hasFocus() || tries >= 3) return;
      tries++;
      report('reclaim', { atMs: ms, tries });
      bringToFront().catch(() => undefined);
    }, ms)));
  }

  private cancel(): void { this.timers.forEach((t) => window.clearTimeout(t)); this.timers = []; }
}
