#!/bin/bash
# Registers your Samsung certificate (made with the VS Code Tizen extension, see README step 4) as a Tizen CLI signing profile.
# It does not create or change certificates. The passwords are read silently and never stored by this script.
# Usage: scripts/register-signing-profile.sh <folder with author.p12 and distributor.p12> [profile-name]
set -euo pipefail
source "$(dirname "$0")/env.sh"
CERT_DIR="${1:?Usage: $0 <certificate folder> [profile-name]}"
PROFILE="${2:-$SIGN_PROFILE}"

read -r -s -p "Author certificate password: " AUTHOR_PW; echo
read -r -s -p "Distributor certificate password (Enter = same as author): " DIST_PW; echo
DIST_PW="${DIST_PW:-$AUTHOR_PW}"

"$TIZEN_CLI" security-profiles add -n "$PROFILE" -A \
  -a "$CERT_DIR/author.p12" -p "$AUTHOR_PW" \
  -d "$CERT_DIR/distributor.p12" -dp "$DIST_PW"
unset AUTHOR_PW DIST_PW
"$TIZEN_CLI" security-profiles list
# Rollback: "$TIZEN_CLI" security-profiles remove -n "$PROFILE"
