#!/usr/bin/env bash
set -euo pipefail

# ===== config =====
TORRENTS_ROOT="${TORRENTS_ROOT:-/volume1/Movies/Torrents}"
MOVIES_ROOT="${MOVIES_ROOT:-/volume1/Movies/Movies}"
TV_ROOT="${TV_ROOT:-/volume1/Movies/TV Shows}"

if stat -c %s "$0" >/dev/null 2>&1; then
  STAT_FLAVOR="gnu"
else
  STAT_FLAVOR="bsd"
fi

# ===== helpers =====
die() { echo "ERR: $*" >&2; exit 2; }

# запрет странных сегментов пути
reject_unsafe_path() {
  local p="$1"

  # Запрещаем только реальные traversal-сегменты (`/../`), но не имена вроде `Paris..S01`.
  [[ "$p" =~ (^|/)\.\.(/|$) ]] && die "Path contains .. segment"

  # запрет не-ASCII управляющих символов
  if printf '%s' "$p" | LC_ALL=C grep -q '[^ -~]'; then
    die "Non-ASCII or control characters in path"
  fi
}

# ограничение источников (чтобы нельзя было линковать "всё что угодно")
assert_under_torrents() {
  local p="$1"
  reject_unsafe_path "$p"
  [[ "$p" == "$TORRENTS_ROOT" || "$p" == "$TORRENTS_ROOT/"* ]] || die "SRC not under $TORRENTS_ROOT"
}

# нормализация имен для пути (минимальная)
sanitize_name() {
  local s="$1"
  s="${s//\//-}"      # слеши в имени запрещаем
  s="${s//$'\n'/ }"   # переносы
  echo "$s"
}

pad2() {
  local n="$1"
  printf "%02d" "$n"
}

stat_size() {
  local p="$1"
  if [[ "$STAT_FLAVOR" == "gnu" ]]; then
    stat -c %s "$p"
  else
    stat -f %z "$p"
  fi
}

stat_mtime() {
  local p="$1"
  if [[ "$STAT_FLAVOR" == "gnu" ]]; then
    stat -c %y "$p"
  else
    stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S %z" "$p"
  fi
}

# ===== movie =====
# usage: linkmovie <src_file_or_dir> <title> <year>
linkmovie() {
  local src="${1:?src missing}"
  local title_raw="${2:?title missing}"
  local year="${3:?year missing}"

  assert_under_torrents "$src"
  if [[ -d "$src" ]]; then
    shopt -s nullglob
    local files=( "$src"/*.mkv "$src"/*.mp4 "$src"/*.avi "$src"/*.m4v )
    shopt -u nullglob

    ((${#files[@]} > 0)) || die "No video files in directory: $src"
    ((${#files[@]} == 1)) || die "Multiple video files in directory, pass exact file path: $src"
    src="${files[0]}"
  else
    [[ -f "$src" ]] || die "SRC is not a file: $src"
  fi
  [[ "$year" =~ ^[0-9]{4}$ ]] || die "YEAR must be 4 digits"

  local title
  title="$(sanitize_name "$title_raw")"

  local dst_dir="$MOVIES_ROOT/$title ($year)"
  mkdir -p "$dst_dir"

  local ext="${src##*.}"
  local dst="$dst_dir/$title ($year).$ext"

  ln -f "$src" "$dst"

  echo "Linked movie:"
  echo "  $src"
  echo "  -> $dst"
}

# ===== season =====
# usage: linkseason <src_dir_or_prefix> <title> <season_num> <year>
# src_dir_or_prefix: директория торрента (как у тебя сейчас), внутри неё ищем серии.
linkseason() {
  local src_dir="${1:?src_dir missing}"
  local title_raw="${2:?title missing}"
  local season="${3:?season missing}"
  local year="${4:?year missing}"

  assert_under_torrents "$src_dir"
  [[ -d "$src_dir" ]] || die "SRC is not a directory: $src_dir"
  [[ "$season" =~ ^[0-9]+$ ]] || die "SEASON must be integer"
  [[ "$year" =~ ^[0-9]{4}$ ]] || die "YEAR must be 4 digits"

  local title
  title="$(sanitize_name "$title_raw")"

  local season_padded
  season_padded="$(pad2 "$season")"

  local show_dir="$TV_ROOT/$title ($year)"
  local dst_dir="$show_dir/Season $season_padded"
  mkdir -p "$dst_dir"

  # Линкуем все видеофайлы из src_dir (можно расширить список)
  shopt -s nullglob
  local files=( "$src_dir"/*.mkv "$src_dir"/*.mp4 "$src_dir"/*.avi "$src_dir"/*.m4v )
  shopt -u nullglob

  ((${#files[@]} > 0)) || die "No video files in $src_dir"

  # Схема именования: оставляем исходное имя файла (часто там уже SxxEyy/эпизод)
  local f bn dst
  for f in "${files[@]}"; do
    bn="$(basename "$f")"
    dst="$dst_dir/$bn"
    ln -f "$f" "$dst"
    echo "  $f"
    echo "  -> $dst"
  done

  echo "Linked season:"
  echo "  show: $title ($year)"
  echo "  season: $season_padded"
  echo "  from: $src_dir"
  echo "  to: $dst_dir"
}

# ====== LIST FOLDERS ======
# вывод доступных папок
listdir() {
  local dir="${1:?dir missing}"

  reject_unsafe_path "$dir"
  [[ -d "$dir" ]] || die "Not a directory"

  # allowlist корней
  case "$dir" in
    "$TORRENTS_ROOT"|"$TORRENTS_ROOT/"* ) ;;
    "$MOVIES_ROOT"|"$MOVIES_ROOT/"* ) ;;
    "$TV_ROOT"|"$TV_ROOT/"* ) ;;
    *) die "Directory not allowed" ;;
  esac

  # формат: type|name|size|mtime
  # type: d / f
  while IFS= read -r -d '' p; do
    name="$(basename "$p")"
    if [[ -d "$p" ]]; then
      type="d"
      size="-"
    else
      type="f"
      size="$(stat_size "$p" 2>/dev/null || echo "-")"
    fi
    mtime="$(stat_mtime "$p" 2>/dev/null || echo "-")"
    echo "$type|$name|$size|$mtime"
  done < <(find "$dir" -maxdepth 1 -mindepth 1 -print0 | sort -z)
}


# ===== CLI wrapper =====
cmd="${1:-}"
shift || true

case "$cmd" in
  linkmovie) linkmovie "$@" ;;
  linkseason) linkseason "$@" ;;
  listdir) listdir "$@" ;;
  *)
    cat >&2 <<EOF
Usage:
  $0 linkmovie  <src_file> <title> <year>
  $0 linkseason <src_dir>  <title> <season_num> <year>
  $0 listdir

Config:
  TORRENTS_ROOT=$TORRENTS_ROOT
  MOVIES_ROOT=$MOVIES_ROOT
  TV_ROOT=$TV_ROOT
EOF
    exit 2
    ;;
esac


# /volume1/scripts/linkmedia.sh linkmovie "/volume1/Movies/Torrents/Movies/Demon.Slayer.Kimetsu.No.Yaiba.Infinity.Castle.1080p.CR-Cassu.mkv" "Demon Slayer Kimetsu no Yaiba Infinity Castle" 2025
