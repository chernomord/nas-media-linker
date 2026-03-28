#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

NAS_LINKER_LOCK_HELD=0
# shellcheck disable=SC1091
. "$SCRIPT_DIR/helper-common.sh"

acquire_ops_lock "restart-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

"$SCRIPT_DIR/stop-helper.sh"
"$SCRIPT_DIR/start-helper.sh"
