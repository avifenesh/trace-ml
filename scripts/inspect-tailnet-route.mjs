#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function endpointUsesPort(endpoint, port) {
  return endpoint.endsWith(`:${port}`);
}

function usesPort(config, port) {
  return (
    Boolean(config?.TCP?.[port]) ||
    Object.keys(config?.Web ?? {}).some((endpoint) =>
      endpointUsesPort(endpoint, port)
    ) ||
    Object.entries(config?.AllowFunnel ?? {}).some(
      ([endpoint, enabled]) =>
        endpointUsesPort(endpoint, port) && enabled === true,
    )
  );
}

export function inspectTailnetRoute(config, port, expectedTarget) {
  const portKey = String(port);
  const foregroundSessions = Object.entries(config?.Foreground ?? {})
    .filter(([, foreground]) => usesPort(foreground, portKey))
    .map(([session]) => session);
  if (foregroundSessions.length > 0) {
    return `conflict:foreground Serve session uses port ${portKey} (${foregroundSessions.join(", ")})`;
  }

  const tcpHandler = config?.TCP?.[portKey];
  const webEntries = Object.entries(config?.Web ?? {}).filter(([endpoint]) =>
    endpointUsesPort(endpoint, portKey),
  );
  const funnelEntries = Object.entries(config?.AllowFunnel ?? {}).filter(
    ([endpoint, enabled]) =>
      endpointUsesPort(endpoint, portKey) && enabled === true,
  );

  if (!tcpHandler && webEntries.length === 0 && funnelEntries.length === 0) {
    return "free";
  }
  if (funnelEntries.length > 0) {
    return `conflict:Funnel is enabled on ${funnelEntries
      .map(([endpoint]) => endpoint)
      .join(", ")}`;
  }
  if (webEntries.length !== 1) {
    return `conflict:expected one HTTPS endpoint on port ${portKey}, found ${webEntries.length}`;
  }

  const tcpKeys =
    tcpHandler && typeof tcpHandler === "object"
      ? Object.keys(tcpHandler)
      : [];
  if (
    tcpHandler?.HTTPS !== true ||
    tcpKeys.length !== 1 ||
    tcpKeys[0] !== "HTTPS"
  ) {
    return `conflict:port ${portKey} is not an exclusive HTTPS listener`;
  }

  const [endpoint, webConfig] = webEntries[0];
  const handlers = webConfig?.Handlers;
  const handlerEntries =
    handlers && typeof handlers === "object" ? Object.entries(handlers) : [];
  if (handlerEntries.length !== 1 || handlerEntries[0][0] !== "/") {
    return `conflict:${endpoint} has sibling or non-root handlers`;
  }

  const rootHandler = handlerEntries[0][1];
  const rootKeys =
    rootHandler && typeof rootHandler === "object"
      ? Object.keys(rootHandler)
      : [];
  if (
    rootHandler?.Proxy !== expectedTarget ||
    rootKeys.length !== 1 ||
    rootKeys[0] !== "Proxy"
  ) {
    return `conflict:${endpoint} does not exclusively proxy ${expectedTarget}`;
  }
  return "owned";
}

async function main() {
  const [port, expectedTarget] = process.argv.slice(2);
  if (!port || !expectedTarget) {
    throw new Error(
      "Usage: inspect-tailnet-route.mjs <port> <expected-target>",
    );
  }

  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) input += chunk;
  const config = JSON.parse(input || "{}");
  process.stdout.write(inspectTailnetRoute(config, port, expectedTarget));
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`error: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}
