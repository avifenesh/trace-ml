import type {
  RunRequest,
  RunResult,
  RuntimeEnvironment,
  WorkerRequest,
} from "./protocol";
import {
  isWorkerMessage,
  isWorkerRequest,
  type WorkerConnectRequest,
} from "./protocol";

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_INTERRUPT_GRACE_MS = 250;
const DEFAULT_INITIALIZATION_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_BYTES = 65_536;
const DEFAULT_MAX_OUTPUT_LINES = 500;

type WorkerFactory = () => Worker;

interface PendingRun {
  runId: string;
  startedAt: number;
  timedOut: boolean;
  interrupted: boolean;
  timeout: ReturnType<typeof setTimeout>;
  interruptGraceMs: number;
  hardStop?: ReturnType<typeof setTimeout>;
  resolve: (result: RunResult) => void;
}

export interface PyodideRunnerOptions {
  allowedPackages?: string[];
  initializationTimeoutMs?: number;
  indexURL?: string;
  workerFactory?: WorkerFactory;
}

function identifier() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
}

export class PyodideRunner {
  readonly #allowedPackages: string[];
  readonly #initializationTimeoutMs: number;
  readonly #indexURL: string;
  readonly #workerFactory: WorkerFactory;
  #worker: Worker | null = null;
  #workerPort: MessagePort | null = null;
  #environment: RuntimeEnvironment | null = null;
  #interruptBuffer: Int32Array | null = null;
  #readyPromise: Promise<RuntimeEnvironment> | null = null;
  #resolveReady: ((environment: RuntimeEnvironment) => void) | null = null;
  #rejectReady: ((error: Error) => void) | null = null;
  #initializationTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingRun: PendingRun | null = null;
  #isolatedRunner: PyodideRunner | null = null;

  constructor(options: PyodideRunnerOptions = {}) {
    this.#allowedPackages = options.allowedPackages ?? [];
    this.#initializationTimeoutMs =
      options.initializationTimeoutMs ?? DEFAULT_INITIALIZATION_TIMEOUT_MS;
    this.#indexURL =
      options.indexURL ??
      new URL("/pyodide/", globalThis.location.origin).toString();
    this.#workerFactory =
      options.workerFactory ??
      (() =>
        new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
          type: "module",
          name: "trace-python-runtime",
        }));
  }

  get environment() {
    return this.#environment;
  }

  get running() {
    return this.#pendingRun !== null || this.#isolatedRunner !== null;
  }

  async initialize() {
    if (this.#environment) return this.#environment;
    if (this.#readyPromise) return this.#readyPromise;

    this.#worker = this.#workerFactory();
    this.#worker.addEventListener("error", this.#handleWorkerError);
    const channel = new MessageChannel();
    this.#workerPort = channel.port1;
    this.#workerPort.addEventListener("message", this.#handleMessage);
    this.#workerPort.addEventListener(
      "messageerror",
      this.#handlePortMessageError,
    );
    this.#workerPort.start();
    const connectRequest: WorkerConnectRequest = { type: "connect" };
    this.#worker.postMessage(connectRequest, [channel.port2]);
    if (
      globalThis.crossOriginIsolated &&
      typeof SharedArrayBuffer !== "undefined"
    ) {
      this.#interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
    }

    this.#readyPromise = new Promise<RuntimeEnvironment>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    const readyPromise = this.#readyPromise;
    const initializingWorker = this.#worker;
    this.#initializationTimer = setTimeout(() => {
      if (
        this.#worker !== initializingWorker ||
        this.#environment ||
        !this.#rejectReady
      ) {
        return;
      }
      this.#disposeWorker(
        new Error(
          `Python runtime did not initialize within ${this.#initializationTimeoutMs} ms.`,
        ),
      );
    }, this.#initializationTimeoutMs);
    try {
      this.#post({
        type: "initialize",
        indexURL: this.#indexURL,
        allowedPackages: this.#allowedPackages,
        interruptBuffer: this.#interruptBuffer?.buffer as
          | SharedArrayBuffer
          | undefined,
      });
    } catch (error) {
      this.#disposeWorker(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    return readyPromise;
  }

  async run(request: RunRequest): Promise<RunResult> {
    const environment = await this.initialize();
    if (this.#pendingRun) {
      throw new Error("A Python run is already in progress.");
    }

    const runId = identifier();
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const interruptGraceMs =
      request.interruptGraceMs ?? DEFAULT_INTERRUPT_GRACE_MS;
    const workerRequest: WorkerRequest = {
      type: "run",
      runId,
      code: request.code,
      checks: request.checks ?? [],
      filename: request.filename ?? "lesson.py",
      seed: request.seed ?? 0,
      maxOutputBytes:
        request.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      maxOutputLines:
        request.maxOutputLines ?? DEFAULT_MAX_OUTPUT_LINES,
    };
    if (!isWorkerRequest(workerRequest)) {
      throw new Error("Refusing to send an invalid Python runtime request.");
    }
    return new Promise<RunResult>((resolve) => {
      const timeout = setTimeout(() => {
        const pending = this.#pendingRun;
        if (!pending || pending.runId !== runId) return;
        pending.timedOut = true;
        this.#signalInterrupt();
        pending.hardStop = setTimeout(
          () => this.#forceStop("timed-out"),
          interruptGraceMs,
        );
      }, timeoutMs);
      this.#pendingRun = {
        runId,
        startedAt: performance.now(),
        timedOut: false,
        interrupted: false,
        timeout,
        interruptGraceMs,
        resolve,
      };
      this.#post(workerRequest);
      if (!this.#worker) {
        resolve(this.#emptyResult("failed", environment, "Worker missing."));
      }
    });
  }

  interrupt() {
    if (this.#isolatedRunner) {
      this.#isolatedRunner.interrupt();
      return;
    }
    if (!this.#pendingRun) {
      if (this.#readyPromise && !this.#environment) {
        this.#disposeWorker(
          new Error("Python runtime initialization was stopped."),
        );
      }
      return;
    }
    const pending = this.#pendingRun;
    pending.interrupted = true;
    if (this.#signalInterrupt()) {
      if (pending.hardStop) clearTimeout(pending.hardStop);
      pending.hardStop = setTimeout(
        () =>
          this.#forceStop(pending.timedOut ? "timed-out" : "interrupted"),
        pending.interruptGraceMs,
      );
      return;
    }
    this.#forceStop("interrupted");
  }

  restart() {
    this.#isolatedRunner?.dispose();
    this.#isolatedRunner = null;
    this.#forceStop("interrupted");
  }

  dispose() {
    this.#isolatedRunner?.dispose();
    this.#isolatedRunner = null;
    this.#forceStop("interrupted");
  }

  async runClean(
    request: RunRequest,
    onReady?: (environment: RuntimeEnvironment) => void,
  ) {
    if (this.#isolatedRunner) {
      throw new Error("A clean Python check is already in progress.");
    }
    const isolated = new PyodideRunner({
      allowedPackages: this.#allowedPackages,
      initializationTimeoutMs: this.#initializationTimeoutMs,
      indexURL: this.#indexURL,
      workerFactory: this.#workerFactory,
    });
    this.#isolatedRunner = isolated;
    try {
      const environment = await isolated.initialize();
      onReady?.(environment);
      return await isolated.run(request);
    } finally {
      if (this.#isolatedRunner === isolated) this.#isolatedRunner = null;
      isolated.dispose();
    }
  }

  #post(message: WorkerRequest) {
    if (!isWorkerRequest(message)) {
      throw new Error("Refusing to send an invalid Python runtime request.");
    }
    if (!this.#workerPort) {
      throw new Error("Python runtime message port is unavailable.");
    }
    this.#workerPort.postMessage(message);
  }

  #signalInterrupt() {
    if (!this.#interruptBuffer) return false;
    Atomics.store(this.#interruptBuffer, 0, 2);
    return true;
  }

  #finishRun(result: RunResult) {
    const pending = this.#pendingRun;
    if (!pending) return;
    clearTimeout(pending.timeout);
    if (pending.hardStop) clearTimeout(pending.hardStop);
    this.#pendingRun = null;
    if (this.#interruptBuffer) Atomics.store(this.#interruptBuffer, 0, 0);
    pending.resolve(result);
  }

  #forceStop(status: "interrupted" | "timed-out") {
    const pending = this.#pendingRun;
    if (pending && this.#environment) {
      this.#finishRun(
        this.#emptyResult(
          status,
          this.#environment,
          status === "timed-out"
            ? "Execution exceeded its time limit."
            : "Execution was stopped.",
          performance.now() - pending.startedAt,
        ),
      );
    }
    this.#disposeWorker();
  }

  #emptyResult(
    status: RunResult["status"],
    environment: RuntimeEnvironment,
    error: string,
    durationMs = 0,
    outputTruncated = false,
  ): RunResult {
    return {
      status,
      stdout: "",
      stderr: "",
      output: [],
      result: null,
      checks: [],
      error,
      outputTruncated,
      bytesProduced: 0,
      durationMs,
      environment,
    };
  }

  #disposeWorker(
    initializationError = new Error(
      "Python runtime stopped before initialization completed.",
    ),
  ) {
    const rejectReady = this.#rejectReady;
    if (this.#initializationTimer) {
      clearTimeout(this.#initializationTimer);
      this.#initializationTimer = null;
    }
    if (this.#worker) {
      this.#worker.removeEventListener("error", this.#handleWorkerError);
      this.#worker.terminate();
    }
    if (this.#workerPort) {
      this.#workerPort.removeEventListener("message", this.#handleMessage);
      this.#workerPort.removeEventListener(
        "messageerror",
        this.#handlePortMessageError,
      );
      this.#workerPort.close();
    }
    this.#worker = null;
    this.#workerPort = null;
    this.#environment = null;
    this.#interruptBuffer = null;
    this.#readyPromise = null;
    this.#resolveReady = null;
    this.#rejectReady = null;
    rejectReady?.(initializationError);
  }

  #handleMessage = (event: MessageEvent<unknown>) => {
    if (!isWorkerMessage(event.data)) {
      this.#failProtocol("Python runtime sent an invalid message.");
      return;
    }
    const message = event.data;
    if (message.type === "ready") {
      if (this.#initializationTimer) {
        clearTimeout(this.#initializationTimer);
        this.#initializationTimer = null;
      }
      this.#environment = message.environment;
      this.#resolveReady?.(message.environment);
      this.#resolveReady = null;
      this.#rejectReady = null;
      return;
    }
    if (message.type === "fatal") {
      const error = new Error(message.error);
      if (this.#pendingRun && this.#environment) {
        this.#finishRun(
          this.#emptyResult(
            "failed",
            this.#environment,
            message.error,
            performance.now() - this.#pendingRun.startedAt,
            message.errorTruncated,
          ),
        );
      }
      this.#disposeWorker(error);
      return;
    }

    const pending = this.#pendingRun;
    if (
      !pending ||
      message.runId !== pending.runId ||
      !this.#environment
    ) {
      return;
    }
    const status = pending.timedOut
      ? "timed-out"
      : pending.interrupted
        ? "interrupted"
        : message.result.status;
    this.#finishRun({
      ...message.result,
      status,
      durationMs: performance.now() - pending.startedAt,
      environment: this.#environment,
    });
  };

  #handleWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || "Python worker failed.");
    if (this.#pendingRun && this.#environment) {
      this.#finishRun(
        this.#emptyResult(
          "failed",
          this.#environment,
          error.message,
          performance.now() - this.#pendingRun.startedAt,
        ),
      );
    }
    this.#disposeWorker(error);
  };

  #handlePortMessageError = () => {
    this.#failProtocol("Python runtime sent an unreadable message.");
  };

  #failProtocol(message: string) {
    const error = new Error(message);
    if (this.#pendingRun && this.#environment) {
      this.#finishRun(
        this.#emptyResult(
          "failed",
          this.#environment,
          error.message,
          performance.now() - this.#pendingRun.startedAt,
        ),
      );
    }
    this.#disposeWorker(error);
  }
}
