#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# shellcheck disable=SC1091
. "$SCRIPT_DIR/helper-common.sh"

acquire_ops_lock "restart-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

restart_helper_runtime
