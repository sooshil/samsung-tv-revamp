# Phase 2 — Technical Feasibility Report

Date: 2026-11-14 · Evidence: probe v0.1–v0.3 on the TV (`probe/`), SDB, and Samsung documentation.

Classification key: **1** Officially supported · **2** Developer interface · **3** Undocumented but reproducible · **4** Requires privileged access · **5** Not feasible on this hardware or firmware.

## Summary

| Question | Verdict | Class |
|---|---|---|
| Custom dashboard web app | ✅ Viable | 1 |
| Discover installed apps automatically | ✅ `getAppsInfo` returns 377 apps (201 visible) with IDs, names and icon paths | 1 |
| Show the system's app icons | ✅ `file:///opt/usr/apps/.../*.png` loads, but small (YouTube 117 px, Netflix 298 px). Bundle hi-res artwork for favourites and fall back to system icons | 1 (icon path from API) |
| Launch YouTube, Netflix and Prime Video | ✅ `tizen.application.launch`, 0.2–1.0 s | 1 |
| Dashboard resumes after another app | ✅ **With `multitasking.support=true` and `background-support=enable`**, the same PID resumes with state intact, including after YouTube. Without them it cold-starts | 1 |
| Back from a streaming app returns to the dashboard | ❌ Back goes to the Samsung Home (YouTube, Prime) or is consumed (Netflix). The dashboard is reopened from the Home bar and then resumes instantly | 5 |
| Intercept the Home button | ❌ Not in `getSupportedKeys()`; reserved by the system | 5 |
| Replace the native launcher | ❌ Needs root or system signature; `sdbd_rootperm:disabled` | 4 / 5 |
| Pin the dashboard first on the Home bar | ✅ Through Samsung's UI (Apps › select › "Add to Home" / move) | 1 |
| Start the dashboard at power-on | ⚠️ Possible via the **Autorun Last App** setting if the dashboard was last in the foreground. Not tested yet; forums report it depends on multitasking, which now works. No supported "launch on boot" for third-party apps | 1 (setting); boot launch 5 |
| Smart Hub Preview (tiles on the Home bar) | ⚠️ Supported on 2016–2021 TVs, but requires a background **service app**. Privilege level for our Public certificate unverified | 1 (privilege TBD) |
| In-app screensaver | ✅ Idle timer plus our own full-screen scene | 1 |
| Replace the OS screensaver | ❌ No API. `webapis.appcommon.setScreenSaver` only lets the foreground app suppress or allow the system one | 5 (replace) / 1 (suppress) |
| Settings persistence | ✅ `localStorage` survives app restart (verified); quota ~275 MB | 1 |
| Weather | ✅ Open-Meteo reachable (no API key); first request is slow (5.4 s), so cache it | 1 |
| Phone / computer configuration | ✅ TV → LAN HTTP works. ❌ TV cannot host a server. See §3 | 1 (client) |
| Full remote-key set (colour, media, Info, Exit…) | ✅ `tvinputdevice.registerKey` (46 keys) | 1 |

## 1. Rendering performance (Chromium 76, measured)

| Test (3 s each, 1920×1080) | FPS |
|---|---|
| Idle rAF | 56 |
| 12 cards, `transform` only, `will-change` | **57** |
| Same, with static `box-shadow` | 43 |
| One card at a time scales (a realistic focus move) | **59** |
| Full-screen 1080p image crossfade driven by JS opacity | **23** ⚠️ |
| v0.1 worst case: shadows plus scale with no layer hints | 1–2 ❌ |

Rules that follow from these numbers:
- Animate only `transform` and `opacity` on promoted layers.
- Keep shadows off moving elements, or bake them into images.
- Do background crossfades slowly with CSS transitions. JS-driven opacity is too slow, so CSS has to be measured too.
- Avoid `filter` and `backdrop-filter` on anything that moves.
- Keep at most two full-screen decoded images alive at once (RAM: ~190 MB free).

## 2. Startup

The script ran about 2.0–2.15 s after navigation start. Synchronous `$WEBAPIS/webapis.js` in `<head>` accounts for part of that. Mitigations:
- load `webapis.js` asynchronously, after first paint;
- inline a minimal shell (clock plus last-known app row from `localStorage`) so something renders before data loads;
- with multitasking, cold starts become rare: they happen only after power cycles or memory reclaim.

## 3. Remote configuration options

| Option | How | Pros | Cons | Class |
|---|---|---|---|---|
| A. On-TV settings | Remote-driven settings screen | Always available, no extra host | Text entry (e.g. city) is clumsy | 1 |
| B. LAN companion (Mac or any always-on box) | Small service serves the phone UI and holds the config. The TV fetches on start/resume and keeps a WebSocket open only while visible. Pairing code shown on the TV; token auth | Rich phone UI; no internet exposure | Needs a machine running | 1 (TV is a client) |
| C. Smart View / MSF channel on the TV (`:8001/api/v2/channels`) | Phone page talks to the TV app directly through the TV's built-in channel service | No companion host | `webapis.multiscreen` / `msf` not present by default; legacy SDK; status unverified | 3 (to test) |
| D. Cloud sync | Config in a hosted store | Works anywhere | Internet exposure, accounts — **rejected** | — |

**Recommendation:** A first. Then B as an optional add-on. Try C as a short experiment; if it works it replaces B.

## 4. Burn-in and power

- Our screensaver keeps everything moving: slow pan and crossfade, a clock that drifts position each minute, and no static bright elements.
- We do **not** suppress Samsung's screensaver or auto power-off in v1. Suppression via `appcommon.setScreenSaver` would be considered only while our animated screensaver is visibly running, with your approval.

## 5. Open items for Phase 3/4

1. Find out which flag actually enables resume (`multitasking.support` vs `background-support`); prefer the minimal one, because background JS costs power.
2. Pause all timers on `visibilitychange: hidden`.
3. Measure CSS-transition crossfades vs JS-driven ones.
4. Test Autorun Last App with the dashboard.
5. Prelaunch metadata effect.
6. Smart Hub Preview privilege.
7. MSF channel experiment.
