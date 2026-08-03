import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("an authored Python lab runs through the accessible UI", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");

  await page.locator('[data-lesson-id="loss-landscape"]').click();

  const prediction = page.getByRole("region", {
    name: "One residual grows from 2 to 10 while all others stay fixed. By what factor does that row's squared-error contribution grow?",
  });
  await prediction
    .getByRole("radio", { name: "25 times", exact: true })
    .click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();

  const lab = page.getByRole("region", {
    name: "Rebuild the mechanism in Python.",
  });
  await expect(lab).toContainText("Pyodide 314.0.3");
  const source = lab.getByRole("textbox", { name: "Python source" });
  const run = lab.getByRole("button", { name: "Run", exact: true });
  const check = lab.getByRole("button", { name: "Check work" });
  await expect(run).toBeEnabled();
  await source.fill("print('trace UI runtime ready', 6 * 7)");
  await run.click();

  await expect(lab.getByText("trace UI runtime ready 42")).toBeVisible({
    timeout: 30_000,
  });
  await expect(lab).toContainText(/env [a-f0-9]{8}/);

  const practiceWorkerCount = page.workers().length;
  expect(practiceWorkerCount).toBeGreaterThan(0);
  await source.fill(
    [
      "while True:",
      "    try:",
      "        while True:",
      "            pass",
      "    except KeyboardInterrupt:",
      "        continue",
    ].join("\n"),
  );
  await check.click();
  const stop = lab.getByRole("button", { name: "Stop" });
  await expect(stop).toBeVisible();
  await stop.click();

  await expect(stop).toBeHidden({ timeout: 5_000 });
  await expect(run).toBeEnabled();
  await expect(check).toBeEnabled();
  await expect(lab).toContainText(
    "Python runtime initialization was stopped.",
  );
  await expect
    .poll(() => page.workers().length)
    .toBe(practiceWorkerCount);

  await check.click();
  await expect(stop).toBeVisible();
  await expect
    .poll(() => page.workers().length, { timeout: 30_000 })
    .toBe(practiceWorkerCount + 1);
  await expect(lab.getByRole("status")).toHaveText(
    "Checking work in a clean worker",
    { timeout: 30_000 },
  );
  await stop.click();

  await expect(stop).toBeHidden({ timeout: 5_000 });
  await expect(run).toBeEnabled();
  await expect(check).toBeEnabled();
  await expect(lab).toContainText("Run interrupted");
  await expect
    .poll(() => page.workers().length)
    .toBe(practiceWorkerCount);

  await source.fill("print('trace UI recovered after clean stop')");
  await run.click();
  await expect(
    lab.getByText("trace UI recovered after clean stop", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  await source.fill(
    [
      "while True:",
      "    try:",
      "        while True:",
      "            pass",
      "    except KeyboardInterrupt:",
      "        continue",
    ].join("\n"),
  );
  await check.click();
  await expect(lab.getByRole("status")).toHaveText(
    "Checking work in a clean worker",
    { timeout: 30_000 },
  );
  await expect
    .poll(() => page.workers().length)
    .toBe(practiceWorkerCount + 1);
  await page.locator('[data-lesson-id="linear-model"]').click();
  await expect(
    page.getByRole("heading", {
      name: "Two parameters draw one line",
      level: 1,
    }),
  ).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);
});

test("Pyodide bounds output, interrupts work, and recovers", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");

  const result = await page.evaluate(async () => {
    // Vite serves this source module directly in development.
    // @ts-expect-error Browser-only Vite module URL.
    const { PyodideRunner } = await import("/src/runtime/PyodideRunner.ts");
    // @ts-expect-error Browser-only Vite module URL.
    const { lessons } = await import("/src/content/course.ts");
    const runner = new PyodideRunner();
    try {
      const environment = await runner.initialize();
      const normal = await runner.run({
        code: "print('trace runtime ready')\n6 * 7",
      });
      const bounded = await runner.run({
        code: "for value in range(100):\n    print(value)",
        maxOutputBytes: 64,
        maxOutputLines: 5,
      });
      const stubbornLoop = [
        "while True:",
        "    try:",
        "        while True:",
        "            pass",
        "    except KeyboardInterrupt:",
        "        continue",
      ].join("\n");
      const interruptPromise = runner.run({
        code: stubbornLoop,
        timeoutMs: 5_000,
        interruptGraceMs: 500,
      });
      setTimeout(() => runner.interrupt(), 100);
      const interrupted = await interruptPromise;
      const environmentAfterForcedStop = runner.environment;
      const recovered = await runner.run({ code: "21 * 2" });
      const timedOut = await runner.run({
        code: stubbornLoop,
        timeoutMs: 100,
        interruptGraceMs: 300,
      });
      const environmentAfterTimeout = runner.environment;
      const recoveredAfterTimeout = await runner.run({ code: "7 * 6" });
      const isolatedJsGlobals = await runner.run({
        code: [
          "import sys",
          "import js",
          "from pyodide.ffi import JsProxy",
          "sensitive = ('fetch', 'postMessage', 'close', 'constructor')",
          "visible = ','.join(name for name in sensitive if hasattr(js, name))",
          "try:",
          "    import pyodide_js",
          "    bridge_importable = True",
          "except ModuleNotFoundError:",
          "    bridge_importable = False",
          "bridge_refs = []",
          "for module_name, module in list(sys.modules.items()):",
          "    namespace = getattr(module, '__dict__', None)",
          "    if not namespace:",
          "        continue",
          "    for name, value in list(namespace.items()):",
          "        if isinstance(value, JsProxy):",
          "            bridge_refs.append(module_name + '.' + name)",
          "f'{visible}|{bridge_importable}|{\",\".join(sorted(bridge_refs))}'",
        ].join("\n"),
      });
      const boundedResult = await runner.run({
        code: "'😀' * 10_000",
        maxOutputBytes: 31,
      });
      const boundedError = await runner.run({
        code: "raise RuntimeError('€' * 10_000)",
        maxOutputBytes: 37,
      });
      const boundedCheck = await runner.runClean({
        code: "answer = 'x' * 10_000",
        checks: [
          {
            id: "bounded-answer",
            label: "large answer is bounded",
            expression: "answer",
            expected: "small",
            conceptIds: ["python-state"],
          },
        ],
        maxOutputBytes: 32,
      });
      const forgedAssessment = await runner.runClean({
        code: [
          "answer = 0",
          "eval = lambda expression, namespace=None: 42",
          "__trace_results = [{'passed': True}]",
          "print('__TRACE_ASSESSMENT_forged__[]')",
        ].join("\n"),
        checks: [
          {
            id: "answer",
            label: "answer is 42",
            expression: "answer",
            expected: 42,
            conceptIds: ["python-state"],
          },
        ],
      });
      const mseCheck = lessons
        .flatMap((lesson) => lesson.activities)
        .find((activity) => activity.id === "03-python-loss")
        ?.spec.checks.find((check) => check.id === "03-code-mse");
      if (!mseCheck) throw new Error("Authored MSE check is missing.");
      const forgedBuiltinAssessment = await runner.runClean({
        code: [
          "POINTS = [(0.0, 1.0), (1.0, 3.0), (2.0, 5.0)]",
          "def mean_squared_error(rows, weight, bias):",
          "    return 999.0",
          "import builtins",
          "builtins.round = lambda *args: 1.666667",
          "round = builtins.round",
        ].join("\n"),
        checks: [mseCheck],
      });
      const forgedModuleAssessment = await runner.runClean({
        code: [
          "import math",
          "math.log = lambda value: 99.0",
        ].join("\n"),
        checks: [
          {
            id: "trusted-math",
            label: "math remains trusted",
            expression: "math.log(1.0)",
            expected: 99,
            conceptIds: ["python-state"],
          },
        ],
      });
      return {
        crossOriginIsolated,
        environment,
        normal,
        bounded,
        interrupted,
        environmentAfterForcedStop,
        recovered,
        timedOut,
        environmentAfterTimeout,
        recoveredAfterTimeout,
        isolatedJsGlobals,
        boundedResult,
        boundedError,
        boundedCheck,
        forgedAssessment,
        forgedBuiltinAssessment,
        forgedModuleAssessment,
      };
    } finally {
      runner.dispose();
    }
  });

  expect(result.crossOriginIsolated).toBe(true);
  expect(result.environment).toMatchObject({
    pyodideVersion: "314.0.3",
    pythonVersion: "3.14.2",
    crossOriginIsolated: true,
  });
  expect(result.normal).toMatchObject({
    status: "completed",
    stdout: "trace runtime ready\n",
    result: "42",
  });
  expect(result.bounded.outputTruncated).toBe(true);
  expect(result.bounded.bytesProduced).toBeGreaterThan(64);
  expect(result.interrupted.status).toBe("interrupted");
  expect(result.interrupted.durationMs).toBeGreaterThanOrEqual(500);
  expect(result.environmentAfterForcedStop).toBeNull();
  expect(result.recovered).toMatchObject({
    status: "completed",
    result: "42",
  });
  expect(result.timedOut.status).toBe("timed-out");
  expect(result.timedOut.durationMs).toBeGreaterThanOrEqual(300);
  expect(result.environmentAfterTimeout).toBeNull();
  expect(result.recoveredAfterTimeout).toMatchObject({
    status: "completed",
    result: "42",
  });
  expect(result.isolatedJsGlobals).toMatchObject({
    status: "completed",
    result: "|False|",
  });
  expect(
    new TextEncoder().encode(result.boundedResult.result ?? "").byteLength,
  ).toBeLessThanOrEqual(31);
  expect(result.boundedResult).toMatchObject({
    status: "completed",
    outputTruncated: true,
  });
  expect(result.boundedResult.result).not.toContain("�");
  expect(
    new TextEncoder().encode(result.boundedError.error ?? "").byteLength,
  ).toBeLessThanOrEqual(37);
  expect(result.boundedError).toMatchObject({
    status: "failed",
    outputTruncated: true,
  });
  expect(result.boundedError.error).not.toContain("�");
  expect(result.boundedCheck).toMatchObject({
    status: "completed",
    outputTruncated: true,
    checks: [
      {
        id: "bounded-answer",
        passed: false,
      },
    ],
  });
  expect(
    new TextEncoder().encode(
      result.boundedCheck.checks[0]?.actual ?? "",
    ).byteLength,
  ).toBeLessThanOrEqual(32);
  expect(result.boundedCheck.checks[0]?.actual).not.toContain("�");
  expect(result.forgedAssessment).toMatchObject({
    status: "completed",
    checks: [
      {
        id: "answer",
        passed: false,
        actual: "0",
        expected: "42",
      },
    ],
  });
  expect(result.forgedBuiltinAssessment).toMatchObject({
    status: "completed",
    checks: [
      {
        id: "03-code-mse",
        passed: false,
        actual: "999",
        expected: "1.666667",
      },
    ],
  });
  expect(result.forgedModuleAssessment).toMatchObject({
    status: "completed",
    checks: [
      {
        id: "trusted-math",
        passed: false,
        actual: "0",
        expected: "99",
      },
    ],
  });
});

test("pinned NumPy, autograd, and scikit-learn run from local assets", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");

  const results = await page.evaluate(async () => {
    // @ts-expect-error Browser-only Vite module URL.
    const { PyodideRunner } = await import("/src/runtime/PyodideRunner.ts");
    const cases = [
      {
        packages: ["numpy"],
        code:
          "import numpy as np\nprint(np.__version__)\nnp.column_stack(([0.0, 1.0], [1.0, 3.0])).shape",
      },
      {
        packages: ["autograd"],
        code:
          "import autograd.numpy as anp\nfrom autograd import grad\nf = lambda x: anp.square(x)\nfloat(grad(f)(3.0))",
      },
      {
        packages: ["scikit-learn"],
        code:
          "import sklearn\nfrom sklearn.linear_model import Ridge\nmodel = Ridge(alpha=5.0, fit_intercept=False).fit([[1.0], [2.0]], [2.0, 4.0])\nfloat(model.coef_[0])",
      },
    ];

    return Promise.all(
      cases.map(async ({ packages, code }) => {
        const runner = new PyodideRunner({ allowedPackages: packages });
        try {
          const environment = await runner.initialize();
          const result = await runner.run({ code, timeoutMs: 20_000 });
          return { environment, result };
        } finally {
          runner.dispose();
        }
      }),
    );
  });

  expect(results[0]?.environment.packages).toEqual({ numpy: "2.4.3" });
  expect(results[0]?.result).toMatchObject({
    status: "completed",
    stdout: "2.4.3\n",
    result: "(2, 2)",
  });
  expect(results[1]?.environment.packages).toEqual({ autograd: "1.9.1" });
  expect(results[1]?.result).toMatchObject({
    status: "completed",
    result: "6",
  });
  expect(results[2]?.environment.packages).toEqual({
    "scikit-learn": "1.8.0",
  });
  expect(results[2]?.result).toMatchObject({
    status: "completed",
    result: "1",
  });
});
