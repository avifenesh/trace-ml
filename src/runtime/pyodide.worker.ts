/// <reference lib="webworker" />

import {
  loadPyodide,
  type PyodideAPI,
} from "pyodide";
import type { PyCallable, PyProxy } from "pyodide/ffi";
import {
  assessPrimitiveValue,
  failedAssessmentCheck,
} from "./assessment";
import {
  OutputQuota,
  truncateUtf8,
  Utf8TextQuota,
} from "./output-quota";
import { finishPythonOutput } from "./python-output";
import {
  isWorkerConnectRequest,
  isWorkerRequest,
  RUNTIME_PROTOCOL_LIMITS,
  type AssessmentCheckResult,
  type RuntimeEnvironment,
  type WorkerMessage,
  type WorkerRequest,
} from "./protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const emptyJsGlobals = Object.freeze(Object.create(null)) as object;
let pyodide: PyodideAPI | null = null;
let environment: RuntimeEnvironment | null = null;
let messagePort: MessagePort | null = null;
let running = false;

function post(message: WorkerMessage) {
  if (!messagePort) {
    throw new Error("Python runtime message port is not connected.");
  }
  messagePort.postMessage(message);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function postFatal(error: unknown) {
  const bounded = truncateUtf8(
    errorMessage(error),
    RUNTIME_PROTOCOL_LIMITS.maxControlStringCharacters,
  );
  post({
    type: "fatal",
    error: bounded.text,
    errorTruncated: bounded.truncated,
  });
}

function createPythonNamespace(runtime: PyodideAPI) {
  const namespace = runtime.toPy({});
  if (
    typeof namespace !== "object" ||
    namespace === null ||
    !("destroy" in namespace) ||
    typeof namespace.destroy !== "function"
  ) {
    throw new Error("Could not create an isolated Python namespace.");
  }
  return namespace as PyProxy;
}

function revokePythonJavaScriptBridge(runtime: PyodideAPI) {
  runtime.unregisterJsModule("pyodide_js");
  const globals = createPythonNamespace(runtime);
  try {
    runtime.runPython(`
import sys
from pyodide.ffi import JsProxy

for module_name, module in list(sys.modules.items()):
    namespace = getattr(module, "__dict__", None)
    if not namespace:
        continue
    for name, value in list(namespace.items()):
        if isinstance(value, JsProxy):
            del namespace[name]

for module_name in list(sys.modules):
    if module_name == "pyodide_js" or module_name.startswith("pyodide_js."):
        del sys.modules[module_name]
`, {
      filename: "trace-revoke-js-bridge.py",
      globals,
    });
  } finally {
    globals.destroy();
  }
}

async function digest(value: string) {
  if (globalThis.crypto?.subtle) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function initialize(
  request: Extract<WorkerRequest, { type: "initialize" }>,
) {
  if (pyodide && environment) {
    post({ type: "ready", environment });
    return;
  }

  pyodide = await loadPyodide({
    indexURL: request.indexURL,
    jsglobals: emptyJsGlobals,
    stdout: () => undefined,
    stderr: () => undefined,
  });
  if (request.allowedPackages.length > 0) {
    await pyodide.loadPackage(request.allowedPackages);
  }
  if (request.interruptBuffer) {
    pyodide.setInterruptBuffer(new Int32Array(request.interruptBuffer));
  }

  const metadataGlobals = createPythonNamespace(pyodide);
  let metadataValue: unknown;
  try {
    metadataValue = pyodide.runPython(`
import importlib.metadata
import json
import platform
import sysconfig
requested_packages = ${JSON.stringify(request.allowedPackages)}
json.dumps({
    "pythonVersion": platform.python_version(),
    "abi": sysconfig.get_config_var("SOABI") or "unknown",
    "packages": {
        name: importlib.metadata.version(name)
        for name in requested_packages
    },
})
`, {
      filename: "trace-runtime-metadata.py",
      globals: metadataGlobals,
    });
  } finally {
    metadataGlobals.destroy();
  }
  const metadata = JSON.parse(String(metadataValue)) as {
    pythonVersion: string;
    abi: string;
    packages: Record<string, string>;
  };
  const baseEnvironment = {
    pyodideVersion: pyodide.version,
    pythonVersion: metadata.pythonVersion,
    abi: metadata.abi,
    packages: metadata.packages,
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
  };
  environment = {
    ...baseEnvironment,
    digest: await digest(JSON.stringify(baseEnvironment)),
  };
  revokePythonJavaScriptBridge(pyodide);
  post({ type: "ready", environment });
}

function createTrustedCheckEvaluator(
  runtime: PyodideAPI,
  globals: PyProxy,
) {
  return runtime.runPython(`
def __trace_create_check_evaluator():
    import builtins as trusted_builtins_module
    import math as trusted_math_module
    import random as trusted_random_module
    import statistics as trusted_statistics_module
    import sys as trusted_sys_module

    trusted_builtins = dict(trusted_builtins_module.__dict__)
    trusted_modules = {
        "math": (
            trusted_math_module,
            dict(trusted_math_module.__dict__),
        ),
        "random": (
            trusted_random_module,
            dict(trusted_random_module.__dict__),
        ),
        "statistics": (
            trusted_statistics_module,
            dict(trusted_statistics_module.__dict__),
        ),
    }
    trusted_eval = trusted_builtins["eval"]
    trusted_compile = trusted_builtins["compile"]

    def evaluate(namespace, expression):
        trusted_builtins_module.__dict__.update(trusted_builtins)
        trusted_sys_module.modules["builtins"] = trusted_builtins_module
        namespace["__builtins__"] = trusted_builtins_module

        # Learner functions keep a reference to this namespace. Restore every
        # builtin there as well as in __builtins__ before an authored check runs.
        namespace.update(trusted_builtins)

        for name, (module, state) in trusted_modules.items():
            module.__dict__.update(state)
            trusted_sys_module.modules[name] = module
            namespace[name] = module

        code = trusted_compile(
            expression,
            "trace-authored-check.py",
            "eval",
        )
        return trusted_eval(code, namespace, namespace)

    return evaluate

__trace_create_check_evaluator()
`, {
    filename: "trace-authored-checks.py",
    globals,
  }) as PyCallable;
}

function createPythonOutputFlusher(
  runtime: PyodideAPI,
  globals: PyProxy,
) {
  return runtime.runPython(`
def __trace_create_output_flusher():
    import sys
    flush_stdout = sys.stdout.flush
    flush_stderr = sys.stderr.flush

    def flush():
        flush_stdout()
        flush_stderr()

    return flush

__trace_create_output_flusher()
`, {
    filename: "trace-output-flusher.py",
    globals,
  }) as PyCallable;
}

function capCheck(
  check: AssessmentCheckResult,
  quota: Utf8TextQuota,
): AssessmentCheckResult {
  return {
    id: check.id,
    label: check.label,
    passed: check.passed,
    actual: quota.take(check.actual),
    expected: quota.take(check.expected),
    ...(check.error === undefined
      ? {}
      : { error: quota.take(check.error) }),
  };
}

async function run(
  request: Extract<WorkerRequest, { type: "run" }>,
) {
  if (!pyodide || !environment || running) {
    throw new Error("Python runtime is not ready for this run.");
  }
  running = true;
  const output = new OutputQuota(
    request.maxOutputBytes,
    request.maxOutputLines,
  );
  pyodide.setStdout({
    write: (buffer) => output.write("stdout", buffer),
  });
  pyodide.setStderr({
    write: (buffer) => output.write("stderr", buffer),
  });

  let globals: PyProxy | undefined;
  let outputFlusherGlobals: PyProxy | undefined;
  let outputFlusher: PyCallable | undefined;
  let trustedCheckGlobals: PyProxy | undefined;
  let trustedCheckEvaluator: PyCallable | undefined;
  const payloadQuota = new Utf8TextQuota(request.maxOutputBytes);
  let finishedOutput: ReturnType<OutputQuota["finish"]> | undefined;
  const finishOutput = () => {
    finishedOutput ??= finishPythonOutput(outputFlusher, () =>
      output.finish()
    );
    return finishedOutput;
  };
  try {
    outputFlusherGlobals = createPythonNamespace(pyodide);
    outputFlusher = createPythonOutputFlusher(
      pyodide,
      outputFlusherGlobals,
    );
    globals = createPythonNamespace(pyodide);
    if (request.checks.length > 0) {
      trustedCheckGlobals = createPythonNamespace(pyodide);
      trustedCheckEvaluator = createTrustedCheckEvaluator(
        pyodide,
        trustedCheckGlobals,
      );
    }
    const value = pyodide.runPython(
      `import random\nrandom.seed(${JSON.stringify(request.seed)})\n${request.code}`,
      {
        filename: request.filename,
        globals,
      },
    );
    const rawResult =
      value === undefined || value === null
        ? null
        : String(value);
    if (
      typeof value === "object" &&
      value !== null &&
      "destroy" in value &&
      typeof value.destroy === "function"
    ) {
      value.destroy();
    }
    const checks = [];
    for (const check of request.checks) {
      let actual: unknown;
      try {
        actual = trustedCheckEvaluator?.(globals, check.expression);
        checks.push(
          capCheck(assessPrimitiveValue(check, actual), payloadQuota),
        );
      } catch (error) {
        checks.push(
          capCheck(failedAssessmentCheck(check, error), payloadQuota),
        );
      } finally {
        if (
          typeof actual === "object" &&
          actual !== null &&
          "destroy" in actual &&
          typeof actual.destroy === "function"
        ) {
          actual.destroy();
        }
      }
    }
    const result =
      rawResult === null ? null : payloadQuota.take(rawResult);
    const outputResult = finishOutput();
    post({
      type: "run-result",
      runId: request.runId,
      result: {
        status: "completed",
        ...outputResult,
        result,
        checks,
        error: null,
        outputTruncated:
          outputResult.outputTruncated || payloadQuota.truncated,
      },
    });
  } catch (error) {
    const rawMessage = errorMessage(error);
    const message = payloadQuota.take(rawMessage);
    const outputResult = finishOutput();
    post({
      type: "run-result",
      runId: request.runId,
      result: {
        status: rawMessage.includes("KeyboardInterrupt")
          ? "interrupted"
          : "failed",
        ...outputResult,
        result: null,
        checks: [],
        error: message,
        outputTruncated:
          outputResult.outputTruncated || payloadQuota.truncated,
      },
    });
  } finally {
    if (
      typeof globals === "object" &&
      globals !== null &&
      "destroy" in globals &&
      typeof globals.destroy === "function"
    ) {
      globals.destroy();
    }
    outputFlusher?.destroy();
    outputFlusherGlobals?.destroy();
    trustedCheckEvaluator?.destroy();
    trustedCheckGlobals?.destroy();
    running = false;
  }
}

function handleRequest(event: MessageEvent<unknown>) {
  if (!isWorkerRequest(event.data)) {
    postFatal(new Error("Python runtime received an invalid request."));
    return;
  }
  const request: WorkerRequest = event.data;
  const operation =
    request.type === "initialize" ? initialize(request) : run(request);
  void operation.catch((error) => {
    postFatal(error);
  });
}

function connect(event: MessageEvent<unknown>) {
  if (
    !isWorkerConnectRequest(event.data) ||
    event.ports.length !== 1 ||
    messagePort
  ) {
    throw new Error("Python runtime received an invalid port connection.");
  }
  workerScope.removeEventListener("message", connect);
  messagePort = event.ports[0] ?? null;
  if (!messagePort) {
    throw new Error("Python runtime message port is missing.");
  }
  messagePort.addEventListener("message", handleRequest);
  messagePort.addEventListener("messageerror", () => {
    postFatal(new Error("Python runtime could not decode a request."));
  });
  messagePort.start();
}

workerScope.addEventListener("message", connect);
