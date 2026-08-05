#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
applications_dir="${TRACE_ML_MAC_APP_DIR:-$HOME/Applications}"
timeout_seconds="${TRACE_ML_START_TIMEOUT_SECONDS:-20}"

usage() {
  cat <<'EOF'
Usage: scripts/smoke-installed-macos.sh [--applications-dir DIR]

Open the installed Trace ML.app through macOS Launch Services, verify that its
exact bundle executable remains alive, then terminate only that verified
process. The default app directory is ~/Applications.
EOF
}

while (($# > 0)); do
  case "$1" in
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
  printf 'error: the macOS startup smoke test must run on macOS\n' >&2
  exit 1
}
[[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] || {
  printf 'error: TRACE_ML_START_TIMEOUT_SECONDS must be a positive integer\n' >&2
  exit 1
}

app="$applications_dir/Trace ML.app"
plist="$app/Contents/Info.plist"
[[ -f "$plist" ]] || {
  printf 'error: Trace ML is not installed at %s\n' "$app" >&2
  exit 1
}

executable="$(plutil -extract CFBundleExecutable raw -o - "$plist")"
binary="$app/Contents/MacOS/$executable"
[[ -x "$binary" ]] || {
  printf 'error: installed bundle executable is missing: %s\n' "$binary" >&2
  exit 1
}

matching_pids() {
  ps -ww -axo pid=,command= | awk -v expected="$binary" '
    {
      pid = $1
      $1 = ""
      sub(/^[[:space:]]+/, "", $0)
      if ($0 == expected || index($0, expected " ") == 1) {
        print pid
      }
    }
  '
}

existing_pids="$(matching_pids)"
[[ -z "$existing_pids" ]] || {
  printf 'error: Trace ML is already running from the tested bundle: %s\n' \
    "$existing_pids" >&2
  exit 1
}

launched_pid=""
cleanup() {
  local status=$?

  if [[ -n "$launched_pid" ]] && kill -0 "$launched_pid" 2>/dev/null; then
    kill "$launched_pid" 2>/dev/null || true
    for _ in {1..10}; do
      kill -0 "$launched_pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$launched_pid" 2>/dev/null; then
      kill -KILL "$launched_pid" 2>/dev/null || true
    fi
  fi

  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

TRACE_ML_MAC_APP_DIR="$applications_dir" make -C "$repo_root" start

deadline=$((SECONDS + timeout_seconds))
while ((SECONDS < deadline)); do
  launched_pid="$(matching_pids | sed -n '1p')"
  [[ -n "$launched_pid" ]] && break
  sleep 1
done

[[ -n "$launched_pid" ]] || {
  printf 'error: Trace ML did not start within %s seconds\n' \
    "$timeout_seconds" >&2
  exit 1
}

sleep 3
kill -0 "$launched_pid" 2>/dev/null || {
  printf 'error: Trace ML exited during startup\n' >&2
  exit 1
}

printf 'Verified installed Trace ML process %s from:\n  %s\n' \
  "$launched_pid" \
  "$binary"
