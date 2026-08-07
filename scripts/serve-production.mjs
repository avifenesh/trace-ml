#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { inspectTailnetBedrockRoute } from "./inspect-tailnet-route.mjs";

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
const MAX_BEDROCK_REQUEST_BYTES = 128 * 1_024;
const MAX_TAILNET_STATUS_BYTES = 1_024 * 1_024;
const MAX_PENDING_BRIDGE_REQUESTS = 10;
const MAX_PENDING_NON_CANCELLATIONS = 8;
const BRIDGE_CANCELLATION_ACTIONS = new Set([
  "cancelLessonAnswer",
  "cancelProseAssessment",
]);
const BRIDGE_TIMEOUTS = Object.freeze({
  ping: 5_000,
  lessonHelperReady: 30_000,
  answerLessonQuestion: 100_000,
  cancelLessonAnswer: 5_000,
  proseAssessmentReady: 30_000,
  assessProse: 190_000,
  cancelProseAssessment: 5_000,
});
const BEDROCK_ROUTES = new Map([
  [
    "/_trace/bedrock/lesson-helper/readiness",
    { action: "lessonHelperReady", shape: "empty" },
  ],
  [
    "/_trace/bedrock/lesson-helper",
    {
      action: "answerLessonQuestion",
      cancelAction: "cancelLessonAnswer",
      shape: "request",
    },
  ],
  [
    "/_trace/bedrock/lesson-helper/cancel",
    { action: "cancelLessonAnswer", shape: "cancellation" },
  ],
  [
    "/_trace/bedrock/prose-assessment/readiness",
    { action: "proseAssessmentReady", shape: "empty" },
  ],
  [
    "/_trace/bedrock/prose-assessment",
    {
      action: "assessProse",
      cancelAction: "cancelProseAssessment",
      shape: "request",
    },
  ],
  [
    "/_trace/bedrock/prose-assessment/cancel",
    { action: "cancelProseAssessment", shape: "cancellation" },
  ],
]);

class HttpRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

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

function sendJson(response, statusCode, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(
    statusCode,
    baseHeaders({
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(body),
      "Content-Type": "application/json; charset=utf-8",
    }),
  );
  response.end(body);
}

function readTailnetStatus(command, socketPath) {
  const arguments_ = socketPath
    ? ["--socket", socketPath, "serve", "status", "--json"]
    : ["serve", "status", "--json"];
  return new Promise((resolveStatus, rejectStatus) => {
    execFile(
      command,
      arguments_,
      {
        encoding: "utf8",
        maxBuffer: MAX_TAILNET_STATUS_BYTES,
        timeout: 3_000,
      },
      (error, stdout) => {
        if (error) rejectStatus(error);
        else resolveStatus(stdout);
      },
    );
  });
}

export function createTailnetRouteGuard({
  command,
  httpsPort,
  localTarget,
  socketPath = null,
  readStatus = readTailnetStatus,
}) {
  let inFlight = null;
  return () => {
    if (inFlight) return inFlight;

    const attempt = (async () => {
      try {
        const rawStatus = await readStatus(command, socketPath);
        const config =
          typeof rawStatus === "string" ? JSON.parse(rawStatus) : rawStatus;
        return (
          inspectTailnetBedrockRoute(config, httpsPort, localTarget) === "owned"
        );
      } catch {
        return false;
      }
    })();
    inFlight = attempt;
    void attempt.finally(() => {
      if (inFlight === attempt) inFlight = null;
    });
    return attempt;
  };
}

function sameOriginRequest(request) {
  const host = request.headers.host;
  const origin = request.headers.origin;
  if (
    typeof host !== "string" ||
    typeof origin !== "string" ||
    (request.headers["sec-fetch-site"] &&
      request.headers["sec-fetch-site"] !== "same-origin")
  ) {
    return false;
  }
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host) return false;
    return (
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname))
    );
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"]
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    throw new HttpRequestError(415, "Content-Type must be application/json.");
  }
  const contentEncoding = request.headers["content-encoding"];
  if (contentEncoding && contentEncoding !== "identity") {
    throw new HttpRequestError(415, "Encoded request bodies are not supported.");
  }
  const declaredLength = Number(request.headers["content-length"]);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_BEDROCK_REQUEST_BYTES
  ) {
    request.resume();
    throw new HttpRequestError(413, "Request body is too large.");
  }

  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > MAX_BEDROCK_REQUEST_BYTES) {
      request.resume();
      throw new HttpRequestError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }
  let value;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpRequestError(400, "Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpRequestError(400, "Request body must be a JSON object.");
  }
  return value;
}

function bridgePayload(route, body) {
  const keys = Object.keys(body);
  if (route.shape === "empty") {
    if (keys.length !== 0) {
      throw new HttpRequestError(400, "Readiness requests must be empty.");
    }
    return {};
  }
  if (route.shape === "request") {
    if (
      keys.length !== 1 ||
      keys[0] !== "request" ||
      !body.request ||
      typeof body.request !== "object" ||
      Array.isArray(body.request)
    ) {
      throw new HttpRequestError(400, "Invalid Bedrock course request.");
    }
    return body.request;
  }
  if (
    keys.length !== 1 ||
    keys[0] !== "requestId" ||
    typeof body.requestId !== "string"
  ) {
    throw new HttpRequestError(400, "Invalid Bedrock cancellation request.");
  }
  return body;
}

async function handleBedrockRoute(
  request,
  response,
  route,
  bedrockBridge,
  tailnetGuard,
  logger,
) {
  if (request.headers["tailscale-funnel-request"] !== undefined) {
    sendJson(response, 403, { error: "Tailnet-only request required." });
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendText(response, 405, "Method not allowed");
    return;
  }
  if (!sameOriginRequest(request)) {
    sendJson(response, 403, { error: "Same-origin request required." });
    return;
  }
  if (!bedrockBridge) {
    sendJson(response, 503, {
      error: "Bedrock is not configured for this web release.",
    });
    return;
  }
  let bridgeStarted = false;
  let completed = false;
  let clientClosed = false;
  let cancelPayload = null;
  const cancelOnClose = () => {
    if (clientClosed) return;
    clientClosed = true;
    if (!bridgeStarted || completed || !route.cancelAction || !cancelPayload) {
      return;
    }
    void bedrockBridge
      .request(route.cancelAction, cancelPayload)
      .catch((error) => {
        logger.error(
          `Trace ML Bedrock ${route.cancelAction} failed after disconnect: ` +
            `${error instanceof Error ? error.message : "unknown error"}`,
        );
      });
  };
  response.once("close", cancelOnClose);
  request.once("aborted", cancelOnClose);
  request.socket.once("close", cancelOnClose);
  try {
    const body = await readJsonBody(request);
    if (clientClosed) return;

    if (!tailnetGuard || !(await tailnetGuard())) {
      if (clientClosed) return;
      sendJson(response, 503, {
        error: "Trace ML's private Tailnet route could not be verified.",
      });
      return;
    }
    if (clientClosed) return;

    const payload = bridgePayload(route, body);
    if (
      route.cancelAction &&
      typeof payload.requestId === "string" &&
      payload.requestId.trim()
    ) {
      cancelPayload = { requestId: payload.requestId };
    }
    bridgeStarted = true;
    const result = await bedrockBridge.request(
      route.action,
      payload,
    );
    if (clientClosed) return;
    completed = true;
    sendJson(response, 200, { result });
  } catch (error) {
    if (clientClosed) return;
    completed = true;
    if (error instanceof HttpRequestError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    const message =
      error instanceof Error && error.message.trim()
        ? Array.from(error.message).slice(0, 500).join("")
        : "The Bedrock service is unavailable.";
    logger.error(`Trace ML Bedrock ${route.action} failed: ${message}`);
    sendJson(response, 503, { error: message });
  } finally {
    response.off("close", cancelOnClose);
    request.off("aborted", cancelOnClose);
    request.socket.off("close", cancelOnClose);
  }
}

export function createBedrockBridge(
  executablePath,
  {
    onFailure = () => {},
    timeouts = BRIDGE_TIMEOUTS,
  } = {},
) {
  const child = spawn(executablePath, [], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  let sequence = 0;
  let failure = null;
  let closing = false;

  const stopChild = (signal) => {
    lines.close();
    child.stdin.destroy();
    child.stdout.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill(signal);
      } catch {
        // The process already ended between the status check and kill.
      }
    }
  };

  const rejectPending = (error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };

  const fail = (error) => {
    if (failure || closing) return;
    failure = error instanceof Error
      ? error
      : new Error("The Bedrock bridge stopped.");
    rejectPending(failure);
    stopChild("SIGKILL");
    onFailure(failure);
  };

  lines.on("line", (line) => {
    let response;
    try {
      response = JSON.parse(line);
    } catch {
      fail(new Error("The Bedrock bridge returned invalid JSON."));
      return;
    }
    const request = pending.get(response?.id);
    if (!request) {
      fail(new Error("The Bedrock bridge returned an unknown response."));
      return;
    }
    pending.delete(response.id);
    clearTimeout(request.timer);
    if (response.ok === true && "result" in response) {
      request.resolve(response.result);
    } else if (
      response.ok === false &&
      typeof response.error === "string" &&
      response.error.trim()
    ) {
      request.reject(new Error(response.error));
    } else {
      const error = new Error("The Bedrock bridge returned an invalid result.");
      request.reject(error);
      fail(error);
    }
  });
  child.stdin.on("error", fail);
  child.stdout.on("error", fail);
  child.once("error", fail);
  child.once("exit", (code, signal) => {
    if (!closing) {
      fail(
        new Error(
          `The Bedrock bridge exited unexpectedly (${signal ?? code ?? "unknown"}).`,
        ),
      );
    }
  });

  return {
    request(action, payload) {
      if (failure) return Promise.reject(failure);
      if (closing) {
        return Promise.reject(new Error("The Bedrock bridge is closing."));
      }
      const pendingNonCancellations = Array.from(pending.values()).filter(
        (request) => !BRIDGE_CANCELLATION_ACTIONS.has(request.action),
      ).length;
      if (
        pending.size >= MAX_PENDING_BRIDGE_REQUESTS ||
        (!BRIDGE_CANCELLATION_ACTIONS.has(action) &&
          pendingNonCancellations >= MAX_PENDING_NON_CANCELLATIONS)
      ) {
        return Promise.reject(new Error("The Bedrock bridge is busy."));
      }
      const id = `bridge-${++sequence}`;
      return new Promise((resolveRequest, rejectRequest) => {
        const timeoutMs = timeouts[action] ?? 30_000;
        const timer = setTimeout(() => {
          fail(new Error(`The Bedrock bridge timed out during ${action}.`));
        }, timeoutMs);
        pending.set(id, {
          resolve: resolveRequest,
          reject: rejectRequest,
          action,
          timer,
        });
        try {
          child.stdin.write(
            `${JSON.stringify({ id, action, payload })}\n`,
            (error) => {
              if (error) fail(error);
            },
          );
        } catch (error) {
          fail(error);
        }
      });
    },
    close() {
      if (closing) return;
      closing = true;
      const error = new Error("The Bedrock bridge is closing.");
      rejectPending(error);
      stopChild("SIGTERM");
    },
  };
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

export function createTraceServer({
  root = DEFAULT_ROOT,
  logger = console,
  bedrockBridge = null,
  tailnetGuard = null,
} = {}) {
  const rootPath = resolve(root);
  const rootRealPromise = realpath(rootPath);

  return createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const bedrockRoute = BEDROCK_ROUTES.get(requestUrl.pathname);
      if (bedrockRoute) {
        await handleBedrockRoute(
          request,
          response,
          bedrockRoute,
          bedrockBridge,
          tailnetGuard,
          logger,
        );
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        sendText(response, 405, "Method not allowed");
        return;
      }

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

export async function listenTraceServer(
  server,
  port,
  host,
  bedrockBridge = null,
) {
  try {
    await new Promise((resolveListen, rejectListen) => {
      const onError = (error) => {
        server.off("listening", onListening);
        rejectListen(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolveListen();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    });
  } catch (error) {
    bedrockBridge?.close();
    throw error;
  }
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

export function parseArguments(arguments_) {
  const options = {
    bedrockBridge: null,
    host: "127.0.0.1",
    port: 5600,
    root: DEFAULT_ROOT,
    tailnetHttpsPort: null,
    tailscaleCommand: null,
    tailscaleSocket: null,
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
    else if (argument === "--bedrock-bridge") {
      options.bedrockBridge = resolve(value);
    } else if (argument === "--tailnet-https-port") {
      options.tailnetHttpsPort = parsePort(value);
    } else if (argument === "--tailscale-command") {
      options.tailscaleCommand = resolve(value);
    } else if (argument === "--tailscale-socket") {
      options.tailscaleSocket = resolve(value);
    } else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!LOOPBACK_HOSTS.has(options.host)) {
    throw new Error("Production server host must be a loopback address");
  }
  if (options.tailscaleSocket && !options.tailscaleCommand) {
    throw new Error("The Tailscale socket requires a Tailscale command.");
  }
  if (
    options.bedrockBridge &&
    (!options.tailnetHttpsPort || !options.tailscaleCommand)
  ) {
    throw new Error(
      "The Bedrock bridge requires a live Tailnet route guard.",
    );
  }
  if (
    !options.bedrockBridge &&
    (options.tailnetHttpsPort ||
      options.tailscaleCommand ||
      options.tailscaleSocket)
  ) {
    throw new Error("Tailnet route guard options require the Bedrock bridge.");
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: node scripts/serve-production.mjs " +
        "[--host 127.0.0.1] [--port 5600] [--root dist] " +
        "[--bedrock-bridge path --tailscale-command path " +
        "[--tailscale-socket path] " +
        "--tailnet-https-port 9443]\n",
    );
    return;
  }

  const indexStats = await stat(resolve(options.root, "index.html"));
  if (!indexStats.isFile()) {
    throw new Error(`Missing production entry point: ${options.root}/index.html`);
  }

  let stopping = false;
  let server = null;
  const localHost = options.host.includes(":")
    ? `[${options.host}]`
    : options.host;
  const tailnetGuard = options.bedrockBridge
    ? createTailnetRouteGuard({
        command: options.tailscaleCommand,
        httpsPort: options.tailnetHttpsPort,
        localTarget: `http://${localHost}:${options.port}`,
        socketPath: options.tailscaleSocket,
      })
    : null;
  const bedrockBridge = options.bedrockBridge
    ? createBedrockBridge(options.bedrockBridge, {
        onFailure(error) {
          if (stopping) return;
          console.error(`error: ${error.message}`);
          process.exitCode = 1;
          server?.close();
        },
      })
    : null;
  if (bedrockBridge) {
    try {
      await bedrockBridge.request("ping", {});
    } catch (error) {
      bedrockBridge.close();
      throw error;
    }
  }
  server = createTraceServer({
    root: options.root,
    bedrockBridge,
    tailnetGuard,
  });
  await listenTraceServer(
    server,
    options.port,
    options.host,
    bedrockBridge,
  );
  process.stdout.write(
    `Trace ML production server listening at http://${options.host}:${options.port}\n`,
  );

  const stop = () => {
    stopping = true;
    bedrockBridge?.close();
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
