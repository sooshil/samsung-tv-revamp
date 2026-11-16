# Phase 0 — Environment Discovery Report

Date: 2026-11-14 · Status: **complete** (gaps filled by the on-device probe; see `system-audit.md`)

No changes were made to the TV. The only change on the Mac was installing Rosetta 2, which the user did.

## 1. Television

| Property | Value | How verified |
|---|---|---|
| Model | `UN75TU690TFXZA` | `sdb devices`; REST endpoint `:8001/api/v2/` |
| Platform code | `21_KANTSU2E_UHD_BASIC1` (2021 Kant-SU2e, UHD basic tier) | REST endpoint |
| Tizen platform version | **6.0** | `sdb capability` → `platform_version:6.0` |
| Product version | 4.0 | `sdb capability` |
| CPU arch (userspace) | armv7 (32-bit) | `sdb capability` |
| Panel resolution | 3840×2160 | REST endpoint. Web app viewport is still to be measured; normally 1920×1080 |
| Network | Wi-Fi, IP <tv-ip> (DHCP; was .88 in April) | ARP + REST |
| Developer Mode | On, host IP <mac-ip> | REST `developerIP` |
| Firmware version | **T-KSU2EAKUC-2301.1**, build `TIZEN-TRUNK2021-KantSU2e-RELEASE_20251112.1` | Probe: `webapis.productinfo.getFirmware()`, `systeminfo BUILD` |
| Web engine | **Chromium 76.0.3809.146** | Probe: `navigator.userAgent` |
| Storage / memory | 4.13 GB internal (1.76 GB free); RAM 1.71 GB total, ~190 MB available | Probe: `tizen.systeminfo` |

### SDB capability (verbatim highlights)

```
sdbd_rootperm:disabled      rootonoff_support:disabled
intershell_support:disabled appcmd_support:disabled
filesync_support:pushpull   can_launch:tv-samsung
profile_name:tv             vendor_name:Samsung
sdbd_version:2.2.31         sdbd_plugin_version:3.8.4_TV_REL
```

**What this means:** no root, no interactive shell, and no general shell commands. `uname`, `cat`, `ls`, `df` and `free` all return empty output. Only Samsung's own `sdb shell 0 <cmd>` commands work. `vd_applist` and `applist` are confirmed working, and both are read-only. Treat the TV as a sealed device: anything we do runs inside the web-app sandbox.

### Open TV ports seen on the LAN

26101 (sdbd), 8001/8002 (Samsung remote-control/REST API, HTTP/WS and TLS), 9197 (DIAL).

## 2. Mac development environment

| Item | Value |
|---|---|
| macOS | 27.0.1 (26A434), Apple Silicon arm64 |
| Java | GraalVM 24 (default), plus JDK 22, 21, 17 and 11; the SDK also bundles its own JDK |
| Tizen Studio | **6.1**, installed at `<tizen-sdk>` (non-default) |
| Tizen CLI | `SDK/tools/ide/bin/tizen` |
| SDB | `SDK/tools/sdb`, v4.2.25, **x86_64 → runs under Rosetta 2** |
| Platforms | tizen-6.0 / 6.5 / 7.0 (mobile, wearable), tizen-8.0 / 9.0 |
| Samsung TV Extension | **Not installed** (no `tv-samsung` platform) |
| Certificate profiles | `tizen-studio-data/profile/profiles.xml`, profile `tv-revamp` (active) |
| Samsung certificate (old) | `<old certificate folder>`: password lost; expires 2027-04-04; no longer used |
| Samsung certificate (current) | `<certificate folder>` (Public, Individual; TV DUID registered). Created with the VS Code Tizen extension 10.4.12. CLI profile `tv-revamp` is active. |
| Stale config | `SDK/sdk.info` still points to `~/Desktop/temp/...` (the SDK was moved) |

`scripts/env.sh` exports these paths.

### Rough edges to fix before we build and sign (needs approval)

1. ✅ `sdk.info` path fixed (backup: `SDK/sdk.info.bak-20261114`). The Eclipse IDE files still contain the old path and were left untouched.
2. ✅ New Samsung certificate + CLI profile `tv-revamp`. The timer (old cert) can no longer be updated in place; the user accepted that.
3. The TV Extension is not installed. Not needed: the VS Code Tizen extension handles certificates and devices.
4. `tizen build-web` fails at 80% with an Eclipse `ClassNotFoundException`. Not needed: `tizen package -t wgt -s tv-revamp` signs a plain folder correctly.
5. SDB depends on Rosetta, which Apple is phasing out. Longer term, move to a native arm64 SDB.
6. The standalone Package Manager has no repository configured ("network disconnected"). Not needed now.

## 3. Existing Countdown Timer (reference only — do not modify)

| Item | Value |
|---|---|
| Source | `<path to the owner's Timer project>` (git, 4 commits, clean) |
| Older copy | `TizenTVAppsDevelopment/workspace/Timer` |
| App ID / package | `<timer-app-id>` / `<dev-id>` (store-style id `<timer-store-id>`) |
| config.xml | `required_version="2.3"`, privileges `application.launch` and `mediastorage`, fullscreen |
| Stack | Vanilla HTML, CSS and JS; `tizen_web_project.yaml` build; output `Debug/SamsungTvTimer.wgt` |
| Remote handling | `document` keydown; keyCodes 37–40, 13, 10009 (Back); `tizen.application.getCurrentApplication().exit()` |
| Not used | `tizen.tvinputdevice.registerKey` (media and colour keys are not available to it) |

Patterns worth reusing: the focusable-class focus model and the Back → exit handling. The new project uses its own package ID so the two apps never collide.

## 4. Installed applications (from `sdb shell 0 vd_applist`)

24 user-facing apps. `applist` shows 376 entries in total, which includes system services.

| Title | Store app_id | Tizen app ID (for launching) | Uses |
|---|---|---|---|
| YouTube | 111299001912 | `9Ur5IzDKqV.TizenYouTube` | 2496 |
| Smart STB+ | 3202406035682 | `aR24dvmurV.SmartSTBplus` | 942 |
| Netflix | 3201907018807 | `org.tizen.netflix-app` | 405 |
| Zee 5 | 3201810017104 | `wKDM33Rods.ZEE5` | 269 |
| Prime Video | 3201910019365 | `org.tizen.primevideo` | 36 |
| Countdown Timer | <timer-store-id> | `<timer-app-id>` | 19 |
| Browser | 3202010022079 | `org.tizen.browser` | 9 |
| e-Manual | 20212100001 | `oKZtnuTBW8.emanual` | 4 |
| Sling TV | 3201707014448 | `ZmmGjO6VKO.slingtv` | 3 |
| ICC.tv | 3202405035190 | `w3k1Cc2pEu.ICC` | 3 |
| Peacock TV | 3202006020991 | `gzcc4LRFBF.Peacock` | 2 |
| Gallery | 3201710015037 | `com.samsung.tv.gallery` | 1 |
| Tubi | 3201504001965 | `3KA0pm7a7V.TubiTV` | 1 |
| Disney+ | 3201901017640 | `MCmYXNxgcu.DisneyPlus` | 0 |
| Hulu | 3201601007625 | `LBUAQX1exg.Hulu` | 0 |
| Apple TV | 3201807016597 | `com.samsung.tv.aria-video` | 0 |
| Spotify | 3201606009684 | `rJeHak5zRg.Spotify` | 0 |
| Xbox | 3202203026799 | `GHI3a0zMSx.XboxGamePass` | 0 |
| Instagram | 3202604044929 | `zigzSWa1hy.InstagramAirwave` | 0 |
| Samsung GameBreaks | 3202404035028 | `jAfAs7yVDX.TheSix` | 0 |
| Glance | 3202510042235 | `HupEmjIB4I.Glance` | 0 |
| Samsung Promotion | 3201807016658 | `yL49PNFmjW.PromotionApp` | 0 |
| Security Center | 3202009021877 | `J9fZJDMi1v.SecurityCenter` | 0 |
| klyq | 3202604044783 | `9TYrsHWbaB.klyq` | 0 |

All 24 report `is_removable=1` and `is_hidden=0`. Launchability with `tizen.application.launch()` has **not** been tested yet; that happens in Phase 1.

Leads for the Phase 1 privacy and bloatware audit: Samsung Promotion and `yL49PNFmjW.service`, Glance, GameBreaks, klyq, `com.samsung.tv.preview-downloader`, `content-grab-service` and `com.samsung.tv.context-aware-grab-control`. The last two are likely tied to ACR / Viewing Information Services.

## 5. Commands executed (all read-only)

```
sw_vers; java -version; /usr/libexec/java_home -V; file SDK/tools/sdb
arp -an; ping/nc to <tv-ip> and <tv-ip> (ports 26101 8001 8002 9197)
curl http://<tv-ip>:8001/api/v2/
sdb version; sdb connect <tv-ip>:26101; sdb devices; sdb capability
sdb get-state; sdb get-serialno; sdb help
sdb shell {uname -a, cat /etc/os-release, cat /etc/info.ini, ls, df -h, free, 0 help}   # all empty
sdb shell 0 vd_applist; sdb shell 0 applist
```

## 6. Recommendations

- Reserve fixed DHCP addresses in the router for the TV (`.79`) and the Mac (`.67`). Both changed since April, and Developer Mode is tied to the Mac's IP.
