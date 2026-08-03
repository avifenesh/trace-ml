import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  RuntimeEnvironment,
  WorkerConnectRequest,
  WorkerMessage,
  WorkerRequest,
} from "./protocol";
import { PyodideRunner } from "./PyodideRunner";

const environment: RuntimeEnvironment = {
  pyodideVersion: "314.0.3",
  pythonVersion: "3.14.2",
  abi: "test-abi",
  packages: {},
  crossOriginIsolated: true,
  digest: "test-digest",
};

class FakeWorker extends EventTarget {
  readonly messages: WorkerRequest[] = [];
  readonly connectionMessages: WorkerConnectRequest[] = [];
  terminated = false;
  #port: MessagePort | null = null;

  postMessage(
    message: WorkerConnectRequest,
    transfer: Transferable[] = [],
  ) {
    this.connectionMessages.push(message);
    const port = transfer[0];
    if (!(port instanceof MessagePort)) {
      throw new Error("Expected a transferred MessagePort.");
    }
    this.#port = port;
    this.#port.addEventListener("message", (event) => {
      this.messages.push(event.data as WorkerRequest);
    });
    this.#port.start();
  }

  terminate() {
    this.terminated = true;
    this.#port?.close();
    this.#port = null;
  }

  emitReady() {
    this.emit({ type: "ready", environment });
  }

  emit(message: unknown) {
    this.#port?.postMessage(message);
  }
}

function workerFactory(workers: FakeWorker[]) {
  return () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker as unknown as Worker;
  };
}

describe("PyodideRunner lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("crossOriginIsolated", true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects initialization after its deadline and terminates the worker", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      initializationTimeoutMs: 50,
      workerFactory: workerFactory(workers),
    });

    const initialization = runner.initialize();
    expect(workers[0]?.connectionMessages).toEqual([{ type: "connect" }]);
    const rejection = expect(initialization).rejects.toThrow(
      "did not initialize within 50 ms",
    );
    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("settles pending initialization when disposed", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      workerFactory: workerFactory(workers),
    });

    const initialization = runner.initialize();
    const rejection = expect(initialization).rejects.toThrow(
      "stopped before initialization completed",
    );
    runner.dispose();

    await rejection;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("force-terminates code that catches cooperative interruption", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      workerFactory: workerFactory(workers),
    });

    const run = runner.run({
      code: "while True:\n    pass",
      interruptGraceMs: 25,
      timeoutMs: 5_000,
    });
    workers[0]?.emitReady();
    await vi.advanceTimersByTimeAsync(0);
    expect(workers[0]?.messages.some((message) => message.type === "run")).toBe(
      true,
    );

    runner.interrupt();
    expect(workers[0]?.terminated).toBe(false);
    await vi.advanceTimersByTimeAsync(25);

    await expect(run).resolves.toMatchObject({
      status: "interrupted",
      error: "Execution was stopped.",
    });
    expect(workers[0]?.terminated).toBe(true);
  });

  it("lets the parent stop and dispose a clean assessment worker", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      workerFactory: workerFactory(workers),
    });

    const run = runner.runClean({
      code: "while True:\n    pass",
      checks: [],
      interruptGraceMs: 25,
    });
    workers[0]?.emitReady();
    await vi.advanceTimersByTimeAsync(0);
    expect(workers[0]?.messages.some((message) => message.type === "run")).toBe(
      true,
    );
    runner.interrupt();
    await vi.advanceTimersByTimeAsync(25);

    await expect(run).resolves.toMatchObject({ status: "interrupted" });
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminated).toBe(true);
    expect(runner.running).toBe(false);
  });

  it("rejects malformed private-channel messages during initialization", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      workerFactory: workerFactory(workers),
    });

    const initialization = runner.initialize();
    const rejection = expect(initialization).rejects.toThrow(
      "Python runtime sent an invalid message.",
    );
    workers[0]?.emit({ type: "ready", environment: null });
    await vi.advanceTimersByTimeAsync(0);

    await rejection;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("fails a run when the worker sends an oversized result", async () => {
    const workers: FakeWorker[] = [];
    const runner = new PyodideRunner({
      indexURL: "http://localhost/pyodide/",
      workerFactory: workerFactory(workers),
    });

    const run = runner.run({ code: "42" });
    workers[0]?.emitReady();
    await vi.advanceTimersByTimeAsync(0);
    const request = workers[0]?.messages.find(
      (message): message is Extract<WorkerRequest, { type: "run" }> =>
        message.type === "run",
    );
    expect(request).toBeDefined();
    if (!request) throw new Error("Run request was not delivered.");
    workers[0]?.emit({
      type: "run-result",
      runId: request.runId,
      result: {
        status: "completed",
        stdout: "",
        stderr: "",
        output: [],
        result: "x".repeat(1_048_577),
        checks: [],
        error: null,
        outputTruncated: false,
        bytesProduced: 0,
      },
    } satisfies WorkerMessage);
    await vi.advanceTimersByTimeAsync(0);

    await expect(run).resolves.toMatchObject({
      status: "failed",
      error: "Python runtime sent an invalid message.",
    });
    expect(workers[0]?.terminated).toBe(true);
  });
});
