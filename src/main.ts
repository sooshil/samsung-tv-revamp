import { el } from './components/dom';
import { Toast } from './components/toast';
import { BackgroundStage } from './services/backgrounds';
import { HomeScreen } from './screens/home';
import { SettingsScreen } from './screens/settings';
import { FavoritesScreen } from './screens/favorites';
import type { Router, Screen } from './screens/screen';
import { intentFor, REGISTERED_KEYS } from './platform/keys';
import { registerKeys, exitApp } from './platform/tizen';
import { onVisibility } from './platform/lifecycle';
import { settings } from './settings/store';
import { runBench, measure } from './bench';
import { memoryInfo, setSystemScreensaver, launchApp, bringToFront, runningAppIds } from './platform/tizen';
import { Screensaver, IdleTimer } from './services/screensaver';
import { WeatherService } from './services/weather';
import { WeatherWidget } from './components/weatherWidget';
import { report } from './platform/report';


const t0 = performance.now();
const root = document.getElementById('root') as HTMLElement;
const stage = new BackgroundStage();
const toast = new Toast();
const layer = el('div.screens');
root.appendChild(stage.root);
root.appendChild(layer);
root.appendChild(toast.root);
const saver = new Screensaver();
root.appendChild(saver.root);

const stack: Screen[] = [];
let settingsScreen: SettingsScreen | null = null;
let favoritesScreen: FavoritesScreen | null = null;

const router: Router = {
  push(name) {
    if (name === 'settings') {
      settingsScreen = settingsScreen || new SettingsScreen(router);
      show(settingsScreen);
    } else if (name === 'favorites') {
      favoritesScreen = favoritesScreen || new FavoritesScreen(router);
      show(favoritesScreen);
    }
  },
  pop() {
    if (stack.length < 2) return;
    const top = stack.pop() as Screen;
    top.root.classList.remove('active');
    const under = stack[stack.length - 1];
    under.root.classList.add('active');
    if (under.onShow) under.onShow();
  },
  toast: (m) => toast.show(m),
  screensaver: () => saver.start(),
};
const idle = new IdleTimer(() => settings.get().screensaverMinutes, () => router.screensaver());

function show(s: Screen): void {
  if (stack.length) stack[stack.length - 1].root.classList.remove('active');
  if (!s.root.parentNode) layer.appendChild(s.root);
  stack.push(s);
  s.root.classList.add('active');
  if (s.onShow) s.onShow();
}

function applySettings(): void {
  const s = settings.get();
  document.body.classList.toggle('reduced-motion', s.animations === 'reduced');
  document.body.setAttribute('data-theme', s.theme);
}

const home = new HomeScreen(router, stage);
show(home);
applySettings();
stage.setMode(settings.get().backgroundId);
const weather = new WeatherService(() => { const s = settings.get(); return { enabled: s.weatherEnabled, place: s.weatherPlace, units: s.weatherUnits }; });
weather.onChange((w) => home.weather.render(w));
saver.weatherText = () => WeatherWidget.short(weather.current());
settings.onChange((s) => { applySettings(); stage.setMode(s.backgroundId); home.refreshCatalog(); weather.reconfigure(); });

document.addEventListener('keydown', (e) => {
  const intent = intentFor(e);
  e.preventDefault(); // never let the page scroll or the engine act on keys
  idle.poke();
  home.watcher.userActive();
  home.reclaimer.userActive();
  if (saver.active) { if (intent !== 'exit') { saver.stop(); return; } saver.stop(); }
  if (!intent) return;
  if (intent === 'exit') { home.saveState(); exitApp(); return; }
  stack[stack.length - 1].handle(intent);
});

onVisibility((visible) => { if (!visible) home.saveState(); });
registerKeys(REGISTERED_KEYS);
if (__DESKTOP__ && location.hash.indexOf('#keys=') === 0) { // desktop preview only: scripted key presses for screenshots
  const codes: Record<string, number> = { u: 38, d: 40, l: 37, r: 39, o: 13, b: 8 };
  location.hash.slice(6).split('').forEach((k, i) => window.setTimeout(() => {
    const ev = new KeyboardEvent('keydown', { bubbles: true });
    Object.defineProperty(ev, 'keyCode', { get: () => codes[k] });
    document.dispatchEvent(ev);
  }, 800 + i * 150));
}
weather.start();

const firstPaintMs = Math.round(performance.now()); // shell + cached apps are in the DOM at this point
home.load()
  .then((r) => {
    const ready = Math.round(performance.now() - t0);
    if (__SELFTEST__ === 'return') {
      report('instance', { coldStart: true, at: new Date().toISOString() });
      if (sessionStorage.getItem('selftestDone')) return;
      sessionStorage.setItem('selftestDone', '1');
      onVisibility((v) => report('visibility', { visible: v }));
      window.setTimeout(() => home.open({ id: 'tvrvmprobe.Probe', label: 'Probe' }), 4000);
    }
    if (__SELFTEST__ === 'weather') window.setTimeout(() => report('weather', { current: weather.current(), shown: !home.weather.root.classList.contains('empty') }), 8000);
    if (__SELFTEST__ === 'launchers') {
      const T = (window as unknown as { tizen: { application: { getAppInfo(id: string): { name: string; show: boolean; iconPath: string } } } }).tizen;
      const ids = ['com.samsung.tv.coba.setting', 'org.tizen.homesetting', 'com.samsung.tv.quickpanel', 'org.tizen.btaudiolist',
        'com.samsung.tv.coba.setting.devicemanager', 'org.tizen.volume-setting'];
      const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      (async () => {
        await wait(3000);
        for (const id of ids) {
          let info: unknown; try { const i = T.application.getAppInfo(id); info = { name: i.name, show: i.show, icon: i.iconPath }; } catch (e) { info = String(e); }
          let blurred = false; const onBlur = () => { blurred = true; }; window.addEventListener('blur', onBlur);
          let launched: string;
          try { await launchApp(id); launched = 'ok'; } catch (e) { launched = String(e); }
          await wait(5000);
          report('launcher', { id, info, launched, tookScreen: document.hidden, tookFocus: blurred, focusedNow: document.hasFocus() }); window.removeEventListener('blur', onBlur);
          await bringToFront().catch(() => undefined);
          await wait(3000);
        }
        report('launcher', { done: true });
      })();
    }
    if (__SELFTEST__ === 'ctx') {
      const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      (async () => {
        await wait(3000);
        for (const id of ['9Ur5IzDKqV.TizenYouTube', 'org.tizen.netflix-app']) {
          const before = await runningAppIds();
          await launchApp(id).catch(() => undefined);
          await wait(9000);
          const after = await runningAppIds();
          report('ctx', { id, wasRunning: before.has(id), isRunning: after.has(id), all: Array.from(after), added: Array.from(after).filter((x) => !before.has(x)), removed: Array.from(before).filter((x) => !after.has(x)), hidden: document.hidden });
          await bringToFront().catch(() => undefined);
          await wait(3000);
        }
        report('ctx', { done: true });
      })();
    }
    if (__SELFTEST__ === 'panel') {
      const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
      (async () => {
        await wait(3000);
        await launchApp('com.samsung.tv.quickpanel').catch(() => undefined);
        await wait(3000);
        const a = document.hasFocus();
        window.focus(); await wait(1000);
        const b = document.hasFocus();
        await bringToFront().catch(() => undefined); await wait(1500);
        const c = document.hasFocus();
        report('panel', { panelUp_hasFocus: a, afterWindowFocus: b, afterBringToFront: c });
      })();
    }
    if (__SELFTEST__ === 'reclaim') {
      if (sessionStorage.getItem('selftestDone')) return;
      sessionStorage.setItem('selftestDone', '1');
      settings.update({ returnAfterApp: true });
      let fired = false;
      onVisibility((v) => {
        report('visibility', { visible: v, hasFocus: document.hasFocus() });
        if (v && !fired) { fired = true; window.setTimeout(() => { launchApp('com.samsung.tv.quickpanel').catch(() => undefined); }, 50); }
      });
      window.setTimeout(() => home.open({ id: 'tvrvmprobe.Probe', label: 'Probe' }), 3000);
      window.setTimeout(() => report('reclaimDone', { hasFocus: document.hasFocus(), hidden: document.hidden }), 30000);
    }
    if (__SELFTEST__ === 'saver') {
      window.setTimeout(async () => {
        const before = memoryInfo();
        router.screensaver();
        const runs = [];
        for (let i = 0; i < 4; i++) runs.push(await measure(12000)); // spans a photo change (40 s) and clock moves
        const rect = (q: string) => { const e = document.querySelector(q) as HTMLElement | null; if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
        const cap = () => ({ name: (document.querySelector('.saver-cap-name') as HTMLElement).textContent, credit: (document.querySelector('.saver-cap-credit') as HTMLElement).textContent, opacity: getComputedStyle(document.querySelector('.saver-caption') as HTMLElement).opacity, rect: rect('.saver-caption'), photo: rect('.saver-photo.visible') });
        const c1 = cap();
        await new Promise((r) => window.setTimeout(r, 4000));
        report('saverCaption', { first: c1, later: cap() });
        report('saver', { runs, memBefore: before, memDuring: memoryInfo(), holdOff: setSystemScreensaver(false), holdOn: setSystemScreensaver(true), weatherLine: WeatherWidget.short(weather.current()) });
        saver.stop();
      }, 3000);
    }
    if (__BENCH__) runBench({ scriptStartMs: Math.round(t0), firstPaintMs, cachedRender: r.cachedRender, appsReadyMs: ready, stage });
  })
  .catch((e) => toast.show('Could not read installed apps: ' + (e && e.message)));
