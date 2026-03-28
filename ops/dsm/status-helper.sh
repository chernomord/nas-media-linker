#!/bin/sh
set -eu

# shellcheck disable=SC1091
. "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/helper-common.sh"

if summary=$(lock_owner_summary 2>/dev/null); then
  echo "nas-linker operation in progress: $summary"
  exit 0
fi

if pid=$(running_pid 2>/dev/null); then
  echo "nas-linker running (pid=$pid)"
  exit 0
fi

echo "nas-linker not running"
exit 1
