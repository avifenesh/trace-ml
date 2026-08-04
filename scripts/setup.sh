#!/usr/bin/env bash
set -euo pipefail

check_only=false

usage() {
  cat <<'EOF'
Usage: scripts/setup.sh [--check]

Check Trace ML desktop prerequisites. Without --check, install the pinned npm
dependencies and synchronize the local Pyodide and authored-manifest assets.
EOF
}

case "${1:-}" in
  "")
    ;;
  --check)
    check_only=true
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

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

for command_name in node npm cargo rustc; do
  command -v "$command_name" >/dev/null 2>&1 ||
    fail "$command_name is required"
done

platform="$(uname -s)"
case "$platform" in
  Darwin)
    command -v xcode-select >/dev/null 2>&1 ||
      fail "Xcode Command Line Tools are required; run: xcode-select --install"
    xcode-select -p >/dev/null 2>&1 ||
      fail "Xcode Command Line Tools are not configured; run: xcode-select --install"
    ;;
  Linux)
    command -v pkg-config >/dev/null 2>&1 ||
      fail "pkg-config and the Tauri Linux development packages are required; see README.md"
    pkg-config --exists webkit2gtk-4.1 ||
      fail "webkit2gtk-4.1 development files are required; see README.md"
    ;;
  *)
    fail "unsupported desktop platform: $platform"
    ;;
esac

node <<'NODE'
const [major, minor] = process.versions.node.split(".").map(Number);
const supported =
  (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 12) ||
  major > 22;
if (!supported) {
  console.error(
    `error: Node ${process.versions.node} is unsupported; install Node 24 LTS (` +
      "Vite requires ^20.19.0 or >=22.12.0)",
  );
  process.exit(1);
}
NODE

rust_version="$(rustc --version | awk '{print $2}')"
node - "$rust_version" <<'NODE'
const actual = process.argv[2].split(".").map(Number);
const minimum = [1, 77, 2];
for (let index = 0; index < minimum.length; index += 1) {
  if ((actual[index] ?? 0) > minimum[index]) process.exit(0);
  if ((actual[index] ?? 0) < minimum[index]) {
    console.error(
      `error: Rust ${process.argv[2]} is unsupported; install Rust ${minimum.join(".")} or newer`,
    );
    process.exit(1);
  }
}
NODE

printf 'Trace ML prerequisites are ready on %s (Node %s, Rust %s).\n' \
  "$platform" \
  "$(node --version)" \
  "$rust_version"

if [[ "$check_only" == true ]]; then
  exit 0
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

npm ci
npm run prebuild

printf '\nSetup complete.\n'
printf '  Desktop development: make dev\n'
printf '  Native installation: make install\n'
printf '  Browser development: make web\n'
