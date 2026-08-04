// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VisualLabActivity } from "../content/types";
import { VisualMechanismLab } from "./VisualMechanismLab";

const activity: VisualLabActivity = {
  id: "linear-model",
  kind: "visual-lab",
  labId: "linear-model",
  conceptIds: ["linear-parameters"],
  evidenceKind: "manipulation",
  title: "Move the line",
  prompt: "Compare two authored states.",
  invariant: "The data points",
  intervention: "The slope",
  control: {
    label: "Slope",
    min: 0,
    max: 1,
    step: 0.25,
    initial: 0,
    lowLabel: "flat",
    highLabel: "steep",
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VisualMechanismLab status announcements", () => {
  it("announces comparison completion through its single status region", () => {
    const onStateChange = vi.fn();
    const { container } = render(
      <VisualMechanismLab
        activity={activity}
        enabled
        persistenceStatus="persistent"
        onStateChange={onStateChange}
      />,
    );

    const comparisonStatus = container.querySelector(".experiment-status");
    expect(comparisonStatus).toHaveAttribute("role", "status");
    expect(
      container.querySelectorAll(".experiment-status[role='status']"),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Capture baseline" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare state" }));

    expect(comparisonStatus).toHaveTextContent(
      "Controlled comparison saved on this device.",
    );
  });
});
