import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { brotliCompressSync } from "node:zlib";
import { afterEach, describe, expect, test } from "vitest";
import { createTraceServer, parsePort } from "./serve-production.mjs";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function startFixtureServer() {
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
  const server = createTraceServer({ root });
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

async function sendRawRequest(baseUrl, requestTarget) {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const chunks = [];
    const socket = connect({ host: hostname, port: Number(port) });
    socket.once("error", reject);
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.once("connect", () => {
      socket.end(
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

  test("labels malformed URL encoding as a bad request", async () => {
    const { baseUrl } = await startFixtureServer();
    const response = await sendRawRequest(baseUrl, "/lesson/%ZZ");

    expect(response).toMatch(/^HTTP\/1\.1 400 Bad Request\r\n/);
    expect(response).toContain("\r\n\r\nBad request\n");
  });

  test("rejects ambiguous port strings", () => {
    expect(parsePort("5600")).toBe(5600);
    expect(() => parsePort("05600")).toThrow("Invalid port");
    expect(() => parsePort("0")).toThrow("Invalid port");
  });
});
