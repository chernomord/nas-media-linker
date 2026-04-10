#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
APP_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
ENV_FILE="${NAS_LINKER_ENV_FILE:-$SCRIPT_DIR/nas-linker.env}"
PID_FILE="${NAS_LINKER_PID_FILE:-$APP_DIR/.run/nas-linker.pid}"
LOG_FILE="${NAS_LINKER_LOG_FILE:-$APP_DIR/helper.log}"
LOCK_DIR="${NAS_LINKER_LOCK_DIR:-$APP_DIR/.run/nas-linker.lock}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  for candidate in \
    /usr/local/bin/node \
    /var/packages/Node.js_v22/target/usr/local/bin/node \
    /var/packages/Node.js_v20/target/usr/local/bin/node
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN=$(resolve_node) || {
  echo "ERR: node binary not found. Install Synology Node.js package or set PATH." >&2
  exit 1
}

prepend_path_entry() {
  case ":${PATH:-}:" in
    *":$1:"*)
      return 0
      ;;
  esac

  if [ -n "${PATH:-}" ]; then
    PATH="$1:$PATH"
  else
    PATH="$1"
  fi
  export PATH
}

prepend_path_entry "$(CDPATH= cd -- "$(dirname -- "$NODE_BIN")" && pwd)"

resolve_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  for candidate in \
    /usr/local/bin/npm \
    /var/packages/Node.js_v22/target/usr/local/bin/npm \
    /var/packages/Node.js_v20/target/usr/local/bin/npm
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

NPM_BIN=$(resolve_npm) || {
  echo "ERR: npm binary not found. Install Synology Node.js package or set PATH." >&2
  exit 1
}
NODE_SQLITE_FLAG="${NAS_LINKER_NODE_SQLITE_FLAG:---experimental-sqlite}"
NPM_CI_ARGS="${NAS_LINKER_NPM_CI_ARGS:-}"

ensure_runtime_dirs() {
  mkdir -p "$(dirname -- "$PID_FILE")"
  mkdir -p "$(dirname -- "$LOG_FILE")"
}

lock_owner_summary() {
  if [ ! -d "$LOCK_DIR" ]; then
    return 1
  fi
  op=$(cat "$LOCK_DIR/op" 2>/dev/null || printf 'unknown')
  pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || printf 'unknown')
  printf '%s (pid=%s)\n' "$op" "$pid"
}

lock_is_reentrant_for_current_process_tree() {
  if [ "${NAS_LINKER_LOCK_HELD:-0}" != "1" ]; then
    return 1
  fi

  owner_pid="${NAS_LINKER_LOCK_OWNER_PID:-}"
  if [ -z "$owner_pid" ] || [ ! -d "$LOCK_DIR" ]; then
    return 1
  fi

  lock_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
  if [ "$lock_pid" != "$owner_pid" ]; then
    return 1
  fi

  kill -0 "$owner_pid" 2>/dev/null
}

acquire_ops_lock() {
  op="${1:-operation}"
  ensure_runtime_dirs

  if lock_is_reentrant_for_current_process_tree; then
    return 0
  fi

  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    printf '%s\n' "$op" > "$LOCK_DIR/op"
    NAS_LINKER_LOCK_HELD=1
    NAS_LINKER_LOCK_OWNER_PID=$$
    export NAS_LINKER_LOCK_HELD
    export NAS_LINKER_LOCK_OWNER_PID
    return 0
  fi

  summary=$(lock_owner_summary 2>/dev/null || printf 'unknown')
  echo "ERR: another nas-linker operation is already running: $summary" >&2
  return 1
}

release_ops_lock() {
  if [ "${NAS_LINKER_LOCK_HELD:-0}" != "1" ]; then
    return 0
  fi
  if [ "${NAS_LINKER_LOCK_OWNER_PID:-}" != "$$" ]; then
    return 0
  fi
  rm -rf "$LOCK_DIR"
  NAS_LINKER_LOCK_HELD=0
  NAS_LINKER_LOCK_OWNER_PID=
  export NAS_LINKER_LOCK_HELD
  export NAS_LINKER_LOCK_OWNER_PID
}

pid_from_file() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi
  pid=$(cat "$PID_FILE" 2>/dev/null || true)
  case "$pid" in
    ''|*[!0-9]*)
      return 1
      ;;
  esac
  printf '%s\n' "$pid"
}

pid_from_process_table() {
  if command -v pgrep >/dev/null 2>&1; then
    pgrep -f 'node .*helper\.mjs|helper\.mjs' | head -n 1
    return 0
  fi

  ps -ef | awk '/[h]elper\.mjs/ { print $2; exit }'
}

running_pid() {
  pid=$(pid_from_file 2>/dev/null || true)
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    printf '%s\n' "$pid"
    return 0
  fi

  pid=$(pid_from_process_table 2>/dev/null || true)
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    printf '%s\n' "$pid"
    return 0
  fi

  return 1
}

start_helper_runtime() {
  if pid=$(running_pid 2>/dev/null); then
    echo "nas-linker already running (pid=$pid)"
    return 0
  fi

  ensure_runtime_dirs

  cd "$APP_DIR"
  nohup "$NODE_BIN" "$NODE_SQLITE_FLAG" server.mjs >>"$LOG_FILE" 2>&1 &
  pid=$!
  echo "$pid" > "$PID_FILE"

  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    echo "nas-linker started (pid=$pid)"
    return 0
  fi

  echo "ERR: nas-linker failed to start; check $LOG_FILE" >&2
  return 1
}

stop_helper_runtime() {
  if ! pid=$(running_pid 2>/dev/null); then
    rm -f "$PID_FILE"
    echo "nas-linker is not running"
    return 0
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
}

restart_helper_runtime() {
  stop_helper_runtime
  start_helper_runtime
}
