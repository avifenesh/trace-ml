import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { brotliCompressSync } from "node:zlib";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createBedrockBridge,
  createTailnetRouteGuard,
  createTraceServer,
  listenTraceServer,
  parseArguments,
  parsePort,
} from "./serve-production.mjs";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function startFixtureServer(serverOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-server-"));
  await mkdir(join(root, "assets"));
  await mkdir(join(root, "pyodide"));
  await writeFile(join(root, "index.html"), "<main>Trace course</main>");
  const assetSource = "const traceCourse = 'authored';\n".repeat(200);
  await writeFile(join(root, "assets", "course-abc123.js"), assetSource);
  await writeFile(
    join(root, "assets", "course-abc123.js.br"),
    brotliCompressSync(assetSource),
  );
  await writeFile(join(root, "manifest.webmanifest"), '{"name":"Trace ML"}');
  await writeFile(join(root, "pyodide", "runtime.json"), '{"version":"test"}');
  await writeFile(join(root, "empty.bin"), "");
  const server = createTraceServer({ root, ...serverOptions });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  cleanups.push(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    () => rm(root, { force: true, recursive: true }),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Fixture server did not bind a TCP port");
  }
  return { assetSource, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function startBridgeFixture(source, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-bridge-"));
  const executable = join(root, "bridge.mjs");
  await writeFile(executable, `#!/usr/bin/env node\n${source}`);
  await chmod(executable, 0o755);
  const bridge = createBedrockBridge(executable, options);
  cleanups.push(
    () => {
      bridge.close();
    },
    () => rm(root, { force: true, recursive: true }),
  );
  return bridge;
}

async function sendRawRequest(baseUrl, requestTarget) {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = connect({ host: hostname, port: Number(port) });
    socket.once("error", reject);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.once("connect", () => {
      socket.write(
        `GET ${requestTarget} HTTP/1.1\r\n` +
          `Host: ${hostname}\r\n` +
          "Connection: close\r\n\r\n",
      );
    });
  });
}

describe("production static server", () => {
  test("serves the SPA with cross-origin isolation headers", async () => {
    const { baseUrl } = await startFixtureServer();
    const response = await fetch(`${baseUrl}/lesson/gradient-descent`, {
      headers: { Accept: "text/html" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Trace course");
    expect(response.headers.get("cross-origin-opener-policy")).toBe(
      "same-origin",
    );
    expect(response.headers.get("cross-origin-embedder-policy")).toBe(
      "require-corp",
    );
    expect(response.headers.get("cache-control")).toBe("no-cache");
  });

  test("caches built assets and does not turn missing assets into HTML", async () => {
    const { baseUrl } = await startFixtureServer();
    const asset = await fetch(`${baseUrl}/assets/course-abc123.js`);
    const missing = await fetch(`${baseUrl}/assets/missing.js`, {
      headers: { Accept: "text/html" },
    });
    const sidecar = await fetch(`${baseUrl}/assets/course-abc123.js.br`);

    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect(missing.status).toBe(404);
    expect(sidecar.status).toBe(404);
  });

  test("revalidates fixed assets and includes cache policy on 304s", async () => {
    const { baseUrl } = await startFixtureServer();
    const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
    const runtime = await fetch(`${baseUrl}/pyodide/runtime.json`);
    const asset = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: { "Accept-Encoding": "identity" },
    });
    const notModified = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: {
        "Accept-Encoding": "identity",
        "If-None-Match": asset.headers.get("etag"),
      },
    });

    expect(manifest.headers.get("cache-control")).toBe("no-cache");
    expect(runtime.headers.get("cache-control")).toBe("no-cache");
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get("cache-control")).toContain("immutable");

    const strongEquivalent = asset.headers.get("etag")?.replace(/^W\//, "");
    const weakMatch = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: {
        "Accept-Encoding": "identity",
        "If-None-Match": strongEquivalent,
      },
    });
    expect(weakMatch.status).toBe(304);
  });

  test("supports date revalidation with entity-tag precedence", async () => {
    const { baseUrl } = await startFixtureServer();
    const assetUrl = `${baseUrl}/assets/course-abc123.js`;
    const initial = await fetch(assetUrl, {
      headers: { "Accept-Encoding": "identity" },
    });
    const lastModified = initial.headers.get("last-modified");
    const etag = initial.headers.get("etag");
    if (!lastModified || !etag) {
      throw new Error("Fixture response is missing validators.");
    }

    const exact = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Modified-Since": lastModified,
      },
    });
    const head = await fetch(assetUrl, {
      method: "HEAD",
      headers: {
        "Accept-Encoding": "identity",
        "If-Modified-Since": lastModified,
      },
    });
    const malformed = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Modified-Since": "not-a-date",
      },
    });
    const precedence = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Modified-Since": lastModified,
        "If-None-Match": '"different"',
      },
    });

    expect(exact.status).toBe(304);
    expect(head.status).toBe(304);
    expect(malformed.status).toBe(200);
    expect(precedence.status).toBe(200);
  });

  test("serves byte ranges and precompressed Brotli assets", async () => {
    const { assetSource, baseUrl } = await startFixtureServer();
    const range = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: { Range: "Bytes=6-15" },
    });
    const compressed = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: { "Accept-Encoding": "br" },
    });

    expect(range.status).toBe(206);
    expect(range.headers.get("accept-ranges")).toBe("bytes");
    expect(range.headers.get("content-range")).toBe(
      `bytes 6-15/${Buffer.byteLength(assetSource)}`,
    );
    expect(await range.text()).toBe(assetSource.slice(6, 16));
    expect(compressed.headers.get("content-encoding")).toBe("br");
    expect(compressed.headers.get("vary")).toBe("Accept-Encoding");
    expect(await compressed.text()).toBe(assetSource);
  });

  test("honors content-encoding quality and prefers Brotli on ties", async () => {
    const { assetSource, baseUrl } = await startFixtureServer();
    const assetUrl = `${baseUrl}/assets/course-abc123.js`;
    const identityPreferred = await fetch(assetUrl, {
      headers: { "Accept-Encoding": "br;q=0.1, identity;q=1" },
    });
    const tied = await fetch(assetUrl, {
      headers: { "Accept-Encoding": "br;q=1, identity;q=1" },
    });

    expect(identityPreferred.status).toBe(200);
    expect(identityPreferred.headers.get("content-encoding")).toBeNull();
    expect(await identityPreferred.text()).toBe(assetSource);
    expect(tied.status).toBe(200);
    expect(tied.headers.get("content-encoding")).toBe("br");
    expect(await tied.text()).toBe(assetSource);
  });

  test("applies single byte ranges only to GET identity responses", async () => {
    const { assetSource, baseUrl } = await startFixtureServer();
    const assetUrl = `${baseUrl}/assets/course-abc123.js`;
    const head = await fetch(assetUrl, {
      method: "HEAD",
      headers: {
        "Accept-Encoding": "identity",
        Range: "bytes=6-15",
      },
    });
    const multiple = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "br",
        Range: "bytes=0-1,4-5",
      },
    });
    const unknownUnit = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "br",
        Range: "items=0-1",
      },
    });
    const emptySuffix = await fetch(`${baseUrl}/empty.bin`, {
      headers: {
        "Accept-Encoding": "identity",
        Range: "bytes=-1",
      },
    });

    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(
      String(Buffer.byteLength(assetSource)),
    );
    expect(head.headers.get("content-range")).toBeNull();
    expect(multiple.status).toBe(200);
    expect(multiple.headers.get("content-encoding")).toBe("br");
    expect(unknownUnit.status).toBe(200);
    expect(unknownUnit.headers.get("content-encoding")).toBe("br");
    expect(emptySuffix.status).toBe(416);
    expect(emptySuffix.headers.get("content-range")).toBe("bytes */0");
  });

  test("requires a strong matching If-Range validator", async () => {
    const { baseUrl } = await startFixtureServer();
    const assetUrl = `${baseUrl}/assets/course-abc123.js`;
    const initial = await fetch(assetUrl, {
      headers: { "Accept-Encoding": "identity" },
    });
    const weakEtag = initial.headers.get("etag");
    const strongEquivalent = weakEtag?.replace(/^W\//, "");
    const lastModified = initial.headers.get("last-modified");
    if (!weakEtag || !strongEquivalent || !lastModified) {
      throw new Error("Fixture response is missing validators.");
    }

    const weakTag = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Range": weakEtag,
        Range: "bytes=0-3",
      },
    });
    const strongTagAgainstWeakResource = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Range": strongEquivalent,
        Range: "bytes=0-3",
      },
    });
    const exactDate = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Range": lastModified,
        Range: "bytes=0-3",
      },
    });
    const laterDate = new Date(Date.parse(lastModified) + 1_000).toUTCString();
    const nonMatchingDate = await fetch(assetUrl, {
      headers: {
        "Accept-Encoding": "identity",
        "If-Range": laterDate,
        Range: "bytes=0-3",
      },
    });

    expect(weakTag.status).toBe(200);
    expect(strongTagAgainstWeakResource.status).toBe(200);
    expect(exactDate.status).toBe(206);
    expect(nonMatchingDate.status).toBe(200);
  });

  test("does not send identity when a range client forbids it", async () => {
    const { assetSource, baseUrl } = await startFixtureServer();
    const response = await fetch(`${baseUrl}/assets/course-abc123.js`, {
      headers: {
        "Accept-Encoding": "br, identity;q=0",
        Range: "bytes=0-3",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBe("br");
    expect(await response.text()).toBe(assetSource);
  });

  test("exposes a no-store health probe and rejects writes", async () => {
    const { baseUrl } = await startFixtureServer();
    const health = await fetch(`${baseUrl}/_trace/health`);
    const write = await fetch(baseUrl, { method: "POST" });

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      service: "trace-ml",
      status: "ok",
    });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET, HEAD");
  });

  test("forwards only fixed same-origin Bedrock course operations", async () => {
    const calls = [];
    const bedrockBridge = {
      async request(action, payload) {
        calls.push({ action, payload });
        if (action === "lessonHelperReady") {
          return {
            available: true,
            model: "openai.gpt-5.6-sol",
            retentionMode: "provider_data_share",
            retentionSource: "account",
            allowedRetentionModes: ["default", "provider_data_share"],
          };
        }
        return { status: "boundary", text: "Boundary.", claims: [] };
      },
    };
    const { baseUrl } = await startFixtureServer({
      bedrockBridge,
      tailnetGuard: async () => true,
    });
    const headers = {
      "Content-Type": "application/json",
      Origin: baseUrl,
      "Sec-Fetch-Site": "same-origin",
    };
    const readiness = await fetch(
      `${baseUrl}/_trace/bedrock/lesson-helper/readiness`,
      {
        method: "POST",
        headers,
        body: "{}",
      },
    );
    const request = {
      requestId: "request-1",
      lessonId: "lesson-1",
      lessonRevision: "revision-1",
      question: "What is a class?",
      history: [],
    };
    const answer = await fetch(`${baseUrl}/_trace/bedrock/lesson-helper`, {
      method: "POST",
      headers,
      body: JSON.stringify({ request }),
    });

    expect(readiness.status).toBe(200);
    expect((await readiness.json()).result).toMatchObject({
      available: true,
      model: "openai.gpt-5.6-sol",
    });
    expect(readiness.headers.get("cache-control")).toBe("no-store");
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      result: { status: "boundary", text: "Boundary.", claims: [] },
    });
    expect(calls).toEqual([
      { action: "lessonHelperReady", payload: {} },
      { action: "answerLessonQuestion", payload: request },
    ]);
  });

  test("rejects cross-origin, malformed, and unconfigured Bedrock requests", async () => {
    const bedrockBridge = { request: vi.fn() };
    const logger = { error: vi.fn() };
    const tailnetGuard = vi.fn(async () => true);
    const { baseUrl } = await startFixtureServer({
      bedrockBridge,
      logger,
      tailnetGuard,
    });
    const endpoint = `${baseUrl}/_trace/bedrock/prose-assessment`;
    const funnel = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        "Sec-Fetch-Site": "same-origin",
        "Tailscale-Funnel-Request": "?1",
      },
      body: JSON.stringify({ request: {} }),
    });
    const crossOrigin = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify({ request: {} }),
    });
    const wrongType = await fetch(endpoint, {
      method: "POST",
      headers: { Origin: baseUrl },
      body: JSON.stringify({ request: {} }),
    });
    const genericPayload = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ prompt: "Use the model for something else." }),
    });
    const unconfigured = await startFixtureServer();
    const unavailable = await fetch(
      `${unconfigured.baseUrl}/_trace/bedrock/lesson-helper/readiness`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: unconfigured.baseUrl,
        },
        body: "{}",
      },
    );

    expect(funnel.status).toBe(403);
    expect(await funnel.json()).toEqual({
      error: "Tailnet-only request required.",
    });
    expect(crossOrigin.status).toBe(403);
    expect(wrongType.status).toBe(415);
    expect(genericPayload.status).toBe(400);
    expect(unavailable.status).toBe(503);
    expect(bedrockBridge.request).not.toHaveBeenCalled();
    expect(tailnetGuard).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("fails closed when live Tailnet route ownership cannot be verified", async () => {
    const bedrockBridge = { request: vi.fn() };
    const tailnetGuard = vi.fn().mockResolvedValue(false);
    const { baseUrl } = await startFixtureServer({
      bedrockBridge,
      tailnetGuard,
    });
    const response = await fetch(
      `${baseUrl}/_trace/bedrock/lesson-helper/readiness`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
        },
        body: "{}",
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Trace ML's private Tailnet route could not be verified.",
    });
    expect(tailnetGuard).toHaveBeenCalledOnce();
    expect(bedrockBridge.request).not.toHaveBeenCalled();

    const malformedStatusGuard = createTailnetRouteGuard({
      command: "/unused/tailscale",
      httpsPort: 9443,
      localTarget: "http://127.0.0.1:5600",
      readStatus: async () => "{",
    });
    await expect(malformedStatusGuard()).resolves.toBe(false);

    const snapStatus = vi.fn(async () =>
      JSON.stringify({
        TCP: { 9443: { HTTPS: true } },
        Web: {
          "trace.tail0000.ts.net:9443": {
            Handlers: {
              "/": { Proxy: "http://127.0.0.1:5600" },
            },
          },
        },
      }),
    );
    const snapGuard = createTailnetRouteGuard({
      command: "/snap/tailscale/current/bin/tailscale",
      httpsPort: 9443,
      localTarget: "http://127.0.0.1:5600",
      socketPath: "/var/snap/tailscale/common/socket/tailscaled.sock",
      readStatus: snapStatus,
    });
    await expect(snapGuard()).resolves.toBe(true);
    expect(snapStatus).toHaveBeenCalledWith(
      "/snap/tailscale/current/bin/tailscale",
      "/var/snap/tailscale/common/socket/tailscaled.sock",
    );
  });

  test("shares one live route inspection across simultaneous requests", async () => {
    let releaseStatus;
    const ownedStatus = {
      TCP: { 9443: { HTTPS: true } },
      Web: {
        "trace.tail0000.ts.net:9443": {
          Handlers: {
            "/": { Proxy: "http://127.0.0.1:5600" },
          },
        },
      },
    };
    const readStatus = vi.fn(
      () =>
        new Promise((resolve) => {
          releaseStatus = resolve;
        }),
    );
    const guard = createTailnetRouteGuard({
      command: "/unused/tailscale",
      httpsPort: 9443,
      localTarget: "http://127.0.0.1:5600",
      readStatus,
    });

    const first = guard();
    const second = guard();
    const third = guard();
    expect(readStatus).toHaveBeenCalledOnce();

    releaseStatus(ownedStatus);
    await expect(Promise.all([first, second, third])).resolves.toEqual([
      true,
      true,
      true,
    ]);

    readStatus.mockResolvedValueOnce(ownedStatus);
    await guard();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });

  test("does not start Bedrock work after a disconnect during route verification", async () => {
    let releaseGuard;
    let markGuardStarted;
    const guardStarted = new Promise((resolve) => {
      markGuardStarted = resolve;
    });
    const guardRelease = new Promise((resolve) => {
      releaseGuard = resolve;
    });
    const bedrockBridge = { request: vi.fn() };
    const tailnetGuard = vi.fn(async () => {
      markGuardStarted();
      await guardRelease;
      return true;
    });
    const { baseUrl } = await startFixtureServer({
      bedrockBridge,
      tailnetGuard,
    });
    const controller = new AbortController();
    const readiness = fetch(
      `${baseUrl}/_trace/bedrock/lesson-helper/readiness`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
        },
        body: "{}",
        signal: controller.signal,
      },
    );

    await guardStarted;
    controller.abort();
    await expect(readiness).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 50));
    releaseGuard();
    await new Promise((resolve) => setImmediate(resolve));

    expect(tailnetGuard).toHaveBeenCalledOnce();
    expect(bedrockBridge.request).not.toHaveBeenCalled();
  });

  test("correlates out-of-order bridge replies and bounds pending work", async () => {
    const bridge = await startBridgeFixture(`
      import { createInterface } from "node:readline";
      createInterface({ input: process.stdin, crlfDelay: Infinity })
        .on("line", (line) => {
          const request = JSON.parse(line);
          if (request.action === "hold") return;
          setTimeout(() => {
            process.stdout.write(JSON.stringify({
              id: request.id,
              ok: true,
              result: request.payload.value,
            }) + "\\n");
          }, request.payload.delay);
        });
    `);

    await expect(
      Promise.all([
        bridge.request("echo", { delay: 30, value: "slow" }),
        bridge.request("echo", { delay: 0, value: "fast" }),
      ]),
    ).resolves.toEqual(["slow", "fast"]);

    const held = Array.from(
      { length: 8 },
      (_, index) => bridge.request("hold", { index }).catch(() => null),
    );
    await expect(bridge.request("hold", {})).rejects.toThrow("busy");
    await expect(
      bridge.request("cancelLessonAnswer", {
        requestId: "held",
        value: true,
      }),
    ).resolves.toBe(true);
    bridge.close();
    await Promise.all(held);
  });

  test("terminates a silent or malformed bridge instead of hanging", async () => {
    const silent = await startBridgeFixture(
      "process.stdin.resume();",
      { timeouts: { ping: 40 } },
    );
    await expect(silent.request("ping", {})).rejects.toThrow(
      "timed out during ping",
    );

    const malformed = await startBridgeFixture(`
      process.stdin.once("data", () => process.stdout.write("not json\\n"));
    `);
    await expect(malformed.request("ping", {})).rejects.toThrow(
      "invalid JSON",
    );
  });

  test("cancels Bedrock work when the browser disconnects", async () => {
    let rejectAnswer;
    let markStarted;
    const started = new Promise((resolve) => {
      markStarted = resolve;
    });
    const calls = [];
    const bedrockBridge = {
      request(action, payload) {
        calls.push({ action, payload });
        if (action === "answerLessonQuestion") {
          markStarted();
          return new Promise((_, reject) => {
            rejectAnswer = reject;
          });
        }
        if (action === "cancelLessonAnswer") {
          rejectAnswer(new Error("cancelled"));
          return Promise.resolve(true);
        }
        return Promise.reject(new Error("Unexpected operation."));
      },
    };
    const { baseUrl } = await startFixtureServer({
      bedrockBridge,
      tailnetGuard: async () => true,
    });
    const controller = new AbortController();
    const requestId = "disconnect-request";
    const answer = fetch(`${baseUrl}/_trace/bedrock/lesson-helper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({
        request: {
          requestId,
          lessonId: "lesson-1",
          lessonRevision: "revision-1",
          question: "What is a class?",
          history: [],
        },
      }),
      signal: controller.signal,
    });
    await started;
    controller.abort();
    await expect(answer).rejects.toThrow();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]).toEqual({
      action: "cancelLessonAnswer",
      payload: { requestId },
    });
  });

  test("labels malformed URL encoding as a bad request", async () => {
    const { baseUrl } = await startFixtureServer();
    const response = await sendRawRequest(baseUrl, "/lesson/%ZZ");

    expect(response).toMatch(/^HTTP\/1\.1 400 Bad Request\r\n/);
    expect(response).toContain("\r\n\r\nBad request\n");
  });

  test("closes the Bedrock bridge when the production port is occupied", async () => {
    const occupied = createHttpServer();
    await new Promise((resolve, reject) => {
      occupied.once("error", reject);
      occupied.listen(0, "127.0.0.1", resolve);
    });
    cleanups.push(
      () =>
        new Promise((resolve, reject) => {
          occupied.close((error) => (error ? reject(error) : resolve()));
        }),
    );
    const address = occupied.address();
    if (!address || typeof address === "string") {
      throw new Error("Occupied fixture server did not bind a TCP port");
    }
    const candidate = createHttpServer();
    const bedrockBridge = { close: vi.fn() };

    await expect(
      listenTraceServer(
        candidate,
        address.port,
        "127.0.0.1",
        bedrockBridge,
      ),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(bedrockBridge.close).toHaveBeenCalledOnce();
  });

  test("rejects ambiguous port strings", () => {
    expect(parsePort("5600")).toBe(5600);
    expect(() => parsePort("05600")).toThrow("Invalid port");
    expect(() => parsePort("0")).toThrow("Invalid port");
  });

  test("accepts a guarded Tailscale socket only with a complete bridge", () => {
    expect(
      parseArguments([
        "--bedrock-bridge",
        "/tmp/bridge",
        "--tailscale-command",
        "/snap/tailscale/current/bin/tailscale",
        "--tailscale-socket",
        "/var/snap/tailscale/common/socket/tailscaled.sock",
        "--tailnet-https-port",
        "9443",
      ]),
    ).toMatchObject({
      tailnetHttpsPort: 9443,
      tailscaleCommand: "/snap/tailscale/current/bin/tailscale",
      tailscaleSocket:
        "/var/snap/tailscale/common/socket/tailscaled.sock",
    });
    expect(() =>
      parseArguments([
        "--bedrock-bridge",
        "/tmp/bridge",
        "--tailscale-socket",
        "/tmp/tailscaled.sock",
        "--tailnet-https-port",
        "9443",
      ]),
    ).toThrow("socket requires a Tailscale command");
    expect(() =>
      parseArguments([
        "--tailscale-command",
        "/tmp/tailscale",
        "--tailscale-socket",
        "/tmp/tailscaled.sock",
      ]),
    ).toThrow("options require the Bedrock bridge");
  });
});
