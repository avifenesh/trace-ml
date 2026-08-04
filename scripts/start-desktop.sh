#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  Darwin)
    app_dir="${TRACE_ML_MAC_APP_DIR:-$HOME/Applications}"
    app="$app_dir/Trace ML.app"
    [[ -d "$app" ]] || {
      printf 'error: Trace ML is not installed; run: make install\n' >&2
      exit 1
    }
    exec open "$app"
    ;;
  Linux)
    data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
    desktop_entry="$data_home/applications/trace-ml.desktop"
    launcher="$HOME/.local/bin/trace-ml-launcher"
    if command -v gio >/dev/null 2>&1 && [[ -f "$desktop_entry" ]]; then
      exec gio launch "$desktop_entry"
    fi
    [[ -x "$launcher" ]] || {
      printf 'error: Trace ML is not installed; run: make install\n' >&2
      exit 1
    }
    exec "$launcher"
    ;;
  *)
    printf 'error: unsupported desktop platform: %s\n' "$(uname -s)" >&2
    exit 1
    ;;
esac
