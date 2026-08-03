import {
  COURSE_REVISION,
  PREREQUISITE_TRACE_REVISION,
  interactive,
  pythonLab,
  reading,
  responseActivity,
  videoAndReading,
} from "./lesson-helpers";
import type {
  Lesson,
  PredictionActivity,
  VisualLabActivity,
} from "./types";
import type { ConceptId } from "../learning/types";

function choicePrediction(
  id: string,
  conceptIds: ConceptId[],
  prompt: string,
  options: Array<{ id: string; label: string }>,
  correctOptionId: string,
  supportedExplanation: string,
  revisitExplanation: string,
): PredictionActivity {
  return {
    id,
    kind: "prediction",
    conceptIds,
    evidenceKind: "prediction",
    renderer: "choice",
    checkpoint: {
      id,
      prompt,
      options,
      correctOptionId,
      supportedExplanation,
      revisitExplanation,
    },
  };
}

function visualLab(
  id: string,
  conceptIds: ConceptId[],
  title: string,
  prompt: string,
  invariant: string,
  intervention: string,
  control: VisualLabActivity["control"],
  evidenceConceptIds?: ConceptId[],
): VisualLabActivity {
  return {
    id,
    kind: "visual-lab",
    labId: id as VisualLabActivity["labId"],
    conceptIds,
    ...(evidenceConceptIds ? { evidenceConceptIds } : {}),
    evidenceKind: "manipulation",
    title,
    prompt,
    invariant,
    intervention,
    control,
  };
}

export const foundationLessons: Lesson[] = [
  {
    id: "prerequisite-trace",
    number: "00",
    moduleId: "foundations",
    phase: "observe",
    published: true,
    title: "Trace the tools before the model",
    question:
      "Can you trace Python state, array shape, plot axes, slope, and probability without guessing?",
    summary:
      "Use a compact diagnostic and repair lab for Python, NumPy, plot coordinates, the chain rule, and a probability baseline.",
    durationMinutes: 32,
    revision: PREREQUISITE_TRACE_REVISION,
    sourceIds: ["S43", "S48", "S58", "S76", "S85"],
    mechanism: {
      input:
        "A short Python function, a NumPy array, plot coordinates, a composed scalar function, and a class frequency.",
      process:
        "Trace program state and dimensions, map columns to axes, multiply local derivatives, and convert counts into a base rate.",
      output:
        "Verified array and plot shapes, a derivative, and a probability baseline with visible arithmetic.",
    },
    starterQuestions: [
      "Which dimensions survive a matrix operation?",
      "How do array rows become x-y coordinates on a plot?",
      "Where does each factor in a chain-rule derivative come from?",
    ],
    prerequisiteConceptIds: [],
    outcomes: [
      {
        id: "00-shape-outcome",
        conceptId: "array-shape",
        text: "Trace the output shape of a batch-by-feature matrix operation.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "00-code-outcome",
        conceptId: "numpy-array",
        text: "Repair a Python/NumPy specimen and map array columns to plot axes.",
        requiredEvidenceKinds: ["code-check"],
      },
      {
        id: "00-chain-outcome",
        conceptId: "slope-chain-rule",
        text: "Multiply local derivatives through a composed function.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "00-probability-outcome",
        conceptId: "probability-baseline",
        text: "Compute and interpret a majority-class baseline.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
    ],
    blocks: [
      {
        id: "00-diagnostic-contract",
        kind: "opening",
        heading: "This is a trace, not a placement exam",
        sourceIds: ["S43", "S48", "S58", "S85"],
        body: [
          "Machine-learning mechanisms repeatedly reuse three tools: array dimensions, rates of change, and probabilities. The diagnostic asks you to expose the intermediate quantities instead of recognizing a final answer.",
          "A correct result with no trace is fragile evidence. Keep dimensions beside arrays, name each local derivative, and write the count behind every probability.",
        ],
        conceptIds: [
          "array-shape",
          "slope-chain-rule",
          "probability-baseline",
        ],
        tags: ["diagnostic", "trace", "dimensions", "derivative", "base rate"],
      },
      {
        id: "00-shapes",
        kind: "worked-example",
        heading: "Shapes describe which axes can interact",
        sourceIds: ["S58"],
        body: [
          "A batch X with shape 4 by 3 contains four examples and three features per example. Multiplying X by a weight vector with three entries combines the feature axis and leaves one score per example, so the result has shape 4.",
          "The operation is valid because the three feature positions align with the three weights. The batch axis is not summed away.",
          "In NumPy, shape reports axis lengths in order. A plotting table with shape 3 by 2 can store three observations as rows: column zero supplies x coordinates and column one supplies y coordinates. Transposing it to 2 by 3 swaps the meaning of rows and columns.",
        ],
        conceptIds: ["python-state", "numpy-array", "plot-axes", "array-shape"],
        tags: [
          "Python",
          "NumPy",
          "batch",
          "feature",
          "matrix",
          "vector",
          "shape",
          "plot axes",
        ],
      },
      {
        id: "00-chain-rule",
        kind: "worked-example",
        heading: "A composed change has two local factors",
        sourceIds: ["S85"],
        body: [
          "Let u = 2x + 1 and y = u squared. At x = 1, u = 3. The outer derivative dy/du is 2u = 6 and the inner derivative du/dx is 2.",
          "The chain rule multiplies those local rates: dy/dx = 6 times 2 = 12. Each factor answers how one adjacent quantity changes.",
        ],
        conceptIds: ["slope-chain-rule"],
        tags: ["chain rule", "local derivative", "composition", "slope"],
      },
      {
        id: "00-base-rate",
        kind: "definition",
        heading: "A baseline states the performance floor",
        sourceIds: ["S48", "S76"],
        body: [
          "Classes are the possible target-label categories. In this binary example, 80 of 100 recorded cases are negative and the other 20 are positive. Always predicting the negative majority is therefore correct 80 percent of the time, and that majority baseline uses no features.",
          "A model that scores 75 percent on those same kinds of cases has not beaten the simplest available rule, even if 75 percent sounds high in isolation.",
        ],
        conceptIds: ["probability-baseline"],
        tags: ["probability", "frequency", "majority class", "baseline"],
      },
    ],
    activities: [
      choicePrediction(
        "00-chain-prediction",
        ["slope-chain-rule"],
        "For y = (2x + 1)^2, what is dy/dx at x = 1?",
        [
          { id: "6", label: "6" },
          { id: "12", label: "12" },
          { id: "18", label: "18" },
          { id: "36", label: "36" },
        ],
        "12",
        "Correct. The outer slope is 2(3) = 6 and the inner slope is 2, so the product is 12.",
        "Compute u = 2x + 1 first, then multiply dy/du by du/dx.",
      ),
      visualLab(
        "prerequisite-trace",
        ["array-shape", "slope-chain-rule", "probability-baseline"],
        "Keep three traces synchronized",
        "Move x through the composed function while its forward values, array dimensions, and class counts remain visible. Record the shape, both derivative factors, and majority baseline.",
        "The array layout and function stay fixed, as do the two target-label counts: 80 negative cases and 20 positive cases.",
        "Change only x and inspect how u, the outer slope, and the final derivative change.",
        {
          label: "Input x",
          min: -2,
          max: 3,
          step: 1,
          initial: 1,
          lowLabel: "-2",
          highLabel: "3",
        },
        ["slope-chain-rule"],
      ),
      responseActivity(
        "00-mechanism-explanation",
        "explanation",
        ["array-shape", "slope-chain-rule", "probability-baseline"],
        "Explain why a 4 by 3 batch times three weights produces four scores, why the derivative at x = 1 is 12, and why 80 percent is the relevant baseline.",
        "Name the preserved axis, both local derivative factors, and the majority count.",
        [
          {
            id: "00-preserved-batch",
            label: "preserve four examples while combining three features",
            keywordGroups: [
              ["four", "4"],
              ["example", "batch"],
              ["three", "3", "feature", "weight"],
            ],
          },
          {
            id: "00-chain-factors",
            label: "multiply the outer factor 6 by the inner factor 2",
            keywordGroups: [
              ["6", "outer"],
              ["2", "inner"],
              ["multiply", "product", "12"],
            ],
          },
          {
            id: "00-majority-count",
            label: "derive the baseline from 80 of 100 cases",
            keywordGroups: [
              ["80"],
              ["100", "percent", "%"],
              ["majority", "negative", "baseline"],
            ],
          },
        ],
        "The trace connects each answer to the operation that produced it.",
        "Show what is combined, what is preserved, and which two adjacent derivatives multiply.",
      ),
      responseActivity(
        "00-sensor-transfer",
        "transfer",
        ["array-shape", "slope-chain-rule", "probability-baseline"],
        "A sensor system receives 12 windows with 5 measurements each, averages the five measurements in each window into one scalar t, computes z = 3t - 2 and score = z^2, and has 90 normal versus 10 fault records. State the score-vector shape, dscore/dt at t = 2, and the accuracy of an always-normal baseline.",
        "Reduce each window to one t, map windows to the preserved axis, trace both derivative factors, and use the observed class counts.",
        [
          {
            id: "00-transfer-shape",
            label: "produce one score for each of 12 windows",
            keywordGroups: [
              ["12"],
              ["score", "output", "vector", "shape"],
            ],
          },
          {
            id: "00-transfer-derivative",
            label: "compute 24 from 2z times 3 at t equals 2",
            keywordGroups: [
              ["24"],
              ["2z", "outer", "8"],
              ["3", "inner"],
            ],
          },
          {
            id: "00-transfer-baseline",
            label: "compute the 90 percent always-normal baseline",
            keywordGroups: [
              ["90"],
              ["percent", "%", "100"],
              ["normal", "baseline"],
            ],
          },
        ],
        "You transferred all three traces to new quantities and labels.",
        "Do not reuse the earlier numbers. Recompute the preserved axis, z at t = 2, and the new majority count.",
      ),
      pythonLab(
        "00-python-numpy-plot",
        ["python-state", "numpy-array", "plot-axes", "array-shape"],
        "array_plot_trace.py",
        "Predict the centered list, the NumPy input shape, and the three plotted points before running. Run the working Python function and inspect the malformed 2 by 3 plotting table. Investigate which axis now holds observations. Modify only line_points so it stacks x and prediction as columns, then check the repaired 3 by 2 table.",
        `import numpy as np


def center(values):
    average = sum(values) / len(values)
    return [value - average for value in values]


def line_points(inputs, weight, bias):
    x = np.asarray(inputs, dtype=float)
    prediction = weight * x + bias
    # REPAIR: each row must be one (x, prediction) point.
    return np.vstack((x, prediction))


INPUTS = np.array([0.0, 1.0, 2.0])
PLOT_POINTS = line_points(INPUTS, weight=2.0, bias=1.0)

print("centered:", center([1.0, 2.0, 3.0]))
print("input shape:", INPUTS.shape)
print("plot table shape:", PLOT_POINTS.shape)
print("rows interpreted as (x, y):", PLOT_POINTS.tolist())
`,
        [
          {
            id: "00-code-python-state",
            label: "The Python function exposes its intermediate mean",
            expression: "str(center([1.0, 2.0, 3.0]))",
            expected: "[-1.0, 0.0, 1.0]",
            conceptIds: ["python-state"],
          },
          {
            id: "00-code-numpy-shape",
            label: "The one-dimensional input has three positions",
            expression: "str(INPUTS.shape)",
            expected: "(3,)",
            conceptIds: ["numpy-array", "array-shape"],
          },
          {
            id: "00-code-plot-shape",
            label: "Three observations occupy rows and x-y values occupy columns",
            expression: "str(PLOT_POINTS.shape)",
            expected: "(3, 2)",
            conceptIds: ["numpy-array", "plot-axes", "array-shape"],
          },
          {
            id: "00-code-plot-coordinates",
            label: "The repaired rows contain the authored x-y coordinates",
            expression: "str(PLOT_POINTS.tolist())",
            expected: "[[0.0, 1.0], [1.0, 3.0], [2.0, 5.0]]",
            conceptIds: ["plot-axes"],
          },
          {
            id: "00-code-held-out-coordinates",
            label: "The repair uses held-out inputs, weight, and bias",
            expression:
              "str(line_points(np.array([-1.0, 3.0]), weight=-2.0, bias=0.5).tolist())",
            expected: "[[-1.0, 2.5], [3.0, -5.5]]",
            conceptIds: ["numpy-array", "plot-axes", "array-shape"],
          },
        ],
        100,
        ["numpy"],
      ),
    ],
    resources: [
      interactive(
        "00-seeing-probability",
        "Seeing Theory: Basic Probability",
        "Brown University",
        "https://seeing-theory.brown.edu/basic-probability/index.html",
        12,
        "00-sensor-transfer",
        "Explore only after completing the local count-based probability transfer.",
        "S48",
        "math-refresh",
      ),
      reading(
        "00-numpy-arrays",
        "What is NumPy?",
        "NumPy",
        "https://numpy.org/doc/2.4/user/whatisnumpy.html",
        5,
        "00-python-numpy-plot",
        "Read after repairing the local array-to-plot trace; this is context for later vector code, not evidence for this lesson.",
        "S58",
        "extension",
      ),
    ],
  },
  {
    id: "data-and-baseline",
    number: "01",
    moduleId: "foundations",
    phase: "observe",
    published: true,
    title: "Data gives each quantity a role",
    question: "What changes during training, and what exists at prediction time?",
    summary:
      "Separate features, targets, predictions, parameters, training, inference, and a baseline.",
    durationMinutes: 26,
    revision: COURSE_REVISION,
    sourceIds: ["S66", "S01", "S13"],
    mechanism: {
      input: "Recorded examples with features and targets.",
      process:
        "Fit parameters from training examples, then apply the fixed fitted rule to features at inference.",
      output: "Predictions compared with an explicit no-feature baseline.",
    },
    starterQuestions: [
      "Which values exist when a new prediction is requested?",
      "Which values can training change?",
      "What simple prediction must the fitted model beat?",
    ],
    prerequisiteConceptIds: ["probability-baseline"],
    outcomes: [
      {
        id: "01-data-role-outcome",
        conceptId: "data-role",
        text: "Distinguish features, targets, and predictions by when they are available.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "01-training-outcome",
        conceptId: "training-versus-inference",
        text: "Separate parameter fitting from applying a fitted model.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "01-baseline-outcome",
        conceptId: "baseline",
        text: "Compute a mean baseline for a numeric target.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
    ],
    blocks: [
      {
        id: "01-row-contract",
        kind: "opening",
        heading: "A recorded row contains evidence, not instructions",
        sourceIds: ["S66"],
        body: [
          "For a completed delivery, distance and package mass can be features, while elapsed minutes is the target. The target is the outcome the prediction is meant to approximate.",
          "At inference time for a new delivery, the features are available but the target is not. If elapsed minutes were already known, there would be nothing to predict.",
        ],
        conceptIds: ["data-role", "prediction-contract"],
        tags: ["feature", "target", "prediction", "availability"],
      },
      {
        id: "01-parameters",
        kind: "definition",
        heading: "Parameters belong to the reusable rule",
        sourceIds: ["S66"],
        body: [
          "A parameter is an adjustable number carried by the model across examples. Training uses feature-target pairs to choose parameter values.",
          "An input changes when the example changes. A parameter changes when training updates the rule.",
        ],
        conceptIds: ["data-role", "parameter-update"],
        tags: ["input", "parameter", "training", "update"],
      },
      {
        id: "01-training-inference",
        kind: "worked-example",
        heading: "Training and inference run different contracts",
        sourceIds: ["S66"],
        body: [
          "During training, the system predicts on recorded examples, compares predictions with targets, and updates parameters. During inference, it receives new features and uses the fitted parameters without reading a target or updating the rule.",
          "The same model structure can participate in both stages, but only training changes its fitted state.",
        ],
        conceptIds: ["training-versus-inference", "parameter-update"],
        tags: ["fit", "training", "inference", "state"],
      },
      {
        id: "01-mean-baseline",
        kind: "worked-example",
        heading: "Start comparison with the mean",
        sourceIds: ["S13"],
        body: [
          "For training targets 8, 10, and 12 minutes, the mean is 10. A mean baseline predicts 10 for every delivery and ignores all features.",
          "A learned regression rule earns its complexity only if its evaluation loss improves on that baseline for untouched cases.",
        ],
        conceptIds: ["baseline", "probability-baseline"],
        tags: ["mean", "baseline", "regression", "comparison"],
      },
    ],
    activities: [
      choicePrediction(
        "01-mean-prediction",
        ["baseline"],
        "Training targets are 8, 10, and 12 minutes. What does the mean baseline predict for every new case?",
        [
          { id: "8", label: "8 minutes" },
          { id: "10", label: "10 minutes" },
          { id: "12", label: "12 minutes" },
          { id: "unknown", label: "It cannot predict" },
        ],
        "10",
        "Correct. The no-feature mean baseline is (8 + 10 + 12) / 3 = 10.",
        "A mean baseline ignores the new case and reuses the average training target.",
      ),
      visualLab(
        "data-and-baseline",
        ["data-role", "parameter-update", "training-versus-inference", "baseline"],
        "Compare one fixed rule with the mean baseline",
        "Predict the output, then move one fitted weight while the feature, bias, target, and mean baseline stay fixed.",
        "The recorded row x = 2, bias 4, target 12, and mean baseline 10 remain fixed.",
        "Change only the fitted weight; compare its prediction and residual with the fixed target and baseline.",
        {
          label: "Fitted parameter",
          min: 0,
          max: 4,
          step: 0.5,
          initial: 1,
          lowLabel: "0",
          highLabel: "4",
        },
        ["parameter-update", "baseline"],
      ),
      responseActivity(
        "01-role-explanation",
        "explanation",
        ["data-role", "parameter-update", "training-versus-inference", "baseline"],
        "Explain why a target may guide a parameter update during training but must be absent during inference, and why the mean prediction is a baseline rather than a learned feature rule.",
        "Use availability time, parameter state, and feature use in your explanation.",
        [
          {
            id: "01-target-training",
            label: "use targets after predictions to evaluate training examples",
            keywordGroups: [
              ["target"],
              ["training"],
              ["compare", "error", "loss", "after prediction"],
            ],
          },
          {
            id: "01-inference-no-target",
            label: "exclude the unknown target at inference",
            keywordGroups: [
              ["inference", "new case", "prediction time"],
              ["target"],
              ["unknown", "absent", "not available"],
            ],
          },
          {
            id: "01-parameter-update",
            label: "change parameters only during fitting",
            keywordGroups: [
              ["parameter"],
              ["update", "change", "fit"],
              ["training"],
            ],
          },
          {
            id: "01-baseline-no-features",
            label: "state that the mean baseline ignores features",
            keywordGroups: [
              ["mean", "baseline"],
              ["ignore", "without", "no"],
              ["feature", "input"],
            ],
          },
        ],
        "You separated the data roles, the two execution stages, and the comparison floor.",
        "Anchor each value to when it is available and state whether it can change the model.",
      ),
      responseActivity(
        "01-energy-transfer",
        "transfer",
        ["data-role", "training-versus-inference", "baseline"],
        "A building model predicts tomorrow's electricity use from forecast temperature and occupancy. Historical use values average 240 kWh. Identify features, target, what training changes, what inference may read, and the baseline prediction.",
        "Map the delivery roles to this new domain without changing their timing.",
        [
          {
            id: "01-transfer-features",
            label: "identify forecast temperature and occupancy as features",
            keywordGroups: [
              ["temperature"],
              ["occupancy"],
              ["feature", "input"],
            ],
          },
          {
            id: "01-transfer-target",
            label: "identify actual electricity use as the target",
            keywordGroups: [
              ["electricity", "use", "kWh"],
              ["target", "actual", "observed"],
            ],
          },
          {
            id: "01-transfer-stages",
            label: "fit parameters on history but do not update from tomorrow's unknown use",
            keywordGroups: [
              ["parameter", "fit", "training"],
              ["inference", "tomorrow", "prediction"],
              ["unknown", "not available", "does not update"],
            ],
          },
          {
            id: "01-transfer-baseline",
            label: "state the 240 kWh mean baseline",
            keywordGroups: [
              ["240"],
              ["mean", "average", "baseline"],
            ],
          },
        ],
        "The same role and timing contract now holds for energy demand.",
        "Name what is known before tomorrow, what is observed afterward, and what the no-feature rule predicts.",
      ),
    ],
    resources: [
      reading(
        "01-google-mlcc",
        "Supervised Learning",
        "Google for Developers",
        "https://developers.google.com/machine-learning/intro-to-ml/supervised?hl=en",
        7,
        "01-energy-transfer",
        "Read after the authored role and baseline transfer; use it to compare features, labels, training, and inference without replacing the local evidence.",
        "S66",
        "extension",
      ),
    ],
  },
  {
    id: "linear-model",
    number: "02",
    moduleId: "foundations",
    phase: "model",
    published: true,
    title: "Two parameters draw one line",
    question: "How do weight and bias change a one-feature prediction?",
    summary:
      "Connect y_hat = wx + b across equation, table, and graph views.",
    durationMinutes: 25,
    revision: COURSE_REVISION,
    sourceIds: ["S67", "S68", "S50"],
    mechanism: {
      input: "One numeric feature x and current parameters w and b.",
      process: "Multiply x by w, then add b.",
      output: "A prediction y_hat and a line across possible x values.",
    },
    starterQuestions: [
      "What does the bias change when x is zero?",
      "What does the weight change between neighboring x values?",
      "When does increasing the weight lower rather than raise a prediction?",
    ],
    prerequisiteConceptIds: [
      "data-role",
      "prediction-contract",
      "parameter-update",
    ],
    outcomes: [
      {
        id: "02-parameter-outcome",
        conceptId: "linear-parameters",
        text: "Trace weight and bias through a one-feature prediction.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "02-contract-outcome",
        conceptId: "prediction-contract",
        text: "Keep the feature separate from the two fitted parameters.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
    ],
    blocks: [
      {
        id: "02-visible-rule",
        kind: "opening",
        heading: "The complete model fits on one line",
        sourceIds: ["S67"],
        body: [
          "A one-feature linear model predicts y_hat = wx + b. The feature x belongs to the case; weight w and bias b belong to the fitted model.",
          "The formula is the prediction mechanism. Training may later choose w and b, but inference only evaluates the formula with their current values.",
        ],
        conceptIds: ["linear-parameters", "prediction-contract"],
        tags: ["linear model", "feature", "weight", "bias", "prediction"],
      },
      {
        id: "02-bias",
        kind: "worked-example",
        heading: "Bias sets the prediction at zero",
        sourceIds: ["S67", "S68"],
        body: [
          "With w = 3 and b = 4, an input x = 0 produces y_hat = 4. Changing b shifts every prediction by the same amount.",
          "On a graph, b is where the line crosses the vertical prediction axis.",
        ],
        conceptIds: ["linear-parameters"],
        tags: ["bias", "intercept", "vertical shift", "x equals zero"],
      },
      {
        id: "02-weight",
        kind: "worked-example",
        heading: "Weight sets change per input unit",
        sourceIds: ["S67", "S68"],
        body: [
          "With w = 3, increasing x by one increases y_hat by three while b stays fixed. The weight is therefore the line's slope.",
          "At x = 5, w = 3 and b = 4 give y_hat = 19. The multiplication contributes 15 and the bias contributes 4.",
        ],
        conceptIds: ["linear-parameters"],
        tags: ["weight", "slope", "rate", "contribution"],
      },
      {
        id: "02-sign-boundary",
        kind: "reading",
        heading: "The sign of x matters",
        sourceIds: ["S68"],
        body: [
          "Increasing w raises y_hat when x is positive, changes nothing at x = 0, and lowers y_hat when x is negative. A weight does not have one output direction independent of the input.",
          "This boundary condition prevents the shortcut that a larger weight always means a larger prediction.",
        ],
        conceptIds: ["linear-parameters"],
        tags: ["negative input", "boundary condition", "direction", "sign"],
      },
    ],
    activities: [
      choicePrediction(
        "02-weight-prediction",
        ["linear-parameters"],
        "Hold b = 4 and x = 5 fixed. If w increases from 3 to 4, how does y_hat change?",
        [
          { id: "minus-five", label: "It decreases by 5" },
          { id: "plus-one", label: "It increases by 1" },
          { id: "plus-five", label: "It increases by 5" },
          { id: "same", label: "It stays the same" },
        ],
        "plus-five",
        "Correct. The weight change is 1 and it is multiplied by x = 5.",
        "Compare (4)(5) + 4 with (3)(5) + 4 while holding x and b fixed.",
      ),
      visualLab(
        "linear-model",
        ["linear-parameters", "prediction-contract"],
        "Link equation, table, and line",
        "Change the weight while the input cases and bias remain fixed. Compare the before and after prediction for every x, including a negative input and x = 0.",
        "The x values and bias b = 4 remain fixed.",
        "Change only weight w and inspect the corresponding rotation around x = 0.",
        {
          label: "Weight w",
          min: -2,
          max: 5,
          step: 0.5,
          initial: 3,
          lowLabel: "-2",
          highLabel: "5",
        },
        ["linear-parameters"],
      ),
      responseActivity(
        "02-parameter-explanation",
        "explanation",
        ["linear-parameters", "prediction-contract"],
        "Explain how w and b affect y_hat = wx + b, including what happens at x = 0 and why increasing w can lower a prediction for negative x.",
        "Connect each parameter to a geometric and arithmetic effect, then state the sign boundary.",
        [
          {
            id: "02-weight-rate",
            label: "identify weight as change in prediction per input unit",
            keywordGroups: [
              ["weight", "w"],
              ["slope", "per unit", "rate", "change"],
            ],
          },
          {
            id: "02-bias-zero",
            label: "identify bias as the prediction at x equals zero",
            keywordGroups: [
              ["bias", "b"],
              ["x = 0", "x=0", "zero"],
              ["prediction", "intercept"],
            ],
          },
          {
            id: "02-negative-boundary",
            label: "explain the reversed effect at negative x",
            keywordGroups: [
              ["negative"],
              ["x", "input"],
              ["lower", "decrease", "opposite"],
            ],
          },
        ],
        "You linked both parameters to the equation and stated the input-sign boundary.",
        "State which parameter is multiplied by x, which is added, and test the rule at x = 0 and x below zero.",
      ),
      responseActivity(
        "02-thermostat-transfer",
        "transfer",
        ["linear-parameters", "prediction-contract"],
        "A thermostat predicts energy change as y_hat = 1.5x - 2, where x is degrees relative to a reference temperature. Interpret the weight and bias, then compute predictions for x = 0 and x = -4 and explain why the negative input reverses the weight contribution.",
        "Map slope and intercept to this signed input rather than to the earlier distance example.",
        [
          {
            id: "02-transfer-weight",
            label: "interpret 1.5 as energy change per degree",
            keywordGroups: [
              ["1.5"],
              ["per degree", "each degree", "slope", "weight"],
            ],
          },
          {
            id: "02-transfer-bias",
            label: "compute minus 2 at the reference point",
            keywordGroups: [
              ["-2", "minus 2"],
              ["x = 0", "x=0", "reference"],
            ],
          },
          {
            id: "02-transfer-negative",
            label: "compute minus 8 at x equals minus 4",
            keywordGroups: [
              ["-8", "minus 8"],
              ["-4", "minus 4"],
              ["negative", "contribution"],
            ],
          },
        ],
        "The line mechanism transfers to a signed temperature feature.",
        "Substitute each x explicitly before interpreting the direction.",
      ),
    ],
    resources: [
      reading(
        "02-google-linear",
        "Linear regression",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/linear-regression?hl=en",
        4,
        "02-thermostat-transfer",
        "Read after completing the local equation-to-graph transfer and compare its parameter language with the traced thermostat rule.",
        "S67",
        "extension",
      ),
      interactive(
        "02-observable-linear",
        "Interactive Visualization of Linear Regression",
        "Observable notebook by Yizhe Ang",
        "https://observablehq.com/@yizhe-ang/interactive-visualization-of-linear-regression",
        10,
        "02-thermostat-transfer",
        "Explore after local evidence. Treat dragged points as a sensitivity experiment, not permission to alter observations.",
        "S50",
        "extension",
      ),
    ],
  },
  {
    id: "loss-landscape",
    number: "03",
    moduleId: "foundations",
    phase: "model",
    published: true,
    title: "Loss turns many residuals into a surface",
    question: "What exactly becomes smaller when a linear model improves?",
    summary:
      "Trace signed residuals into squared errors, mean squared error, and a parameter-indexed loss landscape.",
    durationMinutes: 32,
    revision: COURSE_REVISION,
    sourceIds: ["S55", "S67"],
    mechanism: {
      input: "Predictions and targets for fixed examples.",
      process:
        "Subtract target from prediction, square each residual, average, and repeat across parameter values.",
      output: "One MSE value at each parameter position on a loss landscape.",
    },
    starterQuestions: [
      "What information does a residual sign preserve?",
      "Why can two opposite residuals not cancel in MSE?",
      "How does one outlier reshape the comparison?",
    ],
    prerequisiteConceptIds: ["linear-parameters", "prediction-contract"],
    outcomes: [
      {
        id: "03-residual-outcome",
        conceptId: "residual",
        text: "Compute and interpret prediction-minus-target residuals.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "03-loss-outcome",
        conceptId: "loss",
        text: "Build MSE from every squared residual.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "03-landscape-outcome",
        conceptId: "loss-landscape",
        text: "Interpret loss as a function of parameter position.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "03-residual",
        kind: "opening",
        heading: "Start with one signed miss",
        sourceIds: ["S55"],
        body: [
          "For one example, residual = prediction - target. A residual of -3 means the prediction is three units below the target; +3 means it is three units above.",
          "The sign preserves direction. Its magnitude preserves the size of the miss in target units.",
        ],
        conceptIds: ["residual"],
        tags: ["residual", "prediction", "target", "sign", "magnitude"],
      },
      {
        id: "03-mse",
        kind: "worked-example",
        heading: "Square first, then average",
        sourceIds: ["S55"],
        body: [
          "Residuals -1 and +3 would average to 1, hiding part of the error through cancellation. Their squared values are 1 and 9, so MSE is (1 + 9) / 2 = 5.",
          "Squaring makes every contribution nonnegative and gives a residual twice as large four times the squared contribution.",
        ],
        conceptIds: ["residual", "loss"],
        tags: ["squared error", "mean", "cancellation", "MSE"],
      },
      {
        id: "03-landscape",
        kind: "definition",
        heading: "A landscape indexes loss by parameters",
        sourceIds: ["S55", "S67"],
        body: [
          "Hold the examples and loss definition fixed. For each candidate weight and bias, compute all predictions and one MSE. Those parameter-to-loss values form a loss landscape.",
          "The landscape is not physical terrain. It is a graph of the objective produced by a particular dataset, model, and loss.",
        ],
        conceptIds: ["loss", "loss-landscape"],
        tags: ["objective", "parameter", "surface", "landscape"],
      },
      {
        id: "03-outlier",
        kind: "reading",
        heading: "A large residual can dominate MSE",
        sourceIds: ["S55"],
        body: [
          "Changing one target so its residual grows from 2 to 10 changes its squared contribution from 4 to 100. The row count is unchanged, but that example now has much more influence on MSE.",
          "This is a property of the chosen loss, not proof that the row should be deleted. First investigate measurement, scope, and the cost represented by large misses.",
        ],
        conceptIds: ["residual", "loss", "loss-landscape"],
        tags: ["outlier", "sensitivity", "squared loss", "influence"],
      },
    ],
    activities: [
      choicePrediction(
        "03-outlier-prediction",
        ["residual", "loss"],
        "One residual grows from 2 to 10 while all others stay fixed. By what factor does that row's squared-error contribution grow?",
        [
          { id: "2", label: "2 times" },
          { id: "5", label: "5 times" },
          { id: "10", label: "10 times" },
          { id: "25", label: "25 times" },
        ],
        "25",
        "Correct. The contribution changes from 2^2 = 4 to 10^2 = 100, and 100 / 4 = 25.",
        "Compare squared contributions, not raw residual magnitudes.",
      ),
      visualLab(
        "loss-landscape",
        ["residual", "loss", "loss-landscape"],
        "Trace every row into one loss value",
        "Move the weight while targets, bias, and examples remain fixed. Compare each residual and square before locating the resulting MSE on the landscape.",
        "The examples, targets, bias, and MSE definition remain fixed.",
        "Change only weight w and inspect how every residual contributes to the new MSE.",
        {
          label: "Weight w",
          min: -1,
          max: 4,
          step: 0.25,
          initial: 1,
          lowLabel: "-1",
          highLabel: "4",
        },
        ["residual", "loss", "loss-landscape"],
      ),
      responseActivity(
        "03-loss-explanation",
        "explanation",
        ["residual", "loss", "loss-landscape"],
        "Explain how fixed examples and one candidate weight produce a point on the MSE landscape, and why a large residual can dominate that point without canceling against an opposite residual.",
        "Trace prediction to residual to square to mean, then connect the mean to the parameter position.",
        [
          {
            id: "03-residual-chain",
            label: "subtract target from prediction for each row",
            keywordGroups: [
              ["prediction"],
              ["target"],
              ["subtract", "minus", "difference", "residual"],
            ],
          },
          {
            id: "03-square-mean",
            label: "square every residual before averaging",
            keywordGroups: [
              ["square", "squared"],
              ["average", "mean"],
              ["each", "every", "rows", "examples"],
            ],
          },
          {
            id: "03-no-cancel",
            label: "explain why opposite signs cannot cancel",
            keywordGroups: [
              ["sign", "positive", "negative", "opposite"],
              ["cannot cancel", "nonnegative", "square"],
            ],
          },
          {
            id: "03-parameter-index",
            label: "associate the resulting MSE with the candidate parameters",
            keywordGroups: [
              ["MSE", "loss"],
              ["weight", "parameter"],
              ["point", "landscape", "surface"],
            ],
          },
        ],
        "You reconstructed one landscape point from row-level errors and the loss definition.",
        "Do not jump from parameter to loss. Name each intermediate quantity and operation.",
      ),
      responseActivity(
        "03-calibration-transfer",
        "transfer",
        ["residual", "loss", "loss-landscape"],
        "A scale calibration model predicts grams from voltage. Three residuals are -1, +1, and +8 grams. A calibration audit then corrects the third recorded target, changing that residual to +2 at the same parameter setting while the other two rows stay fixed. Compute both MSE values, interpret the +8 sign, and explain why the corrected target defines a new dataset and therefore a new loss landscape.",
        "Use the new units, show both MSE calculations, and distinguish a new dataset and landscape from movement within one fixed landscape.",
        [
          {
            id: "03-transfer-mse",
            label: "compute the original MSE as 22",
            keywordGroups: [
              ["22"],
              ["1", "64"],
              ["MSE", "mean", "average"],
            ],
          },
          {
            id: "03-transfer-sign",
            label: "interpret plus 8 as prediction above target",
            keywordGroups: [
              ["8", "+8"],
              ["above", "over", "higher"],
              ["target", "actual"],
            ],
          },
          {
            id: "03-transfer-corrected",
            label: "compute corrected MSE as 2 and identify a new dataset and landscape",
            keywordGroups: [
              ["2"],
              ["target", "dataset", "data"],
              ["new", "different"],
              ["landscape", "loss", "MSE"],
            ],
          },
        ],
        "You distinguished a lower MSE at the same parameters on a corrected dataset from movement within the original landscape.",
        "Square all three residuals before and after the correction, divide each sum by three, and name why changing a target changes the dataset-defined landscape.",
      ),
      pythonLab(
        "03-python-loss",
        ["residual", "loss", "loss-landscape"],
        "loss_trace.py",
        "Predict: calculate the MSE at trial_weight = 1.0 before running. Run the working specimen. Investigate every residual and squared contribution. Modify only trial_weight to 2.0, rerun, and explain why the loss reaches zero. The checks also verify the outlier calculation.",
        `POINTS = [
    (0.0, 1.0),
    (1.0, 3.0),
    (2.0, 5.0),
]


def predict(x, weight, bias):
    return weight * x + bias


def residuals(rows, weight, bias):
    return [predict(x, weight, bias) - target for x, target in rows]


def mean_squared_error(rows, weight, bias):
    errors = residuals(rows, weight, bias)
    return sum(error ** 2 for error in errors) / len(errors)


trial_weight = 1.0  # Modify to 2.0 after the first run.
bias = 1.0

print("residuals:", residuals(POINTS, trial_weight, bias))
print("mse:", mean_squared_error(POINTS, trial_weight, bias))
`,
        [
          {
            id: "03-code-residuals",
            label: "Signed residuals remain visible",
            expression: "str(residuals(POINTS, 1.0, 1.0))",
            expected: "[0.0, -1.0, -2.0]",
            conceptIds: ["residual"],
          },
          {
            id: "03-code-mse",
            label: "MSE averages all squared residuals",
            expression: "round(mean_squared_error(POINTS, 1.0, 1.0), 6)",
            expected: 1.666667,
            conceptIds: ["loss"],
          },
          {
            id: "03-code-modification",
            label: "The modified weight reaches the landscape minimum",
            expression:
              "trial_weight == 2.0 and mean_squared_error(POINTS, trial_weight, bias) == 0.0",
            expected: true,
            conceptIds: ["loss-landscape"],
          },
          {
            id: "03-code-outlier",
            label: "A target of 20 contributes the verified outlier loss",
            expression:
              "round(mean_squared_error(POINTS + [(3.0, 20.0)], 2.0, 1.0), 6)",
            expected: 42.25,
            conceptIds: ["loss", "residual"],
          },
        ],
        303,
      ),
    ],
    resources: [
      reading(
        "03-google-loss",
        "Linear Regression: Loss",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/linear-regression/loss?hl=en",
        10,
        "03-python-loss",
        "Read after the local residual trace and code modification.",
        "S55",
        "extension",
      ),
      interactive(
        "03-parameters-exercise",
        "Linear regression: Parameters exercise",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/linear-regression/parameters-exercise?hl=en",
        5,
        "03-python-loss",
        "Use the interactive only after tracing the local residuals and repairing the code specimen.",
        "S68",
        "extension",
      ),
    ],
  },
  {
    id: "gradient-descent",
    number: "04",
    moduleId: "learning",
    phase: "learn",
    published: true,
    title: "Gradient descent follows repeated local measurements",
    question: "How does a slope become a parameter update?",
    summary:
      "Predict a descent direction, execute the update equation, and diagnose a learning rate that overshoots.",
    durationMinutes: 34,
    revision: COURSE_REVISION,
    sourceIds: ["S54", "S56", "S69"],
    mechanism: {
      input: "Current parameters, a differentiable loss, and a learning rate.",
      process:
        "Measure the local gradient, move in the opposite direction, and recompute at the new position.",
      output: "A parameter and loss trace across repeated updates.",
    },
    starterQuestions: [
      "What does the sign of a gradient say locally?",
      "Why must the gradient be recomputed after an update?",
      "How can the correct direction still produce a worse step?",
    ],
    prerequisiteConceptIds: ["slope-chain-rule", "loss", "loss-landscape"],
    outcomes: [
      {
        id: "04-direction-outcome",
        conceptId: "gradient-direction",
        text: "Use the gradient sign to choose a local descent direction.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "04-descent-outcome",
        conceptId: "gradient-descent",
        text: "Execute and recompute a repeated parameter update.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "04-rate-outcome",
        conceptId: "learning-rate",
        text: "Diagnose overshoot caused by excessive step size.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "04-local-slope",
        kind: "opening",
        heading: "The gradient describes the current neighborhood",
        sourceIds: ["S56"],
        body: [
          "For one parameter, the gradient is the slope of loss with respect to that parameter at its current value. A positive gradient means a small parameter increase raises loss; a negative gradient means it lowers loss.",
          "This is local evidence. It does not describe every distant part of the landscape.",
        ],
        conceptIds: ["gradient-direction", "loss-landscape"],
        tags: ["gradient", "slope", "local", "direction"],
      },
      {
        id: "04-update",
        kind: "definition",
        heading: "Subtract the measured slope",
        sourceIds: ["S56", "S69"],
        body: [
          "Gradient descent applies parameter_new = parameter_old - learning_rate times gradient. The minus sign reverses the uphill direction reported by the gradient.",
          "The learning rate scales the move without changing the measured gradient itself.",
        ],
        conceptIds: ["gradient-direction", "gradient-descent", "learning-rate"],
        tags: ["update equation", "minus gradient", "learning rate"],
      },
      {
        id: "04-recompute",
        kind: "worked-example",
        heading: "Every new position needs a new measurement",
        sourceIds: ["S56", "S69"],
        body: [
          "If weight is 0, gradient is -18.666667, and learning rate is 0.05, one update gives 0 - 0.05(-18.666667) = 0.933333.",
          "Predictions and residuals change at weight 0.933333, so the next update must use a newly computed gradient there.",
        ],
        conceptIds: ["gradient-descent", "gradient-direction"],
        tags: ["recompute", "iteration", "weight", "trace"],
      },
      {
        id: "04-overshoot",
        kind: "reading",
        heading: "Direction and distance are separate",
        sourceIds: ["S69"],
        body: [
          "A step can begin in the downhill direction and still cross the low-loss region. Repeated oversized steps can oscillate or diverge.",
          "To test this diagnosis, keep data, initialization, model, and loss fixed, reduce only the learning rate, and compare complete traces.",
        ],
        conceptIds: ["learning-rate", "gradient-descent"],
        tags: ["overshoot", "oscillation", "controlled comparison", "trace"],
      },
    ],
    activities: [
      choicePrediction(
        "04-direction-prediction",
        ["gradient-direction", "gradient-descent"],
        "At the current weight, the loss gradient is -6. Which update direction is locally downhill?",
        [
          { id: "decrease", label: "Decrease the weight" },
          { id: "increase", label: "Increase the weight" },
          { id: "none", label: "Do not change the weight" },
        ],
        "increase",
        "Correct. Subtracting a negative gradient increases the parameter.",
        "The gradient points uphill. Apply the minus sign in the update equation.",
      ),
      visualLab(
        "gradient-descent",
        ["gradient-direction", "gradient-descent", "learning-rate"],
        "Compare descent traces from one start",
        "Run repeated updates from the same initial weight. Change only the learning rate and compare position, local gradient, and loss after every step.",
        "The data, model, loss, initial weight, iteration count, and seed remain fixed.",
        "Change only the learning rate to compare slow, stable, and overshooting paths.",
        {
          label: "Learning rate",
          min: 0.01,
          max: 0.5,
          step: 0.01,
          initial: 0.05,
          lowLabel: "0.01",
          highLabel: "0.50",
        },
      ),
      responseActivity(
        "04-descent-explanation",
        "explanation",
        ["gradient-direction", "gradient-descent", "learning-rate"],
        "Explain why subtracting a negative gradient increases the parameter, why the next gradient must be recomputed, and how a large learning rate can raise loss despite using the correct local direction.",
        "Separate sign, new position, and step distance.",
        [
          {
            id: "04-negative-sign",
            label: "reverse a negative gradient into a positive parameter move",
            keywordGroups: [
              ["negative", "minus"],
              ["gradient"],
              ["increase", "positive", "opposite"],
            ],
          },
          {
            id: "04-new-gradient",
            label: "recompute after predictions and residuals change",
            keywordGroups: [
              ["recompute", "new", "again"],
              ["gradient"],
              ["prediction", "residual", "position", "parameter"],
            ],
          },
          {
            id: "04-overshoot-cause",
            label: "connect a large learning rate to crossing the low-loss region",
            keywordGroups: [
              ["learning rate", "step size"],
              ["large", "too high"],
              ["overshoot", "cross", "oscillate", "diverge"],
            ],
          },
        ],
        "You separated the measured direction from the distance moved and the next measurement.",
        "Use the update equation once, then state which quantities changed before the second update.",
      ),
      responseActivity(
        "04-valve-transfer",
        "transfer",
        ["gradient-direction", "gradient-descent", "learning-rate"],
        "A controller tunes a valve coefficient. At coefficient 4.0 the loss gradient is +8.0. Compute one update with learning rate 0.1, then explain what a trace alternating between coefficients 3.2 and 4.8 would test and which single variable you would change first.",
        "Map the same local update to a physical coefficient and preserve the controlled comparison.",
        [
          {
            id: "04-transfer-update",
            label: "compute the new coefficient as 3.2",
            keywordGroups: [
              ["3.2"],
              ["4", "4.0"],
              ["0.1", "8"],
            ],
          },
          {
            id: "04-transfer-oscillation",
            label: "diagnose repeated overshoot from the alternating trace",
            keywordGroups: [
              ["alternate", "oscillat", "overshoot"],
              ["3.2", "4.8"],
            ],
          },
          {
            id: "04-transfer-control",
            label: "reduce only the learning rate first",
            keywordGroups: [
              ["reduce", "lower", "smaller"],
              ["learning rate", "step size"],
              ["only", "hold", "fixed", "same"],
            ],
          },
        ],
        "The update and controlled overshoot diagnosis transfer to the valve coefficient.",
        "Apply new = old - rate times gradient, then change only the quantity that scales the step.",
      ),
      pythonLab(
        "04-python-descent",
        ["gradient-direction", "gradient-descent", "learning-rate"],
        "descent_trace.py",
        "Predict: determine the first weight update and whether learning_rate = 0.5 will be stable. Run the working specimen and inspect its loss trace. Investigate the gradient at each position. Modify only learning_rate to 0.05 and rerun; the checks verify the gradient and the actual displayed trace driven by that learning rate.",
        `ROWS = [
    (1.0, 3.0),
    (2.0, 5.0),
    (3.0, 7.0),
]


def predict(x, weight, bias=1.0):
    return bias + weight * x


def mean_squared_error(rows, weight):
    return sum((predict(x, weight) - target) ** 2 for x, target in rows) / len(rows)


def weight_gradient(rows, weight):
    return sum(
        2 * (predict(x, weight) - target) * x
        for x, target in rows
    ) / len(rows)


def train(rows, weight, learning_rate, steps):
    history = [mean_squared_error(rows, weight)]
    for _ in range(steps):
        weight = weight - learning_rate * weight_gradient(rows, weight)
        history.append(mean_squared_error(rows, weight))
    return weight, history


learning_rate = 0.5  # Modify to 0.05 after investigating the first trace.
final_weight, loss_history = train(ROWS, 0.0, learning_rate, 12)
print("final weight:", final_weight)
print("loss trace:", loss_history)
`,
        [
          {
            id: "04-code-gradient",
            label: "The initial gradient includes every row",
            expression: "round(weight_gradient(ROWS, 0.0), 6)",
            expected: -18.666667,
            conceptIds: ["gradient-direction"],
          },
          {
            id: "04-code-first-update",
            label: "The selected learning rate drives the first displayed update",
            expression:
              "round(0.0 - learning_rate * weight_gradient(ROWS, 0.0), 6)",
            expected: 0.933333,
            conceptIds: ["gradient-descent", "learning-rate"],
          },
          {
            id: "04-code-rate-change",
            label: "The controlled modification uses the stable learning rate",
            expression: "learning_rate == 0.05",
            expected: true,
            conceptIds: ["learning-rate"],
          },
          {
            id: "04-code-convergence",
            label: "The displayed trace is the complete stable run",
            expression:
              "str((round(final_weight, 6), [round(loss, 6) for loss in loss_history]))",
            expected:
              "(1.998941, [18.666667, 5.30963, 1.510295, 0.429595, 0.122196, 0.034758, 0.009887, 0.002812, 0.0008, 0.000228, 6.5e-05, 1.8e-05, 5e-06])",
            conceptIds: ["gradient-descent", "learning-rate"],
          },
        ],
        404,
      ),
    ],
    resources: [
      videoAndReading(
        "04-google-descent",
        "Gradient Descent",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent?hl=en",
        3,
        "04-python-descent",
        "After producing and repairing the local descent trace, watch the 2:12 embedded video and compare its diagrams with your update history.",
        "S56",
        "extension",
      ),
      interactive(
        "04-gradient-exercise",
        "Linear regression: Gradient descent exercise",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent-exercise?hl=en",
        5,
        "04-python-descent",
        "Use the interactive after repairing the authored update loop; compare direction and step size without treating completion as evidence.",
        "S69",
        "extension",
      ),
    ],
  },
  {
    id: "split-and-leakage",
    number: "05",
    moduleId: "learning",
    phase: "evaluate",
    published: true,
    title: "Three splits protect three decisions",
    question: "How does test information leak into a model choice?",
    summary:
      "Assign training, validation, and test data distinct jobs, then create and repair a controlled selection leak.",
    durationMinutes: 34,
    revision: COURSE_REVISION,
    sourceIds: ["S70", "S53"],
    mechanism: {
      input: "Examples partitioned before fitting or model selection.",
      process:
        "Fit on training data, choose among candidates on validation data, and evaluate the frozen choice once on test data.",
      output: "A final estimate whose test targets did not influence fitting or selection.",
    },
    starterQuestions: [
      "Which split may change fitted parameters?",
      "Which split may choose among authored candidates?",
      "When does an evaluation set stop being independent?",
    ],
    prerequisiteConceptIds: ["baseline", "loss", "gradient-descent"],
    outcomes: [
      {
        id: "05-split-outcome",
        conceptId: "data-split",
        text: "Assign fitting, selection, and final evaluation to separate data.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "05-leakage-outcome",
        conceptId: "leakage",
        text: "Identify and repair test-informed model selection.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "05-generalization-outcome",
        conceptId: "generalization",
        text: "Bound the claim supported by an untouched test result.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
    ],
    blocks: [
      {
        id: "05-three-jobs",
        kind: "opening",
        heading: "Partition before the answer can influence a decision",
        sourceIds: ["S70"],
        body: [
          "Training data fits parameters. Validation data compares model or hyperparameter choices. Test data evaluates the frozen process after fitting and selection are complete.",
          "The labels do not make a split. Its role is defined by how information from it is used.",
        ],
        conceptIds: ["data-split"],
        tags: ["training", "validation", "test", "role"],
      },
      {
        id: "05-selection-loop",
        kind: "worked-example",
        heading: "Validation closes the development loop",
        sourceIds: ["S53", "S70"],
        body: [
          "Fit candidate models on training rows, compare their validation losses, and select one. A validation result can change the next candidate, so it becomes part of development evidence.",
          "After selection, refit only according to the authored procedure and freeze every choice before test evaluation.",
        ],
        conceptIds: ["data-split", "generalization"],
        tags: ["model selection", "validation loss", "freeze", "procedure"],
      },
      {
        id: "05-leakage",
        kind: "definition",
        heading: "Leakage is an information path",
        sourceIds: ["S53", "S70"],
        body: [
          "Test leakage occurs when test features, targets, metrics, or repeated feedback influence fitting, preprocessing, feature choices, stopping, or model selection.",
          "Calling the same rows test data afterward does not restore independence. A new untouched set is required for an honest final estimate.",
        ],
        conceptIds: ["leakage", "data-split"],
        tags: ["leakage", "test peeking", "information path", "independence"],
      },
      {
        id: "05-scope",
        kind: "reading",
        heading: "Untouched does not mean universal",
        sourceIds: ["S53"],
        body: [
          "An untouched test set estimates behavior for cases represented by the same sampling and measurement process. It does not establish behavior for missing locations, users, seasons, or sensors.",
          "Independence protects the estimate from selection bias; coverage limits the situations to which that estimate applies.",
        ],
        conceptIds: ["generalization", "data-split"],
        tags: ["coverage", "sampling", "scope", "distribution"],
      },
    ],
    activities: [
      choicePrediction(
        "05-split-prediction",
        ["data-split", "leakage"],
        "You compare three candidate models using test loss, choose the lowest, and report that same test loss. What happened?",
        [
          { id: "valid", label: "The test remains independent" },
          { id: "leak", label: "Test feedback leaked into selection" },
          { id: "training", label: "The test became training data only if gradients used it" },
        ],
        "leak",
        "Correct. Selection used test feedback, so the reported value is no longer an untouched final estimate.",
        "Leakage includes model choice, not only gradient updates.",
      ),
      visualLab(
        "split-and-leakage",
        ["data-split", "leakage", "generalization"],
        "Open and close the test-information path",
        "Select among fixed candidate predictions first with validation rows, then with test rows. Compare the chosen candidate and mark which decisions consumed each split.",
        "The rows, candidate predictions, loss, and initial training fit remain fixed.",
        "Change only the split used for candidate selection: validation or test.",
        {
          label: "Selection source",
          min: 0,
          max: 1,
          step: 1,
          initial: 0,
          lowLabel: "Validation",
          highLabel: "Test",
        },
      ),
      responseActivity(
        "05-leakage-explanation",
        "explanation",
        ["data-split", "leakage", "generalization"],
        "Explain why choosing a candidate from test loss contaminates the final estimate even when no gradient used test rows, and state the separate jobs of train, validation, and test.",
        "Trace the information path from a metric to a decision.",
        [
          {
            id: "05-train-job",
            label: "fit parameters on training data",
            keywordGroups: [
              ["train", "training"],
              ["fit", "parameter", "learn"],
            ],
          },
          {
            id: "05-validation-job",
            label: "select candidates with validation data",
            keywordGroups: [
              ["validation"],
              ["select", "choose", "compare", "tune"],
            ],
          },
          {
            id: "05-test-job",
            label: "reserve test data for final evaluation",
            keywordGroups: [
              ["test"],
              ["final", "untouched", "once", "evaluate"],
            ],
          },
          {
            id: "05-information-path",
            label: "identify test metric influence on the chosen model",
            keywordGroups: [
              ["test loss", "test metric", "test result"],
              ["influence", "used", "feedback", "choose", "selection"],
              ["leak", "contaminat", "not independent"],
            ],
          },
        ],
        "You identified leakage as decision-relevant information, not merely shared rows.",
        "State what changed after seeing the test metric; that changed decision is the leakage path.",
      ),
      responseActivity(
        "05-factory-transfer",
        "transfer",
        ["data-split", "leakage", "generalization"],
        "A factory trains a defect model on Line A, tunes its threshold by repeatedly checking Line B, then reports the best Line B result as the test score for all factories. Identify each data role, the leakage, the repair, and the remaining coverage limit.",
        "Separate independence from representativeness.",
        [
          {
            id: "05-transfer-roles",
            label: "treat Line A as training and Line B as validation",
            keywordGroups: [
              ["Line A", "A"],
              ["training", "train", "fit"],
              ["Line B", "B", "validation"],
            ],
          },
          {
            id: "05-transfer-leak",
            label: "identify repeated Line B threshold selection as validation use",
            keywordGroups: [
              ["threshold"],
              ["repeated", "best", "tune", "select"],
              ["Line B", "validation", "not test", "leak"],
            ],
          },
          {
            id: "05-transfer-repair",
            label: "require a new untouched final test set",
            keywordGroups: [
              ["new", "separate"],
              ["untouched", "held out"],
              ["test"],
            ],
          },
          {
            id: "05-transfer-scope",
            label: "limit claims beyond represented lines or factories",
            keywordGroups: [
              ["other", "all", "factories", "lines"],
              ["not represented", "coverage", "cannot claim", "distribution"],
            ],
          },
        ],
        "You repaired the information path and kept the deployment claim inside the data coverage.",
        "Rename Line B by how it was used, then introduce data that influenced no decision.",
      ),
      pythonLab(
        "05-python-splits",
        ["data-split", "leakage", "generalization"],
        "split_roles.py",
        "Predict: decide which constant prediction validation will select. Run the nearly working specimen and observe that test rows currently drive selection. Investigate validation and test losses for each candidate. Modify only SELECTION_ROWS to VALIDATION_ROWS, rerun, and explain why the test loss is now evaluation rather than selection feedback.",
        `TRAIN_TARGETS = [8.0, 10.0, 12.0]
VALIDATION_ROWS = [9.0, 13.0]
TEST_ROWS = [20.0, 22.0]
CANDIDATE_PREDICTIONS = [10.0, 11.0, 12.0]


def fit_mean(targets):
    return sum(targets) / len(targets)


def mean_squared_error(targets, prediction):
    return sum((prediction - target) ** 2 for target in targets) / len(targets)


def select_prediction(candidates, validation_targets):
    return min(
        candidates,
        key=lambda prediction: mean_squared_error(validation_targets, prediction),
    )


training_baseline = fit_mean(TRAIN_TARGETS)
SELECTION_ROWS = TEST_ROWS  # Leakage: modify this to VALIDATION_ROWS.
selected_prediction = select_prediction(CANDIDATE_PREDICTIONS, SELECTION_ROWS)

print("training baseline:", training_baseline)
print("selected prediction:", selected_prediction)
print("final test loss:", mean_squared_error(TEST_ROWS, selected_prediction))
`,
        [
          {
            id: "05-code-training",
            label: "Training alone fits the verified mean baseline",
            expression: "fit_mean(TRAIN_TARGETS)",
            expected: 10,
            conceptIds: ["data-split", "baseline"],
          },
          {
            id: "05-code-validation",
            label: "Validation selects the middle candidate",
            expression:
              "select_prediction(CANDIDATE_PREDICTIONS, VALIDATION_ROWS)",
            expected: 11,
            conceptIds: ["data-split"],
          },
          {
            id: "05-code-repair",
            label: "The selection path no longer reads test rows",
            expression:
              "SELECTION_ROWS == VALIDATION_ROWS and selected_prediction == 11.0",
            expected: true,
            conceptIds: ["leakage"],
          },
          {
            id: "05-code-final-test",
            label: "The frozen choice has the verified final test loss",
            expression: "mean_squared_error(TEST_ROWS, 11.0)",
            expected: 101,
            conceptIds: ["generalization", "data-split"],
          },
        ],
        505,
      ),
    ],
    resources: [
      interactive(
        "05-mlu-splits",
        "Train, Test, and Validation Sets",
        "MLU-Explain",
        "https://mlu-explain.github.io/train-test-validation/",
        12,
        "05-python-splits",
        "Explore after repairing the local leak. Repeated selection still makes validation development evidence.",
        "S53",
        "extension",
      ),
      reading(
        "05-google-mlcc",
        "Datasets: Dividing the original dataset",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets?hl=en",
        7,
        "05-python-splits",
        "Read after repairing the local selection leak and compare the page's split roles with the fixed train-validation-test contract.",
        "S70",
        "extension",
      ),
    ],
  },
  {
    id: "capacity-curves",
    number: "06",
    moduleId: "learning",
    phase: "evaluate",
    published: true,
    title: "Capacity changes what a model can fit",
    question:
      "How do fixed train-held-out comparisons separate underfit from overfit?",
    summary:
      "Compare authored polynomial capacities on fixed data states, and keep that evidence distinct from a learning curve.",
    durationMinutes: 35,
    revision: COURSE_REVISION,
    sourceIds: ["S71", "S72", "S10"],
    mechanism: {
      input:
        "Authored polynomial capacities, fixed training rows, and separate held-out rows.",
      process:
        "Compare training and held-out losses across capacities and two explicitly different fitted data states.",
      output:
        "A bounded underfit or overfit diagnosis without claiming a multi-size learning curve.",
    },
    starterQuestions: [
      "What can a higher-degree polynomial represent that a line cannot?",
      "Which train-held-out loss pattern signals a capacity bottleneck?",
      "What would a valid learning-curve protocol hold fixed across training sizes?",
    ],
    prerequisiteConceptIds: [
      "data-split",
      "leakage",
      "generalization",
      "loss-landscape",
    ],
    outcomes: [
      {
        id: "06-capacity-outcome",
        conceptId: "model-capacity",
        text: "Relate polynomial degree to the functions the model can represent.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "06-curves-outcome",
        conceptId: "learning-curves",
        text: "Distinguish the authored capacity comparison from a valid multi-size learning curve.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "06-generalization-outcome",
        conceptId: "generalization",
        text: "Choose a response that matches underfit or overfit evidence.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "06-capacity",
        kind: "opening",
        heading: "Capacity is a set of possible rules",
        sourceIds: ["S71"],
        body: [
          "A linear polynomial can represent straight lines. Adding squared and higher-power terms expands the set of curves the model can fit.",
          "More capacity is not automatically better. It can represent the underlying pattern, but it can also follow sample-specific noise.",
        ],
        conceptIds: ["model-capacity"],
        tags: ["capacity", "polynomial", "degree", "function family"],
      },
      {
        id: "06-underfit",
        kind: "worked-example",
        heading: "High train and validation loss indicate underfit",
        sourceIds: ["S71"],
        body: [
          "If training and held-out loss are both high and close under one fixed evaluation protocol, the current features, model family, or optimization may not capture the pattern.",
          "More observations alone do not repair a rule that cannot represent the relationship. First test one controlled change to capacity, features, objective, or optimization.",
        ],
        conceptIds: ["model-capacity", "learning-curves"],
        tags: ["underfit", "training loss", "validation loss", "bias"],
      },
      {
        id: "06-overfit",
        kind: "worked-example",
        heading: "A persistent gap indicates overfit",
        sourceIds: ["S71"],
        body: [
          "Very low training loss with substantially higher validation loss means the fitted rule captured details that did not transfer to validation cases.",
          "Reducing capacity or constraining the fit can shrink this gap. More representative data is another possible intervention, but this lesson's local code does not test a data-size sequence.",
        ],
        conceptIds: ["model-capacity", "learning-curves", "generalization"],
        tags: ["overfit", "gap", "variance", "representative data"],
      },
      {
        id: "06-data-limit",
        kind: "reading",
        heading: "Two fitted data states are not a learning curve",
        sourceIds: ["S72"],
        body: [
          "The visual compares a five-row fit evaluated on three added rows with an eight-row fit evaluated on a separate probe set. Because both the training rows and held-out rows change, the grouped bars are a capacity comparison, not a learning curve.",
          "A learning curve refits across several nested training sizes while preserving one validation or cross-validation protocol. It can support a data-scaling diagnosis for that fixed pipeline and represented distribution, but it never justifies repeated test inspection.",
        ],
        conceptIds: ["learning-curves", "generalization", "leakage"],
        tags: ["data size", "curve", "plateau", "test independence"],
      },
    ],
    activities: [
      choicePrediction(
        "06-curve-prediction",
        ["model-capacity", "learning-curves", "generalization"],
        "On one fixed train-validation split, a high-degree polynomial has near-zero training loss and much higher validation loss. Which diagnosis is best supported?",
        [
          { id: "underfit", label: "The model is underfitting both sets" },
          { id: "overfit", label: "The model is overfitting a small sample" },
          { id: "leak", label: "The validation targets must have leaked into training" },
          { id: "perfect", label: "The model already generalizes perfectly" },
        ],
        "overfit",
        "Correct. The low training loss and high validation loss support sample-specific overfit under this fixed protocol.",
        "Compare the two losses under the same protocol; do not infer a data-size trend from one pair.",
      ),
      visualLab(
        "capacity-curves",
        ["model-capacity", "learning-curves", "generalization"],
        "Compare polynomial capacity at two authored data states",
        "Change degree, then compare training and held-out MSE from the same deterministic ridge-stabilized least-squares procedure on the authored five-row and eight-row states. Treat the bars as separate capacity comparisons, not a learning curve.",
        "Rows, probe points, raw monomial basis, squared-error loss, lambda = 1e-6 stabilizer, and partial-pivot solver remain fixed.",
        "Change only polynomial degree; each degree is refit separately on the five-row and eight-row training sets.",
        {
          label: "Polynomial degree",
          min: 0,
          max: 9,
          step: 1,
          initial: 2,
          lowLabel: "0",
          highLabel: "9",
        },
      ),
      responseActivity(
        "06-curves-explanation",
        "explanation",
        ["model-capacity", "learning-curves", "generalization"],
        "Explain how train and held-out loss pairs distinguish a capacity bottleneck from sample-specific overfit. Then explain why the two authored data states do not form a learning curve and why slider movement or low training loss alone proves neither diagnosis.",
        "Use both losses and their gap, then name what a multi-size learning-curve protocol would hold fixed.",
        [
          {
            id: "06-underfit-pattern",
            label: "identify high close training and validation losses as underfit evidence",
            keywordGroups: [
              ["training", "train"],
              ["validation"],
              ["high"],
              ["close", "small gap", "both"],
            ],
          },
          {
            id: "06-overfit-pattern",
            label: "identify low train loss and high validation loss as overfit evidence",
            keywordGroups: [
              ["low", "near zero"],
              ["training", "train"],
              ["high", "gap"],
              ["validation", "overfit"],
            ],
          },
          {
            id: "06-protocol-boundary",
            label: "distinguish the two-state comparison from a learning curve",
            keywordGroups: [
              ["five-row", "eight-row", "two states", "training rows"],
              ["validation", "probe", "held-out"],
              ["not a learning curve", "different evaluation", "fixed protocol"],
            ],
          },
          {
            id: "06-not-activity",
            label: "reject control movement or train fit as sufficient evidence",
            keywordGroups: [
              ["slider", "movement", "training loss", "train fit"],
              ["not enough", "does not prove", "alone"],
            ],
          },
        ],
        "You tied each diagnosis to a train-held-out pattern and kept the two-state capacity comparison distinct from a learning curve.",
        "Describe training loss, held-out loss, their gap, and what a valid multi-size protocol would keep fixed.",
      ),
      responseActivity(
        "06-spectrometer-transfer",
        "transfer",
        ["model-capacity", "learning-curves", "generalization"],
        "A spectrometer calibration compares polynomial degrees on one fixed train-validation split. Model A, degree 1, has high similar train and validation errors. Model B, degree 9, has nearly zero train error and high validation error. Diagnose each, prescribe one controlled capacity test for each, and explain why these fits are not a learning curve.",
        "Map each loss pair to a capacity diagnosis, then state the missing multi-size protocol.",
        [
          {
            id: "06-transfer-a",
            label: "diagnose Model A as underfit or otherwise capacity-limited",
            keywordGroups: [
              ["Model A", "A"],
              ["underfit", "capacity", "feature", "optimization"],
              ["high", "similar", "close"],
            ],
          },
          {
            id: "06-transfer-a-test",
            label: "test one added capacity or feature intervention for A",
            keywordGroups: [
              ["increase", "add", "change", "test"],
              ["degree", "capacity", "feature", "optimization"],
              ["hold", "fixed", "controlled", "one"],
            ],
          },
          {
            id: "06-transfer-b",
            label: "diagnose Model B as overfit and test lower capacity",
            keywordGroups: [
              ["Model B", "B"],
              ["overfit", "sample-specific", "variance"],
              ["gap", "validation"],
              ["reduce", "lower", "regularize", "constraint"],
              ["capacity", "degree", "regularization"],
            ],
          },
          {
            id: "06-transfer-protocol",
            label: "deny a learning-curve claim without nested training sizes",
            keywordGroups: [
              ["not a learning curve", "cannot infer", "not enough"],
              ["training size", "nested sizes", "multiple sizes"],
              ["fixed validation", "cross-validation", "same protocol"],
            ],
          },
        ],
        "You matched each calibration failure to capacity evidence, proposed controlled tests, and stated the learning-curve boundary.",
        "Model A cannot fit either split; Model B fits training too specifically. Neither comparison varies training size under one held-out protocol.",
      ),
      {
        ...pythonLab(
        "06-python-capacity",
        ["model-capacity", "learning-curves", "generalization"],
        "capacity_trace.py",
        "Predict: compare train and validation loss for the fixed linear, quadratic, and high-degree specimens. These are hand-authored coefficient fixtures, distinct from the ridge-refitted models in the visual lab. Run the working functions and inspect each pair. Investigate why the high-degree rule matches every training point yet fails between them. Modify only chosen_coefficients from OVERFIT_COEFFICIENTS to QUADRATIC_COEFFICIENTS and rerun. This is a fixed-capacity comparison, not a learning curve.",
        `TRAIN_ROWS = [
    (-2.0, 4.0),
    (-1.0, 1.0),
    (0.0, 0.0),
    (1.0, 1.0),
    (2.0, 4.0),
]
VALIDATION_ROWS = [
    (-1.5, 2.25),
    (0.5, 0.25),
    (1.5, 2.25),
]

LINEAR_COEFFICIENTS = [2.0, 0.0]
QUADRATIC_COEFFICIENTS = [0.0, 0.0, 1.0]
# Authored interpolation specimen; unlike the visual lab, this file does not fit.
OVERFIT_COEFFICIENTS = [0.0, 8.0, 1.0, -10.0, 0.0, 2.0]


def polynomial_predict(x, coefficients):
    return sum(
        coefficient * x ** power
        for power, coefficient in enumerate(coefficients)
    )


def mean_squared_error(rows, coefficients):
    return sum(
        (polynomial_predict(x, coefficients) - target) ** 2
        for x, target in rows
    ) / len(rows)


chosen_coefficients = OVERFIT_COEFFICIENTS  # Modify to QUADRATIC_COEFFICIENTS.

for name, coefficients in [
    ("linear", LINEAR_COEFFICIENTS),
    ("quadratic", QUADRATIC_COEFFICIENTS),
    ("high-degree", OVERFIT_COEFFICIENTS),
]:
    print(
        name,
        "train:", mean_squared_error(TRAIN_ROWS, coefficients),
        "validation:", mean_squared_error(VALIDATION_ROWS, coefficients),
    )
`,
        [
          {
            id: "06-code-linear",
            label: "The fixed low-capacity specimen has verified nonzero errors",
            expression:
              "str((mean_squared_error(TRAIN_ROWS, LINEAR_COEFFICIENTS), mean_squared_error(VALIDATION_ROWS, LINEAR_COEFFICIENTS)))",
            expected: "(2.8, 1.0625)",
            conceptIds: ["model-capacity"],
          },
          {
            id: "06-code-quadratic",
            label: "The matching quadratic transfers to validation points",
            expression:
              "mean_squared_error(TRAIN_ROWS, QUADRATIC_COEFFICIENTS) == 0.0 and mean_squared_error(VALIDATION_ROWS, QUADRATIC_COEFFICIENTS) == 0.0",
            expected: true,
            conceptIds: ["model-capacity", "generalization"],
          },
          {
            id: "06-code-overfit",
            label: "The hand-authored high-degree specimen fits train but fails between points",
            expression:
              "mean_squared_error(TRAIN_ROWS, OVERFIT_COEFFICIENTS) == 0.0 and round(mean_squared_error(VALIDATION_ROWS, OVERFIT_COEFFICIENTS), 6) == 31.347656",
            expected: true,
            conceptIds: ["model-capacity", "generalization"],
          },
          {
            id: "06-code-modification",
            label: "The selected specimen is repaired using validation evidence",
            expression:
              "chosen_coefficients == QUADRATIC_COEFFICIENTS and mean_squared_error(VALIDATION_ROWS, chosen_coefficients) == 0.0",
            expected: true,
            conceptIds: ["model-capacity", "generalization"],
          },
        ],
        606,
        ),
        evidenceConceptIds: ["model-capacity", "generalization"],
      },
    ],
    resources: [
      reading(
        "06-google-mlcc",
        "Overfitting: Model complexity",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/overfitting/model-complexity?hl=en",
        5,
        "06-python-capacity",
        "Read after the authored capacity comparison and compare how complexity changes training and held-out behavior.",
        "S71",
        "extension",
      ),
      reading(
        "06-understanding-deep-learning",
        "Plotting Learning Curves and Checking Models' Scalability",
        "scikit-learn developers",
        "https://scikit-learn.org/1.8/auto_examples/model_selection/plot_learning_curve.html",
        10,
        "06-python-capacity",
        "Inspect this real multi-size learning-curve protocol after the local capacity comparison; do not relabel the authored two-state bars as a curve.",
        "S72",
        "extension",
      ),
    ],
  },
];
