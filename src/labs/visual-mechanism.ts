import type { VisualLabActivity } from "../content/types";
import { CAPSTONE_INCIDENT } from "../content/capstone-incident";

export type VisualLabControl = NonNullable<VisualLabActivity["control"]>;

export type VisualMechanismMetric =
  | number
  | string
  | readonly number[];

export interface VisualMechanismObservation {
  value: number;
  normalized: number;
  primary: string;
  secondary: string;
  explanation: string;
  metrics: Readonly<Record<string, VisualMechanismMetric>>;
}

export const CURRENT_VISUAL_LAB_IDS = [
  "prerequisite-trace",
  "data-and-baseline",
  "linear-model",
  "loss-landscape",
  "gradient-descent",
  "split-and-leakage",
  "capacity-curves",
  "logistic-link",
  "decision-costs",
  "feature-pipeline",
  "knn-versus-tree",
  "regularization-path",
  "ensemble-votes",
  "xor-hidden-space",
  "backprop-graph",
  "optimizer-traces",
  "cluster-project",
  "convolution-field",
  "attention-routing",
  "q-learning",
  "shift-monitor",
] as const satisfies readonly VisualLabActivity["labId"][];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, digits = 3) {
  if (value !== 0 && Math.abs(value) >= 1_000_000) {
    return value.toExponential(2);
  }
  return Number(value.toFixed(digits)).toString();
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanSquaredError(
  rows: readonly (readonly [number, number])[],
  predict: (x: number) => number,
) {
  return mean(rows.map(([x, target]) => (predict(x) - target) ** 2));
}

const LOSS_ROWS = [
  [0, 1],
  [1, 3],
  [2, 5],
] as const;
const DESCENT_ROWS = [
  [1, 3],
  [2, 5],
  [3, 7],
] as const;

function linearResidualState(weight: number) {
  const predictions = LOSS_ROWS.map(([x]) => 1 + weight * x);
  const residuals = LOSS_ROWS.map(
    ([, target], index) => predictions[index] - target,
  );
  const squares = residuals.map((residual) => residual ** 2);
  return {
    predictions,
    residuals,
    squares,
    mse: mean(squares),
  };
}

function descentTrace(learningRate: number) {
  let weight = 0;
  const lossAt = (candidateWeight: number) =>
    meanSquaredError(
      DESCENT_ROWS,
      (x) => 1 + candidateWeight * x,
    );
  const losses = [lossAt(weight)];
  let gradient = 0;
  for (let step = 0; step < 12; step += 1) {
    gradient = mean(
      DESCENT_ROWS.map(
        ([x, target]) => 2 * (1 + weight * x - target) * x,
      ),
    );
    weight -= learningRate * gradient;
    losses.push(lossAt(weight));
  }
  gradient = mean(
    DESCENT_ROWS.map(
      ([x, target]) => 2 * (1 + weight * x - target) * x,
    ),
  );
  return { weight, gradient, loss: losses.at(-1) ?? 0, losses };
}

const SPLIT_CANDIDATES = [10, 11, 12] as const;
const VALIDATION_TARGETS = [9, 13] as const;
const TEST_TARGETS = [20, 22] as const;

function constantPredictionMse(
  targets: readonly number[],
  prediction: number,
) {
  return mean(targets.map((target) => (prediction - target) ** 2));
}

function selectConstantPrediction(targets: readonly number[]) {
  return SPLIT_CANDIDATES.reduce((best, candidate) =>
    constantPredictionMse(targets, candidate) <
    constantPredictionMse(targets, best)
      ? candidate
      : best,
  );
}

const CAPACITY_TRAIN_ROWS = [
  [-2, 4],
  [-1, 1],
  [0, 0],
  [1, 1],
  [2, 4],
] as const;
const CAPACITY_ADDED_ROWS = [
  [-1.5, 2.25],
  [0.5, 0.25],
  [1.5, 2.25],
] as const;
const CAPACITY_PROBE_ROWS = [
  [-1.75, 3.0625],
  [-0.5, 0.25],
  [0.75, 0.5625],
  [1.75, 3.0625],
] as const;
const CAPACITY_RIDGE_PENALTY = 1e-6;
const CAPACITY_FIT_PROCEDURE =
  "raw monomial ridge least squares with partial-pivot Gaussian elimination";

function solveLinearSystem(
  matrix: readonly (readonly number[])[],
  rightHandSide: readonly number[],
) {
  const size = rightHandSide.length;
  const augmented = matrix.map((row, index) => [
    ...row,
    rightHandSide[index],
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }
    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];

    for (let row = column + 1; row < size; row += 1) {
      const factor =
        augmented[row][column] / augmented[column][column];
      for (let entry = column; entry <= size; entry += 1) {
        augmented[row][entry] -=
          factor * augmented[column][entry];
      }
    }
  }

  const solution = Array.from<number>({ length: size }).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    const knownContribution = solution
      .slice(row + 1)
      .reduce(
        (sum, coefficient, offset) =>
          sum +
          augmented[row][row + offset + 1] * coefficient,
        0,
      );
    solution[row] =
      (augmented[row][size] - knownContribution) /
      augmented[row][row];
  }
  return solution;
}

function fitRidgePolynomial(
  degree: number,
  rows: readonly (readonly [number, number])[],
) {
  const coefficientCount = degree + 1;
  const normalMatrix = Array.from(
    { length: coefficientCount },
    () => Array.from<number>({ length: coefficientCount }).fill(0),
  );
  const targetVector = Array.from<number>({
    length: coefficientCount,
  }).fill(0);

  rows.forEach(([x, target]) => {
    const features = Array.from(
      { length: coefficientCount },
      (_unused, power) => x ** power,
    );
    features.forEach((feature, row) => {
      targetVector[row] += feature * target;
      features.forEach((otherFeature, column) => {
        normalMatrix[row][column] += feature * otherFeature;
      });
    });
  });
  normalMatrix.forEach((row, index) => {
    row[index] += CAPACITY_RIDGE_PENALTY;
  });

  const coefficients = solveLinearSystem(
    normalMatrix,
    targetVector,
  );
  return {
    coefficients,
    predict: (x: number) =>
      coefficients.reduce(
        (prediction, coefficient, power) =>
          prediction + coefficient * x ** power,
        0,
      ),
  };
}

function capacityState(degree: number) {
  const largerRows = [
    ...CAPACITY_TRAIN_ROWS,
    ...CAPACITY_ADDED_ROWS,
  ] as const;
  const smallFit = fitRidgePolynomial(
    degree,
    CAPACITY_TRAIN_ROWS,
  );
  const largeFit = fitRidgePolynomial(degree, largerRows);
  return {
    smallCoefficients: smallFit.coefficients,
    largeCoefficients: largeFit.coefficients,
    smallTrainLoss: meanSquaredError(
      CAPACITY_TRAIN_ROWS,
      smallFit.predict,
    ),
    smallValidationLoss: meanSquaredError(
      CAPACITY_ADDED_ROWS,
      smallFit.predict,
    ),
    largeTrainLoss: meanSquaredError(largerRows, largeFit.predict),
    largeProbeLoss: meanSquaredError(
      CAPACITY_PROBE_ROWS,
      largeFit.predict,
    ),
  };
}

const DECISION_SCORES = [0.9, 0.7, 0.6, 0.4, 0.2] as const;
const DECISION_TARGETS = [1, 0, 1, 0, 1] as const;

function decisionState(threshold: number) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  DECISION_SCORES.forEach((score, index) => {
    const prediction = Number(score >= threshold);
    const target = DECISION_TARGETS[index];
    if (prediction === 1 && target === 1) tp += 1;
    else if (prediction === 1 && target === 0) fp += 1;
    else if (prediction === 0 && target === 0) tn += 1;
    else fn += 1;
  });
  return {
    tp,
    fp,
    tn,
    fn,
    precision: tp + fp === 0 ? 0 : tp / (tp + fp),
    recall: tp + fn === 0 ? 0 : tp / (tp + fn),
    cost: fp + 5 * fn,
  };
}

const KNN_POINTS = [
  [1, 0],
  [2, 0],
  [4, 1],
  [5, 1],
] as const;

function knnTreeState(query: number) {
  const neighbors = [...KNN_POINTS]
    .sort(
      (left, right) =>
        Math.abs(left[0] - query) - Math.abs(right[0] - query) ||
        left[0] - right[0],
    )
    .slice(0, 3);
  const positiveVotes = neighbors.reduce(
    (sum, [, label]) => sum + label,
    0,
  );
  return {
    neighbors: neighbors.map(([x]) => x),
    knnLabel: Number(positiveVotes * 2 >= neighbors.length),
    treeLabel: Number(query >= 3),
  };
}

function regularizationState(penalty: number) {
  const rows = [
    [1, 2],
    [2, 4],
  ] as const;
  const weight = 10 / (5 + penalty);
  const trainingLoss = meanSquaredError(rows, (x) => weight * x);
  const foldLosses = rows.map((validationRow, validationIndex) => {
    const trainingRow = rows[1 - validationIndex];
    const foldWeight =
      (trainingRow[0] * trainingRow[1]) /
      (trainingRow[0] ** 2 + penalty);
    return (foldWeight * validationRow[0] - validationRow[1]) ** 2;
  });
  return { weight, trainingLoss, meanFoldLoss: mean(foldLosses) };
}

const XOR_CASES = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;
const XOR_TARGETS = [0, 1, 1, 0] as const;

function xorState(strength: number) {
  const hidden = XOR_CASES.map(([x1, x2]) => {
    const reluDifference = [
      Math.max(0, x1 - x2),
      Math.max(0, x2 - x1),
    ];
    return [
      (1 - strength) * x1 + strength * reluDifference[0],
      (1 - strength) * x2 + strength * reluDifference[1],
    ];
  });
  const scores = hidden.map(([h1, h2]) => h1 + h2);
  return {
    hidden,
    scores,
    targets: XOR_TARGETS,
    predictions: scores.map((score) => Number(score >= 0.5)),
  };
}

function backpropState(weight: number) {
  const input = 2;
  const bias = 0;
  const target = 1;
  const productBranch = weight * input;
  const squareBranch = weight * weight;
  const prediction = productBranch + squareBranch + bias;
  const residual = prediction - target;
  const loss = 0.5 * residual * residual;
  const productLocalDerivative = input;
  const squareLocalDerivative = 2 * weight;
  const productContribution = residual * productLocalDerivative;
  const squareContribution = residual * squareLocalDerivative;
  const totalGradient = productContribution + squareContribution;

  return {
    input,
    weight,
    bias,
    target,
    productBranch,
    squareBranch,
    prediction,
    residual,
    loss,
    productLocalDerivative,
    squareLocalDerivative,
    productContribution,
    squareContribution,
    totalGradient,
    biasGradient: residual,
  };
}

function optimizerTrace(learningRate: number) {
  const targets = [1, 3] as const;
  const minimum = mean(targets);
  const errorMultiplier = 1 - 2 * learningRate;
  const multiplierMagnitude = Math.abs(errorMultiplier);
  const regime =
    multiplierMagnitude < 1
      ? errorMultiplier < 0
        ? "convergent oscillation"
        : "convergent"
      : multiplierMagnitude === 1
        ? "non-convergent oscillation"
        : "divergent oscillation";
  let weight = 0;
  const weights = [weight];
  for (let step = 0; step < 12; step += 1) {
    const gradient = mean(
      targets.map((target) => 2 * (weight - target)),
    );
    weight -= learningRate * gradient;
    weights.push(weight);
  }
  const loss = mean(targets.map((target) => (weight - target) ** 2));
  const crossedMinimum = weights.some(
    (current, index) =>
      index > 0 &&
      (current - minimum) *
        (weights[index - 1] - minimum) <
        0,
  );
  return {
    weight,
    loss,
    crossedMinimum,
    weights,
    minimum,
    errorMultiplier,
    regime,
    stable: multiplierMagnitude < 1,
    initialDistanceToMinimum: Math.abs(weights[0] - minimum),
    finalDistanceToMinimum: Math.abs(weight - minimum),
  };
}

const CLUSTER_POINTS = [
  [0, 0],
  [8, 1],
  [2, 6],
  [10, 10],
] as const;
const CLUSTER_START = [
  [0, 0],
  [10, 10],
] as const;

function squaredDistance(
  left: readonly number[],
  right: readonly number[],
) {
  return left.reduce(
    (sum, value, index) => sum + (value - right[index]) ** 2,
    0,
  );
}

function clusterState(secondCoordinateScale: number) {
  const points = CLUSTER_POINTS.map(([x, y]) => [
    x,
    y * secondCoordinateScale,
  ]);
  const starts = CLUSTER_START.map(([x, y]) => [
    x,
    y * secondCoordinateScale,
  ]);
  const assignments = points.map((point) =>
    squaredDistance(point, starts[0]) <=
    squaredDistance(point, starts[1])
      ? 0
      : 1,
  );
  const centroids = [0, 1].map((cluster) => {
    const assigned = points.filter(
      (_point, index) => assignments[index] === cluster,
    );
    return [
      mean(assigned.map(([x]) => x)),
      mean(assigned.map(([, y]) => y)),
    ];
  });

  const center = [
    mean(points.map(([x]) => x)),
    mean(points.map(([, y]) => y)),
  ];
  const covarianceX = mean(
    points.map(([x]) => (x - center[0]) ** 2),
  );
  const covarianceY = mean(
    points.map(([, y]) => (y - center[1]) ** 2),
  );
  const covarianceXY = mean(
    points.map(
      ([x, y]) => (x - center[0]) * (y - center[1]),
    ),
  );
  const principalAngle =
    (0.5 *
      Math.atan2(
        2 * covarianceXY,
        covarianceX - covarianceY,
      ) *
      180) /
    Math.PI;
  return {
    points,
    assignments,
    centroids,
    center,
    principalAngle,
  };
}

const CONVOLUTION_KERNEL = [
  [1, 0],
  [0, -1],
] as const;

function convolutionState(patternPosition: number) {
  const position = Math.round(patternPosition);
  const image = [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ];
  CONVOLUTION_KERNEL.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      image[rowIndex][position + columnIndex] = cell;
    });
  });
  const outputs = Array.from({ length: 5 }, (_unused, column) =>
    CONVOLUTION_KERNEL.reduce(
      (sum, row, rowIndex) =>
        sum +
        row.reduce<number>(
          (rowSum, kernelValue, kernelColumn) =>
            rowSum +
            image[rowIndex][column + kernelColumn] * kernelValue,
          0,
        ),
      0,
    ),
  );
  const peakPosition = outputs.reduce(
    (best, output, index) =>
      output > outputs[best] ? index : best,
    0,
  );
  return { outputs, peakPosition, peakActivation: outputs[peakPosition] };
}

function attentionState(selectedScore: number) {
  const selectedNumerator = Math.exp(selectedScore);
  const denominator = 1 + selectedNumerator;
  const otherWeight = 1 / denominator;
  const selectedWeight = selectedNumerator / denominator;
  const output = otherWeight * 2 + selectedWeight * 10;
  return { otherWeight, selectedWeight, weightSum: 1, output };
}

export function visualMechanismObservation(
  labId: VisualLabActivity["labId"],
  value: number,
  control: VisualLabControl,
): VisualMechanismObservation {
  const boundedValue = clamp(value, control.min, control.max);
  const range = control.max - control.min;
  const normalized =
    range === 0 ? 0 : (boundedValue - control.min) / range;
  const base = { value: boundedValue, normalized };

  switch (labId) {
    case "prerequisite-trace": {
      const u = 2 * boundedValue + 1;
      const y = u ** 2;
      const outerDerivative = 2 * u;
      const innerDerivative = 2;
      const derivative = outerDerivative * innerDerivative;
      return {
        ...base,
        primary: `u = ${formatNumber(u)}; y = ${formatNumber(y)}`,
        secondary: `dy/dx = ${formatNumber(outerDerivative)} x 2 = ${formatNumber(derivative)}`,
        explanation:
          "Only x changes. The 4 x 3 batch still produces four scores, and the fixed 80-to-20 classes still give an 80% majority baseline.",
        metrics: {
          x: boundedValue,
          u,
          y,
          outerDerivative,
          innerDerivative,
          derivative,
          batchRows: 4,
          batchFeatures: 3,
          majorityBaseline: 0.8,
        },
      };
    }
    case "data-and-baseline": {
      const fixedFeature = 2;
      const fixedBias = 4;
      const fixedTarget = 12;
      const prediction =
        boundedValue * fixedFeature + fixedBias;
      const residual = prediction - fixedTarget;
      return {
        ...base,
        primary: `prediction ${formatNumber(prediction)} vs target ${fixedTarget}`,
        secondary: `residual ${formatNumber(residual)}; mean baseline 10`,
        explanation:
          "Only the fitted weight changes. The recorded row keeps x = 2, bias 4, and target 12, while the no-feature mean baseline stays 10.",
        metrics: {
          parameter: boundedValue,
          fixedFeature,
          fixedBias,
          fixedTarget,
          prediction,
          residual,
          meanBaseline: 10,
        },
      };
    }
    case "linear-model": {
      const inputs = [-2, 0, 5] as const;
      const predictions = inputs.map((x) => boundedValue * x + 4);
      return {
        ...base,
        primary: `w = ${formatNumber(boundedValue)}; y-hat = [${predictions.map((prediction) => formatNumber(prediction)).join(", ")}]`,
        secondary: `x = 0 stays at b = 4; x = -2 gives ${formatNumber(predictions[0])}`,
        explanation:
          "The fixed inputs include a negative value, zero, and five. Changing only w rotates all predictions around the fixed intercept b = 4.",
        metrics: {
          weight: boundedValue,
          bias: 4,
          inputs,
          predictions,
        },
      };
    }
    case "loss-landscape": {
      const state = linearResidualState(boundedValue);
      return {
        ...base,
        primary: `residuals [${state.residuals.map((residual) => formatNumber(residual)).join(", ")}]`,
        secondary: `squares [${state.squares.map((square) => formatNumber(square)).join(", ")}]; MSE ${formatNumber(state.mse)}`,
        explanation:
          "The three authored points and bias 1 stay fixed. Each prediction-minus-target residual is squared before the three contributions are averaged.",
        metrics: {
          weight: boundedValue,
          bias: 1,
          predictions: state.predictions,
          residuals: state.residuals,
          squares: state.squares,
          mse: state.mse,
        },
      };
    }
    case "gradient-descent": {
      const trace = descentTrace(boundedValue);
      return {
        ...base,
        primary: `weight after 12 steps ${formatNumber(trace.weight, 6)}`,
        secondary: `loss ${formatNumber(trace.loss, 6)}; next gradient ${formatNumber(trace.gradient, 6)}`,
        explanation:
          "Every replay starts at weight 0 on the same three rows with bias 1. Only the learning rate changes; the gradient is recomputed after each step.",
        metrics: {
          learningRate: boundedValue,
          initialWeight: 0,
          steps: 12,
          finalWeight: trace.weight,
          finalLoss: trace.loss,
          finalGradient: trace.gradient,
          lossTrace: trace.losses,
        },
      };
    }
    case "split-and-leakage": {
      const selectionTargets =
        boundedValue < 0.5 ? VALIDATION_TARGETS : TEST_TARGETS;
      const source =
        boundedValue < 0.5 ? "validation" : "test";
      const selected = selectConstantPrediction(selectionTargets);
      const selectionLoss = constantPredictionMse(
        selectionTargets,
        selected,
      );
      const finalTestLoss = constantPredictionMse(
        TEST_TARGETS,
        selected,
      );
      return {
        ...base,
        primary: `${source} selects prediction ${selected}`,
        secondary: `selection loss ${formatNumber(selectionLoss)}; test loss ${formatNumber(finalTestLoss)}`,
        explanation:
          source === "validation"
            ? "Validation chooses the candidate, so the final test rows remain independent of selection."
            : "Test loss now chooses the candidate, so that same test result is selection feedback rather than an independent estimate.",
        metrics: {
          selectionSource: source,
          candidatePredictions: SPLIT_CANDIDATES,
          selectedPrediction: selected,
          selectionLoss,
          finalTestLoss,
          testIndependent: source === "validation" ? 1 : 0,
          candidateCount: SPLIT_CANDIDATES.length,
        },
      };
    }
    case "capacity-curves": {
      const degree = Math.round(boundedValue);
      const state = capacityState(degree);
      return {
        ...base,
        primary: `degree ${degree}: train ${formatNumber(state.smallTrainLoss)}; validation ${formatNumber(state.smallValidationLoss)}`,
        secondary: `after 3 added examples: train ${formatNumber(state.largeTrainLoss)}; probe ${formatNumber(state.largeProbeLoss)}`,
        explanation:
          "Every state uses raw powers 1 through x^degree and the same ridge-stabilized least-squares solve. A fixed lambda = 1e-6 makes underdetermined fits unique; partial-pivot Gaussian elimination, all rows, and all probe points stay fixed.",
        metrics: {
          degree,
          smallRowCount: CAPACITY_TRAIN_ROWS.length,
          largeRowCount:
            CAPACITY_TRAIN_ROWS.length +
            CAPACITY_ADDED_ROWS.length,
          addedRowCount: CAPACITY_ADDED_ROWS.length,
          probeRowCount: CAPACITY_PROBE_ROWS.length,
          ridgePenalty: CAPACITY_RIDGE_PENALTY,
          fitProcedure: CAPACITY_FIT_PROCEDURE,
          smallCoefficients: state.smallCoefficients,
          largeCoefficients: state.largeCoefficients,
          smallTrainLoss: state.smallTrainLoss,
          smallValidationLoss: state.smallValidationLoss,
          largeTrainLoss: state.largeTrainLoss,
          largeProbeLoss: state.largeProbeLoss,
        },
      };
    }
    case "logistic-link": {
      const logit = boundedValue;
      const probability = 1 / (1 + Math.exp(-logit));
      const lossTargetOne = -Math.log(probability);
      const lossTargetZero = -Math.log(1 - probability);
      return {
        ...base,
        primary: `logit ${formatNumber(logit)} -> p ${formatNumber(probability)}`,
        secondary: `loss y=1 ${formatNumber(lossTargetOne)}; y=0 ${formatNumber(lossTargetZero)}`,
        explanation:
          "The fixed feature contribution is zero, so the selected bias contribution is the logit. Sigmoid and both target-dependent log losses are recomputed exactly.",
        metrics: {
          biasContribution: boundedValue,
          fixedFeatureContribution: 0,
          logit,
          probability,
          lossTargetOne,
          lossTargetZero,
        },
      };
    }
    case "decision-costs": {
      const state = decisionState(boundedValue);
      return {
        ...base,
        primary: `TP ${state.tp} / FP ${state.fp} / TN ${state.tn} / FN ${state.fn}`,
        secondary: `precision ${formatNumber(state.precision)}; recall ${formatNumber(state.recall)}; cost ${state.cost}`,
        explanation:
          "The five authored probabilities and targets stay fixed. Only the threshold changes labels; cost remains 1 x FP + 5 x FN.",
        metrics: {
          threshold: boundedValue,
          scoreCount: DECISION_SCORES.length,
          tp: state.tp,
          fp: state.fp,
          tn: state.tn,
          fn: state.fn,
          precision: state.precision,
          recall: state.recall,
          weightedCost: state.cost,
        },
      };
    }
    case "feature-pipeline": {
      const trainingScale = Math.sqrt(200 / 3);
      const scaledTemperature = (boundedValue - 20) / trainingScale;
      const outputVector = [scaledTemperature, 0, 0, 1];
      return {
        ...base,
        primary: `scaled temperature (${formatNumber(boundedValue)} - 20) / ${formatNumber(trainingScale)} = ${formatNumber(scaledTemperature)}`,
        secondary: `vector [${outputVector.map((entry) => formatNumber(entry)).join(", ")}]`,
        explanation:
          "The shared [10, missing, 30] training fixture supplies mean 20 and fitted scale sqrt(200 / 3). The binary missing flag and [day, night] category positions stay frozen while this complete night row changes only its temperature.",
        metrics: {
          incomingTemperature: boundedValue,
          trainingMean: 20,
          trainingScale,
          missingIndicator: 0,
          dayIndicator: 0,
          nightIndicator: 1,
          scaledTemperature,
          outputVector,
        },
      };
    }
    case "knn-versus-tree": {
      const state = knnTreeState(boundedValue);
      return {
        ...base,
        primary: `3-NN [${state.neighbors.join(", ")}] -> class ${state.knnLabel}`,
        secondary: `tree x < 3 / x >= 3 -> class ${state.treeLabel}`,
        explanation:
          "The four authored labeled points, k = 3, and the fitted tree split at x = 3 stay fixed while only the query moves.",
        metrics: {
          query: boundedValue,
          k: 3,
          neighbors: state.neighbors,
          knnLabel: state.knnLabel,
          treeThreshold: 3,
          treeLabel: state.treeLabel,
        },
      };
    }
    case "regularization-path": {
      const state = regularizationState(boundedValue);
      return {
        ...base,
        primary: `ridge weight 10 / (5 + ${formatNumber(boundedValue)}) = ${formatNumber(state.weight)}`,
        secondary: `train MSE ${formatNumber(state.trainingLoss)}; mean fold MSE ${formatNumber(state.meanFoldLoss)}`,
        explanation:
          "The authored x = [1, 2], y = [2, 4] data and two leave-one-out folds stay fixed. Lambda alone enlarges each ridge denominator.",
        metrics: {
          penalty: boundedValue,
          numerator: 10,
          squaredInputSum: 5,
          weight: state.weight,
          trainingLoss: state.trainingLoss,
          meanFoldLoss: state.meanFoldLoss,
          foldCount: 2,
        },
      };
    }
    case "ensemble-votes": {
      const learnerCount = 10;
      const individualVariance = 1;
      const ensembleVariance =
        individualVariance *
        (boundedValue + (1 - boundedValue) / learnerCount);
      return {
        ...base,
        primary: `pairwise correlation ${formatNumber(boundedValue)}`,
        secondary: `variance of 10-model mean ${formatNumber(ensembleVariance)}`,
        explanation:
          "Ten learners and unit individual error variance stay fixed. Only pairwise error correlation changes the variance left after averaging.",
        metrics: {
          correlation: boundedValue,
          learnerCount,
          individualVariance,
          ensembleVariance,
          ensembleStandardDeviation: Math.sqrt(ensembleVariance),
        },
      };
    }
    case "xor-hidden-space": {
      const state = xorState(boundedValue);
      return {
        ...base,
        primary: `scores [${state.scores.map((score) => formatNumber(score)).join(", ")}]`,
        secondary: `targets [${state.targets.join(", ")}]; predictions [${state.predictions.join(", ")}]`,
        explanation:
          "All four XOR cases interpolate from pass-through coordinates to the authored ReLU difference features. Targets remain immutable while the h1 + h2 predictions change.",
        metrics: {
          strength: boundedValue,
          caseCount: XOR_CASES.length,
          hidden00: state.hidden[0],
          hidden10: state.hidden[1],
          hidden01: state.hidden[2],
          hidden11: state.hidden[3],
          scores: state.scores,
          targets: state.targets,
          predictions: state.predictions,
          threshold: 0.5,
        },
      };
    }
    case "backprop-graph": {
      const state = backpropState(boundedValue);
      return {
        ...base,
        primary: `w ${formatNumber(state.weight)} gives prediction ${formatNumber(state.prediction)} and loss ${formatNumber(state.loss)}`,
        secondary: `path gradients ${formatNumber(state.productContribution)} + ${formatNumber(state.squareContribution)} = ${formatNumber(state.totalGradient)}`,
        explanation:
          "The same w feeds w*x and w^2. Reverse mode multiplies along each route, then adds both contributions where the routes return to w.",
        metrics: {
          input: state.input,
          weight: state.weight,
          bias: state.bias,
          target: state.target,
          productBranch: state.productBranch,
          squareBranch: state.squareBranch,
          prediction: state.prediction,
          residual: state.residual,
          loss: state.loss,
          productLocalDerivative: state.productLocalDerivative,
          squareLocalDerivative: state.squareLocalDerivative,
          productContribution: state.productContribution,
          squareContribution: state.squareContribution,
          totalGradient: state.totalGradient,
          biasGradient: state.biasGradient,
        },
      };
    }
    case "optimizer-traces": {
      const trace = optimizerTrace(boundedValue);
      const explanation =
        trace.regime === "convergent oscillation"
          ? "Each update crosses the minimum, but the error multiplier has magnitude below 1, so the oscillation shrinks and converges."
          : trace.regime === "divergent oscillation"
            ? "Each update crosses the minimum and the error multiplier has magnitude above 1, so the oscillation grows and is genuinely unstable."
            : trace.regime === "non-convergent oscillation"
              ? "Each update reflects the error across the minimum without shrinking it, so the trace oscillates but does not converge."
              : "The error remains on one side of the minimum and shrinks on every update.";
      return {
        ...base,
        primary: `${trace.regime}: weight after 12 steps ${formatNumber(trace.weight, 6)}`,
        secondary: `distance to minimum ${formatNumber(trace.finalDistanceToMinimum, 6)}; batch loss ${formatNumber(trace.loss, 6)}`,
        explanation:
          `${explanation} Initialization 0, targets [1, 3], batch order, squared-error objective, and plain SGD remain fixed.`,
        metrics: {
          learningRate: boundedValue,
          initialWeight: 0,
          targetMean: trace.minimum,
          steps: 12,
          finalWeight: trace.weight,
          finalLoss: trace.loss,
          crossedMinimum: trace.crossedMinimum ? 1 : 0,
          errorMultiplier: trace.errorMultiplier,
          stabilityRegime: trace.regime,
          stable: trace.stable ? 1 : 0,
          initialDistanceToMinimum:
            trace.initialDistanceToMinimum,
          finalDistanceToMinimum: trace.finalDistanceToMinimum,
          weightTrace: trace.weights,
        },
      };
    }
    case "cluster-project": {
      const state = clusterState(boundedValue);
      const flatCentroids = state.centroids.flat();
      return {
        ...base,
        primary: `centroids (${formatNumber(flatCentroids[0])}, ${formatNumber(flatCentroids[1])}) and (${formatNumber(flatCentroids[2])}, ${formatNumber(flatCentroids[3])})`,
        secondary: `first principal direction ${formatNumber(state.principalAngle, 1)} degrees`,
        explanation:
          "The four authored rows, two initial centroids, assignments step, and PCA definition stay fixed. Only the second coordinate is rescaled before both computations.",
        metrics: {
          secondCoordinateScale: boundedValue,
          pointCount: CLUSTER_POINTS.length,
          scaledPoints: state.points.flat(),
          assignments: state.assignments,
          centroidZero: state.centroids[0],
          centroidOne: state.centroids[1],
          dataCenter: state.center,
          principalAngleDegrees: state.principalAngle,
        },
      };
    }
    case "convolution-field": {
      const state = convolutionState(boundedValue);
      return {
        ...base,
        primary: `output [${state.outputs.map((output) => formatNumber(output)).join(", ")}]`,
        secondary: `peak activation ${formatNumber(state.peakActivation)} at output ${state.peakPosition}`,
        explanation:
          "The 2 x 2 kernel, stride 1, valid padding, and pattern values stay fixed. Translating the pattern moves the matching response without changing the shared weights.",
        metrics: {
          patternPosition: Math.round(boundedValue),
          kernelValues: CONVOLUTION_KERNEL.flat(),
          outputValues: state.outputs,
          peakPosition: state.peakPosition,
          peakActivation: state.peakActivation,
          stride: 1,
          padding: 0,
        },
      };
    }
    case "attention-routing": {
      const state = attentionState(boundedValue);
      return {
        ...base,
        primary: `weights [${formatNumber(state.otherWeight)}, ${formatNumber(state.selectedWeight)}]`,
        secondary: `2w0 + 10w1 = ${formatNumber(state.output)}`,
        explanation:
          "The other allowed score stays zero and values stay [2, 10]. One softmax normalizes both scores to weights summing exactly to one.",
        metrics: {
          selectedScore: boundedValue,
          otherScore: 0,
          otherWeight: state.otherWeight,
          selectedWeight: state.selectedWeight,
          weightSum: state.weightSum,
          valueZero: 2,
          valueOne: 10,
          output: state.output,
        },
      };
    }
    case "q-learning": {
      const reward = 2;
      const discount = 0.9;
      const currentQ = 1;
      const learningRate = 0.5;
      const nonterminalTarget =
        reward + discount * boundedValue;
      const terminalTarget = reward;
      const updatedQ =
        currentQ +
        learningRate * (nonterminalTarget - currentQ);
      return {
        ...base,
        primary: `target 2 + 0.9 x ${formatNumber(boundedValue)} = ${formatNumber(nonterminalTarget)}`,
        secondary: `Q update 1 -> ${formatNumber(updatedQ)}; terminal target 2`,
        explanation:
          "Reward 2, discount 0.9, current Q = 1, learning rate 0.5, and the transition remain fixed. Only the continuing next-state estimate changes.",
        metrics: {
          bestNextQ: boundedValue,
          reward,
          discount,
          currentQ,
          learningRate,
          nonterminalTarget,
          terminalTarget,
          updatedQ,
        },
      };
    }
    case "shift-monitor": {
      const dayFalseNegativeRate =
        CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate;
      const nightFalseNegativeRate =
        CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate;
      const totalActualPositiveSupport =
        CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport;
      const nightActualPositiveSupport =
        boundedValue * totalActualPositiveSupport;
      const dayActualPositiveSupport =
        totalActualPositiveSupport -
        nightActualPositiveSupport;
      const dayFalseNegatives =
        dayActualPositiveSupport * dayFalseNegativeRate;
      const nightFalseNegatives =
        nightActualPositiveSupport * nightFalseNegativeRate;
      const falseNegatives =
        dayFalseNegatives + nightFalseNegatives;
      const aggregateFalseNegativeRate =
        falseNegatives / totalActualPositiveSupport;
      return {
        ...base,
        primary: `${formatNumber(falseNegatives, 1)} / ${formatNumber(totalActualPositiveSupport)} actual positives -> aggregate FNR ${formatNumber(aggregateFalseNegativeRate * 100, 1)}%`,
        secondary: `day ${formatNumber(dayFalseNegativeRate * 100)}%; night ${formatNumber(nightFalseNegativeRate * 100)}%; gap ${formatNumber((nightFalseNegativeRate - dayFalseNegativeRate) * 100)} points`,
        explanation: `The cohort stays fixed at ${formatNumber(totalActualPositiveSupport)} actual positives. The control reallocates that positive support between day and night, and aggregate FNR is total false negatives divided by total actual positives; it does not represent overall parcel share.`,
        metrics: {
          nightShareAmongActualPositives: boundedValue,
          dayShareAmongActualPositives: 1 - boundedValue,
          nightShare: boundedValue,
          dayShare: 1 - boundedValue,
          totalActualPositiveSupport,
          dayActualPositiveSupport,
          nightActualPositiveSupport,
          dayFalseNegativeRate,
          nightFalseNegativeRate,
          dayFalseNegatives,
          nightFalseNegatives,
          falseNegatives,
          falseNegativeRateGap:
            nightFalseNegativeRate - dayFalseNegativeRate,
          aggregateFalseNegativeRate,
        },
      };
    }
    default:
      return {
        ...base,
        primary: `${formatNumber(normalized * 100)}% intervention`,
        secondary:
          normalized < 0.5 ? "near baseline" : "counterfactual",
        explanation:
          "The authored intervention changes one control while preserving the rest of the experiment state.",
        metrics: { normalized },
      };
  }
}
