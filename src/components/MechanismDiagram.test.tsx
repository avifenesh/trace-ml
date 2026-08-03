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

function paddedBounds(values: readonly number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  const padding =
    span > 0 ? span * 0.12 : Math.max(1, Math.abs(maximum) * 0.2);
  return [minimum - padding, maximum + padding] as const;
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

  it("keeps the mean baseline at one fixed screen position", () => {
    const baselinePositions = [0, 1, 3, 4].map((weight) => {
      const rendered = render(
        <MechanismDiagram
          labId="data-and-baseline"
          observation={observationFor("data-and-baseline", weight)}
        />,
      );
      const position = Number(
        screen
          .getByTestId("mean-baseline-reference")
          .getAttribute("data-y"),
      );
      rendered.unmount();
      return position;
    });

    expect(new Set(baselinePositions).size).toBe(1);
  });

  it("uses one linear-model scale so larger weights draw steeper lines", () => {
    const renderedRise = (weight: number) => {
      const rendered = render(
        <MechanismDiagram
          labId="linear-model"
          observation={observationFor("linear-model", weight)}
        />,
      );
      const line = screen.getByTestId("linear-prediction-line");
      const rise = Math.abs(
        Number(line.getAttribute("data-end-y")) -
          Number(line.getAttribute("data-start-y")),
      );
      rendered.unmount();
      return rise;
    };

    expect(renderedRise(5)).toBeGreaterThan(renderedRise(0.5));
    expect(renderedRise(-2)).toBeGreaterThan(renderedRise(-0.5));
  });

  it("renders one fixed loss curve, a moving point, and absolute square heights", () => {
    const renderedGeometry = (weight: number) => {
      const rendered = render(
        <MechanismDiagram
          labId="loss-landscape"
          observation={observationFor("loss-landscape", weight)}
        />,
      );
      const curve = screen.getByTestId("loss-landscape-curve");
      const axes = screen.getByTestId("loss-landscape-axes");
      const currentGuide = screen.getByTestId(
        "loss-landscape-current-guide",
      );
      const point = screen.getByTestId("loss-landscape-current");
      const square = screen.getByTestId("loss-square-2");
      const geometry = {
        curve: curve.getAttribute("d"),
        axesFill: axes.getAttribute("fill"),
        currentGuideFill: currentGuide.getAttribute("fill"),
        pointX: Number(point.getAttribute("cx")),
        pointY: Number(point.getAttribute("cy")),
        mse: Number(point.getAttribute("data-mse")),
        squareHeight: Number(square.getAttribute("data-height")),
      };
      rendered.unmount();
      return geometry;
    };
    const weightOne = renderedGeometry(1);
    const weightOneHalf = renderedGeometry(1.5);
    const optimum = renderedGeometry(2);

    expect(weightOne.curve).toBe(weightOneHalf.curve);
    expect(weightOneHalf.curve).toBe(optimum.curve);
    expect(weightOne.axesFill).toBe("none");
    expect(weightOne.currentGuideFill).toBe("none");
    expect(weightOneHalf.pointX).toBeGreaterThan(weightOne.pointX);
    expect(optimum.pointY).toBeGreaterThan(weightOneHalf.pointY);
    expect(optimum.mse).toBe(0);
    expect(weightOne.squareHeight).toBeGreaterThan(
      weightOneHalf.squareHeight,
    );
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

  it("labels Lesson 05 candidates as authored rather than trained", () => {
    const observation = observationFor("split-and-leakage", 0);
    render(
      <MechanismDiagram
        labId="split-and-leakage"
        observation={observation}
      />,
    );

    expect(screen.getByText("AUTHORED CANDIDATES")).toBeTruthy();
    expect(screen.getByText("10 / 11 / 12")).toBeTruthy();
    expect(screen.queryByText("TRAIN")).toBeNull();
    expect(screen.queryByText("fit candidates")).toBeNull();
    expect(screen.getByText("VALIDATION SELECTS")).toBeTruthy();
    expect(screen.getByText("FINAL TEST")).toBeTruthy();
  });

  it("labels the backprop product route unambiguously", () => {
    const observation = observationFor("backprop-graph", 1);
    render(
      <MechanismDiagram
        labId="backprop-graph"
        observation={observation}
      />,
    );

    expect(screen.getByText("p = w * x")).toBeTruthy();
    expect(screen.queryByText("p = w x x")).toBeNull();
  });

  it("renders the PCA direction through the data center under unequal axis scales", () => {
    const observation = observationFor("cluster-project", 4);
    const { container } = render(
      <MechanismDiagram
        labId="cluster-project"
        observation={observation}
      />,
    );
    const axis = screen.getByTestId("cluster-principal-axis");
    expect(screen.getByTestId("cluster-axis-frame").getAttribute("fill")).toBe(
      "none",
    );
    const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map(
      (attribute) => Number(axis.getAttribute(attribute)),
    );
    const flatPoints = observation.metrics.scaledPoints as readonly number[];
    const points = Array.from(
      { length: flatPoints.length / 2 },
      (_unused, index) => [
        flatPoints[index * 2],
        flatPoints[index * 2 + 1],
      ] as const,
    );
    const xValues = points.map(([x]) => x);
    const yValues = points.map(([, y]) => y);
    const [xMin, xMax] = paddedBounds(xValues);
    const [yMin, yMax] = paddedBounds(yValues);
    const [centerX, centerY] = observation.metrics
      .dataCenter as readonly number[];
    const renderedCenterX =
      75 + ((centerX - xMin) / (xMax - xMin)) * (390 - 75);
    const renderedCenterY =
      210 + ((centerY - yMin) / (yMax - yMin)) * (50 - 210);
    const radians =
      ((observation.metrics.principalAngleDegrees as number) *
        Math.PI) /
      180;
    const expectedSlope =
      (-Math.sin(radians) * (210 - 50) / (yMax - yMin)) /
      (Math.cos(radians) * (390 - 75) / (xMax - xMin));

    expect((x1 + x2) / 2).toBeCloseTo(renderedCenterX, 10);
    expect((y1 + y2) / 2).toBeCloseTo(renderedCenterY, 10);
    expect((y2 - y1) / (x2 - x1)).toBeCloseTo(expectedSlope, 10);
    expect(
      Array.from(
        container.querySelectorAll("[data-cluster-point]"),
        (element) =>
          Number(element.getAttribute("data-cluster-assignment")),
      ),
    ).toEqual([0, 0, 1, 1]);
  });

  it("renders the fixed convolution kernel while its peak translates", () => {
    for (const position of [0, 1, 4]) {
      const observation = observationFor(
        "convolution-field",
        position,
      );
      const rendered = render(
        <MechanismDiagram
          labId="convolution-field"
          observation={observation}
        />,
      );
      const { container } = rendered;

      expect(screen.getByText("shared 2 x 2 kernel")).toBeTruthy();
      expect(
        Array.from(
          container.querySelectorAll('[aria-label^="Kernel row"]'),
          (element) => element.textContent,
        ),
      ).toEqual(["1", "0", "0", "-1"]);
      const peak = container.querySelector(
        `[data-output-index="${position}"]`,
      );
      expect(peak?.getAttribute("data-output-value")).toBe("2");
      expect(
        screen.getByText(`2 at output ${position}`),
      ).toBeTruthy();
      rendered.unmount();
    }
  });

  it("renders two normalized attention routes with monotonic selected routing", () => {
    const selectedWeights: number[] = [];
    const outputs: number[] = [];
    for (const score of [-2, 0, 2]) {
      const observation = observationFor("attention-routing", score);
      const rendered = render(
        <MechanismDiagram
          labId="attention-routing"
          observation={observation}
        />,
      );
      const { container } = rendered;

      const weights = Array.from(
        container.querySelectorAll("[data-attention-weight]"),
        (element) =>
          Number(element.getAttribute("data-attention-weight")),
      );
      expect(weights).toHaveLength(2);
      expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(
        1,
        12,
      );
      selectedWeights.push(
        Number(
          container
            .querySelector('[data-attention-route="selected"]')
            ?.getAttribute("data-attention-weight"),
        ),
      );
      outputs.push(observation.metrics.output as number);
      expect(screen.getByText("sum weights = 1")).toBeTruthy();
      rendered.unmount();
    }
    expect(selectedWeights[0]).toBeLessThan(selectedWeights[1]);
    expect(selectedWeights[1]).toBeLessThan(selectedWeights[2]);
    expect(outputs[0]).toBeLessThan(outputs[1]);
    expect(outputs[1]).toBeLessThan(outputs[2]);
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
