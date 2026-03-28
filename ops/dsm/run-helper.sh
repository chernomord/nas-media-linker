#!/bin/sh
set -eu

# shellcheck disable=SC1091
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/helper-common.sh"

cd "$APP_DIR"
exec "$NODE_BIN" "$NODE_SQLITE_FLAG" helper.mjs
