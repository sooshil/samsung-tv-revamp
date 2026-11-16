#!/bin/bash
# Package (signed with the active 'tv-revamp' profile), install and launch a web app folder on the TV.
# Usage: scripts/deploy.sh <app-folder> <app-id> [--no-run]
set -euo pipefail
source "$(dirname "$0")/env.sh"
SRC="$(cd "$1" && pwd)"; APPID="$2"
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT
rsync -a --exclude '.buildResult' --exclude '*.wgt' --exclude '.DS_Store' "$SRC/" "$OUT/"
# The optional probe app needs this computer's address (only used by the self-tests).
MAC_IP="${MAC_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)}"
[ -f "$OUT/probe.js" ] && sed -i.bak "s/__MAC_IP__/$MAC_IP/" "$OUT/probe.js" && rm -f "$OUT/probe.js.bak"
"$TIZEN_CLI" package -t wgt -s "$SIGN_PROFILE" -- "$OUT" | grep -E "Package File Location|ERROR|rror" || true
WGT="$(ls "$OUT"/*.wgt)"; mv "$WGT" "$OUT/app.wgt"
"$SDB" connect "$TV_ADDR" >/dev/null 2>&1 || true
"$TIZEN_CLI" install -n app.wgt -s "$TV_ADDR" -- "$OUT" | grep -E "install completed|Installed|rror|fail" || true
[ "${3:-}" = "--no-run" ] || "$TIZEN_CLI" run -p "$APPID" -s "$TV_ADDR" | grep -E "launched|rror" || true
