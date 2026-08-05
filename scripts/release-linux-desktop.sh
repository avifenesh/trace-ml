#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

make check
if [[ "${TRACE_ML_RUN_E2E:-0}" == "1" ]]; then
  npm run test:e2e
fi
npm run tauri -- build --no-bundle -- --locked

release_binary="$repo_root/src-tauri/target/release/trace-ml"
install_args=(--binary "$release_binary")
if [[ "${TRACE_ML_RUN_SMOKE:-0}" == "1" ]]; then
  install_args+=(--smoke)
fi
if [[ "${TRACE_ML_REQUIRE_BEDROCK_SMOKE:-0}" == "1" ]]; then
  install_args+=(--require-bedrock)
fi
bash "$repo_root/scripts/install-linux-desktop.sh" "${install_args[@]}"
