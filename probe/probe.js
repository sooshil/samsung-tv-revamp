/* TV Revamp diagnostic probe. ES5 only: runs on any Tizen web engine version.
 * Read-only: it gathers info, and launches apps only when the user presses a button. */
(function () {
  'use strict';
  var RECEIVER = 'http://__MAC_IP__:8765/report'; // filled in by scripts/deploy.sh
  var t0 = Date.now();
  var logEl = document.getElementById('log');
  var statusEl = document.getElementById('status');

  function log(s) { logEl.textContent = (s + '\n' + logEl.textContent).slice(0, 4000); }
  function post(section, data) {
    try {
      var x = new XMLHttpRequest();
      x.open('POST', RECEIVER, true);
      x.setRequestHeader('Content-Type', 'text/plain');
      x.send(JSON.stringify({ section: section, t: Date.now() - t0, data: data }));
    } catch (e) { log('post failed: ' + e); }
  }
  function attempt(fn) { try { return fn(); } catch (e) { return 'ERR: ' + (e && (e.name + ' ' + e.message)); } }
  function report(section, data) { post(section, data); log('[' + section + '] ' + JSON.stringify(data).slice(0, 300)); }

  // Self-test helper for the dashboard's "return when an app closes" watcher:
  // when the dashboard opens this probe, it closes itself after 6 s, like a user backing out of an app.
  try {
    var rac = tizen.application.getCurrentApplication().getRequestedAppControl();
    var caller = rac && rac.callerAppId;
    if (caller === 'tvrevamp00.Dashboard') {
      report('selftest', { caller: caller, exitingInMs: 6000 });
      setTimeout(function () { tizen.application.getCurrentApplication().exit(); }, 6000);
    }
  } catch (e) { post('selftest', { err: String(e) }); }

  // ---- Environment & engine
  function syntax(src) { try { new Function(src); return true; } catch (e) { return false; } }
  function css(p, v) { return !!(window.CSS && CSS.supports && CSS.supports(p, v)); }
  report('env', {
    userAgent: navigator.userAgent,
    viewport: [window.innerWidth, window.innerHeight], screen: [screen.width, screen.height],
    dpr: window.devicePixelRatio, language: navigator.language,
    timeZone: attempt(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }),
    loadMs: attempt(function () { var p = performance.timing; return { domInteractive: p.domInteractive - p.navigationStart, domComplete: p.domComplete - p.navigationStart }; })
  });
  report('features', {
    js: {
      arrow: syntax('var f=()=>1'), class: syntax('class A{}'), asyncAwait: syntax('async function f(){await 1}'),
      asyncIter: syntax('async function f(){for await (var x of y){}}'), objSpread: syntax('var a={...{}}'),
      optionalChaining: syntax('var a=b?.c'), nullish: syntax('var a=b??c'), classFields: syntax('class A{x=1}'),
      bigint: typeof BigInt !== 'undefined', esModules: 'noModule' in document.createElement('script'),
      fetch: typeof fetch === 'function', Promise_allSettled: !!(window.Promise && Promise.allSettled),
      IntersectionObserver: 'IntersectionObserver' in window, ResizeObserver: 'ResizeObserver' in window,
      WebSocket: 'WebSocket' in window, indexedDB: 'indexedDB' in window, serviceWorker: 'serviceWorker' in navigator
    },
    css: {
      vars: css('--a', '0'), grid: css('display', 'grid'), gap: css('gap', '1px'),
      backdropFilter: css('backdrop-filter', 'blur(4px)') || css('-webkit-backdrop-filter', 'blur(4px)'),
      aspectRatio: css('aspect-ratio', '1/1'), clamp: css('width', 'clamp(1px,2px,3px)'), inset: css('inset', '0'),
      focusVisible: attempt(function () { document.querySelector(':focus-visible'); return true; }),
      webp: document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0
    }
  });

  // ---- Storage
  report('storage', {
    localStorage: attempt(function () { localStorage.setItem('_p', '1'); var ok = localStorage.getItem('_p') === '1'; localStorage.removeItem('_p'); return ok; })
  });
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(function (e) { report('storage.estimate', e); }, function (e) { report('storage.estimate', 'ERR ' + e); });
  }

  // ---- Tizen platform
  var hasTizen = typeof tizen !== 'undefined';
  report('apis', { tizen: hasTizen, webapis: typeof webapis !== 'undefined' });
  if (hasTizen) {
    var caps = {};
    ['platform.version', 'platform.name', 'build.version.release', 'build.string', 'build.date', 'build.model',
     'platform.core.cpu.arch', 'screen.width', 'screen.height', 'tv.inputdevice', 'websetting', 'network.wifi']
      .forEach(function (k) { caps[k] = attempt(function () { return tizen.systeminfo.getCapability('http://tizen.org/feature/' + k); }); });
    report('capabilities', caps);
    report('memory', {
      total: attempt(function () { return tizen.systeminfo.getTotalMemory(); }),
      available: attempt(function () { return tizen.systeminfo.getAvailableMemory(); })
    });
    ['BUILD', 'DISPLAY', 'CPU', 'STORAGE', 'MEMORY', 'LOCALE', 'NETWORK'].forEach(function (p) {
      attempt(function () {
        tizen.systeminfo.getPropertyValue(p, function (v) {
          var o = {}; for (var k in v) { if (typeof v[k] !== 'function') o[k] = v[k]; }
          if (p === 'STORAGE' && v.units) o.units = v.units.map(function (u) { return { type: u.type, capacity: u.capacity, available: u.availableCapacity, removable: u.isRemovable }; });
          report('systeminfo.' + p, o);
        }, function (e) { report('systeminfo.' + p, 'ERR ' + e.name); });
      });
    });
    report('inputdevice.supportedKeys', attempt(function () {
      return tizen.tvinputdevice.getSupportedKeys().map(function (k) { return k.name + ':' + k.code; });
    }));
    attempt(function () {
      tizen.application.getAppsInfo(function (apps) {
        report('appsInfo', { count: apps.length, apps: apps.filter(function (a) { return a.show; }).map(function (a) {
          return { id: a.id, name: a.name, pkg: a.packageId, icon: a.iconPath, version: a.version, categories: a.categories };
        }), hiddenCount: apps.filter(function (a) { return !a.show; }).length });
      }, function (e) { report('appsInfo', 'ERR ' + e.name + ' ' + e.message); });
    });
    attempt(function () {
      tizen.application.getAppsContext(function (ctx) { report('appsContext', ctx.map(function (c) { return c.appId; })); },
        function (e) { report('appsContext', 'ERR ' + e.name); });
    });
    report('currentApp', attempt(function () { var a = tizen.application.getCurrentApplication().appInfo; return { id: a.id, pkg: a.packageId }; }));
  }
  if (typeof webapis !== 'undefined') {
    var pi = webapis.productinfo || {}, net = webapis.network || {};
    var p = {};
    ['getVersion', 'getFirmware', 'getModel', 'getModelCode', 'getRealModel', 'getSmartTVServerVersion',
     'getSmartTVServerType', 'getLocalSet', 'isUdPanelSupported', 'isUHDAModel', 'is8KPanelSupported', 'isWallModel']
      .forEach(function (f) { p[f] = typeof pi[f] === 'function' ? attempt(function () { return pi[f](); }) : 'n/a'; });
    report('productinfo', p);
    report('network', {
      activeType: attempt(function () { return net.getActiveConnectionType(); }),
      ip: attempt(function () { return net.getIp(); }),
      gateway: attempt(function () { return net.isConnectedToGateway(); })
    });
    report('webapis.version', attempt(function () { return webapis.getVersion ? webapis.getVersion() : 'n/a'; }));
  }

  // ---- Internet reachability (weather provider candidate; fixed coordinates, not the user's location)
  attempt(function () {
    var s = Date.now(), x = new XMLHttpRequest();
    x.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=51.5&longitude=0&current=temperature_2m', true);
    x.timeout = 8000;
    x.onload = function () { report('internet.openMeteo', { status: x.status, ms: Date.now() - s }); };
    x.onerror = x.ontimeout = function () { report('internet.openMeteo', 'FAILED after ' + (Date.now() - s) + 'ms'); };
    x.send();
  });

  // ---- Lifecycle events (for return-from-app focus behavior)
  document.addEventListener('visibilitychange', function () { report('lifecycle', { hidden: document.hidden, focusIdx: focusIdx }); });
  window.addEventListener('blur', function () { report('lifecycle', 'window.blur'); });
  window.addEventListener('focus', function () { report('lifecycle', 'window.focus, focusIdx=' + focusIdx); });

  // ---- Interactive: launch tests + perf test
  var actions = [
    { label: 'YouTube', id: '9Ur5IzDKqV.TizenYouTube' },
    { label: 'Netflix', id: 'org.tizen.netflix-app' },
    { label: 'Prime Video', id: 'org.tizen.primevideo' },
    { label: 'Perf test', perf: true },
    { label: 'Exit', exit: true }
  ];
  var btnRow = document.getElementById('buttons'), btns = [], focusIdx = 0;
  actions.forEach(function (a) { var b = document.createElement('div'); b.className = 'btn'; b.textContent = a.label; btnRow.appendChild(b); btns.push(b); });
  function render() { btns.forEach(function (b, i) { b.className = 'btn' + (i === focusIdx ? ' focus' : ''); }); }
  render();

  function launch(a) {
    var s = Date.now();
    tizen.application.launch(a.id,
      function () { report('launch', { app: a.label, id: a.id, ok: true, ms: Date.now() - s }); },
      function (e) { report('launch', { app: a.label, id: a.id, ok: false, err: e.name + ' ' + e.message }); });
  }

  function perfTest(variant, done) {
    var layer = document.getElementById('perf'); layer.innerHTML = ''; layer.style.display = 'block';
    var cards = [];
    for (var i = 0; i < 12; i++) {
      var c = document.createElement('div'); c.className = 'card';
      c.style.left = (80 + (i % 6) * 300) + 'px'; c.style.top = (200 + Math.floor(i / 6) * 320) + 'px';
      if (variant === 'blur') c.style.filter = 'blur(2px)';
      layer.appendChild(c); cards.push(c);
    }
    var frames = 0, slow = 0, last = performance.now(), start = last;
    function step(now) {
      frames++; if (now - last > 32) slow++; last = now;
      var k = (now - start) / 1000;
      cards.forEach(function (c, i) { c.style.transform = 'scale(' + (1 + 0.08 * Math.sin(k * 4 + i)) + ')'; });
      if (now - start < 3000) requestAnimationFrame(step);
      else { layer.style.display = 'none'; done({ variant: variant, fps: Math.round(frames / ((now - start) / 1000)), slowFrames: slow }); }
    }
    requestAnimationFrame(step);
  }

  document.addEventListener('keydown', function (e) {
    report('key', { keyCode: e.keyCode, key: e.key });
    switch (e.keyCode) {
      case 37: focusIdx = Math.max(0, focusIdx - 1); render(); break;
      case 39: focusIdx = Math.min(btns.length - 1, focusIdx + 1); render(); break;
      case 13:
        var a = actions[focusIdx];
        if (a.exit) tizen.application.getCurrentApplication().exit();
        else if (a.perf) perfTest('transform', function (r1) { report('perf', r1); perfTest('blur', function (r2) { report('perf', r2); }); });
        else launch(a);
        break;
      case 10009: tizen.application.getCurrentApplication().exit(); break;
    }
    e.preventDefault();
  });

  statusEl.textContent = 'Diagnostics sent. ←/→ to choose, OK to run. Back exits.';

  // ================= v0.2 automatic tests (no remote input needed) =================
  report('startup', { scriptAtMs: Math.round(performance.now()) });

  // Persistence across restarts
  report('persistence', attempt(function () {
    var n = parseInt(localStorage.getItem('probe.runCount') || '0', 10) + 1;
    localStorage.setItem('probe.runCount', String(n));
    return { runCount: n, lastRun: localStorage.getItem('probe.lastRun') };
  }));
  attempt(function () { localStorage.setItem('probe.lastRun', new Date().toISOString()); });

  // API presence only (nothing is called)
  function has(path) {
    var o = window, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (o == null) return false; o = o[parts[i]]; }
    return o === undefined ? false : typeof o;
  }
  report('apiPresence', {
    'webapis.appcommon.setScreenSaver': has('webapis.appcommon.setScreenSaver'),
    'webapis.appcommon.AppCommonScreenSaverState': has('webapis.appcommon.AppCommonScreenSaverState'),
    'webapis.multiscreen': has('webapis.multiscreen'),
    'webapis.preview': has('webapis.preview'),
    'webapis.avplay': has('webapis.avplay'),
    'tizen.power': has('tizen.power'),
    'tizen.alarm': has('tizen.alarm'),
    'tizen.messageport': has('tizen.messageport'),
    'tizen.filesystem': has('tizen.filesystem'),
    'tizen.tvwindow': has('tizen.tvwindow'),
    'msf': has('msf')
  });

  // Can we display other apps' icons from their install paths?
  [['YouTube', 'file:///opt/usr/apps/9Ur5IzDKqV/shared/res/9Ur5IzDKqV.TizenYouTube.png'],
   ['Netflix', 'file:///opt/usr/apps/org.tizen.netflix-app/shared/res/org.tizen.netflix-app.png'],
   ['NetflixNoScheme', '/opt/usr/apps/org.tizen.netflix-app/shared/res/org.tizen.netflix-app.png']].forEach(function (p) {
    var img = new Image();
    img.onload = function () { report('iconAccess', { app: p[0], ok: true, size: [img.naturalWidth, img.naturalHeight] }); };
    img.onerror = function () { report('iconAccess', { app: p[0], ok: false }); };
    img.src = p[1];
  });

  // Realistic animation variants. Compositor-friendly styles, measured one after another.
  function makeBg() {
    var c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
    var g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 1920, 1080);
    gr.addColorStop(0, '#1d2b4a'); gr.addColorStop(1, '#4a1d3a'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 1080);
    for (var i = 0; i < 300; i++) { g.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.15 + ')'; g.fillRect(Math.random() * 1920, Math.random() * 1080, 40, 40); }
    return c.toDataURL('image/jpeg', 0.8);
  }
  function run2(variant, done) {
    var layer = document.getElementById('perf'); layer.innerHTML = ''; layer.style.display = 'block';
    var els = [], bg = null;
    if (variant === 'crossfade') {
      var url = makeBg();
      for (var j = 0; j < 2; j++) {
        var b = document.createElement('div');
        b.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;will-change:opacity;background:url(' + url + ') center/cover';
        layer.appendChild(b); els.push(b);
      }
    } else {
      for (var i = 0; i < 12; i++) {
        var c = document.createElement('div');
        c.style.cssText = 'position:absolute;width:320px;height:180px;border-radius:18px;background:#3a4b8a;will-change:transform;' +
          'left:' + (80 + (i % 6) * 300) + 'px;top:' + (200 + Math.floor(i / 6) * 320) + 'px;' +
          (variant === 'staticShadow' ? 'box-shadow:0 20px 50px rgba(0,0,0,.6);' : '');
        layer.appendChild(c); els.push(c);
      }
    }
    var frames = 0, slow = 0, start = null, last = 0;
    function step(now) {
      if (start === null) { start = last = now; }
      frames++; if (now - last > 32) slow++; last = now;
      var k = (now - start) / 1000;
      if (variant === 'crossfade') els[1].style.opacity = String((Math.sin(k * 2) + 1) / 2);
      else if (variant === 'focusOne') els[(Math.floor(k * 3)) % 12].style.transform = 'scale(1.1)', els[(Math.floor(k * 3) + 11) % 12].style.transform = 'scale(1)';
      else els.forEach(function (e, i) { e.style.transform = 'translateZ(0) scale(' + (1 + 0.08 * Math.sin(k * 4 + i)) + ')'; });
      if (now - start < 3000) requestAnimationFrame(step);
      else { layer.style.display = 'none'; done({ variant: variant, fps: Math.round(frames / ((now - start) / 1000)), slowFrames: slow, frames: frames }); }
    }
    requestAnimationFrame(step);
  }
  var variants = ['idle', 'transformNoShadow', 'staticShadow', 'focusOne', 'crossfade'];
  function next(i) {
    if (i >= variants.length) { report('perf2.done', true); return; }
    if (variants[i] === 'idle') {
      var f = 0, s = null;
      (function tick(now) { if (s === null) s = now; f++; if (now - s < 2000) requestAnimationFrame(tick); else { report('perf2', { variant: 'idle', fps: Math.round(f / ((now - s) / 1000)) }); next(i + 1); } })(performance.now());
      return;
    }
    run2(variants[i], function (r) { report('perf2', r); setTimeout(function () { next(i + 1); }, 500); });
  }
  setTimeout(function () { next(0); }, 3000);
})();
