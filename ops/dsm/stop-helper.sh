#!/bin/sh
set -eu

# shellcheck disable=SC1091
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/helper-common.sh"

acquire_ops_lock "stop-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

stop_helper_runtime
