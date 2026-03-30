#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# shellcheck disable=SC1091
. "$SCRIPT_DIR/helper-common.sh"

acquire_ops_lock "deploy-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

cd "$APP_DIR"

echo "nas-linker deploy: npm ci"
if [ -n "$NPM_CI_ARGS" ]; then
  # shellcheck disable=SC2086
  "$NPM_BIN" ci $NPM_CI_ARGS
else
  "$NPM_BIN" ci
fi

echo "nas-linker deploy: build UI"
"$NPM_BIN" run build:ui

echo "nas-linker deploy: restart helper"
restart_helper_runtime
