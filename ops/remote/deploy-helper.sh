#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
LOCAL_APP_DIR="${NAS_LINKER_LOCAL_APP_DIR:-$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)}"
REMOTE_APP_DIR="${NAS_LINKER_REMOTE_APP_DIR:-/volume1/scripts/nas-linker}"
SSH_TARGET="${NAS_LINKER_SSH_TARGET:-movies_linker@synology.local}"
SSH_LOG_LEVEL="${NAS_LINKER_SSH_LOG_LEVEL:-ERROR}"
ARCHIVE_FILE="${NAS_LINKER_ARCHIVE_FILE:-}"

if [ ! -f "$LOCAL_APP_DIR/package.json" ] || [ ! -d "$LOCAL_APP_DIR/ops/dsm" ]; then
  echo "ERR: local app dir does not look like a nas-linker checkout: $LOCAL_APP_DIR" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ERR: ssh binary not found" >&2
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "ERR: tar binary not found" >&2
  exit 1
fi

quote_sh() {
  printf "%s" "$1" | sed "s/'/'\\\\''/g"
}

REMOTE_APP_DIR_QUOTED=$(quote_sh "$REMOTE_APP_DIR")
REMOTE_MKDIR_CMD="mkdir -p '$REMOTE_APP_DIR_QUOTED'"
REMOTE_DEPLOY_CMD="cd '$REMOTE_APP_DIR_QUOTED' && sh ./ops/dsm/deploy-helper.sh"
SSH_BASE_OPTS="-o LogLevel=$SSH_LOG_LEVEL"

if [ -n "$ARCHIVE_FILE" ]; then
  :
else
  ARCHIVE_FILE=$(mktemp "${TMPDIR:-/tmp}/nas-linker-remote-deploy.XXXXXX.tar")
fi

cleanup() {
  rm -f "$ARCHIVE_FILE"
}

trap cleanup EXIT INT TERM

echo "nas-linker remote deploy: target=$SSH_TARGET"
echo "nas-linker remote deploy: ensure remote app dir"
ssh $SSH_BASE_OPTS "$SSH_TARGET" "$REMOTE_MKDIR_CMD"

echo "nas-linker remote deploy: archive checkout"
tar --no-xattrs --no-mac-metadata -C "$LOCAL_APP_DIR" \
  --exclude='./.git' \
  --exclude='./.run' \
  --exclude='./data' \
  --exclude='./node_modules' \
  --exclude='./helper.log' \
  --exclude='./ops/dsm/nas-linker.env' \
  -cf "$ARCHIVE_FILE" .

echo "nas-linker remote deploy: sync checkout"
ssh $SSH_BASE_OPTS "$SSH_TARGET" "tar --no-same-owner --no-same-permissions -xf - -C '$REMOTE_APP_DIR_QUOTED'" < "$ARCHIVE_FILE"

echo "nas-linker remote deploy: run remote deploy script"
ssh $SSH_BASE_OPTS "$SSH_TARGET" "$REMOTE_DEPLOY_CMD"
echo "nas-linker remote deploy: done"
