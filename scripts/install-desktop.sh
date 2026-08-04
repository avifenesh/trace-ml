#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

case "$(uname -s)" in
  Darwin)
    exec bash "$repo_root/scripts/release-macos-desktop.sh" "$@"
    ;;
  Linux)
    exec bash "$repo_root/scripts/release-linux-desktop.sh" "$@"
    ;;
  *)
    printf 'error: unsupported desktop platform: %s\n' "$(uname -s)" >&2
    exit 1
    ;;
esac
