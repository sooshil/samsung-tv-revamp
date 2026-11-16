# Source this file:  source scripts/env.sh
# Reads config/local.env (git-ignored; copy config/example.local.env) and sets up the Tizen CLI paths.
_here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
[ -f "$_here/../config/local.env" ] && . "$_here/../config/local.env"
export TIZEN_SDK="${TIZEN_SDK:-$HOME/tizen-studio}"
export SDB="$TIZEN_SDK/tools/sdb"
export TIZEN_CLI="$TIZEN_SDK/tools/ide/bin/tizen"
export SIGN_PROFILE="${SIGN_PROFILE:-tv-revamp}"
# Your TV's address, with the Developer Mode port (26101). Find the IP in the TV's Settings > Network.
export TV_ADDR="${TV_ADDR:-${TV_IP:+$TV_IP:26101}}"
if [ -z "$TV_ADDR" ]; then echo "Set TV_IP in config/local.env (see config/example.local.env)" >&2; return 1 2>/dev/null || exit 1; fi
