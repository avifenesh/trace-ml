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
cargo fmt --version >/dev/null 2>&1 ||
  fail "the Rust rustfmt component is required; run: rustup component add rustfmt"
cargo clippy --version >/dev/null 2>&1 ||
  fail "the Rust clippy component is required; run: rustup component add clippy"

platform="$(uname -s)"
case "$platform" in
  Darwin)
    for command_name in sw_vers xcode-select xcrun; do
      command -v "$command_name" >/dev/null 2>&1 ||
        fail "Xcode Command Line Tools are required; run: xcode-select --install"
    done
    xcode-select -p >/dev/null 2>&1 ||
      fail "Xcode Command Line Tools are not configured; run: xcode-select --install"
    xcrun --find clang >/dev/null 2>&1 ||
      fail "the active Xcode toolchain does not provide clang"
    xcrun --show-sdk-path >/dev/null 2>&1 ||
      fail "the active Xcode toolchain does not provide a macOS SDK"
    macos_version="$(sw_vers -productVersion)"
    node - "$macos_version" <<'NODE'
const [major = 0, minor = 0] = process.argv[2].split(".").map(Number);
if (major < 13 || (major === 13 && minor < 5)) {
  console.error(
    `error: macOS ${process.argv[2]} is unsupported; Trace ML requires macOS 13.5 or newer`,
  );
  process.exit(1);
}
NODE
    ;;
  Linux)
    for command_name in \
      desktop-file-validate \
      gio \
      gtk-update-icon-cache \
      pkg-config \
      update-desktop-database; do
      command -v "$command_name" >/dev/null 2>&1 ||
        fail "$command_name and the Linux desktop packages are required; see README.md"
    done
    pkg-config --exists webkit2gtk-4.1 ||
      fail "webkit2gtk-4.1 development files are required; see README.md"
    ;;
  *)
    fail "unsupported desktop platform: $platform"
    ;;
esac

node <<'NODE'
const [major, minor, patch] = process.versions.node.split(".").map(Number);
const atLeast = (expectedMajor, expectedMinor, expectedPatch) =>
  major === expectedMajor &&
  (minor > expectedMinor ||
    (minor === expectedMinor && patch >= expectedPatch));
const supported =
  atLeast(22, 22, 2) ||
  atLeast(24, 15, 0) ||
  major >= 26;
if (!supported) {
  console.error(
    `error: Node ${process.versions.node} is unsupported; install the latest ` +
      "Node 24 LTS (^22.22.2 || ^24.15.0 || >=26.0.0)",
  );
  process.exit(1);
}
NODE

rust_version="$(rustc --version | awk '{print $2}')"
node - "$rust_version" <<'NODE'
const actual = process.argv[2].split(".").map(Number);
const minimum = [1, 88, 0];
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
