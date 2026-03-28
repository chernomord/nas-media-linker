#!/bin/sh
set -eu

# Local convenience launcher.
# Copy and edit values for your own environment.

export EXECUTOR_MODE="${EXECUTOR_MODE:-node}"

# Rollback-only SSH settings. Required only for EXECUTOR_MODE=bash.
export NAS_HOST="${NAS_HOST:-127.0.0.1}"
export NAS_USER="${NAS_USER:-replace_me}"
export NAS_KEY_PATH="${NAS_KEY_PATH:-$HOME/.ssh/replace_me}"
export NAS_SCRIPT="${NAS_SCRIPT:-/volume1/scripts/linkmedia.sh}"

# Optional metadata search settings.
export PLEX_DISCOVER_URL="${PLEX_DISCOVER_URL:-https://discover.provider.plex.tv}"
export PLEX_DISCOVER_TOKEN="${PLEX_DISCOVER_TOKEN:-replace_me}"
export PLEX_DISCOVER_PRODUCT="${PLEX_DISCOVER_PRODUCT:-Plex Web}"
export PLEX_DISCOVER_VERSION="${PLEX_DISCOVER_VERSION:-4.147.1}"
export PLEX_DISCOVER_CLIENT_ID="${PLEX_DISCOVER_CLIENT_ID:-replace_me}"
export PLEX_DISCOVER_PLATFORM="${PLEX_DISCOVER_PLATFORM:-Safari}"
export PLEX_DISCOVER_PLATFORM_VERSION="${PLEX_DISCOVER_PLATFORM_VERSION:-26.2}"
export PLEX_DISCOVER_FEATURES="${PLEX_DISCOVER_FEATURES:-external-media,indirect-media,hub-style-list}"
export PLEX_DISCOVER_MODEL="${PLEX_DISCOVER_MODEL:-bundled}"
export PLEX_DISCOVER_DEVICE="${PLEX_DISCOVER_DEVICE:-OSX}"
export PLEX_DISCOVER_DEVICE_RESOLUTION="${PLEX_DISCOVER_DEVICE_RESOLUTION:-1512x982}"
export PLEX_DISCOVER_PROVIDER_VERSION="${PLEX_DISCOVER_PROVIDER_VERSION:-7.2}"
export PLEX_DISCOVER_TEXT_FORMAT="${PLEX_DISCOVER_TEXT_FORMAT:-plain}"
export PLEX_DISCOVER_DRM="${PLEX_DISCOVER_DRM:-fairplay}"
export PLEX_DISCOVER_LANGUAGE="${PLEX_DISCOVER_LANGUAGE:-en}"
export OMDB_API_KEY="${OMDB_API_KEY:-replace_me}"

node --experimental-sqlite helper.mjs
