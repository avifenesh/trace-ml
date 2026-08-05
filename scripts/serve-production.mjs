#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";

const DEFAULT_ROOT = resolve(
  fileURLToPath(new URL("../dist", import.meta.url)),
);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1"]);
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".whl", "application/zip"],
  [".zip", "application/zip"],
]);
const SECURITY_HEADERS = Object.freeze({
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
});

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function cacheControl(pathname) {
  if (pathname === "/" || pathname.endsWith(".html")) return "no-cache";
  if (pathname.startsWith("/assets/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=86400";
}

function baseHeaders(extra = {}) {
  return { ...SECURITY_HEADERS, ...extra };
}

function sendText(response, statusCode, message) {
  const body = `${message}\n`;
  response.writeHead(
    statusCode,
    baseHeaders({
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": "text/plain; charset=utf-8",
    }),
  );
  response.end(body);
}

async function locateFile(root, rootReal, pathname, acceptsHtml) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }
  if (decodedPath.includes("\0")) return { status: 400 };

  const requested = resolve(root, `.${decodedPath}`);
  if (!isWithin(root, requested)) return { status: 403 };

  let candidate = requested;
  let candidateStats;
  try {
    candidateStats = await stat(candidate);
    if (candidateStats.isDirectory()) {
      candidate = resolve(candidate, "index.html");
      candidateStats = await stat(candidate);
    }
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    const shouldUseSpaFallback =
      acceptsHtml && extname(decodedPath) === "";
    if (!shouldUseSpaFallback) return { status: 404 };
    candidate = resolve(root, "index.html");
    candidateStats = await stat(candidate);
  }

  if (!candidateStats.isFile()) return { status: 404 };
  const candidateReal = await realpath(candidate);
  if (!isWithin(rootReal, candidateReal)) return { status: 403 };
  return {
    filePath: candidateReal,
    pathname:
      candidateReal === resolve(rootReal, "index.html")
        ? "/index.html"
        : decodedPath,
    stats: candidateStats,
    status: 200,
  };
}

async function serveFile(request, response, located) {
  const etag = `W/"${located.stats.size.toString(16)}-${Math.trunc(
    located.stats.mtimeMs,
  ).toString(16)}"`;
  if (request.headers["if-none-match"] === etag) {
    response.writeHead(304, baseHeaders({ ETag: etag }));
    response.end();
    return;
  }

  response.writeHead(
    200,
    baseHeaders({
      "Cache-Control": cacheControl(located.pathname),
      "Content-Length": located.stats.size,
      "Content-Type":
        MIME_TYPES.get(extname(located.filePath).toLowerCase()) ??
        "application/octet-stream",
      ETag: etag,
    }),
  );
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  try {
    await pipeline(createReadStream(located.filePath), response);
  } catch (error) {
    if (error?.code !== "ERR_STREAM_PREMATURE_CLOSE") throw error;
  }
}

export function createTraceServer({ root = DEFAULT_ROOT, logger = console } = {}) {
  const rootPath = resolve(root);
  const rootRealPromise = realpath(rootPath);

  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        sendText(response, 405, "Method not allowed");
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname === "/_trace/health") {
        const body = '{"status":"ok"}\n';
        response.writeHead(
          200,
          baseHeaders({
            "Cache-Control": "no-store",
            "Content-Length": Buffer.byteLength(body),
            "Content-Type": "application/json; charset=utf-8",
          }),
        );
        response.end(request.method === "HEAD" ? undefined : body);
        return;
      }

      const rootReal = await rootRealPromise;
      const located = await locateFile(
        rootPath,
        rootReal,
        requestUrl.pathname,
        request.headers.accept?.includes("text/html") ?? false,
      );
      if (located.status !== 200) {
        sendText(
          response,
          located.status,
          located.status === 403 ? "Forbidden" : "Not found",
        );
        return;
      }
      await serveFile(request, response, located);
    } catch (error) {
      logger.error("Trace ML production server request failed", error);
      if (!response.headersSent) {
        sendText(response, 500, "Internal server error");
      } else {
        response.destroy(error);
      }
    }
  });
}

function parsePort(value) {
  if (!/^[0-9]{1,5}$/.test(value)) {
    throw new Error(`Invalid port: ${value}`);
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function parseArguments(arguments_) {
  const options = {
    host: "127.0.0.1",
    port: 5600,
    root: DEFAULT_ROOT,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help" || argument === "-h") {
      return { ...options, help: true };
    }
    const value = arguments_[index + 1];
    if (!value) throw new Error(`Missing value for ${argument}`);
    if (argument === "--host") options.host = value;
    else if (argument === "--port") options.port = parsePort(value);
    else if (argument === "--root") options.root = resolve(value);
    else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!LOOPBACK_HOSTS.has(options.host)) {
    throw new Error("Production server host must be a loopback address");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: node scripts/serve-production.mjs " +
        "[--host 127.0.0.1] [--port 5600] [--root dist]\n",
    );
    return;
  }

  const indexStats = await stat(resolve(options.root, "index.html"));
  if (!indexStats.isFile()) {
    throw new Error(`Missing production entry point: ${options.root}/index.html`);
  }

  const server = createTraceServer({ root: options.root });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(options.port, options.host, resolveListen);
  });
  process.stdout.write(
    `Trace ML production server listening at http://${options.host}:${options.port}\n`,
  );

  const stop = () => {
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
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
