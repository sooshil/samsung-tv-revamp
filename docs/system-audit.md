# Phase 1 — System Audit Report

Date: 2026-11-14 · Method: SDB (read-only) plus the diagnostic app `tvrvmprobe.Probe` v0.1.0 (`probe/`), which reports to a temporary listener on the Mac.

## 1. Platform facts (measured on the TV)

| | Value |
|---|---|
| Firmware | T-KSU2EAKUC-2301.1 (build `KantSU2e-RELEASE_20251112.1`), Smart Hub server `T-INFOLINK2021-1017` |
| Tizen / productinfo API | 6.0 / 3.7 |
| Web engine | Chromium 76.0.3809.146 (`Tizen 6.0 ... TV Safari/537.36`) |
| Viewport | 1920×1080, devicePixelRatio 1 (4K panel upscales) |
| CPU | armv7 (32-bit userspace); load around 0.33 at idle |
| RAM | 1.71 GB total, **~190 MB available** with Netflix and the probe resident |
| Storage | 4.13 GB internal, 1.76 GB free. Web storage quota ~275 MB; `localStorage` and IndexedDB work |
| Network | Wi-Fi, <tv-ip>. TV → Mac LAN HTTP works. Internet works (Open-Meteo: HTTP 200 in 5.4 s cold) |
| Locale / time zone | en_US / America/Chicago |

### Web feature support (Chromium 76)

- **Supported:** arrow functions, classes, class fields, async/await, async iteration, object spread, BigInt, ES modules, `fetch`, `Promise.allSettled`, IntersectionObserver, ResizeObserver, WebSocket, IndexedDB, service worker, CSS variables, grid, `gap`, `backdrop-filter`, WebP.
- **Not supported:** `?.`, `??`, CSS `aspect-ratio`, `clamp()`, `inset`, `:focus-visible`.

So: compile TypeScript or modern JavaScript with **esbuild, target `chrome76`**.

### Remote keys

`tizen.tvinputdevice.getSupportedKeys()` lists 46 registrable keys: digits 0–9, volume and channel keys, the four colour keys (403–406), Info 457, Menu 10133, Tools 10135, **Exit 10182**, Search 10225, Guide 458, media keys (Play 415, Pause 19, PlayPause 10252, Stop 413, FF 417, RW 412, Prev/Next 10232/10233), Source 10072, Caption 10221, and more. Arrows, Enter and Back (10009) arrive without registration. **Home is not in the list, so it can't be intercepted.**

## 2. Application management

| Capability | Result | Classification |
|---|---|---|
| List installed apps with ID, name, version, icon path | ✅ `tizen.application.getAppsInfo`: 377 apps, 201 with `show=true` | 1. Officially supported |
| List running apps | ✅ `tizen.application.getAppsContext` (no extra privilege) | 1. Officially supported |
| Launch another app by ID | ✅ `tizen.application.launch`: YouTube 1.0 s, Netflix 0.2 s (already resident), Prime Video 0.8 s | 1. Officially supported |
| Return to the dashboard after Back | ❌ YouTube and Prime Video go to the Samsung Home. Netflix ignores Back. | 5. Not feasible (platform behaviour) |
| Dashboard survives while another app runs | ✅ only with multitasking metadata (see update below); ❌ without it | 1. Officially supported |
| Uninstall or kill other apps | Not attempted. Needs partner/platform privilege (we have Public) | 4. Requires privileged access |
| Inventory via SDB | ✅ `sdb shell 0 vd_applist` (24 store apps, with use counts) and `0 applist` | 2. Developer interface |
| General shell / root | ❌ `intershell_support:disabled`, `sdbd_rootperm:disabled` | 4/5 |

### Launch IDs for the dashboard (verified)

YouTube `9Ur5IzDKqV.TizenYouTube` · Netflix `org.tizen.netflix-app` · Prime Video `org.tizen.primevideo`.

Unverified but listed by `getAppsInfo`: Disney+ `MCmYXNxgcu.DisneyPlus` · Hulu `LBUAQX1exg.Hulu` · Apple TV `com.samsung.tv.aria-video` · Peacock `gzcc4LRFBF.Peacock` · Sling `ZmmGjO6VKO.slingtv` · Tubi `3KA0pm7a7V.TubiTV` · Spotify `rJeHak5zRg.Spotify` · ZEE5 `wKDM33Rods.ZEE5` · Smart STB+ `aR24dvmurV.SmartSTBplus` · ICC.tv `w3k1Cc2pEu.ICC` · Countdown Timer `<timer-app-id>`.

Store apps report icon paths like `/opt/usr/apps/<pkg>/shared/res/<id>.png`. Whether our app can read those files is **not yet tested**; if not, the dashboard bundles its own artwork.

## 3. Privacy and advertising

### Running services worth noting (from `getAppsContext`, 2026-11-14)

`com.samsung.tv.acr` (Automatic Content Recognition) · `com.samsung.tv.targeted-ad-service` · `com.samsung.tv.cis` / `cis-api-service-app` · `org.tizen.content-tiles-provider` · `com.samsung.tv.lightweight-node-service` · `org.tizen.hbbtv-service`.

Installed but not running: `com.samsung.tv.adplayer`, `com.samsung.tv.coba.adagent`, `com.samsung.tv.preview-downloader`, `yL49PNFmjW.PromotionApp` and `.service`.

**Verification method:** after each settings change, re-run the probe and check whether `acr` and `targeted-ad-service` are still running. This gives measurable before/after evidence without intercepting any traffic.

### Settings to review (supported UI only)

The current state can't be read through any API available to us, so the user reads it on the TV. Menu paths are the 2021 Tizen 6.0 layout and still need confirming on this TV.

| Setting | Expected location | Purpose and implications | Reversible | Consequence of disabling |
|---|---|---|---|---|
| Viewing Information Services (ACR) | Settings › Support › Terms & Privacy | Samsung identifies what's on screen, including HDMI sources, for recommendations and ads | Yes | Fewer "recommended" tiles; no loss of streaming apps |
| Interest-Based Advertisements | Settings › Support › Terms & Privacy | Ad personalisation from viewing and usage data | Yes | Ads remain but are generic |
| Voice Recognition Services | Settings › Support › Terms & Privacy | Cloud voice processing; this remote is reported without voice (`remote_voiceControl:false`) | Yes | None for this remote |
| Privacy Choices / usage diagnostics | Settings › Support › Terms & Privacy | Usage, diagnostics and marketing data sharing | Yes | None functionally |
| Smart Hub terms (`smartHubAgreement:true`) | Settings › Support › Terms & Privacy | Withdrawing **disables the app store and most streaming apps** | Yes, but painful | **Do not withdraw** |
| Autorun Smart Hub / Autorun Last App | Settings › General › Smart Features | What appears at power-on | Yes | Affects the dashboard startup strategy; see feasibility |

## 4. Bloatware classification (no changes made)

- **A. Can be removed through the supported UI** (store apps with `is_removable=1`, unused according to `vd_applist` use counts): Samsung GameBreaks, Glance, klyq, Instagram, Xbox, Tubi, Disney+, Hulu, Apple TV, Spotify, Peacock, Sling TV. **The user decides; keep anything they subscribe to.**
- **B. Can be disabled or reduced through settings:** ACR, interest-based ads, Smart Hub autorun behaviour, and home-screen promotions (via the privacy settings above).
- **C. System — leave untouched:** everything under `/usr/apps` and the `com.samsung.tv.coba.*`, `org.tizen.*`, `com.samsung.tv.cobalt-*`, `ep-hotel-*` (hotel-mode framework), `acr` and `adagent` components. None can be removed with our privileges anyway.
- **D. Unknown dependencies:** Samsung Promotion (`yL49PNFmjW`; reports removable, but may be reinstalled by Smart Hub), Security Center (Samsung's security app; recommend keeping), Smart STB+ (942 uses; likely the set-top-box integration — keep), e-Manual.

## 5. Performance (first measurement)

The synthetic test, 12 large cards with 50 px box-shadows and scale animation in the main thread with no compositing hints, ran at **1–2 fps**. This is a worst-case style, but it shows that **paint is extremely expensive**. The dashboard must animate only `transform` and `opacity` on pre-promoted layers, keep shadows static (baked into images or non-animated pseudo-elements), and avoid `filter`/`backdrop-filter` on anything that moves. The Phase 3 prototype will be measured directly on the TV.

## 6. Change log for this phase

| Change | Rollback |
|---|---|
| `SDK/sdk.info`: path corrected | `cp SDK/sdk.info.bak-20261114 SDK/sdk.info` |
| New Samsung certificate `<certificate folder>`, plus install permit pushed to the TV (done by the user in the VS Code extension) | Delete the folder and the profile; re-permit with another certificate |
| CLI profile `tv-revamp` added and active | `tizen security-profiles remove -n tv-revamp` |
| Installed `tvrvmprobe.Probe` 0.1.0 on the TV | `tizen uninstall -p tvrvmprobe.Probe -s <tv-ip>:26101` |

### Update (probe v0.2 and v0.3, 2026-11-14)

The "terminated on every launch" finding above was **caused by the probe's own config** (`background-support="disable"` and no multitasking metadata), not the platform. With `multitasking.support=true` and `background-support=enable`, the probe resumes in the same process after the timer and after YouTube. See `technical-feasibility.md`.

Installed `tvrvmprobe.Probe` v0.3.0 (replaces 0.1.0). Same rollback.

### Update (2026-11-15)

| Change | Rollback |
|---|---|
| `tvrevamp00.Dashboard` v0.2.0 installed (replaces 0.1.0) | `tizen uninstall -p tvrevamp00.Dashboard -s <tv-ip>:26101` |
| `tvrvmprobe.Probe` v0.3.1: closes itself 6 s after being opened **by the dashboard** (self-test helper); unchanged otherwise | Same uninstall command with `-p tvrvmprobe.Probe` |

No TV settings were changed. The TV's own screensaver is **not** held off (code present, disabled pending approval).

### Update (v0.3.0, 2026-11-15)

| Change | Rollback |
|---|---|
| `tvrevamp00.Dashboard` v0.3.0: weather, and the TV's own screensaver held off only while the dashboard's screensaver shows (approved) | Settings › Screensaver after › Off stops it; or uninstall as above. The hold is released whenever the dashboard's screensaver ends, so no TV setting stays changed. |

### Update (v0.4.0, 2026-11-15)

| Change | Rollback |
|---|---|
| Dashboard v0.4.0 (diagnostic build: the return watcher's decisions go to the Mac listener on the LAN only) | Redeploy a plain build (`npm run deploy`) or uninstall as above |
| Settings v2: ZEE5 out of favourites; 12 unused apps **hidden in the dashboard** (nothing uninstalled) | Settings › Reset dashboard settings |

App removal candidates (owner's list): every store app on it reports `is_removable=1` and can be deleted from the TV's own Apps screen. No uninstall has been done.

### Update (v0.5.0–v0.6.0, 2026-11-15)

| Change | Rollback |
|---|---|
| Dashboard v0.6.0 (production build, ~38 MB with photos) | `tizen uninstall -p tvrevamp00.Dashboard -s <tv-ip>:26101` |
| Owner deleted unused apps through the TV's own Apps screen (done by the owner) | Reinstall from the Samsung app store |
