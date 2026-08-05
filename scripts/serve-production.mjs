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
const BROTLI_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".wasm",
  ".webmanifest",
]);
const FIXED_ASSET_PATHS = new Set([
  "/favicon.svg",
  "/icons.svg",
  "/manifest.webmanifest",
  "/trace-ml-180.png",
  "/trace-ml-192.png",
  "/trace-ml-512.png",
  "/trace-ml-maskable-512.png",
]);

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function cacheControl(pathname) {
  if (pathname === "/" || pathname.endsWith(".html")) return "no-cache";
  if (pathname.startsWith("/pyodide/") || FIXED_ASSET_PATHS.has(pathname)) {
    return "no-cache";
  }
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
    rootReal,
    stats: candidateStats,
    status: 200,
  };
}

function encodingQuality(value, encoding) {
  if (!value) return encoding === "identity" ? 1 : 0;
  let wildcardQuality = null;
  for (const item of value.split(",")) {
    const [name, ...parameters] = item.trim().toLowerCase().split(";");
    const qualityParameter = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith("q="));
    const parsedQuality = qualityParameter
      ? Number.parseFloat(qualityParameter.slice(2))
      : 1;
    const quality =
      Number.isFinite(parsedQuality) &&
      parsedQuality >= 0 &&
      parsedQuality <= 1
        ? parsedQuality
        : 0;
    if (name === encoding) return quality;
    if (name === "*") wildcardQuality = quality;
  }
  if (encoding === "identity") return wildcardQuality === 0 ? 0 : 1;
  return wildcardQuality ?? 0;
}

function opaqueEtag(value) {
  return /^(?:W\/)?("[\u0021\u0023-\u007e\u0080-\u00ff]*")$/.exec(value)?.[1] ??
    null;
}

function matchesEtag(value, etag) {
  const expected = opaqueEtag(etag);
  return (
    value
      ?.split(",")
      .map((candidate) => candidate.trim())
      .some(
        (candidate) =>
          candidate === "*" ||
          (expected !== null && opaqueEtag(candidate) === expected),
      ) ?? false
  );
}

function ifRangeMatches(value, etag, modifiedAt) {
  if (!value) return true;
  const validator = value.trim();
  if (validator.startsWith('"') || validator.startsWith('W/"')) {
    return (
      !validator.startsWith("W/") &&
      !etag.startsWith("W/") &&
      validator === etag
    );
  }
  const requestedDate = Date.parse(validator);
  return (
    Number.isFinite(requestedDate) &&
    Math.trunc(modifiedAt.getTime() / 1000) ===
      Math.trunc(requestedDate / 1000)
  );
}

function ifModifiedSinceMatches(value, modifiedAt) {
  if (!value) return false;
  const requestedDate = Date.parse(value);
  return (
    Number.isFinite(requestedDate) &&
    Math.trunc(modifiedAt.getTime() / 1000) <=
      Math.trunc(requestedDate / 1000)
  );
}

function parseByteRange(value, size) {
  const unit = /^bytes=(.*)$/i.exec(value);
  if (!unit) return null;
  const specification = unit[1];
  if (specification.includes(",")) return null;
  const match = /^([0-9]*)-([0-9]*)$/.exec(specification);
  if (!match || (!match[1] && !match[2])) return { invalid: true };

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (
      size === 0 ||
      !Number.isSafeInteger(suffixLength) ||
      suffixLength < 1
    ) {
      return { invalid: true };
    }
    return {
      end: size - 1,
      start: Math.max(0, size - suffixLength),
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= size ||
    requestedEnd < start
  ) {
    return { invalid: true };
  }
  return { end: Math.min(requestedEnd, size - 1), start };
}

async function brotliRepresentation(located) {
  if (
    !BROTLI_EXTENSIONS.has(extname(located.filePath).toLowerCase())
  ) {
    return null;
  }
  try {
    const compressedReal = await realpath(`${located.filePath}.br`);
    if (!isWithin(located.rootReal, compressedReal)) return null;
    const compressedStats = await stat(compressedReal);
    if (!compressedStats.isFile() || compressedStats.size >= located.stats.size) {
      return null;
    }
    return { filePath: compressedReal, stats: compressedStats };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

async function serveFile(request, response, located) {
  const rawEtag = `W/"${located.stats.size.toString(16)}-${Math.trunc(
    located.stats.mtimeMs,
  ).toString(16)}"`;
  const modifiedAt = located.stats.mtime;
  const rangeHeader =
    request.method === "GET" && typeof request.headers.range === "string"
      ? request.headers.range
      : null;
  const parsedRange = rangeHeader
    ? parseByteRange(rangeHeader, located.stats.size)
    : null;
  const requestedRange =
    parsedRange &&
    ifRangeMatches(request.headers["if-range"], rawEtag, modifiedAt)
      ? parsedRange
      : null;
  const encodingHeader = request.headers["accept-encoding"];
  const identityQuality = encodingQuality(encodingHeader, "identity");
  const brotliQuality = encodingQuality(encodingHeader, "br");
  const shouldUseBrotli =
    brotliQuality > 0 &&
    (
      requestedRange
        ? identityQuality === 0
        : brotliQuality >= identityQuality
    );
  const compressed = shouldUseBrotli
    ? await brotliRepresentation(located)
    : null;
  if (!compressed && identityQuality === 0) {
    response.setHeader("Vary", "Accept-Encoding");
    sendText(response, 406, "No acceptable representation");
    return;
  }
  const representation = compressed ?? {
    filePath: located.filePath,
    stats: located.stats,
  };
  const etag = compressed
    ? `W/"${representation.stats.size.toString(16)}-${Math.trunc(
      representation.stats.mtimeMs,
    ).toString(16)}-br"`
    : rawEtag;
  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl(located.pathname),
    "Content-Type":
      MIME_TYPES.get(extname(located.filePath).toLowerCase()) ??
      "application/octet-stream",
    ETag: etag,
    "Last-Modified": modifiedAt.toUTCString(),
  };
  if (BROTLI_EXTENSIONS.has(extname(located.filePath).toLowerCase())) {
    headers.Vary = "Accept-Encoding";
  }
  if (compressed) headers["Content-Encoding"] = "br";

  if (matchesEtag(request.headers["if-none-match"], etag)) {
    response.writeHead(304, baseHeaders(headers));
    response.end();
    return;
  }
  if (
    request.headers["if-none-match"] === undefined &&
    ifModifiedSinceMatches(request.headers["if-modified-since"], modifiedAt)
  ) {
    response.writeHead(304, baseHeaders(headers));
    response.end();
    return;
  }

  if (requestedRange && identityQuality > 0) {
    const range = requestedRange;
    if (range?.invalid) {
      response.writeHead(
        416,
        baseHeaders({
          ...headers,
          "Content-Length": 0,
          "Content-Range": `bytes */${located.stats.size}`,
        }),
      );
      response.end();
      return;
    }
    if (range) {
      const length = range.end - range.start + 1;
      response.writeHead(
        206,
        baseHeaders({
          ...headers,
          "Content-Length": length,
          "Content-Range": `bytes ${range.start}-${range.end}/${located.stats.size}`,
        }),
      );
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      try {
        await pipeline(
          createReadStream(located.filePath, {
            end: range.end,
            start: range.start,
          }),
          response,
        );
      } catch (error) {
        if (error?.code !== "ERR_STREAM_PREMATURE_CLOSE") throw error;
      }
      return;
    }
  }

  response.writeHead(
    200,
    baseHeaders({
      ...headers,
      "Content-Length": representation.stats.size,
    }),
  );
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  try {
    await pipeline(createReadStream(representation.filePath), response);
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
        const body = '{"service":"trace-ml","status":"ok"}\n';
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
      if (requestUrl.pathname.toLowerCase().endsWith(".br")) {
        sendText(response, 404, "Not found");
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
        const message =
          located.status === 400
            ? "Bad request"
            : located.status === 403
              ? "Forbidden"
              : "Not found";
        sendText(
          response,
          located.status,
          message,
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

export function parsePort(value) {
  if (!/^[1-9][0-9]{0,4}$/.test(value)) {
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
