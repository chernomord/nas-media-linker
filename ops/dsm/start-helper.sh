#!/bin/sh
set -eu

# shellcheck disable=SC1091
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/helper-common.sh"

acquire_ops_lock "start-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

if pid=$(running_pid 2>/dev/null); then
  echo "nas-linker already running (pid=$pid)"
  exit 0
fi

ensure_runtime_dirs

cd "$APP_DIR"
nohup "$NODE_BIN" "$NODE_SQLITE_FLAG" helper.mjs >>"$LOG_FILE" 2>&1 &
pid=$!
echo "$pid" > "$PID_FILE"

sleep 1
if kill -0 "$pid" 2>/dev/null; then
  echo "nas-linker started (pid=$pid)"
  exit 0
fi

echo "ERR: nas-linker failed to start; check $LOG_FILE" >&2
exit 1
