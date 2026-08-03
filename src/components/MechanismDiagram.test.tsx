// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { lessons } from "../content/course";
import type { VisualLabActivity } from "../content/types";
import {
  CURRENT_VISUAL_LAB_IDS,
  visualMechanismObservation,
} from "../labs/visual-mechanism";
import { MechanismDiagram } from "./MechanismDiagram";

function escapedMarkup(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const activities = lessons
  .flatMap((lesson) => lesson.activities)
  .filter(
    (activity): activity is VisualLabActivity =>
      activity.kind === "visual-lab",
  );

function activityFor(
  labId: (typeof CURRENT_VISUAL_LAB_IDS)[number],
) {
  const activity = activities.find(
    (candidate) => candidate.labId === labId,
  );
  if (!activity?.control) {
    throw new Error(`Missing authored control for ${labId}.`);
  }
  return activity as VisualLabActivity & {
    control: NonNullable<VisualLabActivity["control"]>;
  };
}

function observationFor(
  labId: (typeof CURRENT_VISUAL_LAB_IDS)[number],
  value?: number,
) {
  const activity = activityFor(labId);
  return visualMechanismObservation(
    labId,
    value ?? activity.control.initial,
    activity.control,
  );
}

afterEach(cleanup);

describe("MechanismDiagram", () => {
  it("renders every authored lab deterministically from its observation", () => {
    expect(activities).toHaveLength(CURRENT_VISUAL_LAB_IDS.length);

    for (const labId of CURRENT_VISUAL_LAB_IDS) {
      const observation = observationFor(labId);
      const diagram = (
        <MechanismDiagram
          labId={labId}
          observation={observation}
        />
      );
      const first = renderToStaticMarkup(diagram);
      const repeated = renderToStaticMarkup(diagram);

      expect(repeated).toBe(first);
      expect(first).toContain(`data-lab-id="${labId}"`);
      expect(first).toContain(
        `<title>Exact linked state for ${labId}:`,
      );
      expect(first).toContain(escapedMarkup(observation.primary));
      expect(first).toContain(escapedMarkup(observation.secondary));
      expect(first).toContain("<summary>Diagram values</summary>");
      for (const metric of Object.values(observation.metrics)) {
        const value = Array.isArray(metric) ? metric.join(", ") : String(metric);
        expect(first).toContain(escapedMarkup(value));
      }
      expect(first).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("draws a negative linear weight as a descending prediction line", () => {
    const observation = observationFor("linear-model", -2);
    render(
      <MechanismDiagram
        labId="linear-model"
        observation={observation}
      />,
    );

    const line = screen.getByTestId("linear-prediction-line");
    expect(Number(line.getAttribute("data-slope"))).toBe(-2);
    expect(Number(line.getAttribute("data-start-y"))).toBeLessThan(
      Number(line.getAttribute("data-end-y")),
    );
    expect(
      screen.getByText("y-hat = -2x + 4"),
    ).toBeTruthy();
  });

  it("keeps the ensemble at the exact fixed learner count", () => {
    const observation = observationFor("ensemble-votes", 1);
    const { container } = render(
      <MechanismDiagram
        labId="ensemble-votes"
        observation={observation}
      />,
    );

    expect(
      container.querySelectorAll("[data-ensemble-learner]"),
    ).toHaveLength(10);
    expect(screen.getByText("10 fixed learners")).toBeTruthy();
    expect(
      [...container.querySelectorAll("svg text")].some(
        (element) => element.textContent === "1",
      ),
    ).toBe(true);
  });

  it("renders the exact 2 by 2 kernel and computed convolution peak", () => {
    const observation = observationFor("convolution-field", 3);
    const { container } = render(
      <MechanismDiagram
        labId="convolution-field"
        observation={observation}
      />,
    );

    expect(
      screen.getByText("shared 2 x 2 kernel"),
    ).toBeTruthy();
    expect(
      Array.from(
        container.querySelectorAll('[aria-label^="Kernel row"]'),
        (element) => element.textContent,
      ),
    ).toEqual(["1", "0", "0", "-1"]);
    const peak = container.querySelector(
      '[data-output-index="3"]',
    );
    expect(peak?.getAttribute("data-output-value")).toBe("2");
    expect(screen.getByText("2 at output 3")).toBeTruthy();
  });

  it("uses exactly two normalized attention weights from the metrics", () => {
    const observation = observationFor("attention-routing", 0);
    const { container } = render(
      <MechanismDiagram
        labId="attention-routing"
        observation={observation}
      />,
    );

    const weights = Array.from(
      container.querySelectorAll("[data-attention-weight]"),
      (element) =>
        Number(element.getAttribute("data-attention-weight")),
    );
    expect(weights).toEqual([0.5, 0.5]);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(1);
    expect(screen.getByText("sum weights = 1")).toBeTruthy();
    expect(
      [...container.querySelectorAll("svg text")].some(
        (element) => element.textContent === "6",
      ),
    ).toBe(true);
  });

  it("shows the exact Q-learning discount, alpha, target, and update", () => {
    const observation = observationFor("q-learning", 5);
    const { container } = render(
      <MechanismDiagram
        labId="q-learning"
        observation={observation}
      />,
    );
    const text = container.textContent ?? "";

    expect(text).toContain("2 + gamma 0.9 x 5 = 6.5");
    expect(text).toContain("UPDATE WITH alpha 0.5");
    expect(text).toContain("Q: 1 -> 3.75");
    expect(text).toContain("terminal target 2");
  });

  it("plots the exact observation traces without regenerating them", () => {
    const gradient = observationFor("gradient-descent", 0.05);
    const optimizer = observationFor("optimizer-traces", 0.8);

    const gradientRender = render(
      <MechanismDiagram
        labId="gradient-descent"
        observation={gradient}
      />,
    );
    expect(
      gradientRender
        .getByTestId("gradient-loss-trace")
        .getAttribute("data-values"),
    ).toBe((gradient.metrics.lossTrace as readonly number[]).join(","));
    gradientRender.unmount();

    const optimizerRender = render(
      <MechanismDiagram
        labId="optimizer-traces"
        observation={optimizer}
      />,
    );
    expect(
      optimizerRender
        .getByTestId("optimizer-weight-trace")
        .getAttribute("data-values"),
    ).toBe(
      (optimizer.metrics.weightTrace as readonly number[]).join(","),
    );
  });
});
