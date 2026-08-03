import type { CodeCheck } from "../content/types";

export const RUNTIME_PROTOCOL_LIMITS = Object.freeze({
  maxCodeCharacters: 1_000_000,
  maxChecks: 128,
  maxConceptIds: 32,
  maxControlStringCharacters: 16_384,
  maxFilenameCharacters: 512,
  maxOutputBytes: 1_048_576,
  maxOutputChunks: 2_000,
  maxOutputLines: 10_000,
  maxPackages: 64,
  maxRunIdCharacters: 128,
});

export interface RuntimeEnvironment {
  pyodideVersion: string;
  pythonVersion: string;
  abi: string;
  packages: Record<string, string>;
  crossOriginIsolated: boolean;
  digest: string;
}

export interface RunRequest {
  code: string;
  checks?: CodeCheck[];
  filename?: string;
  seed?: number;
  timeoutMs?: number;
  interruptGraceMs?: number;
  maxOutputBytes?: number;
  maxOutputLines?: number;
}

export type RunStatus =
  | "completed"
  | "failed"
  | "interrupted"
  | "timed-out";

export interface AssessmentCheckResult {
  id: string;
  label: string;
  passed: boolean;
  actual: string;
  expected: string;
  error?: string;
}

export interface OutputChunk {
  stream: "stdout" | "stderr";
  text: string;
}

export interface RunResult {
  status: RunStatus;
  stdout: string;
  stderr: string;
  output: OutputChunk[];
  result: string | null;
  checks: AssessmentCheckResult[];
  error: string | null;
  outputTruncated: boolean;
  bytesProduced: number;
  durationMs: number;
  environment: RuntimeEnvironment;
}

export interface InitializeWorkerRequest {
  type: "initialize";
  indexURL: string;
  allowedPackages: string[];
  interruptBuffer?: SharedArrayBuffer;
}

export interface RunWorkerRequest {
  type: "run";
  runId: string;
  code: string;
  checks: CodeCheck[];
  filename: string;
  seed: number;
  maxOutputBytes: number;
  maxOutputLines: number;
}

export type WorkerRequest = InitializeWorkerRequest | RunWorkerRequest;

export interface WorkerReadyMessage {
  type: "ready";
  environment: RuntimeEnvironment;
}

export interface WorkerRunMessage {
  type: "run-result";
  runId: string;
  result: Omit<RunResult, "status" | "durationMs" | "environment"> & {
    status: "completed" | "failed" | "interrupted";
  };
}

export interface WorkerFatalMessage {
  type: "fatal";
  error: string;
  errorTruncated: boolean;
}

export type WorkerMessage =
  | WorkerReadyMessage
  | WorkerRunMessage
  | WorkerFatalMessage;

export interface WorkerConnectRequest {
  type: "connect";
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function isBoundedString(value: unknown, maxCharacters: number) {
  return typeof value === "string" && value.length <= maxCharacters;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isStringArray(
  value: unknown,
  maxItems: number,
  maxCharacters: number,
) {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => isBoundedString(item, maxCharacters))
  );
}

function isCodeCheck(value: unknown): value is CodeCheck {
  if (!isRecord(value)) return false;
  const expected = value.expected;
  return (
    isBoundedString(
      value.id,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.label,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.expression,
      RUNTIME_PROTOCOL_LIMITS.maxCodeCharacters,
    ) &&
    (isBoundedString(
      expected,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) ||
      isFiniteNumber(expected) ||
      isBoolean(expected)) &&
    isStringArray(
      value.conceptIds,
      RUNTIME_PROTOCOL_LIMITS.maxConceptIds,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    )
  );
}

function isRuntimeEnvironment(value: unknown): value is RuntimeEnvironment {
  if (!isRecord(value) || !isRecord(value.packages)) return false;
  const packageEntries = Object.entries(value.packages);
  return (
    isBoundedString(
      value.pyodideVersion,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.pythonVersion,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.abi,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.digest,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoolean(value.crossOriginIsolated) &&
    packageEntries.length <= RUNTIME_PROTOCOL_LIMITS.maxPackages &&
    packageEntries.every(
      ([name, version]) =>
        isBoundedString(
          name,
          RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
        ) &&
        isBoundedString(
          version,
          RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
        ),
    )
  );
}

function isAssessmentCheckResult(
  value: unknown,
): value is AssessmentCheckResult {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(
      value.id,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoundedString(
      value.label,
      RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
    ) &&
    isBoolean(value.passed) &&
    isBoundedString(
      value.actual,
      RUNTIME_PROTOCOL_LIMITS.maxOutputBytes,
    ) &&
    isBoundedString(
      value.expected,
      RUNTIME_PROTOCOL_LIMITS.maxOutputBytes,
    ) &&
    (value.error === undefined ||
      isBoundedString(
        value.error,
        RUNTIME_PROTOCOL_LIMITS.maxOutputBytes,
      ))
  );
}

function isOutputChunk(value: unknown): value is OutputChunk {
  return (
    isRecord(value) &&
    (value.stream === "stdout" || value.stream === "stderr") &&
    isBoundedString(value.text, RUNTIME_PROTOCOL_LIMITS.maxOutputBytes)
  );
}

function isWorkerRunResult(
  value: unknown,
): value is WorkerRunMessage["result"] {
  if (!isRecord(value)) return false;
  return (
    (value.status === "completed" ||
      value.status === "failed" ||
      value.status === "interrupted") &&
    isBoundedString(value.stdout, RUNTIME_PROTOCOL_LIMITS.maxOutputBytes) &&
    isBoundedString(value.stderr, RUNTIME_PROTOCOL_LIMITS.maxOutputBytes) &&
    Array.isArray(value.output) &&
    value.output.length <= RUNTIME_PROTOCOL_LIMITS.maxOutputChunks &&
    value.output.every(isOutputChunk) &&
    (value.result === null ||
      isBoundedString(value.result, RUNTIME_PROTOCOL_LIMITS.maxOutputBytes)) &&
    Array.isArray(value.checks) &&
    value.checks.length <= RUNTIME_PROTOCOL_LIMITS.maxChecks &&
    value.checks.every(isAssessmentCheckResult) &&
    (value.error === null ||
      isBoundedString(value.error, RUNTIME_PROTOCOL_LIMITS.maxOutputBytes)) &&
    isBoolean(value.outputTruncated) &&
    isSafeNonnegativeInteger(value.bytesProduced)
  );
}

export function isWorkerConnectRequest(
  value: unknown,
): value is WorkerConnectRequest {
  return isRecord(value) && value.type === "connect";
}

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (!isRecord(value)) return false;
  if (value.type === "initialize") {
    return (
      isBoundedString(
        value.indexURL,
        RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
      ) &&
      isStringArray(
        value.allowedPackages,
        RUNTIME_PROTOCOL_LIMITS.maxPackages,
        RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
      ) &&
      (value.interruptBuffer === undefined ||
        (typeof SharedArrayBuffer !== "undefined" &&
          value.interruptBuffer instanceof SharedArrayBuffer))
    );
  }
  if (value.type !== "run") return false;
  return (
    isBoundedString(
      value.runId,
      RUNTIME_PROTOCOL_LIMITS.maxRunIdCharacters,
    ) &&
    isBoundedString(
      value.code,
      RUNTIME_PROTOCOL_LIMITS.maxCodeCharacters,
    ) &&
    Array.isArray(value.checks) &&
    value.checks.length <= RUNTIME_PROTOCOL_LIMITS.maxChecks &&
    value.checks.every(isCodeCheck) &&
    isBoundedString(
      value.filename,
      RUNTIME_PROTOCOL_LIMITS.maxFilenameCharacters,
    ) &&
    isFiniteNumber(value.seed) &&
    isIntegerInRange(
      value.maxOutputBytes,
      1,
      RUNTIME_PROTOCOL_LIMITS.maxOutputBytes,
    ) &&
    isIntegerInRange(
      value.maxOutputLines,
      1,
      RUNTIME_PROTOCOL_LIMITS.maxOutputLines,
    )
  );
}

export function isWorkerMessage(value: unknown): value is WorkerMessage {
  if (!isRecord(value)) return false;
  if (value.type === "ready") {
    return isRuntimeEnvironment(value.environment);
  }
  if (value.type === "fatal") {
    return (
      isBoundedString(
        value.error,
        RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
      ) && isBoolean(value.errorTruncated)
    );
  }
  return (
    value.type === "run-result" &&
    isBoundedString(
      value.runId,
      RUNTIME_PROTOCOL_LIMITS.maxRunIdCharacters,
    ) &&
    isWorkerRunResult(value.result)
  );
}
