import { describe, expect, it } from "vitest";
import { CAPSTONE_INCIDENT } from "../content/capstone-incident";
import { lessons } from "../content/course";
import type { VisualLabActivity } from "../content/types";
import {
  CURRENT_VISUAL_LAB_IDS,
  visualMechanismObservation,
  type VisualLabControl,
} from "./visual-mechanism";

type CurrentVisualLabId =
  (typeof CURRENT_VISUAL_LAB_IDS)[number];

function activityFor(labId: CurrentVisualLabId) {
  const matches = lessons
    .flatMap((lesson) => lesson.activities)
    .filter(
      (activity): activity is VisualLabActivity =>
        activity.kind === "visual-lab" &&
        activity.labId === labId,
    );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one authored activity for ${labId}, found ${matches.length}`,
    );
  }
  return matches[0];
}

function controlFor(labId: CurrentVisualLabId): VisualLabControl {
  const control = activityFor(labId).control;
  if (!control) {
    throw new Error(`Missing authored control for ${labId}`);
  }
  return control;
}

function observe(
  labId: CurrentVisualLabId,
  value: number,
) {
  return visualMechanismObservation(
    labId,
    value,
    controlFor(labId),
  );
}

function numberMetric(
  observation: ReturnType<typeof observe>,
  key: string,
) {
  const metric = observation.metrics[key];
  expect(typeof metric).toBe("number");
  return metric as number;
}

function arrayMetric(
  observation: ReturnType<typeof observe>,
  key: string,
) {
  const metric = observation.metrics[key];
  expect(Array.isArray(metric)).toBe(true);
  return metric as readonly number[];
}

function stringMetric(
  observation: ReturnType<typeof observe>,
  key: string,
) {
  const metric = observation.metrics[key];
  expect(typeof metric).toBe("string");
  return metric as string;
}

function authoredStates(labId: CurrentVisualLabId) {
  const control = controlFor(labId);
  return {
    control,
    minimum: observe(labId, control.min),
    initial: observe(labId, control.initial),
    maximum: observe(labId, control.max),
  };
}

describe("visual mechanism observations", () => {
  it("uses each authored control at its deterministic minimum, initial, and maximum states", () => {
    expect(CURRENT_VISUAL_LAB_IDS).toHaveLength(21);
    for (const labId of CURRENT_VISUAL_LAB_IDS) {
      const { min, initial, max } = controlFor(labId);
      const states = [
        [min, 0],
        [initial, (initial - min) / (max - min)],
        [max, 1],
      ] as const;
      for (const [value, normalized] of states) {
        const first = observe(labId, value);
        const repeated = observe(labId, value);
        expect(repeated).toEqual(first);
        expect(first.value).toBe(value);
        expect(first.normalized).toBeCloseTo(normalized, 12);
        expect(first.primary.length).toBeGreaterThan(0);
        expect(first.secondary.length).toBeGreaterThan(0);
        expect(Object.keys(first.metrics).length).toBeGreaterThan(0);
      }
    }
  });

  it("computes the composed prerequisite trace and preserves shape and class counts", () => {
    const result = observe("prerequisite-trace", 1);
    expect(numberMetric(result, "derivative")).toBe(12);
    expect(numberMetric(result, "batchRows")).toBe(4);
    expect(numberMetric(result, "batchFeatures")).toBe(3);
    expect(numberMetric(result, "majorityBaseline")).toBe(0.8);
  });

  it("changes one fitted weight while the row and baseline stay fixed", () => {
    const { minimum, initial, maximum } = authoredStates(
      "data-and-baseline",
    );
    for (const state of [minimum, initial, maximum]) {
      expect(numberMetric(state, "fixedFeature")).toBe(2);
      expect(numberMetric(state, "fixedBias")).toBe(4);
      expect(numberMetric(state, "fixedTarget")).toBe(12);
      expect(numberMetric(state, "meanBaseline")).toBe(10);
    }
    expect(numberMetric(minimum, "prediction")).toBe(4);
    expect(numberMetric(initial, "prediction")).toBe(6);
    expect(numberMetric(maximum, "prediction")).toBe(12);
  });

  it("rotates the linear predictions around the fixed bias", () => {
    const result = observe("linear-model", 3);
    expect(arrayMetric(result, "inputs")).toEqual([-2, 0, 5]);
    expect(arrayMetric(result, "predictions")).toEqual([-2, 4, 19]);
    expect(numberMetric(result, "bias")).toBe(4);
  });

  it("derives every residual, square, and MSE from the authored loss rows", () => {
    const result = observe("loss-landscape", 1);
    expect(arrayMetric(result, "residuals")).toEqual([0, -1, -2]);
    expect(arrayMetric(result, "squares")).toEqual([0, 1, 4]);
    expect(numberMetric(result, "mse")).toBeCloseTo(5 / 3, 12);
  });

  it("replays twelve recomputed gradient steps from the authored initial state", () => {
    const result = observe("gradient-descent", 0.05);
    expect(numberMetric(result, "initialWeight")).toBe(0);
    expect(numberMetric(result, "steps")).toBe(12);
    expect(numberMetric(result, "finalWeight")).toBeCloseTo(
      1.998941,
      6,
    );
  });

  it("changes only the split used to select a fixed prediction candidate", () => {
    const validation = observe("split-and-leakage", 0);
    const test = observe("split-and-leakage", 1);
    expect(numberMetric(validation, "selectedPrediction")).toBe(11);
    expect(numberMetric(validation, "finalTestLoss")).toBe(101);
    expect(numberMetric(validation, "testIndependent")).toBe(1);
    expect(numberMetric(test, "selectedPrediction")).toBe(12);
    expect(numberMetric(test, "testIndependent")).toBe(0);
  });

  it("uses one deterministic ridge polynomial fit at every authored endpoint", () => {
    const { minimum, initial, maximum } = authoredStates(
      "capacity-curves",
    );
    for (const state of [minimum, initial, maximum]) {
      expect(numberMetric(state, "smallRowCount")).toBe(5);
      expect(numberMetric(state, "addedRowCount")).toBe(3);
      expect(numberMetric(state, "largeRowCount")).toBe(8);
      expect(numberMetric(state, "probeRowCount")).toBe(4);
      expect(numberMetric(state, "ridgePenalty")).toBe(1e-6);
      expect(stringMetric(state, "fitProcedure")).toBe(
        "raw monomial ridge least squares with partial-pivot Gaussian elimination",
      );
      expect(
        arrayMetric(state, "smallCoefficients"),
      ).toHaveLength(numberMetric(state, "degree") + 1);
      expect(
        arrayMetric(state, "largeCoefficients"),
      ).toHaveLength(numberMetric(state, "degree") + 1);
    }
    expect(numberMetric(minimum, "smallTrainLoss")).toBeCloseTo(
      2.80000000000016,
      12,
    );
    expect(
      numberMetric(minimum, "smallValidationLoss"),
    ).toBeCloseTo(1.0624996666668933, 12);
    expect(numberMetric(initial, "smallTrainLoss")).toBeLessThan(
      1e-12,
    );
    expect(
      numberMetric(initial, "smallValidationLoss"),
    ).toBeLessThan(1e-12);
    expect(
      numberMetric(maximum, "smallValidationLoss"),
    ).toBeCloseTo(1.9274100237197487, 7);
    expect(
      numberMetric(maximum, "largeProbeLoss"),
    ).toBeCloseTo(0.010806767373532804, 10);
  });

  it("computes sigmoid and both target-dependent log losses", () => {
    const result = observe("logistic-link", 0);
    expect(numberMetric(result, "probability")).toBe(0.5);
    expect(numberMetric(result, "lossTargetOne")).toBeCloseTo(
      Math.log(2),
      12,
    );
    expect(numberMetric(result, "lossTargetZero")).toBeCloseTo(
      Math.log(2),
      12,
    );
  });

  it("thresholds the authored score table into exact metrics and cost", () => {
    const result = observe("decision-costs", 0.5);
    expect([
      numberMetric(result, "tp"),
      numberMetric(result, "fp"),
      numberMetric(result, "tn"),
      numberMetric(result, "fn"),
    ]).toEqual([2, 1, 1, 1]);
    expect(numberMetric(result, "precision")).toBeCloseTo(2 / 3, 12);
    expect(numberMetric(result, "recall")).toBeCloseTo(2 / 3, 12);
    expect(numberMetric(result, "weightedCost")).toBe(6);
  });

  it("changes only temperature for one complete night row", () => {
    const { minimum, initial, maximum } = authoredStates(
      "feature-pipeline",
    );
    for (const state of [minimum, initial, maximum]) {
      expect(numberMetric(state, "trainingMean")).toBe(20);
      expect(numberMetric(state, "trainingScale")).toBeCloseTo(
        Math.sqrt(200 / 3),
        12,
      );
      expect(numberMetric(state, "missingIndicator")).toBe(0);
      expect(numberMetric(state, "dayIndicator")).toBe(0);
      expect(numberMetric(state, "nightIndicator")).toBe(1);
    }
    expect(arrayMetric(minimum, "outputVector")[0]).toBeCloseTo(
      -Math.sqrt(6),
      12,
    );
    expect(arrayMetric(minimum, "outputVector").slice(1)).toEqual([
      0, 0, 1,
    ]);
    expect(arrayMetric(initial, "outputVector")).toEqual([
      0, 0, 0, 1,
    ]);
    expect(arrayMetric(maximum, "outputVector")[0]).toBeCloseTo(
      Math.sqrt(6),
      12,
    );
    expect(arrayMetric(maximum, "outputVector").slice(1)).toEqual([
      0, 0, 1,
    ]);
  });

  it("moves one query through fixed kNN points and a fixed tree split", () => {
    const result = observe("knn-versus-tree", 3.6);
    expect(arrayMetric(result, "neighbors")).toEqual([4, 5, 2]);
    expect(numberMetric(result, "knnLabel")).toBe(1);
    expect(numberMetric(result, "treeThreshold")).toBe(3);
    expect(numberMetric(result, "treeLabel")).toBe(1);
  });

  it("fits the authored ridge coefficient and fold losses at lambda", () => {
    const result = observe("regularization-path", 4);
    expect(numberMetric(result, "numerator")).toBe(10);
    expect(numberMetric(result, "squaredInputSum")).toBe(5);
    expect(numberMetric(result, "weight")).toBeCloseTo(10 / 9, 12);
    expect(numberMetric(result, "foldCount")).toBe(2);
  });

  it("uses the fixed-learner correlated-mean variance equation", () => {
    const diverse = observe("ensemble-votes", 0);
    const aligned = observe("ensemble-votes", 1);
    expect(numberMetric(diverse, "learnerCount")).toBe(10);
    expect(numberMetric(diverse, "ensembleVariance")).toBeCloseTo(
      0.1,
      12,
    );
    expect(numberMetric(aligned, "ensembleVariance")).toBe(1);
  });

  it("computes all four authored XOR hidden scores", () => {
    const result = observe("xor-hidden-space", 1);
    expect(arrayMetric(result, "hidden10")).toEqual([1, 0]);
    expect(arrayMetric(result, "hidden01")).toEqual([0, 1]);
    expect(arrayMetric(result, "scores")).toEqual([0, 1, 1, 0]);
    expect(arrayMetric(result, "targets")).toEqual([0, 1, 1, 0]);
    expect(arrayMetric(result, "predictions")).toEqual([0, 1, 1, 0]);
  });

  it("adds both paths back into the shared backprop parameter", () => {
    const authored = observe("backprop-graph", 1);
    const cancellation = observe("backprop-graph", -1);
    expect(numberMetric(authored, "productBranch")).toBe(2);
    expect(numberMetric(authored, "squareBranch")).toBe(1);
    expect(numberMetric(authored, "productContribution")).toBe(4);
    expect(numberMetric(authored, "squareContribution")).toBe(4);
    expect(numberMetric(authored, "totalGradient")).toBe(8);
    expect(numberMetric(cancellation, "productContribution")).toBe(-4);
    expect(numberMetric(cancellation, "squareContribution")).toBe(4);
    expect(numberMetric(cancellation, "totalGradient")).toBe(0);
  });

  it("distinguishes convergent oscillation from true high-rate instability", () => {
    const { control, minimum, initial, maximum } = authoredStates(
      "optimizer-traces",
    );
    expect(control.max).toBe(1.2);
    for (const state of [minimum, initial, maximum]) {
      expect(numberMetric(state, "initialWeight")).toBe(0);
      expect(numberMetric(state, "targetMean")).toBe(2);
      expect(numberMetric(state, "steps")).toBe(12);
    }
    expect(stringMetric(minimum, "stabilityRegime")).toBe(
      "convergent",
    );
    expect(stringMetric(initial, "stabilityRegime")).toBe(
      "convergent",
    );

    const convergentOscillation = observe(
      "optimizer-traces",
      0.8,
    );
    expect(
      stringMetric(convergentOscillation, "stabilityRegime"),
    ).toBe("convergent oscillation");
    expect(numberMetric(convergentOscillation, "stable")).toBe(1);
    expect(
      numberMetric(
        convergentOscillation,
        "finalDistanceToMinimum",
      ),
    ).toBeLessThan(
      numberMetric(
        convergentOscillation,
        "initialDistanceToMinimum",
      ),
    );

    const nonConvergentOscillation = observe(
      "optimizer-traces",
      1,
    );
    expect(
      stringMetric(nonConvergentOscillation, "stabilityRegime"),
    ).toBe("non-convergent oscillation");
    expect(
      numberMetric(
        nonConvergentOscillation,
        "finalDistanceToMinimum",
      ),
    ).toBe(
      numberMetric(
        nonConvergentOscillation,
        "initialDistanceToMinimum",
      ),
    );

    expect(stringMetric(maximum, "stabilityRegime")).toBe(
      "divergent oscillation",
    );
    expect(numberMetric(maximum, "stable")).toBe(0);
    expect(
      numberMetric(maximum, "finalDistanceToMinimum"),
    ).toBeGreaterThan(
      numberMetric(maximum, "initialDistanceToMinimum"),
    );
  });

  it("rescales only the second coordinate before k-means and PCA", () => {
    const result = observe("cluster-project", 1);
    expect(arrayMetric(result, "assignments")).toEqual([0, 0, 1, 1]);
    expect(arrayMetric(result, "centroidZero")).toEqual([0, 1]);
    expect(arrayMetric(result, "centroidOne")).toEqual([9, 8]);
    expect(
      Number.isFinite(numberMetric(result, "principalAngleDegrees")),
    ).toBe(true);
  });

  it("translates a fixed pattern under one shared 2 by 2 kernel", () => {
    const result = observe("convolution-field", 3);
    expect(arrayMetric(result, "kernelValues")).toEqual([1, 0, 0, -1]);
    expect(numberMetric(result, "peakPosition")).toBe(3);
    expect(numberMetric(result, "peakActivation")).toBe(2);
    expect(numberMetric(result, "stride")).toBe(1);
    expect(numberMetric(result, "padding")).toBe(0);
  });

  it("normalizes both attention scores once and mixes fixed values", () => {
    const result = observe("attention-routing", 0);
    expect(numberMetric(result, "otherWeight")).toBe(0.5);
    expect(numberMetric(result, "selectedWeight")).toBe(0.5);
    expect(numberMetric(result, "weightSum")).toBe(1);
    expect(numberMetric(result, "output")).toBe(6);
  });

  it("computes continuing, terminal, and updated Q values separately", () => {
    const result = observe("q-learning", 5);
    expect(numberMetric(result, "nonterminalTarget")).toBe(6.5);
    expect(numberMetric(result, "terminalTarget")).toBe(2);
    expect(numberMetric(result, "updatedQ")).toBe(3.75);
  });

  it("aggregates slice false negatives over fixed actual-positive support", () => {
    const { minimum, initial, maximum } = authoredStates(
      "shift-monitor",
    );
    expect(
      activityFor("shift-monitor").control?.label,
    ).toBe("Night share among actual positives");
    for (const state of [minimum, initial, maximum]) {
      expect(
        numberMetric(state, "totalActualPositiveSupport"),
      ).toBe(CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport);
      expect(numberMetric(state, "dayFalseNegativeRate")).toBe(
        CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate,
      );
      expect(numberMetric(state, "nightFalseNegativeRate")).toBe(
        CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate,
      );
      expect(
        numberMetric(state, "dayActualPositiveSupport") +
          numberMetric(state, "nightActualPositiveSupport"),
      ).toBe(CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport);
      expect(numberMetric(state, "nightShare")).toBe(
        numberMetric(state, "nightShareAmongActualPositives"),
      );
      expect(numberMetric(state, "dayShare")).toBe(
        numberMetric(state, "dayShareAmongActualPositives"),
      );
      expect(numberMetric(state, "falseNegativeRateGap")).toBeCloseTo(
        CAPSTONE_INCIDENT.metrics.falseNegativeRateGap,
        12,
      );
      expect(
        numberMetric(state, "aggregateFalseNegativeRate"),
      ).toBeCloseTo(
        numberMetric(state, "falseNegatives") /
          numberMetric(state, "totalActualPositiveSupport"),
        12,
      );
    }
    expect(numberMetric(minimum, "falseNegatives")).toBe(
      CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport *
        CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate,
    );
    expect(
      numberMetric(minimum, "aggregateFalseNegativeRate"),
    ).toBe(CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate);
    expect(numberMetric(initial, "dayActualPositiveSupport")).toBe(
      CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport -
        CAPSTONE_INCIDENT.live.slices.night.truePositives -
        CAPSTONE_INCIDENT.live.slices.night.falseNegatives,
    );
    expect(
      numberMetric(initial, "nightActualPositiveSupport"),
    ).toBe(
      CAPSTONE_INCIDENT.live.slices.night.truePositives +
        CAPSTONE_INCIDENT.live.slices.night.falseNegatives,
    );
    expect(numberMetric(initial, "falseNegatives")).toBe(
      CAPSTONE_INCIDENT.live.slices.day.falseNegatives +
        CAPSTONE_INCIDENT.live.slices.night.falseNegatives,
    );
    expect(numberMetric(initial, "dayFalseNegatives")).toBe(
      CAPSTONE_INCIDENT.live.slices.day.falseNegatives,
    );
    expect(numberMetric(initial, "nightFalseNegatives")).toBe(
      CAPSTONE_INCIDENT.live.slices.night.falseNegatives,
    );
    expect(
      numberMetric(initial, "aggregateFalseNegativeRate"),
    ).toBeCloseTo(
      (CAPSTONE_INCIDENT.live.slices.day.falseNegatives +
        CAPSTONE_INCIDENT.live.slices.night.falseNegatives) /
        CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport,
      12,
    );
    expect(numberMetric(maximum, "falseNegatives")).toBe(
      CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport *
        CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate,
    );
    expect(
      numberMetric(maximum, "aggregateFalseNegativeRate"),
    ).toBe(CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate);
  });
});
