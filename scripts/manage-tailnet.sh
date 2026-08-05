#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
service_name="trace-ml-web.service"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
unit_file="$unit_dir/$service_name"
config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/trace-ml"
config_file="$config_dir/tailnet.conf"
data_dir="${XDG_DATA_HOME:-$HOME/.local/share}/trace-ml-web"
releases_dir="$data_dir/releases"
default_local_port="5600"
default_https_port="9443"
expected_health='{"service":"trace-ml","status":"ok"}'

configured_local_port=""
configured_https_port=""
local_port=""
https_port=""
local_target=""
candidate_release=""
staging_release=""
temporary_unit=""
unit_backup=""
candidate_server_pid=""
candidate_server_log=""
deployment_had_old_unit="false"
deployment_old_unit_active="false"
deployment_old_unit_enabled="false"
deployment_old_release=""
lifecycle_lock_fd=""
route_cleanup_failure=""

usage() {
  cat <<'EOF'
Usage: scripts/manage-tailnet.sh <install|start|restart|status|stop|uninstall>

Build and expose Trace ML through a dedicated, tailnet-only HTTPS endpoint.
Set TRACE_ML_WEB_PORT and TRACE_ML_TAILNET_HTTPS_PORT during install to choose
ports. The installed values are persisted for every later lifecycle command.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "$candidate_server_pid" ]]; then
    kill "$candidate_server_pid" >/dev/null 2>&1 || true
    wait "$candidate_server_pid" >/dev/null 2>&1 || true
  fi
  [[ -z "$candidate_server_log" ]] || rm -f -- "$candidate_server_log"
  [[ -z "$temporary_unit" ]] || rm -f -- "$temporary_unit"
  if [[ -n "$unit_backup" && -f "$unit_backup" ]]; then
    printf 'warning: retained the previous unit for manual recovery: %s\n' \
      "$unit_backup" >&2
  fi
  if [[ -n "$staging_release" && -d "$staging_release" ]]; then
    rm -rf -- "$staging_release"
  fi
  if [[ -n "$candidate_release" &&
    -d "$candidate_release" &&
    ! -f "$candidate_release/.deployed" ]]; then
    local installed_release=""
    installed_release="$(
      systemctl --user show "$service_name" \
        --property=WorkingDirectory \
        --value 2>/dev/null || true
    )"
    if [[ "$installed_release" == "$candidate_release" ]]; then
      printf 'warning: retaining the active uncommitted release after interruption: %s\n' \
        "$candidate_release" >&2
    else
      rm -rf -- "$candidate_release"
    fi
  fi
}
trap cleanup EXIT

validate_port() {
  local label="$1"
  local value="$2"
  [[ "$value" =~ ^[1-9][0-9]{0,4}$ ]] ||
    fail "$label must be an integer between 1 and 65535 without leading zeroes"
  ((10#$value <= 65535)) ||
    fail "$label must be an integer between 1 and 65535 without leading zeroes"
}

load_config() {
  [[ -f "$config_file" ]] || return 0

  local line
  local saw_local="false"
  local saw_https="false"
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "$line" in
      "" | \#*)
        ;;
      TRACE_ML_WEB_PORT=*)
        [[ "$saw_local" == "false" ]] ||
          fail "$config_file contains TRACE_ML_WEB_PORT more than once"
        configured_local_port="${line#*=}"
        saw_local="true"
        ;;
      TRACE_ML_TAILNET_HTTPS_PORT=*)
        [[ "$saw_https" == "false" ]] ||
          fail "$config_file contains TRACE_ML_TAILNET_HTTPS_PORT more than once"
        configured_https_port="${line#*=}"
        saw_https="true"
        ;;
      *)
        fail "$config_file contains an unsupported setting: $line"
        ;;
    esac
  done <"$config_file"

  [[ "$saw_local" == "true" && "$saw_https" == "true" ]] ||
    fail "$config_file must define both Trace ML ports"
  validate_port "persisted TRACE_ML_WEB_PORT" "$configured_local_port"
  validate_port \
    "persisted TRACE_ML_TAILNET_HTTPS_PORT" \
    "$configured_https_port"
}

resolve_ports() {
  local action="$1"
  load_config

  if [[ "$action" == "install" ]]; then
    local_port="${TRACE_ML_WEB_PORT-${configured_local_port:-$default_local_port}}"
    https_port="${TRACE_ML_TAILNET_HTTPS_PORT-${configured_https_port:-$default_https_port}}"
    if [[ -n "$configured_local_port" &&
      (
        "$local_port" != "$configured_local_port" ||
        "$https_port" != "$configured_https_port"
      ) ]]; then
      fail "ports are already installed; uninstall before reinstalling with different ports"
    fi
  elif [[ -n "$configured_local_port" ]]; then
    if [[ -n "${TRACE_ML_WEB_PORT+x}" &&
      "$TRACE_ML_WEB_PORT" != "$configured_local_port" ]]; then
      fail "TRACE_ML_WEB_PORT is persisted as $configured_local_port; omit the override"
    fi
    if [[ -n "${TRACE_ML_TAILNET_HTTPS_PORT+x}" &&
      "$TRACE_ML_TAILNET_HTTPS_PORT" != "$configured_https_port" ]]; then
      fail "TRACE_ML_TAILNET_HTTPS_PORT is persisted as $configured_https_port; omit the override"
    fi
    local_port="$configured_local_port"
    https_port="$configured_https_port"
  else
    local_port="${TRACE_ML_WEB_PORT-$default_local_port}"
    https_port="${TRACE_ML_TAILNET_HTTPS_PORT-$default_https_port}"
  fi

  validate_port "TRACE_ML_WEB_PORT" "$local_port"
  validate_port "TRACE_ML_TAILNET_HTTPS_PORT" "$https_port"
  local_target="http://127.0.0.1:$local_port"
}

write_config() {
  mkdir -p "$config_dir" || return 1
  local temporary
  temporary="$(mktemp "$config_dir/.tailnet.XXXXXX.conf")" || return 1
  if ! {
    printf 'TRACE_ML_WEB_PORT=%s\n' "$local_port"
    printf 'TRACE_ML_TAILNET_HTTPS_PORT=%s\n' "$https_port"
  } >"$temporary"; then
    rm -f -- "$temporary"
    return 1
  fi
  chmod 0600 "$temporary" || {
    rm -f -- "$temporary"
    return 1
  }
  mv -f -- "$temporary" "$config_file" || {
    rm -f -- "$temporary"
    return 1
  }
}

prepare_user_bus() {
  local uid
  uid="$(id -u)"
  : "${XDG_RUNTIME_DIR:=/run/user/$uid}"
  export XDG_RUNTIME_DIR
  if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -S "$XDG_RUNTIME_DIR/bus" ]]; then
    export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
  fi
}

require_commands() {
  local command_name
  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 ||
      fail "$command_name is required"
  done
}

require_linux_local_service_tools() {
  [[ "$(uname -s)" == "Linux" ]] ||
    fail "the persistent tailnet service currently requires Linux and systemd"
  require_commands systemctl
  prepare_user_bus
}

require_linux_service_tools() {
  require_linux_local_service_tools
  require_commands curl node systemctl systemd-analyze tailscale
}

acquire_lifecycle_lock() {
  require_commands flock
  [[ -d "$XDG_RUNTIME_DIR" ]] ||
    fail "user runtime directory is unavailable: $XDG_RUNTIME_DIR"
  local lock_file="$XDG_RUNTIME_DIR/trace-ml-tailnet.lock"
  exec {lifecycle_lock_fd}>"$lock_file" ||
    fail "could not open the Trace ML lifecycle lock"
  flock --nonblock "$lifecycle_lock_fd" ||
    fail "another Trace ML lifecycle command is already running"
}

unit_quote() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//%/%%}"
  printf '"%s"' "$value"
}

unit_path() {
  local value="$1"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] ||
    fail "service paths cannot contain line breaks"
  value="${value//\\/\\x5c}"
  value="${value// /\\x20}"
  value="${value//$'\t'/\\x09}"
  value="${value//%/%%}"
  printf '%s' "$value"
}

verify_unit() {
  local candidate="$1"
  local verification
  if ! verification="$(systemd-analyze --user verify "$candidate" 2>&1)"; then
    printf '%s\n' "$verification" >&2
    fail "generated systemd service did not pass verification"
  fi
  if [[ "$verification" == *"$candidate"* ]]; then
    printf '%s\n' "$verification" >&2
    fail "generated systemd service produced a verification warning"
  fi
}

tailnet_hostname() {
  # Node receives this JavaScript literally.
  # shellcheck disable=SC2016
  tailscale status --json | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const status = JSON.parse(input);
      const dnsName = status.Self?.DNSName?.replace(/\.$/, "");
      if (!dnsName) process.exit(1);
      process.stdout.write(dnsName);
    });
  '
}

route_state() {
  local port="$1"
  local target="$2"
  tailscale serve status --json |
    node "$repo_root/scripts/inspect-tailnet-route.mjs" "$port" "$target"
}

ensure_route_available() {
  local port="$1"
  local target="$2"
  local state
  state="$(route_state "$port" "$target")"
  case "$state" in
    free | owned)
      return
      ;;
    conflict:*)
      printf 'error: HTTPS port %s is already configured by Tailscale Serve (%s)\n' \
        "$port" "${state#conflict:}" >&2
      return 1
      ;;
    *)
      printf 'error: could not inspect Tailscale Serve route state\n' >&2
      return 1
      ;;
  esac
}

configure_route() {
  local port="$1"
  local target="$2"
  if ! tailscale serve --yes --https="$port" --bg "$target" >/dev/null; then
    return 1
  fi
  [[ "$(route_state "$port" "$target")" == "owned" ]]
}

disable_route() {
  local port="$1"
  local target="$2"
  local state
  route_cleanup_failure=""
  if ! state="$(route_state "$port" "$target")"; then
    route_cleanup_failure="inspect-failed"
    printf 'error: could not inspect Tailscale Serve route state\n' >&2
    return 1
  fi
  case "$state" in
    free)
      return
      ;;
    owned)
      if ! tailscale serve --yes --https="$port" off >/dev/null; then
        route_cleanup_failure="remove-failed"
        return 1
      fi
      if [[ "$(route_state "$port" "$target" 2>/dev/null || true)" != "free" ]]; then
        route_cleanup_failure="verify-failed"
        return 1
      fi
      ;;
    conflict:*)
      route_cleanup_failure="conflict"
      printf 'error: refusing to remove a route not owned by Trace ML (%s)\n' \
        "${state#conflict:}" >&2
      return 1
      ;;
    *)
      route_cleanup_failure="inspect-failed"
      printf 'error: could not inspect Tailscale Serve route state\n' >&2
      return 1
      ;;
  esac
}

health_body() {
  curl --fail --silent --show-error --max-time 2 \
    "$local_target/_trace/health"
}

service_working_directory() {
  systemctl --user show "$service_name" \
    --property=WorkingDirectory \
    --value
}

service_main_pid() {
  systemctl --user show "$service_name" \
    --property=MainPID \
    --value
}

main_process_matches_release() {
  local expected_release="$1"
  local pid
  pid="$(service_main_pid 2>/dev/null || true)"
  [[ "$pid" =~ ^[1-9][0-9]*$ && -r "/proc/$pid/cmdline" ]] || return 1

  local argument
  local saw_server="false"
  local saw_root="false"
  while IFS= read -r -d '' argument; do
    [[ "$argument" != "$expected_release/scripts/serve-production.mjs" ]] ||
      saw_server="true"
    [[ "$argument" != "$expected_release/dist" ]] ||
      saw_root="true"
  done <"/proc/$pid/cmdline"
  [[ "$saw_server" == "true" && "$saw_root" == "true" ]]
}

main_process_owns_listener() {
  local pid
  pid="$(service_main_pid 2>/dev/null || true)"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || return 1
  [[ "$(
    node "$repo_root/scripts/inspect-listener-owner.mjs" \
      "$pid" \
      "$local_port" 2>/dev/null
  )" == "owned" ]]
}

wait_for_server() {
  local expected_working_directory="$1"
  local attempt
  local body
  local working_directory
  for ((attempt = 1; attempt <= 50; attempt += 1)); do
    if systemctl --user is-active --quiet "$service_name"; then
      working_directory="$(service_working_directory 2>/dev/null || true)"
      if [[ "$working_directory" == "$expected_working_directory" ]] &&
        main_process_matches_release "$expected_working_directory" &&
        body="$(health_body 2>/dev/null)" &&
        [[ "$body" == "$expected_health" ]] &&
        main_process_owns_listener; then
        return
      fi
    fi
    sleep 0.2
  done
  systemctl --user status "$service_name" --no-pager >&2 || true
  printf 'error: Trace ML did not become ready from %s on %s\n' \
    "$expected_working_directory" \
    "$local_target" >&2
  return 1
}

assert_server_ready() {
  local expected_working_directory="$1"
  systemctl --user is-active --quiet "$service_name" ||
    fail "$service_name is not active"
  [[ "$(service_working_directory)" == "$expected_working_directory" ]] ||
    fail "$service_name is not running its installed release"
  main_process_matches_release "$expected_working_directory" ||
    fail "$service_name MainPID is not the installed Trace ML release"
  main_process_owns_listener ||
    fail "$service_name MainPID does not own Trace ML's listening port"
  local body
  body="$(health_body)" ||
    fail "Trace ML health is unavailable on $local_target"
  [[ "$body" == "$expected_health" ]] ||
    fail "Trace ML returned an unexpected health response"
}

print_access() {
  local hostname
  hostname="$(tailnet_hostname)" ||
    fail "Tailscale is not connected or MagicDNS has no hostname"
  printf 'Trace ML is available inside this tailnet:\n'
  printf '  https://%s:%s/\n' "$hostname" "$https_port"
}

release_revision() {
  if command -v git >/dev/null 2>&1; then
    local revision
    revision="$(
      git -C "$repo_root" rev-parse --short=12 HEAD 2>/dev/null
    )" || {
      printf source
      return
    }
    if [[ -n "$(git -C "$repo_root" status --porcelain)" ]]; then
      printf '%s-dirty' "$revision"
    else
      printf '%s' "$revision"
    fi
  else
    printf source
  fi
}

build_release() {
  require_commands npm
  mkdir -p "$releases_dir"
  find "$releases_dir" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '.staging-*' \
    -exec rm -rf -- {} +

  local release_id
  local release_path
  release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(release_revision)-$$"
  staging_release="$releases_dir/.staging-$release_id"
  release_path="$releases_dir/$release_id"
  [[ ! -e "$staging_release" && ! -e "$release_path" ]] ||
    fail "release path already exists: $release_id"
  mkdir -p "$staging_release/dist" "$staging_release/scripts"

  (
    cd "$repo_root"
    npm ci
    npm run build -- \
      --outDir "$staging_release/dist" \
      --emptyOutDir
  )
  cp -- \
    "$repo_root/scripts/serve-production.mjs" \
    "$staging_release/scripts/serve-production.mjs"
  node "$repo_root/scripts/compress-production-assets.mjs" \
    "$staging_release/dist"
  node --check "$staging_release/scripts/serve-production.mjs"
  [[ -f "$staging_release/dist/index.html" ]] ||
    fail "production release is missing index.html"

  mv -- "$staging_release" "$release_path"
  staging_release=""
  candidate_release="$release_path"
}

select_validation_port() {
  node --input-type=module --eval '
    import { createServer } from "node:net";
    const server = createServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") process.exit(1);
    process.stdout.write(String(address.port));
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  '
}

validate_release() {
  local release="$1"
  local validation_port
  local validation_target
  local attempt
  local body
  validation_port="$(select_validation_port)"
  validation_target="http://127.0.0.1:$validation_port"
  candidate_server_log="$(mktemp "$data_dir/.release-validation.XXXXXX.log")"

  node "$release/scripts/serve-production.mjs" \
    --host 127.0.0.1 \
    --port "$validation_port" \
    --root "$release/dist" \
    >"$candidate_server_log" 2>&1 &
  candidate_server_pid="$!"

  for ((attempt = 1; attempt <= 50; attempt += 1)); do
    if body="$(curl --fail --silent --max-time 2 \
      "$validation_target/_trace/health" 2>/dev/null)" &&
      [[ "$body" == "$expected_health" ]]; then
      kill "$candidate_server_pid" >/dev/null 2>&1 || true
      wait "$candidate_server_pid" >/dev/null 2>&1 || true
      candidate_server_pid=""
      rm -f -- "$candidate_server_log"
      candidate_server_log=""
      return
    fi
    if ! kill -0 "$candidate_server_pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done

  printf '%s\n' "Candidate release failed its health probe:" >&2
  sed -n '1,120p' "$candidate_server_log" >&2 || true
  fail "release validation failed for $release"
}

managed_release() {
  local release="$1"
  [[ "$release" == "$releases_dir/"* &&
    -d "$release/dist" &&
    -f "$release/scripts/serve-production.mjs" ]]
}

require_managed_installation() {
  [[ -f "$config_file" && -f "$unit_file" ]] ||
    fail "Trace ML is not installed as a managed tailnet service"
  if ! grep -Fqx '# Managed by Trace ML' "$unit_file" &&
    ! grep -Fqx 'Description=Trace ML tailnet web course' "$unit_file"; then
    fail "$service_name is not owned by Trace ML"
  fi
  local installed_release
  installed_release="$(service_working_directory 2>/dev/null || true)"
  managed_release "$installed_release" ||
    fail "Trace ML's installed unit does not reference a managed release"
}

mark_release_deployed() {
  local release="$1"
  managed_release "$release" || return
  touch "$release/.deployed"
}

render_unit() {
  local release="$1"
  local destination="$2"
  local node_path
  node_path="$(command -v node)"
  {
    printf '%s\n' \
      '# Managed by Trace ML' \
      '[Unit]' \
      'Description=Trace ML tailnet web course' \
      '' \
      '[Service]' \
      'Type=simple'
    printf 'WorkingDirectory=%s\n' "$(unit_path "$release")"
    printf 'ExecStart=%s %s --host 127.0.0.1 --port %s --root %s\n' \
      "$(unit_quote "$node_path")" \
      "$(unit_quote "$release/scripts/serve-production.mjs")" \
      "$local_port" \
      "$(unit_quote "$release/dist")"
    printf '%s\n' \
      'Environment=NODE_ENV=production' \
      'Restart=on-failure' \
      'RestartSec=2s' \
      'NoNewPrivileges=yes' \
      'PrivateDevices=yes' \
      'PrivateTmp=yes' \
      'ProtectClock=yes' \
      'ProtectControlGroups=yes' \
      'ProtectHome=read-only' \
      'ProtectKernelLogs=yes' \
      'ProtectKernelModules=yes' \
      'ProtectKernelTunables=yes' \
      'ProtectSystem=strict' \
      'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' \
      'RestrictNamespaces=yes' \
      'SystemCallArchitectures=native' \
      'UMask=0077' \
      '' \
      '[Install]' \
      'WantedBy=default.target'
  } >"$destination"
  verify_unit "$destination"
  chmod 0644 "$destination"
}

promote_unit() {
  local release="$1"
  mkdir -p "$unit_dir"
  temporary_unit="$(mktemp "$unit_dir/.trace-ml-web.XXXXXX.service")"
  render_unit "$release" "$temporary_unit"

  if [[ -f "$unit_file" ]]; then
    deployment_had_old_unit="true"
    if systemctl --user is-enabled --quiet "$service_name"; then
      deployment_old_unit_enabled="true"
    fi
    local previous_release
    previous_release="$(service_working_directory 2>/dev/null || true)"
    if managed_release "$previous_release"; then
      deployment_old_release="$previous_release"
    fi
    if systemctl --user is-active --quiet "$service_name"; then
      deployment_old_unit_active="true"
      if managed_release "$previous_release" &&
        main_process_matches_release "$previous_release"; then
        mark_release_deployed "$previous_release" ||
          fail "could not mark the active Trace ML release as successful"
      fi
    fi
    unit_backup="$(mktemp "$unit_dir/.trace-ml-web.backup.XXXXXX.service")"
    cp -- "$unit_file" "$unit_backup"
  fi

  mv -f -- "$temporary_unit" "$unit_file"
  temporary_unit=""
  if ! systemctl --user daemon-reload; then
    rollback_unit_or_warn || true
    fail "could not reload the candidate Trace ML service"
  fi
  if ! systemctl --user enable "$service_name" >/dev/null; then
    rollback_unit_or_warn || true
    fail "could not enable the candidate Trace ML service"
  fi
  if ! systemctl --user restart "$service_name"; then
    rollback_unit_or_warn || true
    fail "could not start the candidate Trace ML release"
  fi
  if ! wait_for_server "$release"; then
    rollback_unit_or_warn || true
    fail "candidate Trace ML release failed its active health check"
  fi
}

rollback_unit() {
  if ! systemctl --user stop "$service_name" >/dev/null 2>&1; then
    printf 'error: could not stop the rejected Trace ML service\n' >&2
    return 1
  fi
  if [[ "$deployment_had_old_unit" == "true" && -n "$unit_backup" ]]; then
    local restored
    if ! restored="$(mktemp "$unit_dir/.trace-ml-web.restore.XXXXXX.service")"; then
      printf 'error: could not prepare the restored Trace ML unit\n' >&2
      return 1
    fi
    if ! cp -- "$unit_backup" "$restored" ||
      ! chmod 0644 "$restored" ||
      ! mv -f -- "$restored" "$unit_file"; then
      rm -f -- "$restored"
      printf 'error: could not restore the previous Trace ML unit\n' >&2
      return 1
    fi
    if ! systemctl --user daemon-reload; then
      printf 'error: could not reload the restored Trace ML service\n' >&2
      return 1
    fi
    if [[ "$deployment_old_unit_enabled" == "true" ]]; then
      if ! systemctl --user enable "$service_name" >/dev/null; then
        printf 'error: could not re-enable the restored Trace ML service\n' >&2
        return 1
      fi
    elif ! systemctl --user disable "$service_name" >/dev/null; then
      printf 'error: could not restore the disabled Trace ML service state\n' >&2
      return 1
    fi
    if [[ "$deployment_old_unit_active" == "true" ]]; then
      if ! systemctl --user restart "$service_name" >/dev/null; then
        printf 'error: could not restart the restored Trace ML service\n' >&2
        return 1
      fi
      if [[ -z "$deployment_old_release" ]] ||
        ! wait_for_server "$deployment_old_release"; then
        printf 'error: the restored Trace ML service did not become ready\n' >&2
        return 1
      fi
    fi
  else
    if ! systemctl --user disable "$service_name" >/dev/null 2>&1; then
      printf 'error: could not disable the rejected Trace ML service\n' >&2
      return 1
    fi
    if ! rm -f -- "$unit_file"; then
      printf 'error: could not remove the rejected Trace ML unit\n' >&2
      return 1
    fi
    if ! systemctl --user daemon-reload; then
      printf 'error: could not unload the rejected Trace ML service\n' >&2
      return 1
    fi
  fi
  finish_unit_promotion
}

rollback_unit_or_warn() {
  if ! rollback_unit; then
    printf 'error: automatic unit rollback is incomplete\n' >&2
    return 1
  fi
}

finish_unit_promotion() {
  [[ -z "$unit_backup" ]] || rm -f -- "$unit_backup"
  unit_backup=""
}

rollback_route() {
  local previous_owned="$1"
  local state_before="$2"
  local state

  state="$(route_state "$https_port" "$local_target" 2>/dev/null || true)"
  if [[ "$previous_owned" == "true" ]]; then
    if [[ "$state" == "owned" ]]; then
      return
    fi
    if [[ "$state" != "free" ]]; then
      printf 'error: refusing to overwrite a route that changed ownership\n' >&2
      return 1
    fi
    if ! configure_route "$https_port" "$local_target"; then
      printf 'error: could not restore the previous Trace ML route\n' >&2
      return 1
    fi
    return 0
  fi

  if [[ "$state_before" != "owned" && "$state" == "owned" ]]; then
    if ! tailscale serve --yes --https="$https_port" off >/dev/null ||
      [[ "$(route_state "$https_port" "$local_target" 2>/dev/null || true)" != "free" ]]; then
      printf 'error: could not remove the rejected Trace ML route\n' >&2
      return 1
    fi
  elif [[ "$state" != "free" ]]; then
    printf 'error: refusing to alter a route that changed ownership\n' >&2
    return 1
  fi
}

rollback_route_or_warn() {
  if ! rollback_route "$@"; then
    printf '%s\n' \
      'error: automatic route rollback is incomplete; inspect tailscale serve status before retrying.' >&2
  fi
}

prune_releases() {
  local current="$1"
  local previous_kept="false"
  local name
  local path
  while IFS= read -r name; do
    path="$releases_dir/$name"
    if [[ ! -f "$path/.deployed" ]]; then
      rm -rf -- "$path"
      continue
    fi
    if [[ "$path" == "$current" ]]; then
      continue
    fi
    if [[ "$previous_kept" == "false" ]]; then
      previous_kept="true"
      continue
    fi
    rm -rf -- "$path"
  done < <(
    find "$releases_dir" \
      -mindepth 1 \
      -maxdepth 1 \
      -type d \
      ! -name '.staging-*' \
      -printf '%f\n' |
      sort -r
  )
}

deploy_release() {
  local previous_state
  local previous_owned="false"
  local new_state_before

  previous_state="$(route_state "$https_port" "$local_target")"
  case "$previous_state" in
    free)
      ;;
    owned)
      previous_owned="true"
      ;;
    conflict:*)
      fail "the previously configured Trace ML endpoint is no longer exclusive (${previous_state#conflict:})"
      ;;
    *)
      fail "could not inspect the previous Trace ML endpoint"
      ;;
  esac

  ensure_route_available \
    "$https_port" \
    "$local_target" ||
    fail "Trace ML's HTTPS route is unavailable"

  build_release
  validate_release "$candidate_release"
  promote_unit "$candidate_release"

  if ! ensure_route_available \
    "$https_port" \
    "$local_target"; then
    rollback_unit_or_warn || true
    fail "Trace ML's HTTPS route changed while the release was building"
  fi
  if ! new_state_before="$(route_state "$https_port" "$local_target")"; then
    rollback_unit_or_warn || true
    fail "could not capture Trace ML's route state at cutover"
  fi
  if ! configure_route "$https_port" "$local_target"; then
    rollback_route_or_warn \
      "$previous_owned" \
      "$new_state_before"
    rollback_unit_or_warn || true
    fail "Tailscale did not establish Trace ML's exclusive HTTPS route"
  fi

  if ! mark_release_deployed "$candidate_release"; then
    rollback_route_or_warn \
      "$previous_owned" \
      "$new_state_before"
    rollback_unit_or_warn || true
    fail "could not mark the candidate Trace ML release as successful"
  fi

  finish_unit_promotion
  prune_releases "$candidate_release"
}

warn_if_lingering_disabled() {
  if [[ "$(loginctl show-user "$(id -un)" -p Linger --value)" != "yes" ]]; then
    printf '%s\n' \
      'warning: user lingering is disabled.' \
      'Run: loginctl enable-linger' \
      'This keeps the service available before login.' >&2
  fi
}

install_service() {
  require_linux_service_tools
  require_commands loginctl npm
  acquire_lifecycle_lock
  if [[ -f "$unit_file" && ! -f "$config_file" ]]; then
    fail "$service_name already exists without Trace ML ownership metadata"
  fi
  if [[ -f "$unit_file" ]]; then
    require_managed_installation
  fi
  if [[ ! -f "$config_file" ]]; then
    ensure_route_available "$https_port" "$local_target" ||
      fail "Trace ML's HTTPS route is unavailable"
    write_config ||
      fail "could not persist Trace ML's tailnet ports"
  fi
  deploy_release
  warn_if_lingering_disabled
  print_access
}

rollback_start_state() {
  local was_active="$1"
  local was_enabled="$2"
  local route_was_owned="$3"
  local failed="false"
  local state

  if [[ "$route_was_owned" == "false" ]]; then
    state="$(route_state "$https_port" "$local_target" 2>/dev/null || true)"
    if [[ "$state" == "owned" ]] &&
      ! disable_route "$https_port" "$local_target"; then
      printf 'error: could not remove the rejected Trace ML route\n' >&2
      failed="true"
    elif [[ "$state" != "free" && "$state" != "owned" ]]; then
      printf 'error: refusing to alter a route that changed ownership\n' >&2
      failed="true"
    fi
  fi
  if [[ "$was_active" == "false" ]] &&
    ! systemctl --user stop "$service_name" >/dev/null 2>&1; then
    printf 'error: could not restore the stopped Trace ML service state\n' >&2
    failed="true"
  fi
  if [[ "$was_enabled" == "false" ]] &&
    ! systemctl --user disable "$service_name" >/dev/null 2>&1; then
    printf 'error: could not restore the disabled Trace ML service state\n' >&2
    failed="true"
  fi
  [[ "$failed" == "false" ]]
}

start_service() {
  require_linux_service_tools
  acquire_lifecycle_lock
  require_managed_installation
  local initial_route_state
  initial_route_state="$(route_state "$https_port" "$local_target")"
  case "$initial_route_state" in
    free | owned)
      ;;
    *)
      ensure_route_available "$https_port" "$local_target" ||
        fail "Trace ML's HTTPS route is unavailable"
      ;;
  esac

  local route_was_owned="false"
  [[ "$initial_route_state" != "owned" ]] || route_was_owned="true"

  ensure_route_available "$https_port" "$local_target" ||
    fail "Trace ML's HTTPS route is unavailable"

  local was_active="false"
  local was_enabled="false"
  systemctl --user is-active --quiet "$service_name" && was_active="true"
  systemctl --user is-enabled --quiet "$service_name" && was_enabled="true"
  if ! systemctl --user enable "$service_name" >/dev/null; then
    rollback_start_state "$was_active" "$was_enabled" "$route_was_owned" || true
    fail "could not enable and start the installed Trace ML service"
  fi
  if [[ "$was_active" == "false" ]] &&
    ! systemctl --user start "$service_name" >/dev/null; then
    rollback_start_state "$was_active" "$was_enabled" "$route_was_owned" || true
    fail "could not enable and start the installed Trace ML service"
  fi
  local installed_release
  installed_release="$(service_working_directory)"
  if ! wait_for_server "$installed_release" ||
    ! ensure_route_available "$https_port" "$local_target" ||
    ! configure_route "$https_port" "$local_target"; then
    rollback_start_state "$was_active" "$was_enabled" "$route_was_owned" || true
    fail "could not restore Trace ML's exclusive tailnet endpoint"
  fi
  print_access
}

restart_service() {
  require_linux_service_tools
  require_commands npm
  acquire_lifecycle_lock
  require_managed_installation
  deploy_release
  print_access
}

show_status() {
  require_linux_service_tools
  require_managed_installation
  local installed_release
  installed_release="$(service_working_directory)"
  assert_server_ready "$installed_release"
  [[ "$(route_state "$https_port" "$local_target")" == "owned" ]] ||
    fail "Trace ML's tailnet route is absent, shared, public, or points elsewhere"
  printf '%s\n' "$expected_health"
  printf 'Active release: %s\n' "$installed_release"
  printf 'Main PID: %s\n' "$(service_main_pid)"
  print_access
}

restore_local_service_state() {
  local was_active="$1"
  local was_enabled="$2"
  local installed_release="$3"
  local failed="false"

  if [[ "$was_enabled" == "true" ]]; then
    if ! systemctl --user enable "$service_name" >/dev/null; then
      printf 'error: could not restore the enabled Trace ML service state\n' >&2
      failed="true"
    fi
  elif ! systemctl --user disable "$service_name" >/dev/null; then
    printf 'error: could not restore the disabled Trace ML service state\n' >&2
    failed="true"
  fi

  if [[ "$was_active" == "true" ]]; then
    if ! systemctl --user start "$service_name" >/dev/null ||
      ! wait_for_server "$installed_release"; then
      printf 'error: could not restore the active Trace ML service state\n' >&2
      failed="true"
    fi
  elif ! systemctl --user stop "$service_name" >/dev/null 2>&1; then
    printf 'error: could not restore the stopped Trace ML service state\n' >&2
    failed="true"
  fi
  [[ "$failed" == "false" ]]
}

stop_and_disable_service() {
  local installed_release="$1"
  local was_active="false"
  local was_enabled="false"
  systemctl --user is-active --quiet "$service_name" && was_active="true"
  systemctl --user is-enabled --quiet "$service_name" && was_enabled="true"

  if ! systemctl --user stop "$service_name" >/dev/null; then
    restore_local_service_state \
      "$was_active" \
      "$was_enabled" \
      "$installed_release" || true
    return 1
  fi
  if ! systemctl --user disable "$service_name" >/dev/null; then
    restore_local_service_state \
      "$was_active" \
      "$was_enabled" \
      "$installed_release" || true
    return 1
  fi
}

stop_service() {
  require_linux_local_service_tools
  acquire_lifecycle_lock
  require_managed_installation
  local installed_release
  installed_release="$(service_working_directory)"
  if ! stop_and_disable_service "$installed_release"; then
    fail "could not stop and disable the local Trace ML service"
  fi

  route_cleanup_failure=""
  if ! command -v tailscale >/dev/null 2>&1 ||
    ! command -v node >/dev/null 2>&1; then
    route_cleanup_failure="unavailable"
  elif ! disable_route "$https_port" "$local_target"; then
    :
  fi
  if [[ -n "$route_cleanup_failure" ]]; then
    printf 'error: Trace ML stopped locally, but its route may remain.\n' >&2
    if [[ "$route_cleanup_failure" == "conflict" ]]; then
      printf '%s\n' \
        'Do not remove the port-wide route; it is no longer owned by Trace ML.' >&2
    fi
    printf '%s\n' \
      'After restoring exclusive route ownership, rerun: make tailnet-stop' >&2
    return 1
  fi
  printf 'Trace ML tailnet service stopped; unrelated Serve routes were preserved.\n'
}

uninstall_service() {
  require_linux_local_service_tools
  acquire_lifecycle_lock
  [[ -f "$config_file" || -f "$unit_file" ]] ||
    fail "Trace ML is not installed as a tailnet service"
  if [[ -f "$unit_file" ]]; then
    [[ -f "$config_file" ]] ||
      fail "$service_name exists without Trace ML ownership metadata"
    require_managed_installation
  fi

  if [[ -f "$unit_file" ]]; then
    local installed_release
    installed_release="$(service_working_directory)"
    if ! stop_and_disable_service "$installed_release"; then
      fail "could not stop and disable the Trace ML service; local files were kept"
    fi
  fi

  local route_removed="true"
  route_cleanup_failure=""
  if command -v tailscale >/dev/null 2>&1 &&
    command -v node >/dev/null 2>&1; then
    if ! disable_route "$https_port" "$local_target"; then
      route_removed="false"
      printf '%s\n' \
        'warning: the Trace ML Tailscale route could not be removed.' >&2
    fi
  else
    route_removed="false"
    route_cleanup_failure="unavailable"
    printf '%s\n' \
      'warning: Tailscale is unavailable; the Trace ML route may remain.' >&2
  fi

  rm -f -- "$unit_file"
  systemctl --user daemon-reload ||
    fail "could not unload the removed Trace ML service"
  systemctl --user reset-failed "$service_name" >/dev/null 2>&1 || true
  rm -rf -- "$data_dir"
  if [[ "$route_removed" == "true" ]]; then
    rm -f -- "$config_file"
    rmdir "$config_dir" >/dev/null 2>&1 || true
    printf 'Trace ML tailnet service, route, and managed releases were removed.\n'
  else
    printf 'Trace ML local service and managed releases were removed.\n'
    printf '%s\n' \
      'warning: port metadata was retained so route cleanup can be retried.' >&2
    if [[ "$route_cleanup_failure" == "conflict" ]]; then
      printf '%s\n' \
        'Do not remove the port-wide route; it is no longer owned by Trace ML.' >&2
    fi
    printf '%s\n' \
      'After restoring exclusive route ownership, rerun: make tailnet-uninstall' >&2
    return 1
  fi
}

action="${1:-}"
case "$action" in
  -h | --help)
    usage
    exit
    ;;
  install | start | restart | status | stop | uninstall)
    resolve_ports "$action"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

case "$action" in
  install)
    install_service
    ;;
  start)
    start_service
    ;;
  restart)
    restart_service
    ;;
  status)
    show_status
    ;;
  stop)
    stop_service
    ;;
  uninstall)
    uninstall_service
    ;;
esac
