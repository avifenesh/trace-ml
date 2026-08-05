import { describe, expect, test } from "vitest";
import { inspectTailnetRoute } from "./inspect-tailnet-route.mjs";

const endpoint = "trace.tail0000.ts.net:9443";
const target = "http://127.0.0.1:5600";

function ownedConfig() {
  return {
    TCP: { 9443: { HTTPS: true } },
    Web: {
      [endpoint]: {
        Handlers: { "/": { Proxy: target } },
      },
    },
  };
}

describe("Tailscale Serve route ownership", () => {
  test("recognizes a free or exclusively owned endpoint", () => {
    expect(inspectTailnetRoute({}, 9443, target)).toBe("free");
    expect(inspectTailnetRoute(ownedConfig(), 9443, target)).toBe("owned");
  });

  test("rejects another proxy target", () => {
    const config = ownedConfig();
    config.Web[endpoint].Handlers["/"].Proxy = "http://127.0.0.1:9999";

    expect(inspectTailnetRoute(config, 9443, target)).toMatch(
      /^conflict:.*does not exclusively proxy/,
    );
  });

  test("rejects sibling handlers", () => {
    const config = ownedConfig();
    config.Web[endpoint].Handlers["/admin"] = {
      Proxy: "http://127.0.0.1:9000",
    };

    expect(inspectTailnetRoute(config, 9443, target)).toMatch(
      /^conflict:.*sibling or non-root handlers/,
    );
  });

  test("rejects Funnel on the same endpoint", () => {
    const config = ownedConfig();
    config.AllowFunnel = { [endpoint]: true };

    expect(inspectTailnetRoute(config, 9443, target)).toMatch(
      /^conflict:Funnel is enabled/,
    );
  });

  test("rejects a non-exclusive TCP listener", () => {
    const config = ownedConfig();
    config.TCP[9443].TCPForward = "127.0.0.1:5600";

    expect(inspectTailnetRoute(config, 9443, target)).toBe(
      "conflict:port 9443 is not an exclusive HTTPS listener",
    );
  });

  test("rejects a foreground-only endpoint on the selected port", () => {
    const config = {
      Foreground: {
        sessionA: ownedConfig(),
      },
    };

    expect(inspectTailnetRoute(config, 9443, target)).toBe(
      "conflict:foreground Serve session uses port 9443 (sessionA)",
    );
  });

  test("rejects foreground handlers that override a background endpoint", () => {
    const config = ownedConfig();
    config.Foreground = {
      sessionB: {
        AllowFunnel: { [endpoint]: true },
        TCP: { 9443: { HTTPS: true } },
        Web: {
          [endpoint]: {
            Handlers: {
              "/": { Proxy: "http://127.0.0.1:9999" },
            },
          },
        },
      },
    };

    expect(inspectTailnetRoute(config, 9443, target)).toBe(
      "conflict:foreground Serve session uses port 9443 (sessionB)",
    );
  });
});
