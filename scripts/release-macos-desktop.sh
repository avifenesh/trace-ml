#!/usr/bin/env bash
set -euo pipefail

[[ "$(uname -s)" == Darwin ]] || {
  printf 'error: macOS releases must be built on macOS\n' >&2
  exit 1
}

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm run check:manifests
npm run lint
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
if [[ "${TRACE_ML_RUN_E2E:-0}" == "1" ]]; then
  npm run test:e2e
fi
npm run tauri build -- --bundles app

bash "$repo_root/scripts/install-macos-desktop.sh"
