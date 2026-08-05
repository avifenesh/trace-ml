#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
service_name="trace-ml-web.service"
unit_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
unit_file="$unit_dir/$service_name"
local_port="${TRACE_ML_WEB_PORT:-5600}"
https_port="${TRACE_ML_TAILNET_HTTPS_PORT:-9443}"
local_target="http://127.0.0.1:$local_port"

usage() {
  cat <<'EOF'
Usage: scripts/manage-tailnet.sh <install|start|restart|status|stop|uninstall>

Build and expose Trace ML through a dedicated, tailnet-only HTTPS endpoint.
Override ports with TRACE_ML_WEB_PORT and TRACE_ML_TAILNET_HTTPS_PORT.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

validate_port() {
  local label="$1"
  local value="$2"
  [[ "$value" =~ ^[0-9]{1,5}$ ]] ||
    fail "$label must be an integer between 1 and 65535"
  ((10#$value >= 1 && 10#$value <= 65535)) ||
    fail "$label must be an integer between 1 and 65535"
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
  tailscale serve status --json | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const port = process.argv[1];
      const expected = process.argv[2];
      const config = JSON.parse(input || "{}");
      const web = config.Web ?? {};
      const key = Object.keys(web).find((entry) => entry.endsWith(`:${port}`));
      if (!key) {
        const tcpHandler = config.TCP?.[port];
        process.stdout.write(
          tcpHandler ? `conflict:TCP ${port}:${JSON.stringify(tcpHandler)}` : "free",
        );
        return;
      }
      const proxy = web[key]?.Handlers?.["/"]?.Proxy;
      if (proxy === expected) {
        process.stdout.write("owned");
        return;
      }
      process.stdout.write(`conflict:${key}:${proxy ?? "non-proxy handler"}`);
    });
  ' "$https_port" "$local_target"
}

ensure_route_available() {
  local state
  state="$(route_state)"
  case "$state" in
    free | owned)
      ;;
    conflict:*)
      fail "HTTPS port $https_port is already configured by Tailscale Serve (${state#conflict:})"
      ;;
    *)
      fail "could not inspect Tailscale Serve route state"
      ;;
  esac
}

configure_route() {
  ensure_route_available
  tailscale serve --yes --https="$https_port" --bg "$local_target" >/dev/null
}

disable_route() {
  local state
  state="$(route_state)"
  case "$state" in
    free)
      return
      ;;
    owned)
      tailscale serve --yes --https="$https_port" off >/dev/null
      ;;
    conflict:*)
      fail "refusing to remove a route not owned by Trace ML (${state#conflict:})"
      ;;
    *)
      fail "could not inspect Tailscale Serve route state"
      ;;
  esac
}

wait_for_server() {
  local attempt
  for attempt in {1..50}; do
    if curl --fail --silent --max-time 2 \
      "$local_target/_trace/health" >/dev/null; then
      return
    fi
    sleep 0.2
  done
  systemctl --user status "$service_name" --no-pager >&2 || true
  fail "Trace ML did not become ready on $local_target"
}

print_access() {
  local hostname
  hostname="$(tailnet_hostname)" ||
    fail "Tailscale is not connected or MagicDNS has no hostname"
  printf 'Trace ML is available inside this tailnet:\n'
  printf '  https://%s:%s/\n' "$hostname" "$https_port"
}

write_unit() {
  local node_path temporary
  node_path="$(command -v node)"
  mkdir -p "$unit_dir"
  temporary="$(mktemp "$unit_dir/.trace-ml-web.XXXXXX.service")"
  trap 'rm -f -- "${temporary:-}"' EXIT
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Trace ML tailnet web course' \
      '' \
      '[Service]' \
      'Type=simple'
    printf 'WorkingDirectory=%s\n' "$(unit_path "$repo_root")"
    printf 'ExecStart=%s %s --host 127.0.0.1 --port %s --root %s\n' \
      "$(unit_quote "$node_path")" \
      "$(unit_quote "$repo_root/scripts/serve-production.mjs")" \
      "$local_port" \
      "$(unit_quote "$repo_root/dist")"
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
  } >"$temporary"
  verify_unit "$temporary"
  chmod 0644 "$temporary"
  mv -f -- "$temporary" "$unit_file"
  trap - EXIT
}

install_service() {
  require_commands curl loginctl node npm systemctl systemd-analyze tailscale
  [[ "$(uname -s)" == "Linux" ]] ||
    fail "the persistent tailnet service currently requires Linux and systemd"
  prepare_user_bus
  ensure_route_available
  (
    cd "$repo_root"
    npm run build
  )
  write_unit
  systemctl --user daemon-reload
  systemctl --user enable "$service_name"
  systemctl --user restart "$service_name"
  wait_for_server
  configure_route
  if [[ "$(loginctl show-user "$USER" -p Linger --value)" != "yes" ]]; then
    printf '%s\n' \
      'warning: user lingering is disabled; run `loginctl enable-linger`' \
      'to keep this service available before login.' >&2
  fi
  print_access
}

start_service() {
  require_commands curl node systemctl tailscale
  prepare_user_bus
  [[ -f "$unit_file" ]] ||
    fail "Trace ML is not installed as a tailnet service; run make tailnet-install"
  systemctl --user enable --now "$service_name"
  wait_for_server
  configure_route
  print_access
}

restart_service() {
  require_commands curl node npm systemctl tailscale
  prepare_user_bus
  [[ -f "$unit_file" ]] ||
    fail "Trace ML is not installed as a tailnet service; run make tailnet-install"
  (
    cd "$repo_root"
    npm run build
  )
  systemctl --user restart "$service_name"
  wait_for_server
  configure_route
  print_access
}

show_status() {
  require_commands curl node systemctl tailscale
  prepare_user_bus
  systemctl --user status "$service_name" --no-pager
  curl --fail --silent --show-error "$local_target/_trace/health"
  printf '\n'
  case "$(route_state)" in
    owned)
      print_access
      ;;
    free)
      fail "the local service is running but its tailnet HTTPS route is disabled"
      ;;
    conflict:*)
      fail "HTTPS port $https_port belongs to another Tailscale Serve route"
      ;;
  esac
}

stop_service() {
  require_commands node systemctl tailscale
  prepare_user_bus
  disable_route
  if [[ -f "$unit_file" ]]; then
    systemctl --user disable --now "$service_name"
  fi
  printf 'Trace ML tailnet service stopped; unrelated Serve routes were preserved.\n'
}

uninstall_service() {
  require_commands node systemctl tailscale
  prepare_user_bus
  disable_route
  systemctl --user disable --now "$service_name" >/dev/null 2>&1 || true
  rm -f -- "$unit_file"
  systemctl --user daemon-reload
  systemctl --user reset-failed "$service_name" >/dev/null 2>&1 || true
  printf 'Trace ML tailnet service removed; the repository and build remain.\n'
}

validate_port "TRACE_ML_WEB_PORT" "$local_port"
validate_port "TRACE_ML_TAILNET_HTTPS_PORT" "$https_port"

case "${1:-}" in
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
  -h | --help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
