#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
timeout_seconds="${TRACE_ML_SMOKE_TIMEOUT:-45}"
smoke_state_dir=""
proof_path=""
app_pid=""
app_start_time=""
expected_executable=""

usage() {
  cat <<'EOF'
Usage: scripts/smoke-installed-linux.sh [--self-test] [--require-bedrock]

Launch and verify the exact installed Trace ML process created for this smoke.
The launcher proof binds a per-launch nonce to its PID, executable, and process
start time. The smoke also submits one authored helper question and requires a
completed response. By default, local or Bedrock helper mode passes; use
--require-bedrock for the optional credentialed semantic check.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

collect_new_ids() {
  local -n baseline_ref=$1
  local -n current_ref=$2
  local -n result_ref=$3
  local baseline_id
  local candidate_id
  local was_present

  result_ref=()
  for candidate_id in "${current_ref[@]}"; do
    was_present=false
    for baseline_id in "${baseline_ref[@]}"; do
      if [[ "$candidate_id" == "$baseline_id" ]]; then
        was_present=true
        break
      fi
    done
    [[ "$was_present" == true ]] || result_ref+=("$candidate_id")
  done
}

process_start_time() {
  local pid=$1

  [[ -r "/proc/$pid/stat" ]] || return 1
  awk '{ print $22 }' "/proc/$pid/stat"
}

process_matches_proof() {
  local pid=$1
  local expected_executable=$2
  local expected_start_time=$3
  local actual_executable
  local actual_start_time

  [[ "$pid" =~ ^[1-9][0-9]*$ && -e "/proc/$pid/exe" ]] || return 1
  actual_executable="$(readlink -f -- "/proc/$pid/exe")" || return 1
  [[ "$actual_executable" == "$expected_executable" ]] || return 1
  actual_start_time="$(process_start_time "$pid")" || return 1
  [[ "$actual_start_time" == "$expected_start_time" ]]
}

cleanup() {
  local status=$?

  trap - EXIT
  set +e

  if [[ -n "$proof_path" ]]; then
    rm -f -- "$proof_path" ||
      printf 'warning: could not remove launch proof %s\n' "$proof_path" >&2
  fi
  if [[ -n "$smoke_state_dir" ]]; then
    rm -rf -- "$smoke_state_dir" ||
      printf 'warning: could not remove smoke state %s\n' \
        "$smoke_state_dir" >&2
  fi

  if [[ -n "$app_pid" && -n "$app_start_time" &&
    -e "/proc/$app_pid/exe" ]]; then
    if ! process_matches_proof \
      "$app_pid" \
      "$expected_executable" \
      "$app_start_time"; then
      printf 'warning: refusing to clean PID %s because its identity changed\n' \
        "$app_pid" >&2
    else
      kill -- "$app_pid" 2>/dev/null || true
      for _ in {1..40}; do
        process_matches_proof \
          "$app_pid" \
          "$expected_executable" \
          "$app_start_time" || break
        sleep 0.1
      done
      if process_matches_proof \
        "$app_pid" \
        "$expected_executable" \
        "$app_start_time"; then
        kill -KILL -- "$app_pid" 2>/dev/null || true
      fi
    fi
  fi

  exit "$status"
}

run_cleanup_status_fixture() (
  local fixture_dir=$1
  local desired_status=$2

  set -e
  smoke_state_dir="$fixture_dir/cleanup-state-$desired_status"
  proof_path="$fixture_dir/cleanup-$desired_status.proof"
  mkdir -p -- "$smoke_state_dir"
  : >"$proof_path"
  sleep 30 &
  app_pid=$!
  expected_executable="$(readlink -f -- "/proc/$app_pid/exe")"
  app_start_time="$(process_start_time "$app_pid")"
  trap cleanup EXIT
  exit "$desired_status"
)

read_launch_proof() {
  local proof_path=$1
  local expected_nonce=$2
  local expected_executable=$3
  local key
  local value
  local nonce_value=""
  local pid_value=""
  local executable_value=""
  local start_time_value=""
  local nonce_seen=false
  local pid_seen=false
  local executable_seen=false
  local start_time_seen=false

  [[ -f "$proof_path" && ! -L "$proof_path" && -O "$proof_path" ]] ||
    return 1
  [[ "$(stat -c '%a' -- "$proof_path")" == "600" ]] || return 1

  while IFS='=' read -r key value; do
    case "$key" in
      nonce)
        [[ "$nonce_seen" == false ]] || return 1
        nonce_seen=true
        nonce_value=$value
        ;;
      pid)
        [[ "$pid_seen" == false ]] || return 1
        pid_seen=true
        pid_value=$value
        ;;
      executable)
        [[ "$executable_seen" == false ]] || return 1
        executable_seen=true
        executable_value=$value
        ;;
      start_time)
        [[ "$start_time_seen" == false ]] || return 1
        start_time_seen=true
        start_time_value=$value
        ;;
      *)
        return 1
        ;;
    esac
  done <"$proof_path"

  [[ "$nonce_value" == "$expected_nonce" ]] || return 1
  [[ "$pid_value" =~ ^[1-9][0-9]*$ ]] || return 1
  [[ "$executable_value" == "$expected_executable" ]] || return 1
  [[ "$start_time_value" =~ ^[1-9][0-9]*$ ]] || return 1

  proof_pid=$pid_value
  proof_start_time=$start_time_value
}

run_self_test() {
  local -a baseline_ids=(101 202)
  local -a current_ids=(101 202 303)
  local -a new_ids=()
  local test_dir
  local test_nonce="01234567-89ab-cdef-0123-456789abcdef"
  local test_executable
  local test_start_time
  local test_proof
  local cleanup_status

  collect_new_ids baseline_ids current_ids new_ids
  [[ "${new_ids[*]}" == "303" ]] ||
    fail "self-test did not isolate a newly created window"

  current_ids=(101 202)
  collect_new_ids baseline_ids current_ids new_ids
  ((${#new_ids[@]} == 0)) ||
    fail "self-test treated a baseline window as newly created"

  test_dir="$(mktemp -d)"
  test_proof="$test_dir/launch.proof"
  test_executable="$(readlink -f -- "/proc/$$/exe")"
  test_start_time="$(process_start_time "$$")"
  (
    umask 077
    {
      printf 'nonce=%s\n' "$test_nonce"
      printf 'pid=%s\n' "$$"
      printf 'executable=%s\n' "$test_executable"
      printf 'start_time=%s\n' "$test_start_time"
    } >"$test_proof"
  )

  read_launch_proof "$test_proof" "$test_nonce" "$test_executable" ||
    fail "self-test rejected a valid launch proof"
  [[ "$proof_pid" == "$$" && "$proof_start_time" == "$test_start_time" ]] ||
    fail "self-test parsed incorrect launch ownership"
  process_matches_proof "$proof_pid" "$test_executable" "$proof_start_time" ||
    fail "self-test rejected a matching process identity"
  if read_launch_proof \
    "$test_proof" \
    "ffffffff-ffff-ffff-ffff-ffffffffffff" \
    "$test_executable"; then
    fail "self-test accepted a launch proof with the wrong nonce"
  fi
  if process_matches_proof \
    "$proof_pid" \
    "$test_executable" \
    "$((proof_start_time + 1))"; then
    fail "self-test accepted a reused process ID"
  fi

  set +e
  run_cleanup_status_fixture "$test_dir" 0
  cleanup_status=$?
  set -e
  [[ "$cleanup_status" == 0 ]] ||
    fail "cleanup changed a successful exit to status $cleanup_status"

  set +e
  run_cleanup_status_fixture "$test_dir" 17
  cleanup_status=$?
  set -e
  [[ "$cleanup_status" == 17 ]] ||
    fail "cleanup changed exit status 17 to $cleanup_status"

  rm -rf -- "$test_dir"

  printf 'Installed smoke self-test passed:\n'
  printf '  window baselines exclude pre-existing IDs\n'
  printf '  launch proofs require the expected nonce and file owner\n'
  printf '  cleanup ownership binds PID, executable, and process start time\n'
  printf '  cleanup preserves successful and failing exit status\n'
}

require_bedrock=false
while (($# > 0)); do
  case "$1" in
    --self-test)
      run_self_test
      exit 0
      ;;
    --require-bedrock)
      require_bedrock=true
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

required_commands=(
  awk
  basename
  desktop-file-validate
  file
  gio
  gjs
  grep
  id
  mktemp
  readlink
  rm
  sleep
  ss
  stat
  xdotool
  xprop
)
for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null 2>&1 ||
    fail "required command not found: $command_name"
done

[[ "$timeout_seconds" =~ ^[1-9][0-9]*$ ]] ||
  fail "TRACE_ML_SMOKE_TIMEOUT must be a positive integer"
: "${HOME:?error: HOME is not set}"

if ss -H -ltn 'sport = :5173' | grep -q .; then
  fail "port 5173 is serving; stop Vite before testing installed production assets"
fi

: "${DISPLAY:?error: DISPLAY is not set; run this smoke in a GNOME/X11 or Xvfb session}"

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
binary="$HOME/.local/bin/trace-ml"
menu_entry="$data_home/applications/trace-ml.desktop"
desktop_entry="$HOME/Desktop/Trace ML.desktop"
if command -v xdg-user-dir >/dev/null 2>&1; then
  configured_desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
  if [[ "$configured_desktop_dir" == /* ]]; then
    desktop_entry="$configured_desktop_dir/Trace ML.desktop"
  fi
fi
icon_theme_dir="$data_home/icons/hicolor"
uid="$(id -u)"
: "${XDG_RUNTIME_DIR:=/run/user/$uid}"
export XDG_RUNTIME_DIR
if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "$XDG_RUNTIME_DIR/bus" ]]; then
  export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
fi

[[ -x "$binary" ]] ||
  fail "installed binary is missing or not executable: $binary"
[[ -f "$menu_entry" ]] ||
  fail "app-menu entry is missing: $menu_entry"
[[ -x "$desktop_entry" ]] ||
  fail "Desktop shortcut is missing or not executable: $desktop_entry"
expected_executable="$(readlink -f -- "$binary")"
desktop-file-validate "$menu_entry" "$desktop_entry"

desktop_info="$(
  gio info -a metadata::trusted,access::can-execute "$desktop_entry"
)"
grep -Fq 'metadata::trusted: true' <<<"$desktop_info" ||
  fail "Desktop shortcut is not trusted according to gio"
grep -Fq 'access::can-execute: TRUE' <<<"$desktop_info" ||
  fail "Desktop shortcut is not executable according to gio"

for size in 32 64 128 256 512; do
  icon_path="$icon_theme_dir/${size}x${size}/apps/trace-ml.png"
  [[ -f "$icon_path" ]] ||
    fail "installed ${size}px icon is missing: $icon_path"
  file "$icon_path" | grep -Fq "${size} x ${size}" ||
    fail "installed icon does not have ${size}x${size} dimensions: $icon_path"
done

icon_path="$(
  gjs -c '
    imports.gi.versions.Gtk = "3.0";
    const Gtk = imports.gi.Gtk;
    Gtk.init(null);
    const info = Gtk.IconTheme.get_default().lookup_icon("trace-ml", 512, 0);
    if (!info) imports.system.exit(1);
    print(info.get_filename());
  '
)" || fail "GTK could not resolve the trace-ml themed icon"
[[ "$(basename -- "$icon_path")" == "trace-ml.png" ]] ||
  fail "GTK resolved an unexpected icon: $icon_path"

snapshot_matching_windows() {
  local output
  local status
  local candidate_window_id

  matching_window_ids=()
  set +e
  output="$(xdotool search --onlyvisible --class '^trace-ml$' 2>&1)"
  status=$?
  set -e
  if ((status != 0)); then
    [[ -z "$output" ]] ||
      fail "could not enumerate existing Trace ML windows: $output"
    return
  fi

  while IFS= read -r candidate_window_id; do
    [[ -z "$candidate_window_id" ]] && continue
    [[ "$candidate_window_id" =~ ^[1-9][0-9]*$ ]] ||
      fail "xdotool returned an invalid Trace ML window ID: $candidate_window_id"
    matching_window_ids+=("$candidate_window_id")
  done <<<"$output"
}

smoke_state_dir="$(mktemp -d)"
launch_nonce="$(<"/proc/sys/kernel/random/uuid")"
proof_path="$XDG_RUNTIME_DIR/trace-ml/launch-$launch_nonce.proof"
trap cleanup EXIT

export GDK_BACKEND=x11
export NO_AT_BRIDGE=0
export GTK_MODULES="${GTK_MODULES:+$GTK_MODULES:}atk-bridge"
export TRACE_ML_LAUNCH_NONCE="$launch_nonce"
export XDG_CACHE_HOME="$smoke_state_dir/cache"
export XDG_CONFIG_HOME="$smoke_state_dir/config"
export XDG_DATA_HOME="$smoke_state_dir/data"
launcher_log="$XDG_CACHE_HOME/trace-ml/launcher.log"

xprop -root >/dev/null 2>&1 ||
  fail "the X11 root window is unavailable on DISPLAY=$DISPLAY"
matching_window_ids=()
snapshot_matching_windows
baseline_window_ids=("${matching_window_ids[@]}")
rm -f -- "$proof_path"

gio launch "$desktop_entry" ||
  fail "desktop-file activation failed; inspect $launcher_log"

proof_pid=""
proof_start_time=""
deadline=$((SECONDS + timeout_seconds))
while ((SECONDS < deadline)); do
  if [[ -f "$proof_path" ]]; then
    read_launch_proof \
      "$proof_path" \
      "$launch_nonce" \
      "$expected_executable" ||
      fail "launcher emitted an invalid ownership proof: $proof_path"
    if process_matches_proof \
      "$proof_pid" \
      "$expected_executable" \
      "$proof_start_time"; then
      app_pid=$proof_pid
      app_start_time=$proof_start_time
      break
    fi
  fi
  sleep 0.05
done
[[ -n "$app_pid" ]] ||
  fail "no live process matched launch nonce $launch_nonce; inspect $launcher_log"

window_id=""
while ((SECONDS < deadline)); do
  process_matches_proof \
    "$app_pid" \
    "$expected_executable" \
    "$app_start_time" ||
    fail "the launch-owned process exited before its window became ready"

  snapshot_matching_windows
  new_window_ids=()
  collect_new_ids baseline_window_ids matching_window_ids new_window_ids
  owned_window_ids=()
  for candidate_window_id in "${new_window_ids[@]}"; do
    candidate_properties="$(
      xprop -id "$candidate_window_id" WM_CLASS _NET_WM_PID 2>/dev/null ||
        true
    )"
    candidate_pid="$(
      awk '/_NET_WM_PID/ { print $NF }' <<<"$candidate_properties"
    )"
    if [[ "$candidate_pid" == "$app_pid" ]]; then
      owned_window_ids+=("$candidate_window_id")
    fi
  done
  if ((${#owned_window_ids[@]} > 1)); then
    fail "launch-owned PID $app_pid created multiple visible Trace ML windows"
  fi
  if ((${#owned_window_ids[@]} == 1)); then
    window_id=${owned_window_ids[0]}
    break
  fi
  sleep 0.1
done
[[ -n "$window_id" ]] ||
  fail "launch-owned PID $app_pid did not create a new Trace ML window"

window_properties="$(
  xprop -id "$window_id" WM_CLASS _NET_WM_PID
)" || fail "could not inspect launch-owned window $window_id"
grep -Fq 'WM_CLASS(STRING) = "trace-ml", "Trace-ml"' <<<"$window_properties" ||
  fail "unexpected WM_CLASS: $window_properties"
candidate_pid="$(
  awk '/_NET_WM_PID/ { print $NF }' <<<"$window_properties"
)"
[[ "$candidate_pid" == "$app_pid" ]] ||
  fail "window PID $candidate_pid does not match nonce-owned PID $app_pid"

actual_executable="$(readlink -f -- "/proc/$app_pid/exe")"
xdotool windowactivate --sync "$window_id"
ask_center="$(
  gjs "$repo_root/packaging/linux/find-native-control.js" \
    "$app_pid" \
    "Ask" \
    "$timeout_seconds"
)" || fail "the accessible Ask control did not become ready"
read -r ask_x ask_y <<<"$ask_center"
[[ "$ask_x" =~ ^[0-9]+$ && "$ask_y" =~ ^[0-9]+$ ]] ||
  fail "invalid Ask control coordinates: $ask_center"
xdotool mousemove --sync "$ask_x" "$ask_y" click 1

readiness_args=("$app_pid" "$timeout_seconds")
if [[ "$require_bedrock" == true ]]; then
  readiness_args+=(--require-bedrock)
fi
readiness_output="$(
  gjs "$repo_root/packaging/linux/assert-native-readiness.js" \
    "${readiness_args[@]}"
)"
helper_output="$(
  gjs "$repo_root/packaging/linux/exercise-native-helper.js" \
    "$app_pid" \
    "$timeout_seconds"
)"

printf 'Installed production smoke passed:\n'
printf '  launch:   %s -> PID %s, start %s\n' \
  "$launch_nonce" \
  "$app_pid" \
  "$app_start_time"
printf '  PID/exe:  %s -> %s\n' "$app_pid" "$actual_executable"
printf '  WM_CLASS: trace-ml, Trace-ml\n'
printf '  icon:     %s\n' "$icon_path"
printf '  IPC:      %s\n' "$readiness_output"
printf '  helper:   %s\n' "$helper_output"
