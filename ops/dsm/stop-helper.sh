#!/bin/sh
set -eu

# shellcheck disable=SC1091
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/helper-common.sh"

acquire_ops_lock "stop-helper.sh"
trap 'release_ops_lock' EXIT INT TERM

if ! pid=$(running_pid 2>/dev/null); then
  rm -f "$PID_FILE"
  echo "nas-linker is not running"
  exit 0
fi

kill "$pid" 2>/dev/null || true

i=0
while kill -0 "$pid" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 10 ]; then
    kill -9 "$pid" 2>/dev/null || true
    break
  fi
  sleep 1
done

rm -f "$PID_FILE"
echo "nas-linker stopped"
