# Performance log (measured on the TV)

Method: `npm run build:bench` adds `src/bench.ts`, which drives the real UI with synthetic remote keys and posts frame timings to `scripts/probe-receiver.py` on the Mac. Each run takes about 30 s and needs no remote input.

## Dashboard v0.1.0 — 2026-11-14

### Startup

| Metric | Before | After |
|---|---|---|
| Script start (from navigation) | ~300 ms | ~300 ms |
| Shell + apps on screen | 5.7 s (waits for `getAppsInfo`) | **~0.6 s** (cached app list) |
| Fresh app list from TV | 5.7 s | 5.7 s, in background; re-renders only if changed |

### Navigation (24 presses at 180 ms; 16 presses at 90 ms)

| Variant | 180 ms fps | worst frame | held 90 ms fps |
|---|---|---|---|
| v0 baseline (blurred focus glow, hero text-shadow, hero updated per move) | 10–26 | 266–376 ms | 17 |
| No focus glow | 40–50 | 94–141 ms | — |
| No glow + no hero text | 57 | 44 ms | — |
| **Shipped: no glow, hero updated after focus settles (260 ms), no text-shadow** | **50–51** | 75–237 ms | **26–31** |
| Shipped + shortened transitions while key is held | 51 | 122 ms | 31 (no gain → reverted) |

### Other

| Metric | Result |
|---|---|
| Idle | 60 fps |
| Background crossfade (CSS opacity transition, 1.6 s) | 52–54 fps (JS-driven in probe: 23) |
| Dashboard memory | ~40–45 MB (available memory 220 → 180 MB) |
| Bundle | app.js 17 KB, styles.css 5.4 KB, backgrounds 4.0 MB (v0.5.0: 28 photos, 14 MB; only two are decoded at a time) |

## Screensaver v0.2.0 — 2026-11-15 (`--selftest=saver`, 4 × 12 s, photo change every 12 s)

| Variant | fps | worst frame | memory |
|---|---|---|---|
| CSS background-image layers, swap on `onload` | 45–60 | **3074 ms** at photo change | −104 MB |
| `<img>` layers, `decode()` before swap, dashboard layers hidden underneath | **59–60** | 115–236 ms | **−25 MB** |

## Screensaver with shuffled order and Nepal photos (v0.7.1, `--selftest=saver`): 51–60 fps, worst frame 111–270 ms at a photo change, ~55 MB while showing (was 25–38 MB with the smaller Unsplash set; the Nepal crops are larger files).

## Rules derived

1. No blurred `box-shadow` on anything whose opacity or transform changes. The shadow gets re-rasterised, halving the frame rate.
2. Don't change large text while focus is moving. Update after it settles.
3. CSS transitions on `opacity`/`transform` are fine; JS-driven per-frame style changes on full-screen layers are not.
4. Cache anything from `getAppsInfo`; never block first paint on it.
5. Decode full-screen images (`img.decode()`) before showing them, and hide covered layers (`visibility: hidden`) so their tiles are freed.

## Known items

- Held-key navigation at 26–31 fps. Candidates: virtualise the off-screen "All apps" cards; avoid `classList` churn on rows that aren't focused.
- Occasional 120–240 ms frames during navigation, probably first decode of system icon images as cards scroll into view. Candidate: pre-decode icons after first paint.
