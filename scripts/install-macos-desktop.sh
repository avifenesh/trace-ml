#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_app="$repo_root/src-tauri/target/release/bundle/macos/Trace ML.app"
applications_dir="${TRACE_ML_MAC_APP_DIR:-$HOME/Applications}"

usage() {
  cat <<'EOF'
Usage: scripts/install-macos-desktop.sh [--app PATH] [--applications-dir DIR]

Install a locally built Trace ML.app for the current macOS user. The default
destination is ~/Applications/Trace ML.app.
EOF
}

while (($# > 0)); do
  case "$1" in
    --app)
      [[ $# -ge 2 ]] || {
        printf 'error: --app requires a path\n' >&2
        exit 2
      }
      source_app=$2
      shift 2
      ;;
    --applications-dir)
      [[ $# -ge 2 ]] || {
        printf 'error: --applications-dir requires a path\n' >&2
        exit 2
      }
      applications_dir=$2
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf 'error: unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

[[ "$(uname -s)" == Darwin ]] || {
  printf 'error: the macOS app installer must run on macOS\n' >&2
  exit 1
}

for command_name in ditto plutil; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'error: required macOS command not found: %s\n' "$command_name" >&2
    exit 1
  }
done

validate_app() {
  local app_path=$1
  local plist="$app_path/Contents/Info.plist"
  local identifier
  local executable

  [[ -d "$app_path" && -f "$plist" ]] || {
    printf 'error: invalid macOS app bundle: %s\n' "$app_path" >&2
    return 1
  }
  identifier="$(plutil -extract CFBundleIdentifier raw -o - "$plist")"
  [[ "$identifier" == "com.avifenesh.traceml" ]] || {
    printf 'error: unexpected bundle identifier: %s\n' "$identifier" >&2
    return 1
  }
  executable="$(plutil -extract CFBundleExecutable raw -o - "$plist")"
  [[ -n "$executable" && "$executable" != */* ]] || {
    printf 'error: invalid bundle executable: %s\n' "$executable" >&2
    return 1
  }
  [[ -x "$app_path/Contents/MacOS/$executable" ]] || {
    printf 'error: bundle executable is missing: %s\n' \
      "$app_path/Contents/MacOS/$executable" >&2
    return 1
  }
  [[ -f "$app_path/Contents/Resources/icon.icns" ]] || {
    printf 'error: bundle icon is missing\n' >&2
    return 1
  }
  [[ -f "$app_path/Contents/Resources/LICENSE" ]] || {
    printf 'error: bundled project license is missing\n' >&2
    return 1
  }
  [[ -f "$app_path/Contents/Resources/THIRD_PARTY_NOTICES.md" ]] || {
    printf 'error: bundled third-party notices are missing\n' >&2
    return 1
  }
}

validate_app "$source_app"
mkdir -p "$applications_dir"

destination="$applications_dir/Trace ML.app"
transaction_dir="$(mktemp -d "$applications_dir/.trace-ml-install.XXXXXX")"
staged_app="$transaction_dir/Trace ML.app"
backup_app="$transaction_dir/previous.app"
destination_backed_up=false
destination_installed=false
transaction_committed=false

cleanup() {
  local status=$?
  if [[ "$transaction_committed" != true ]]; then
    if [[ "$destination_installed" == true ]]; then
      rm -rf "$destination"
    fi
    if [[ "$destination_backed_up" == true && -d "$backup_app" ]]; then
      mv "$backup_app" "$destination" || true
    fi
  fi
  rm -rf "$transaction_dir"
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

ditto "$source_app" "$staged_app"
validate_app "$staged_app"

if [[ -e "$destination" || -L "$destination" ]]; then
  [[ -d "$destination" && ! -L "$destination" ]] || {
    printf 'error: refusing to replace non-app path: %s\n' "$destination" >&2
    exit 1
  }
  mv "$destination" "$backup_app"
  destination_backed_up=true
fi

mv "$staged_app" "$destination"
destination_installed=true
validate_app "$destination"
transaction_committed=true

printf 'Installed Trace ML:\n'
printf '  app: %s\n' "$destination"
printf '  start: make start\n'
