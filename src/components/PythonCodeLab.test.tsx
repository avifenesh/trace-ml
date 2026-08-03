// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CodeLabActivity } from "../content/types";
import { PythonCodeLab } from "./PythonCodeLab";

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

afterEach(cleanup);

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
