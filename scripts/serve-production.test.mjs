import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createTraceServer } from "./serve-production.mjs";

const cleanups = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function startFixtureServer() {
  const root = await mkdtemp(join(tmpdir(), "trace-ml-server-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<main>Trace course</main>");
  await writeFile(join(root, "assets", "course-abc123.js"), "export {};");
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
  return `http://127.0.0.1:${address.port}`;
}

describe("production static server", () => {
  test("serves the SPA with cross-origin isolation headers", async () => {
    const baseUrl = await startFixtureServer();
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
    const baseUrl = await startFixtureServer();
    const asset = await fetch(`${baseUrl}/assets/course-abc123.js`);
    const missing = await fetch(`${baseUrl}/assets/missing.js`, {
      headers: { Accept: "text/html" },
    });

    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect(missing.status).toBe(404);
  });

  test("exposes a no-store health probe and rejects writes", async () => {
    const baseUrl = await startFixtureServer();
    const health = await fetch(`${baseUrl}/_trace/health`);
    const write = await fetch(baseUrl, { method: "POST" });

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET, HEAD");
  });
});
