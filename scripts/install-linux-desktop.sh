#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
release_binary="$repo_root/src-tauri/target/release/trace-ml"
run_smoke=false
require_bedrock=false
self_test=false

usage() {
  cat <<'EOF'
Usage: scripts/install-linux-desktop.sh [--binary PATH] [--smoke]
       scripts/install-linux-desktop.sh --self-test

Install a Trace ML release build and its GNOME desktop integration for the
current user. The default binary is src-tauri/target/release/trace-ml.

--smoke keeps the previous installation recoverable until the installed app
passes its GUI smoke. --require-bedrock implies --smoke and requires the
credentialed Bedrock helper during that smoke.
EOF
}

while (($# > 0)); do
  case "$1" in
    --binary)
      [[ $# -ge 2 ]] || {
        printf 'error: --binary requires a path\n' >&2
        exit 2
      }
      release_binary=$2
      shift 2
      ;;
    --smoke)
      run_smoke=true
      shift
      ;;
    --require-bedrock)
      run_smoke=true
      require_bedrock=true
      shift
      ;;
    --self-test)
      self_test=true
      shift
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

temporary_dir="$(mktemp -d)"
transaction_active=false
transaction_committed=false
declare -a transaction_destinations=()
declare -a transaction_backups=()
declare -a transaction_existed=()

atomic_copy() {
  local mode=$1
  local source_path=$2
  local destination_path=$3
  local destination_dir
  local staged_path

  destination_dir="$(dirname -- "$destination_path")"
  mkdir -p -- "$destination_dir"
  staged_path="$(mktemp --tmpdir="$destination_dir" '.trace-ml.install.XXXXXX')"
  if ! install -m "$mode" -- "$source_path" "$staged_path"; then
    rm -f -- "$staged_path"
    return 1
  fi
  if ! mv -fT -- "$staged_path" "$destination_path"; then
    rm -f -- "$staged_path"
    return 1
  fi
}

begin_transaction() {
  local destination_path
  local index=0

  transaction_active=true
  transaction_committed=false
  for destination_path in "$@"; do
    if [[ -d "$destination_path" && ! -L "$destination_path" ]]; then
      printf 'error: refusing to replace directory: %s\n' \
        "$destination_path" >&2
      return 1
    fi
    transaction_destinations+=("$destination_path")
    transaction_backups+=("$temporary_dir/backup-$index")
    if [[ -e "$destination_path" || -L "$destination_path" ]]; then
      cp -a -- "$destination_path" "$temporary_dir/backup-$index"
      transaction_existed+=(true)
    else
      transaction_existed+=(false)
    fi
    index=$((index + 1))
  done
}

refresh_desktop_caches() {
  update-desktop-database "$applications_dir"
  gtk-update-icon-cache \
    --force \
    --ignore-theme-index \
    --quiet \
    "$icon_theme_dir"
}

rollback_transaction() {
  local quiet=${1:-false}
  local destination_path
  local destination_dir
  local index
  local restored_path

  [[ "$transaction_active" == true && "$transaction_committed" == false ]] ||
    return 0

  if [[ "$quiet" == false ]]; then
    printf 'Installation failed; restoring the previous Trace ML installation.\n' \
      >&2
  fi
  for ((index = 0; index < ${#transaction_destinations[@]}; index += 1)); do
    destination_path=${transaction_destinations[index]}
    if [[ "${transaction_existed[index]}" == true ]]; then
      destination_dir="$(dirname -- "$destination_path")"
      mkdir -p -- "$destination_dir"
      restored_path="$(
        mktemp --tmpdir="$destination_dir" '.trace-ml.rollback.XXXXXX'
      )"
      rm -f -- "$restored_path"
      if cp -a -- "${transaction_backups[index]}" "$restored_path"; then
        mv -fT -- "$restored_path" "$destination_path" ||
          printf 'warning: could not restore %s\n' "$destination_path" >&2
      else
        rm -f -- "$restored_path"
        printf 'warning: could not stage rollback for %s\n' \
          "$destination_path" >&2
      fi
    else
      rm -f -- "$destination_path" ||
        printf 'warning: could not remove new file %s\n' \
          "$destination_path" >&2
    fi
  done

  if [[ -n "${applications_dir:-}" && -n "${icon_theme_dir:-}" ]]; then
    refresh_desktop_caches ||
      printf 'warning: could not refresh desktop caches after rollback\n' >&2
  fi
}

cleanup() {
  local status=$?

  if ((status != 0)); then
    rollback_transaction
  fi
  rm -rf -- "$temporary_dir"
  exit "$status"
}
trap cleanup EXIT

run_transaction_self_test() {
  local fixture_dir="$temporary_dir/self-test"
  local existing_destination="$fixture_dir/install/existing"
  local new_destination="$fixture_dir/install/new"
  local new_payload="$fixture_dir/new-payload"

  mkdir -p -- "$(dirname -- "$existing_destination")"
  printf 'previous\n' >"$existing_destination"
  printf 'replacement\n' >"$new_payload"

  begin_transaction "$existing_destination" "$new_destination"
  atomic_copy 0644 "$new_payload" "$existing_destination"
  atomic_copy 0644 "$new_payload" "$new_destination"
  rollback_transaction true
  transaction_active=false

  [[ "$(<"$existing_destination")" == "previous" ]] || {
    printf 'error: self-test did not restore an existing file\n' >&2
    return 1
  }
  [[ ! -e "$new_destination" ]] || {
    printf 'error: self-test did not remove a newly installed file\n' >&2
    return 1
  }

  printf 'Installer transaction self-test passed:\n'
  printf '  existing files are restored after failure\n'
  printf '  files created by a failed install are removed\n'
}

if [[ "$self_test" == true ]]; then
  (($# == 0)) || {
    printf 'error: --self-test does not accept additional arguments\n' >&2
    exit 2
  }
  run_transaction_self_test
  exit 0
fi

required_commands=(
  cp
  desktop-file-validate
  dirname
  gio
  grep
  gtk-update-icon-cache
  id
  install
  mkdir
  mktemp
  mv
  readlink
  rm
  update-desktop-database
)
for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null 2>&1 || {
    printf 'error: required command not found: %s\n' "$command_name" >&2
    exit 1
  }
done

: "${HOME:?error: HOME is not set}"
[[ -f "$release_binary" && -x "$release_binary" ]] || {
  printf 'error: release binary is not executable: %s\n' "$release_binary" >&2
  printf 'Build it first with: npm run tauri build\n' >&2
  exit 1
}

release_binary="$(readlink -f -- "$release_binary")"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
bin_dir="$HOME/.local/bin"
applications_dir="$data_home/applications"
icon_theme_dir="$data_home/icons/hicolor"
notices_dir="$data_home/trace-ml"
desktop_dir="$HOME/Desktop"
if command -v xdg-user-dir >/dev/null 2>&1; then
  configured_desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
  if [[ "$configured_desktop_dir" == /* ]]; then
    desktop_dir="$configured_desktop_dir"
  fi
fi
binary_destination="$bin_dir/trace-ml"
launcher_destination="$bin_dir/trace-ml-launcher"
menu_destination="$applications_dir/trace-ml.desktop"
desktop_destination="$desktop_dir/Trace ML.desktop"
license_destination="$notices_dir/LICENSE"
third_party_notices_destination="$notices_dir/THIRD_PARTY_NOTICES.md"

printf -v binary_shell '%q' "$binary_destination"
launcher_contents="$(<"$repo_root/packaging/linux/trace-ml-launcher.in")"
launcher_contents="${launcher_contents//@BINARY_PATH_SHELL@/$binary_shell}"
printf '%s\n' "$launcher_contents" >"$temporary_dir/trace-ml-launcher"
chmod 0755 "$temporary_dir/trace-ml-launcher"

desktop_exec=$launcher_destination
desktop_exec=${desktop_exec//\\/\\\\}
desktop_exec=${desktop_exec//\"/\\\"}
desktop_exec=${desktop_exec//\`/\\\`}
desktop_exec=${desktop_exec//\$/\\\$}
desktop_contents="$(<"$repo_root/packaging/linux/trace-ml.desktop.in")"
desktop_contents="${desktop_contents//@LAUNCHER_PATH_EXEC@/$desktop_exec}"
printf '%s\n' "$desktop_contents" >"$temporary_dir/trace-ml.desktop"
desktop-file-validate "$temporary_dir/trace-ml.desktop"

icon_sources=(
  "32:$repo_root/src-tauri/icons/32x32.png"
  "64:$repo_root/src-tauri/icons/64x64.png"
  "128:$repo_root/src-tauri/icons/128x128.png"
  "256:$repo_root/src-tauri/icons/128x128@2x.png"
  "512:$repo_root/src-tauri/icons/icon.png"
)
icon_destinations=()
for icon_source in "${icon_sources[@]}"; do
  size=${icon_source%%:*}
  source_path=${icon_source#*:}
  [[ -f "$source_path" ]] || {
    printf 'error: icon source is missing: %s\n' "$source_path" >&2
    exit 1
  }
  icon_destinations+=(
    "$icon_theme_dir/${size}x${size}/apps/trace-ml.png"
  )
done

begin_transaction \
  "$binary_destination" \
  "$launcher_destination" \
  "$license_destination" \
  "$third_party_notices_destination" \
  "${icon_destinations[@]}" \
  "$menu_destination" \
  "$desktop_destination"

atomic_copy 0755 "$release_binary" "$binary_destination"
atomic_copy 0755 "$temporary_dir/trace-ml-launcher" "$launcher_destination"
atomic_copy 0644 "$repo_root/LICENSE" "$license_destination"
atomic_copy \
  0644 \
  "$repo_root/THIRD_PARTY_NOTICES.md" \
  "$third_party_notices_destination"
for ((index = 0; index < ${#icon_sources[@]}; index += 1)); do
  source_path=${icon_sources[index]#*:}
  atomic_copy 0644 "$source_path" "${icon_destinations[index]}"
done
atomic_copy 0644 "$temporary_dir/trace-ml.desktop" "$menu_destination"
atomic_copy 0755 "$temporary_dir/trace-ml.desktop" "$desktop_destination"
desktop-file-validate "$menu_destination" "$desktop_destination"

uid="$(id -u)"
: "${XDG_RUNTIME_DIR:=/run/user/$uid}"
if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "$XDG_RUNTIME_DIR/bus" ]]; then
  export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
fi
[[ -x "$desktop_destination" ]] || {
  printf 'error: desktop shortcut is not executable: %s\n' \
    "$desktop_destination" >&2
  exit 1
}
if gio set --type=string "$desktop_destination" metadata::trusted true \
  2>/dev/null; then
  desktop_info="$(
    gio info \
      -a metadata::trusted \
      "$desktop_destination" 2>/dev/null ||
      true
  )"
  if ! grep -Fq 'metadata::trusted: true' <<<"$desktop_info"; then
    printf 'warning: this desktop does not retain GNOME launcher trust metadata\n' \
      >&2
  fi
else
  printf 'warning: this desktop does not support GNOME launcher trust metadata\n' \
    >&2
fi

refresh_desktop_caches

if [[ "$run_smoke" == true ]]; then
  smoke_args=()
  if [[ "$require_bedrock" == true ]]; then
    smoke_args+=(--require-bedrock)
  fi
  bash "$repo_root/scripts/smoke-installed-linux.sh" "${smoke_args[@]}"
fi

transaction_committed=true
transaction_active=false

printf 'Installed Trace ML:\n'
printf '  binary:  %s\n' "$binary_destination"
printf '  menu:    %s\n' "$menu_destination"
printf '  desktop: %s\n' "$desktop_destination"
printf '  notices: %s\n' "$notices_dir"
if [[ "$run_smoke" == true ]]; then
  printf '  smoke:   passed before transaction commit\n'
fi
