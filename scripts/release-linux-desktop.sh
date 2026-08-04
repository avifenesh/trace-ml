#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm run check:manifests
npm run lint
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:e2e
npm run tauri build

release_binary="$repo_root/src-tauri/target/release/trace-ml"
install_args=(--binary "$release_binary" --smoke)
if [[ "${TRACE_ML_REQUIRE_BEDROCK_SMOKE:-0}" == "1" ]]; then
  install_args+=(--require-bedrock)
fi
bash "$repo_root/scripts/install-linux-desktop.sh" "${install_args[@]}"
