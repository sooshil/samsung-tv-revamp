# Phase 4 — On-TV validation

Dashboard `tvrevamp00.Dashboard` on the UN75TU690TFXZA (firmware T-KSU2EAKUC-2301.1). Each row was tested on the TV,
either by the owner with the remote or by a self-test build reporting to the Mac (`node scripts/build.mjs --selftest=<name>`).

## Results

| Check | Result | How |
|---|---|---|
| Install / launch / uninstall with profile `tv-revamp` | Pass | `scripts/deploy.sh` |
| Real apps listed and launched (YouTube, Netflix, Prime Video, ZEE5, Smart STB+) | Pass | Owner, remote |
| Focus restored after returning from an app | Pass (same process, focus kept) | Owner, remote |
| Settings survive restart | Pass | Owner, remote |
| Card icons | YouTube and Countdown Timer register Tizen's **generic placeholder icon**; fixed with a drawn mark / name tile | Pulled every app icon with `sdb pull`, compared hashes |
| Back from an app returns to the dashboard | **Depends on the app** (below); fixed with the return watcher | Owner, remote |
| Return watcher: app closes → dashboard comes back | Pass: same instance, ~0.2 s after detection, no reload | `--selftest=return` (probe app closes itself) |
| Weather on the TV (Open-Meteo through `<access>` whitelist) | Pass: live data shown | `--selftest=weather` |
| `setScreenSaver` OFF/ON from the app | Pass (no error both ways) | `--selftest=saver` |
| Screensaver: pan-and-zoom + drifting clock | 59–60 fps; photo change hitch 115–236 ms; +25 MB | `--selftest=saver` |

## Back key behaviour, by app (owner's test, 2026-11-15)

| App | Back repeatedly | Where you land |
|---|---|---|
| YouTube | exits | the dashboard, but Samsung's home panel covers it for 20–30 s |
| Prime Video | "exit?" dialog, then exits | Samsung home → the v0.2 watcher brings the dashboard back and the panel goes away |
| ZEE5 | "exit?" dialog, then exits | same as Prime Video |
| Netflix | ignores Back; the Exit key closes it | Samsung home, then Samsung TV Plus starts playing; the v0.3 watcher did **not** bring the dashboard back |

Each app decides what Back does; the dashboard can't change that, and the Home key can't be intercepted.

### Return watcher (v0.2.0)

The dashboard stays alive in the background, so after it opens an app it polls the running-app list (`getAppsContext`,
every 1.5 s, only while hidden). When that app disappears, it brings itself back to the front. It stands down if:

- the dashboard is already visible,
- another user app was started in the meantime (picked from Samsung's home bar), or
- the app never appeared within 20 s.

Pressing **Home** leaves apps running, so it doesn't trigger the watcher, and Samsung home stays where you put it.

Measured details:

- `tizen.application.launch(self)` **reloads the page** (cold start). An app control to itself, with
  `<tizen:app-control><tizen:src reload="disable"/>` in config.xml, **resumes the same instance**.
- Detection takes 1.5–3 s after the app closes. You see Samsung home briefly, then the dashboard.
- Setting: Settings › *When an app closes* › Come back here / Samsung home.

To be confirmed with the remote: Netflix after the Exit key, and Prime/ZEE5 after their exit dialogs.

## Still open

- Autorun Last App (Settings › General › Smart Features): whether it reopens the dashboard after power-on. Owner to check.
- Which of the two config flags (`multitasking.support`, `background-support`) is required. Both are kept; low value to bisect.

### v0.4.0 changes from the owner's test

- The watcher now also fires when the dashboard is already visible (YouTube case), since bringing ourselves to the front dismisses Samsung's panel. It stops as soon as a key reaches the dashboard.
- An app that starts within 4 s of the watched app closing is treated as the TV's fallback (e.g. TV Plus after Exit), not the user's choice.
- Built with `--diag`: the watcher's decisions are logged to the Mac listener so the Netflix Exit case can be seen. Replace with a plain build once confirmed.

## Samsung system panels an app can open (`--selftest=launchers`, 2026-11-15)

| App ID | Launch | Takes focus (visible panel) | Used |
|---|---|---|---|
| `com.samsung.tv.quickpanel` | ok | yes | "Quick Settings" tile (includes Sound Output) |
| `org.tizen.btaudiolist` | ok | yes | "Bluetooth Audio" tile |
| `org.tizen.volume-setting` | ok | yes | not used |
| `com.samsung.tv.coba.setting` | ok | no (nothing shown) | not used |
| `com.samsung.tv.coba.setting.devicemanager` | ok | no | not used |
| `org.tizen.homesetting` | ok | no | not used |

There is no public API to switch the sound output directly (`tvaudiocontrol` can only read the output mode).

### v0.4.1 — process IDs (`--selftest=ctx`, 2026-11-15)

- **YouTube runs as `com.samsung.tv.cobalt-yt`** in the running-app list, not `9Ur5IzDKqV.TizenYouTube`. The v0.4.0 watcher logged "never-appeared" for YouTube for that reason. It now watches the process ID.
- **Netflix is always in the running list**: before launch, after Back, and after the Exit key. It never closes, so the watcher can't help with it and now skips it. Ways back to the dashboard after Netflix: Home → "Home" on Samsung's bar.

### v0.5.0 — Samsung panel after YouTube (2026-11-15)

- Owner's test of v0.4.1: the panel still stayed. Log: `com.samsung.tv.cobalt-yt` **never leaves the running list** either (like Netflix), so there was no close to react to.
- New approach, `FocusReclaimer`: after returning from an app opened here, if the dashboard is visible but `document.hasFocus()` is false (a system panel holds focus), it brings itself to the front. It checks at 0.4, 1.2, 2.5, 4 and 6 s, tries at most 3 times, and stops on any key press.
- `--selftest=panel`: with Quick Settings open over the dashboard, `hasFocus` is false; `window.focus()` doesn't help; an app control to self closes the panel and focus returns.
- `--selftest=reclaim`: probe closes → dashboard visible → panel opened on top → the reclaimer fired at 2.5 s → dashboard focused.

Owner's test of v0.5.0: **pass**. The reclaimer fired 0.4 s after returning from YouTube and Samsung's panel closed.

### v0.6.0 — Nepal photography

36 photos of Nepal (Himalaya, lakes, Langtang, Mustang, Pokhara, Kathmandu Valley heritage, Lumbini) from Wikimedia
Commons featured/quality pictures, CC BY / CC BY-SA. The photographer and license are shown on screen next to the photo name;
the full list is in `assets/backgrounds/nepal/CREDITS.md`. Settings › Photos: Nepal (default) / Nature / both.
Package is now ~38 MB (64 photos); only two are decoded at a time. Production build (no diagnostic logging).
