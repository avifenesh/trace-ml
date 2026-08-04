// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeLabActivity } from "../content/types";
import type { RunResult } from "../runtime/protocol";
import { PythonCodeLab } from "./PythonCodeLab";

const runnerMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  run: vi.fn(),
  runClean: vi.fn(),
  restart: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("../runtime/PyodideRunner", () => ({
  PyodideRunner: class {
    initialize = runnerMocks.initialize;
    run = runnerMocks.run;
    runClean = runnerMocks.runClean;
    restart = runnerMocks.restart;
    dispose = runnerMocks.dispose;
  },
}));

const activity: CodeLabActivity = {
  id: "keyboard-test-code-lab",
  kind: "code-lab",
  conceptIds: ["python-state"],
  evidenceKind: "code-check",
  spec: {
    runtimeId: "pyodide-314.0.3",
    environmentDigest: "test-environment",
    seed: 1,
    timeoutMs: 1_000,
    maxOutputBytes: 1_000,
    maxOutputLines: 100,
    instructions: "Inspect and edit the authored Python source.",
    starterFiles: [
      {
        path: "lesson.py",
        language: "python",
        contents: "value = 1",
      },
    ],
    checks: [],
    allowedPackages: [],
  },
};

const completedResult: RunResult = {
  status: "completed",
  stdout: "",
  stderr: "",
  output: [],
  result: null,
  checks: [],
  error: null,
  outputTruncated: false,
  bytesProduced: 0,
  durationMs: 1,
  environment: {
    pyodideVersion: "314.0.3",
    pythonVersion: "3.14.2",
    abi: "test",
    packages: {},
    crossOriginIsolated: true,
    digest: "test-environment",
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderCodeLab(enabled = false) {
  const onStateChange = vi.fn();
  const rendered = render(
    <PythonCodeLab
      activity={activity}
      enabled={enabled}
      previouslyDemonstrated={false}
      onEvidence={vi.fn()}
      onStateChange={onStateChange}
    />,
  );
  return { ...rendered, onStateChange };
}

describe("PythonCodeLab keyboard access", () => {
  it("describes and provides a one-shot Escape then Tab exit", () => {
    renderCodeLab();
    const source = screen.getByLabelText("Python source") as HTMLTextAreaElement;
    const instructions = screen.getByText(
      "Tab indents. Press Escape, then Tab to leave the editor.",
    );

    expect(source.getAttribute("aria-describedby")).toBe(instructions.id);
    source.focus();
    source.setSelectionRange(0, 0);

    expect(fireEvent.keyDown(source, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(source);
    expect(source.value).toBe("    value = 1");

    expect(fireEvent.keyDown(source, { key: "Escape" })).toBe(true);
    expect(fireEvent.keyDown(source, { key: "Tab" })).toBe(true);
    expect(source.value).toBe("    value = 1");

    source.setSelectionRange(0, 0);
    expect(fireEvent.keyDown(source, { key: "Tab" })).toBe(false);
    expect(source.value).toBe("        value = 1");
  });

  it("marks only unavailable controls as disabled", () => {
    const { container } = renderCodeLab();
    const region = container.querySelector(`#${activity.id}`);
    const source = screen.getByLabelText("Python source") as HTMLTextAreaElement;
    const reset = screen.getByRole("button", {
      name: "Reset starter code",
    }) as HTMLButtonElement;
    const run = screen.getByRole("button", {
      name: "Run",
    }) as HTMLButtonElement;
    const check = screen.getByRole("button", {
      name: "Check work",
    }) as HTMLButtonElement;

    expect(region?.hasAttribute("aria-disabled")).toBe(false);
    expect(source.disabled).toBe(false);
    expect(reset.disabled).toBe(false);
    expect(run.disabled).toBe(true);
    expect(check.disabled).toBe(true);
  });
});

describe("PythonCodeLab runtime isolation", () => {
  it("restarts after practice but preserves clean assessment execution", async () => {
    runnerMocks.initialize.mockResolvedValue(completedResult.environment);
    runnerMocks.run.mockResolvedValue(completedResult);
    runnerMocks.runClean.mockResolvedValue(completedResult);
    renderCodeLab(true);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(runnerMocks.run).toHaveBeenCalledOnce());
    await waitFor(() => expect(runnerMocks.restart).toHaveBeenCalledOnce());
    expect(runnerMocks.runClean).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Check work" }));
    await waitFor(() => expect(runnerMocks.runClean).toHaveBeenCalledOnce());
    expect(runnerMocks.restart).toHaveBeenCalledOnce();
  });
});
