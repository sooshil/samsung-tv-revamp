# Architecture Proposal

## Constraints driving the design (measured)

- Chromium 76, so no `?.`, `??`, `clamp()`, `aspect-ratio` or `:focus-visible`.
- ~190 MB free RAM; armv7 CPU; paint-bound GPU.
- 1920×1080 CSS viewport.
- The app resumes in place when multitasking is enabled; the Home button and launcher are off-limits.

## Stack

- **TypeScript, bundled by esbuild with `target: chrome76`.** One small JS bundle and one CSS file. Dev dependencies are only `typescript` and `esbuild`; there are **zero runtime dependencies**.
- **No UI framework.** The DOM is built once per screen. Updates are targeted: focus moves toggle a class and a transform on two elements, which keeps us at the 57–59 fps measured for transform-only work. React's runtime cost and GC churn buy nothing here.
- The same build runs in desktop Chrome on the Mac (arrow keys and Enter, with Backspace standing in for Back) with a mock `tizen` layer, for fast iteration. **The TV is the acceptance environment.**

## Modules

```
src/
  main.ts                 bootstrap: render shell, restore state, lazy-load webapis
  platform/               the only place that touches tizen.* / webapis.*
    tizen.ts              typed wrappers + desktop mocks
    keys.ts               key map, registerKey for colour/media/Info
    lifecycle.ts          visibility → pause/resume bus
  navigation/
    focus.ts              spatial focus engine: zones (rows/grids) with explicit neighbours,
                          remembered index per zone, no DOM focus() or scrolling
  apps/
    catalog.ts            getAppsInfo → filtered list; merges user favourites, order, labels
    artwork.ts            bundled hi-res art for known IDs → system icon → monogram
    launcher.ts           saves focus state, then tizen.application.launch, error → toast
  settings/
    store.ts              versioned JSON in localStorage, migrations, defaults
  screens/
    home.ts  settings.ts  screensaver.ts  diagnostics.ts
  components/             clock, app card, hero, row, toast, toggle, picker
  services/
    weather.ts            Open-Meteo; configured lat/lon; 30-min cache; fetch only when visible
    backgrounds.ts        bundled curated photos, preload next, ≤2 decoded at once
  styles/                 tokens.css (theme variables), base, components
assets/backgrounds/       1920×1080 WebP, ~250–400 KB each
tizen/config.xml          app ID tvrevamp00.Dashboard, multitasking metadata
tests/                    node:test for focus engine, settings migrations, catalog merge
```

## Key behaviours

- **Launching an app:** persist `{screen, zone, index}`, then launch. On `visibilitychange: visible`, re-assert focus and refresh the clock and weather if stale. On a cold start, restore from `localStorage`.
- **Back key:** go up the screen stack (Settings → Home). On Home, Back does nothing, since a dashboard shouldn't exit by accident. **Exit (10182)** leaves the app.
- **Idle → screensaver:** after N minutes (configurable, default 10) with no key press on Home. Any key returns to the exact previous focus.
- **Persistence:** a single settings document `{version, theme, background, favourites[], order[], labels{}, widgets{}, screensaver{}, animations}`, written debounced.
- **Network:** weather is the only automatic call. It fetches on start and resume if older than 30 minutes; there is no polling while hidden. When offline, it shows the cached value with its age, or hides the widget.
- **Diagnostics screen:** the probe's checks (firmware, memory, storage, engine, running apps) behind Settings → About.

## Not in v1 (needs your approval later)

Companion phone UI, MSF experiment, Smart Hub Preview service, and Autorun Last App configuration.

**Approved 2026-11-15:** holding the TV's own screensaver off *only while the dashboard's screensaver is showing* (`webapis.appcommon.setScreenSaver`), handed back when it ends or the dashboard is hidden.

## Weather

Open-Meteo, no key. The location comes from git-ignored `config/local.json` (see `config/example.local.json`); the build rounds it to 2 decimals (~1 km), and only that rounded value is in the bundle and sent to the service. Cache `tvr.weather`, refreshed after 30 min, hidden after 6 h offline.

## Favourites editor (v0.7.0)

Home → star button in the top bar, or Settings › Edit favourites. Arrows, OK and Back only. OK on a favourite picks it up (▲▼ reorder, ◀ removes, OK/Back puts it down); OK on another app adds it to the end and picks it up. Maximum 10, minimum 1. Every change is saved at once to `settings.favorites`. Pure list operations live in `src/apps/favorites.ts` (tested).
