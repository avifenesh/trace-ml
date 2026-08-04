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
    durationMinutes: 60,
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
    teaching: {
      title: "Trace the quantities that machine learning reuses",
      introduction: [
        "Machine learning starts with recorded examples. An example is one case, such as one delivery or one sensor reading. A feature is a measured input about that case, and a target is the value or category to be predicted. Tracing matters because a plausible final number can hide a wrong array dimension, a swapped plot axis, or an arithmetic mistake.",
        "An array is an ordered collection of values. Its shape lists the length of each axis: a 4 by 3 array has four rows and three columns. In a typical data table, rows hold examples and columns hold features. A batch is a group of examples processed together. An array operation may combine one axis while preserving another. If x and prediction are separate one-dimensional arrays, NumPy's column_stack((x, prediction)) turns them into a two-dimensional table: x becomes column zero and prediction becomes column one.",
        "A slope measures how much one quantity changes when another changes. A derivative is the slope at a particular input. The notation dy/dx means the derivative of output y with respect to input x. This lesson uses two derivative rules: if y = u squared, then dy/du = 2u; if u = 2x + 1, then du/dx = 2. When one calculation feeds another, the chain rule multiplies those adjacent local derivatives. Probability supplies a different trace: a base rate is an observed fraction, and a majority-class baseline is the accuracy obtained by always predicting the most frequent target category.",
      ],
      vocabulary: [
        {
          term: "Program state",
          definition:
            "The current values held by variables at a specific point while a program runs.",
        },
        {
          term: "NumPy array",
          definition:
            "An ordered, multidimensional collection of values whose axis lengths are reported by its shape.",
        },
        {
          term: "Shape",
          definition:
            "The ordered list of axis lengths, such as 4 by 3 for four rows and three columns.",
        },
        {
          term: "Derivative",
          definition:
            "The local rate at which one quantity changes with respect to another quantity.",
        },
        {
          term: "Derivative notation",
          definition:
            "In dy/dx, the numerator names the changing output y and the denominator names the input x whose change is being considered.",
        },
        {
          term: "Chain rule",
          definition:
            "The rule that multiplies adjacent local derivatives when one function is composed with another.",
        },
        {
          term: "Majority-class baseline",
          definition:
            "The accuracy of a rule that always predicts the most frequent target category and uses no features.",
        },
      ],
      workedExample: {
        title: "Trace shape, slope, and probability without skipping steps",
        setup:
          "A batch contains four examples with three features each. A separate plotting table contains three x-y points. The function uses u = 2x + 1 and y = u squared at x = 1. A dataset with two target categories has 80 negative and 20 positive targets.",
        steps: [
          {
            label: "Write the batch shape",
            explanation:
              "Four examples form the row axis and three features form the column axis, so the batch shape is 4 by 3.",
          },
          {
            label: "Trace the matrix result",
            explanation:
              "Multiplying the batch by three weights combines each row's three feature values with the three weights. The feature axis is consumed, while the four-example axis remains, producing four scores.",
          },
          {
            label: "Map the plot columns",
            explanation:
              "A 3 by 2 plotting table contains three rows and two values per row. NumPy's column_stack((x, prediction)) constructs that layout from two one-dimensional arrays: column zero supplies three x coordinates and column one supplies the matching three y coordinates.",
          },
          {
            label: "Evaluate the composed function",
            explanation:
              "At x = 1, the inner value is u = 2(1) + 1 = 3. The outer derivative is 2u = 6, and the inner derivative is 2.",
          },
          {
            label: "Multiply the local derivatives",
            explanation:
              "The chain rule gives dy/dx = (dy/du)(du/dx) = 6 times 2 = 12. Each factor belongs to one adjacent calculation.",
          },
          {
            label: "Compute the baseline",
            explanation:
              "There are 100 targets in total. Always predicting the negative class is correct for 80 of them, so the majority-class baseline is 80/100 = 0.80, or 80 percent.",
          },
        ],
        takeaway:
          "A trustworthy result exposes which axis remains, which local slopes multiply, and which count produced a probability.",
      },
      misconceptions: [
        {
          misconception: "A 4 by 3 array contains only three examples.",
          correction:
            "Shape is ordered. Under the lesson's row-by-example convention, the first axis has four examples and the second has three features.",
        },
        {
          misconception: "The derivative of a composed function is just the outer derivative.",
          correction:
            "The outer rate describes change with respect to the intermediate value u. Multiply it by the inner rate to obtain change with respect to x.",
        },
        {
          misconception: "An 80 percent baseline means a model learned useful features.",
          correction:
            "The majority rule ignores every feature. It is a comparison floor created only by the 80-to-20 target counts.",
        },
      ],
      summary: [
        "Track array axes in order and state which axis an operation combines or preserves.",
        "For a composition, evaluate the intermediate value and multiply the adjacent local derivatives.",
        "Derive a majority baseline from class counts before judging a model's accuracy.",
      ],
      sourceIds: ["S43", "S48", "S58", "S76", "S85"],
    },
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
          "In NumPy, shape reports axis lengths in order. Given one-dimensional x and prediction arrays, np.column_stack((x, prediction)) makes each input a column, producing one (x, prediction) row per observation. A plotting table with shape 3 by 2 therefore has three points; transposing it to 2 by 3 swaps the meaning of rows and columns.",
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
        "For y = (3x - 2)^2, what is dy/dx at x = 2?",
        [
          { id: "8", label: "8" },
          { id: "12", label: "12" },
          { id: "24", label: "24" },
          { id: "48", label: "48" },
        ],
        "24",
        "Correct. The inner value is 3(2) - 2 = 4, the outer slope is 2(4) = 8, and the inner slope is 3, so the product is 24.",
        "Compute u = 3x - 2 first, then multiply dy/du by du/dx.",
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
        "Predict the centered list, the NumPy input shape, and the three plotted points before running. First inspect the working COLUMN_STACK_EXAMPLE: each one-dimensional input becomes one column. Then inspect the malformed 2 by 3 plotting table, identify which axis holds observations, and modify only line_points to apply the demonstrated operation. Check the repaired 3 by 2 table.",
        `import numpy as np


def center(values):
    average = sum(values) / len(values)
    return [value - average for value in values]


# Two one-dimensional arrays become two columns and one row per position.
COLUMN_STACK_EXAMPLE = np.column_stack((
    np.array([0.0, 1.0]),
    np.array([10.0, 11.0]),
))


def line_points(inputs, weight, bias):
    x = np.asarray(inputs, dtype=float)
    prediction = weight * x + bias
    # REPAIR: each row must be one (x, prediction) point.
    return np.vstack((x, prediction))


INPUTS = np.array([0.0, 1.0, 2.0])
PLOT_POINTS = line_points(INPUTS, weight=2.0, bias=1.0)

print("centered:", center([1.0, 2.0, 3.0]))
print("column-stack example:", COLUMN_STACK_EXAMPLE.tolist())
print("input shape:", INPUTS.shape)
print("plot table shape:", PLOT_POINTS.shape)
print("rows interpreted as (x, y):", PLOT_POINTS.tolist())
`,
        [
          {
            id: "00-code-python-state",
            label: "The function centers every value around the shared mean",
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
    durationMinutes: 50,
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
    teaching: {
      title: "Give every quantity one job and one time of availability",
      introduction: [
        "Supervised learning uses recorded examples for which an outcome is known. An example is one row describing one case. A feature is an input available for that case, while a target is the outcome the model is asked to predict. The model produces a prediction, which is its estimate of the target. These names are not interchangeable: they describe when a value is available and what role it plays.",
        "Training is the stage that uses recorded feature-target pairs to fit a rule. A parameter is an adjustable number stored in that rule, and fitting means choosing parameter values from training evidence. Inference is the later stage that applies the fitted rule to the features of a new case. The new target is not available during inference; it becomes known only after the real outcome occurs. Otherwise, the system would be reading the answer instead of predicting it.",
        "A baseline is a simple comparison rule that the fitted model should improve upon. For a numeric target, one baseline predicts the mean, which is the sum of the training targets divided by their count. This baseline ignores all features. It matters because a complicated model can produce numbers without extracting useful information. Comparing against an explicit no-feature rule asks whether learning from features actually helped.",
      ],
      vocabulary: [
        {
          term: "Example",
          definition:
            "One recorded case containing feature values and, during training, a known target.",
        },
        {
          term: "Feature",
          definition:
            "An input value available when the model must make a prediction.",
        },
        {
          term: "Target",
          definition:
            "The outcome that training observes and inference attempts to predict before it is known.",
        },
        {
          term: "Parameter",
          definition:
            "An adjustable number stored in the model and fitted from training examples.",
        },
        {
          term: "Training and inference",
          definition:
            "Training fits parameters from known examples; inference applies the fixed fitted rule to new features.",
        },
        {
          term: "Mean baseline",
          definition:
            "A no-feature rule that predicts the average training target for every case.",
        },
      ],
      workedExample: {
        title: "Predict delivery time and compare with a no-feature rule",
        setup:
          "Three completed deliveries took 8, 10, and 12 minutes. For a new delivery, distance x is 2. A fitted rule multiplies x by 4 and then adds 4, while the actual target will later be observed as 12 minutes.",
        steps: [
          {
            label: "Assign the data roles",
            explanation:
              "Distance is a feature because it is known before delivery. Elapsed minutes is the target because that is the unknown outcome to predict.",
          },
          {
            label: "Compute the training mean",
            explanation:
              "Add the three known targets: 8 + 10 + 12 = 30. Divide by three examples to obtain the mean 10.",
          },
          {
            label: "State the baseline",
            explanation:
              "The mean baseline predicts 10 minutes for every new delivery. It does not inspect distance or any other feature.",
          },
          {
            label: "Apply the fitted parameters",
            explanation:
              "The fitted rule calculates 4 times x plus 4. For x = 2, its prediction is 4(2) + 4 = 12 minutes.",
          },
          {
            label: "Separate inference from later evaluation",
            explanation:
              "Inference may read x = 2 and the two stored parameters, but not the unknown target. After 12 minutes is observed, the fitted rule's residual is 12 - 12 = 0, while the baseline's residual is 10 - 12 = -2.",
          },
        ],
        takeaway:
          "The feature, target, parameters, and prediction have different roles; the baseline reveals whether using fitted feature information improved the result.",
      },
      misconceptions: [
        {
          misconception: "A target is another feature that inference can read.",
          correction:
            "The target is the unknown outcome. Training has past targets, but inference for a new case must operate before that case's target is known.",
        },
        {
          misconception: "Parameters change whenever the input example changes.",
          correction:
            "Feature values vary across examples. Parameters belong to the fitted rule and change only when a training procedure updates them.",
        },
        {
          misconception: "A baseline is acceptable only when it predicts accurately.",
          correction:
            "Its purpose is comparison. Even a simple mean can expose that a more complex model has failed to gain useful predictive value.",
        },
      ],
      summary: [
        "Features are known inputs, targets are outcomes, and predictions estimate those outcomes.",
        "Training fits model parameters; inference applies the fitted parameters without reading or updating from the new target.",
        "A numeric model should be compared with a mean baseline that uses no features.",
      ],
      sourceIds: ["S66", "S01", "S13"],
    },
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
        "A power-demand model has training targets of 18, 24, and 30 kilowatts. What does the mean baseline predict for every new interval?",
        [
          { id: "18", label: "18 kilowatts" },
          { id: "24", label: "24 kilowatts" },
          { id: "30", label: "30 kilowatts" },
          { id: "unknown", label: "It cannot predict" },
        ],
        "24",
        "Correct. The no-feature mean baseline is (18 + 24 + 30) / 3 = 24 kilowatts.",
        "A mean baseline ignores the new interval and reuses the average training target.",
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
    durationMinutes: 50,
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
    teaching: {
      title: "Read a linear prediction as two visible contributions",
      introduction: [
        "A one-feature linear model predicts a number from one numeric input. The input is written as x. The prediction is written as y_hat, read as 'y-hat,' to distinguish the model's estimate from the observed target y. The rule is y_hat = wx + b: multiply x by the weight w, then add the bias b. Both w and b are parameters fitted during training.",
        "The weight controls how much the prediction changes for a one-unit change in x. This rate is the line's slope. If w = 3, then moving x upward by one changes y_hat by 3 while b remains fixed. The bias is the prediction when x = 0 because wx then equals zero. On a graph, that value is the intercept, the point where the line crosses the vertical prediction axis.",
        "This separation matters because parameter changes do not have identical effects. Adding one to b raises every prediction by one. Adding one to w changes a particular prediction by x, so the effect is positive for positive x, zero at x = 0, and negative for negative x. Tracing multiplication before addition prevents the mistaken shortcut that a larger weight always raises every output.",
      ],
      vocabulary: [
        {
          term: "Linear model",
          definition:
            "A prediction rule whose graph is a straight line for one feature.",
        },
        {
          term: "y_hat",
          definition:
            "The model's predicted value, kept distinct from the observed target y.",
        },
        {
          term: "Weight",
          definition:
            "The parameter w multiplied by x; it gives the prediction change per one unit of input.",
        },
        {
          term: "Bias",
          definition:
            "The parameter b added after multiplication; it equals the prediction at x = 0.",
        },
        {
          term: "Slope",
          definition:
            "The change in the vertical prediction for a one-unit increase in the horizontal input.",
        },
        {
          term: "Intercept",
          definition:
            "The vertical value where the line crosses x = 0, equal to the bias.",
        },
      ],
      workedExample: {
        title: "Trace a signed temperature input through one line",
        setup:
          "A thermostat predicts energy change with y_hat = 1.5x - 2. Here x is degrees relative to a reference temperature, so x can be positive, zero, or negative.",
        steps: [
          {
            label: "Identify both parameters",
            explanation:
              "The weight is w = 1.5, meaning 1.5 units of predicted energy change per degree. The bias is b = -2.",
          },
          {
            label: "Evaluate the reference point",
            explanation:
              "At x = 0, the weighted contribution is 1.5(0) = 0. Therefore y_hat = 0 - 2 = -2, which is the intercept.",
          },
          {
            label: "Evaluate a positive input",
            explanation:
              "At x = 4, multiplication contributes 1.5(4) = 6. Adding the bias gives y_hat = 6 - 2 = 4.",
          },
          {
            label: "Evaluate a negative input",
            explanation:
              "At x = -4, multiplication contributes 1.5(-4) = -6. Adding the bias gives y_hat = -6 - 2 = -8.",
          },
          {
            label: "Change only the weight",
            explanation:
              "If w rises from 1.5 to 2 while x = -4 and b = -2 stay fixed, the prediction becomes 2(-4) - 2 = -10. The larger weight lowers this output because x is negative.",
          },
        ],
        takeaway:
          "The bias shifts every prediction equally, while the weight's effect depends on both its change and the signed input value.",
      },
      misconceptions: [
        {
          misconception: "The weight is the model's prediction.",
          correction:
            "The weight is only one parameter. A prediction also depends on the current input and the bias through y_hat = wx + b.",
        },
        {
          misconception: "Increasing the bias makes the line steeper.",
          correction:
            "Changing b shifts the entire line vertically without changing its slope. Changing w alters the slope.",
        },
        {
          misconception: "A larger positive weight always creates a larger prediction.",
          correction:
            "The prediction change caused by a weight change is multiplied by x. For a negative x, increasing w lowers y_hat.",
        },
      ],
      summary: [
        "Compute y_hat by multiplying x by w and then adding b.",
        "Interpret w as slope and b as the prediction at x = 0.",
        "Use the sign of x before predicting how a weight change will move the output.",
      ],
      sourceIds: ["S67", "S68", "S50"],
    },
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
        "A delivery system predicts minutes relative to schedule as y_hat = -0.8x + 6, where x is hours relative to noon. Interpret the weight and bias, then compute predictions for x = 0 and x = -5 and explain why the two negative factors make the weighted contribution positive.",
        "Map slope and intercept to this signed time input, substitute both x values, and keep multiplication separate from the bias.",
        [
          {
            id: "02-transfer-weight",
            label: "interpret minus 0.8 as predicted minutes per hour",
            keywordGroups: [
              ["-0.8", "minus 0.8"],
              ["per hour", "each hour", "slope", "weight"],
            ],
          },
          {
            id: "02-transfer-bias",
            label: "compute 6 at noon",
            keywordGroups: [
              ["6"],
              ["x = 0", "x=0", "noon", "reference"],
            ],
          },
          {
            id: "02-transfer-negative",
            label: "compute 10 at five hours before noon",
            keywordGroups: [
              ["10"],
              ["-5", "minus 5"],
              ["negative", "positive", "contribution"],
            ],
          },
        ],
        "The line mechanism transfers to a signed time feature with new parameters.",
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
    durationMinutes: 55,
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
    teaching: {
      title: "Build one loss value from every prediction error",
      introduction: [
        "A model needs a numeric way to compare its predictions with known targets. For one example, a residual is prediction minus target. A negative residual means the prediction is below the target; a positive residual means it is above. The residual's magnitude is the size of the miss in target units. Keeping the sign at this stage makes the direction of each error visible.",
        "A loss combines errors into a quantity that a training procedure can compare. Mean squared error, abbreviated MSE, first squares every residual, then adds those squared values, and finally divides by the number of examples. Squaring makes every contribution nonnegative, so misses on opposite sides cannot cancel. It also gives larger residuals disproportionately larger contributions: doubling a residual multiplies its square by four.",
        "For a fixed dataset and fixed MSE definition, each candidate weight and bias produces one loss value. A loss landscape is the mapping from those parameter choices to their losses. A point on this landscape is not a separate observation; it summarizes all row-level squared errors for one parameter setting. This matters because model improvement means moving to parameters with lower loss, not merely making one selected prediction look better.",
      ],
      vocabulary: [
        {
          term: "Residual",
          definition:
            "Prediction minus target for one example; its sign gives direction and its magnitude gives miss size.",
        },
        {
          term: "Squared error",
          definition:
            "A residual multiplied by itself, producing a nonnegative contribution to loss.",
        },
        {
          term: "Mean squared error",
          definition:
            "The sum of all squared residuals divided by the number of examples.",
        },
        {
          term: "Loss",
          definition:
            "A numeric summary used to compare how well parameter choices match known targets.",
        },
        {
          term: "Loss landscape",
          definition:
            "The loss associated with every considered parameter position for fixed data and a fixed loss rule.",
        },
        {
          term: "Outlier",
          definition:
            "An observation with a value or residual far from most others; under MSE, a large residual can contribute strongly.",
        },
      ],
      workedExample: {
        title: "Construct two points on a weight-to-MSE landscape",
        setup:
          "Three fixed examples are (x = 0, target = 1), (x = 1, target = 3), and (x = 2, target = 5). The model is y_hat = wx + 1, so the bias stays fixed at 1 while the candidate weight changes.",
        steps: [
          {
            label: "Predict with weight 1",
            explanation:
              "For x values 0, 1, and 2, the predictions are 1, 2, and 3 because y_hat = 1x + 1.",
          },
          {
            label: "Compute signed residuals",
            explanation:
              "Subtract each target from its prediction: 1 - 1 = 0, 2 - 3 = -1, and 3 - 5 = -2.",
          },
          {
            label: "Square every residual",
            explanation:
              "The squared errors are 0 squared = 0, (-1) squared = 1, and (-2) squared = 4. The negative signs no longer permit cancellation.",
          },
          {
            label: "Average the squares",
            explanation:
              "Add 0 + 1 + 4 = 5 and divide by three examples. The MSE is 5/3, approximately 1.667, at weight 1.",
          },
          {
            label: "Evaluate weight 2",
            explanation:
              "With y_hat = 2x + 1, the predictions are 1, 3, and 5. Every residual and squared error is zero, so MSE is zero.",
          },
          {
            label: "Place both landscape points",
            explanation:
              "The fixed data and bias therefore map weight 1 to MSE 1.667 and weight 2 to MSE 0. These are two points on the same weight-to-loss landscape.",
          },
        ],
        takeaway:
          "Every landscape point must be reconstructed through predictions, residuals, squared errors, and their mean.",
      },
      misconceptions: [
        {
          misconception: "Residuals should be averaged before they are squared.",
          correction:
            "MSE squares each residual first. Averaging signed residuals first lets positive and negative misses cancel.",
        },
        {
          misconception: "A residual of -4 is a smaller error than a residual of +2.",
          correction:
            "The sign gives direction, not quality. Their magnitudes are 4 and 2, and their squared contributions are 16 and 4.",
        },
        {
          misconception: "A large MSE proves an unusual row should be deleted.",
          correction:
            "MSE reveals strong influence from a large residual. Deletion requires separate evidence about measurement, scope, or the error costs being modeled.",
        },
      ],
      summary: [
        "Compute each residual as prediction minus target and interpret its sign before squaring.",
        "MSE squares every residual and then averages, preventing cancellation and emphasizing large misses.",
        "A parameter setting identifies one loss-landscape point only after all examples contribute.",
      ],
      sourceIds: ["S55", "S67"],
    },
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
    durationMinutes: 60,
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
    teaching: {
      title: "Turn a local loss slope into a repeated update",
      introduction: [
        "Training seeks parameter values with lower loss. A gradient is a local slope: for one parameter, it measures how loss changes for a small increase in that parameter at its current value. A positive gradient means a small increase is locally uphill, while a negative gradient means a small increase is locally downhill. The word local is essential because the measurement describes the current neighborhood, not every distant parameter value.",
        "Gradient descent updates a parameter in the direction opposite the gradient. Its rule is new parameter = old parameter - learning rate times gradient. The learning rate is a positive number that scales the update distance. The minus sign chooses the downhill direction; the learning rate chooses how far to move. Subtracting a negative gradient therefore increases the parameter, because a negative quantity is being subtracted.",
        "One update does not finish the process. An iteration is one cycle of measuring the gradient, updating the parameter, and recomputing predictions and loss. After the parameter moves, the local slope can change, so the next iteration needs a new gradient. A learning rate that is too large can overshoot a low-loss region, causing loss to alternate or grow even though each step began in the locally correct direction.",
      ],
      vocabulary: [
        {
          term: "Gradient",
          definition:
            "The local slope of loss with respect to a parameter at its current value.",
        },
        {
          term: "Gradient descent",
          definition:
            "A repeated procedure that moves parameters opposite the current gradient.",
        },
        {
          term: "Learning rate",
          definition:
            "The positive multiplier that controls how far a gradient update moves.",
        },
        {
          term: "Iteration",
          definition:
            "One measurement-update-recompute cycle in an optimization procedure.",
        },
        {
          term: "Overshoot",
          definition:
            "A step that crosses a low-loss region because its distance is too large.",
        },
      ],
      workedExample: {
        title: "Follow two gradient updates from the same starting weight",
        setup:
          "The model predicts y_hat = 1 + wx for rows (1, 3), (2, 5), and (3, 7). Its loss is the mean squared residual. It starts at weight w = 0 and uses learning rate 0.05.",
        steps: [
          {
            label: "Derive and average the row gradients",
            explanation:
              "For one row, residual r = 1 + wx - y and dr/dw = x, so the chain rule gives d(r squared)/dw = 2r times x. At w = 0 the three contributions are 2(-2)(1) = -4, 2(-4)(2) = -16, and 2(-6)(3) = -36. Their mean is -56/3 = -18.666667.",
          },
          {
            label: "Read and scale the first direction",
            explanation:
              "The gradient is negative, so increasing the weight is locally downhill. Scale it by the learning rate: 0.05(-18.666667) = -0.933333.",
          },
          {
            label: "Apply the first update",
            explanation:
              "Compute new w = 0 - (-0.933333) = 0.933333. The parameter increases because subtracting a negative amount is addition.",
          },
          {
            label: "Recompute at the new position",
            explanation:
              "At w = 0.933333, predictions and residuals have changed. The new gradient is approximately -9.955556, so reusing -18.666667 would describe the wrong position.",
          },
          {
            label: "Apply the second update",
            explanation:
              "Compute w = 0.933333 - 0.05(-9.955556) = 1.431111. The loss after this second step is approximately 1.510, lower than the previous loss.",
          },
          {
            label: "Interpret the trace",
            explanation:
              "The updates move toward weight 2, where these rows have zero loss. A larger learning rate must be tested by comparing the whole loss trace, because one locally correct direction can still overshoot.",
          },
        ],
        takeaway:
          "Direction comes from the gradient sign, distance comes from the learning rate, and every new position requires a fresh measurement.",
      },
      misconceptions: [
        {
          misconception: "A negative gradient means the parameter should decrease.",
          correction:
            "The gradient points toward increasing loss. Gradient descent uses its opposite, so subtracting a negative gradient increases the parameter.",
        },
        {
          misconception: "The first gradient can be reused for every step.",
          correction:
            "Moving changes predictions, residuals, and the local slope. Recompute the gradient at each new parameter position.",
        },
        {
          misconception: "The correct direction guarantees that the next loss is lower.",
          correction:
            "The direction is only local. An excessive learning rate can cross the low-loss region and land at a worse point.",
        },
      ],
      summary: [
        "Use the gradient sign to identify the locally uphill direction, then move in the opposite direction.",
        "Apply new = old - learning rate times gradient and recompute the gradient after every move.",
        "Diagnose overshoot from a complete loss trace while changing only the learning rate.",
      ],
      sourceIds: ["S54", "S56", "S69"],
    },
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
          "For one row with prediction 1 + wx, target y, and squared residual r squared, r = 1 + wx - y and dr/dw = x. The chain rule gives d(r squared)/dw = 2r x. Mean squared error averages that contribution over all rows.",
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
        "At weight w = 2, the current loss gradient is +4 and the learning rate is 0.25. What is the updated weight after one gradient-descent step?",
        [
          { id: "one", label: "1" },
          { id: "two", label: "2" },
          { id: "three", label: "3" },
          { id: "negative-one", label: "-1" },
        ],
        "one",
        "Correct. Apply w_new = 2 - 0.25(4) = 1.",
        "Substitute the old weight, positive learning rate, and positive gradient into new = old - rate times gradient.",
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
        "Predict: derive 2 * residual * x for one row, average the three row contributions at weight zero, determine the first update, and decide whether learning_rate = 0.5 will be stable. Run the working specimen and inspect its loss trace. Investigate the gradient at each position. Modify only learning_rate to 0.05 and rerun; the checks verify the gradient and the actual displayed trace driven by that learning rate.",
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
    # For one row: d((prediction - target)^2)/dw
    # = 2 * (prediction - target) * d(prediction)/dw
    # = 2 * residual * x. MSE averages those row derivatives.
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
    durationMinutes: 55,
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
    teaching: {
      title: "Protect model decisions with three separate data roles",
      introduction: [
        "Evaluating a model requires data that did not determine the result being evaluated. A data split is a partition of recorded examples into groups with different jobs. The training split fits model parameters. A candidate is one possible fitted model or setting under consideration. The validation split compares candidates and supports development choices. The test split evaluates the frozen choice only after fitting and selection are complete.",
        "Leakage is an information path from data into a decision that the data was supposed to evaluate independently. Test leakage occurs if test values or test results influence fitting, preprocessing, stopping, feature choices, threshold choices, or candidate selection. No gradient needs to read test rows for leakage to occur. If a developer sees a test score and changes the chosen model, that score has entered the development process.",
        "Generalization is performance on cases beyond those used to fit the model. An untouched test result estimates generalization only for cases represented by the same sampling and measurement process. Independence and coverage answer different questions: independence asks whether test information influenced the model, while coverage asks whether the evaluated cases represent the situations named in the claim. A clean test from one factory cannot establish performance at every factory.",
      ],
      vocabulary: [
        {
          term: "Training split",
          definition:
            "The examples used to fit model parameters.",
        },
        {
          term: "Validation split",
          definition:
            "Separate examples used to compare candidates and make development choices.",
        },
        {
          term: "Test split",
          definition:
            "Examples reserved for final evaluation after the model and procedure are frozen.",
        },
        {
          term: "Candidate",
          definition:
            "One model, parameter setting, threshold, or other authored option being compared during selection.",
        },
        {
          term: "Leakage",
          definition:
            "A path by which evaluation information influences fitting or model-development decisions.",
        },
        {
          term: "Generalization",
          definition:
            "Performance on relevant cases that were not used to fit the model.",
        },
      ],
      workedExample: {
        title: "Select with validation, then evaluate once with test data",
        setup:
          "Training targets are 8, 10, and 12. Validation targets are 9 and 13. Test targets are 20 and 22. Three constant-prediction candidates output 10, 11, or 12, and all comparisons use MSE.",
        steps: [
          {
            label: "Fit the training baseline",
            explanation:
              "The training mean is (8 + 10 + 12) / 3 = 10. This fit uses only the training split.",
          },
          {
            label: "Score candidate 10 on validation",
            explanation:
              "Its residuals are 10 - 9 = 1 and 10 - 13 = -3. MSE is (1 squared + (-3) squared) / 2 = 5.",
          },
          {
            label: "Score the other candidates",
            explanation:
              "Candidate 11 has validation MSE ((2 squared) + (-2 squared)) / 2 = 4. Candidate 12 has MSE ((3 squared) + (-1 squared)) / 2 = 5.",
          },
          {
            label: "Freeze the validation choice",
            explanation:
              "Candidate 11 has the lowest validation MSE, so select it and stop changing the model or selection procedure before opening the test result.",
          },
          {
            label: "Evaluate on test once",
            explanation:
              "Candidate 11 has test residuals -9 and -11. Its final test MSE is (81 + 121) / 2 = 101.",
          },
          {
            label: "Expose the leakage alternative",
            explanation:
              "If the candidates were selected by test MSE, candidate 12 would look best with MSE 82. Reporting that same 82 as an untouched test estimate would be invalid because test feedback chose the candidate.",
          },
        ],
        takeaway:
          "A split's role is determined by how its information changes decisions, not by the label attached to the file.",
      },
      misconceptions: [
        {
          misconception: "Test leakage happens only when test rows are used in gradient updates.",
          correction:
            "Any test-informed development choice creates a path into the selected result, including preprocessing, thresholds, stopping, or candidate selection.",
        },
        {
          misconception: "Looking at the test score repeatedly is harmless if the score is not stored.",
          correction:
            "Human decisions can carry the information. Once a test result changes development, those rows no longer provide an untouched final estimate.",
        },
        {
          misconception: "An untouched test result applies to every future population.",
          correction:
            "Untouched data protects against selection feedback. The claim still remains limited to populations, locations, times, and measurements represented by the test process.",
        },
      ],
      summary: [
        "Fit on training data, select among candidates with validation data, and evaluate the frozen choice on test data.",
        "Trace leakage through every decision influenced by test information, not only through parameter updates.",
        "Keep an independent test estimate separate from the coverage limits of the sampled cases.",
      ],
      sourceIds: ["S70", "S53"],
    },
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
        "A team evaluates its frozen pipeline on the test set once, changes the missing-value rule because of that score, and evaluates again on the same test rows. What is true of the second score?",
        [
          { id: "leak", label: "Test feedback entered development, so the score is no longer an untouched estimate" },
          { id: "valid", label: "The score remains untouched because no test row entered a gradient update" },
          { id: "validation", label: "Only the validation set became contaminated" },
        ],
        "leak",
        "Correct. The first test result changed preprocessing, so the repeated score evaluates a test-informed procedure.",
        "Trace whether information from the first test result changed any later development choice, including preprocessing.",
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
    durationMinutes: 60,
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
    teaching: {
      title: "Diagnose capacity with paired training and held-out evidence",
      introduction: [
        "Model capacity is the range of rules a model family can represent. A polynomial combines powers of an input, such as a constant, x, x squared, and higher powers. Its degree is the highest power included. A degree-one polynomial can draw a line; adding squared and higher-power terms allows more varied curves. Greater capacity expands what can be fitted, but it does not guarantee better predictions on new cases.",
        "Training loss measures errors on examples used to fit the model. Held-out loss measures errors on separate examples not used for that fit. Underfitting occurs when the current procedure cannot capture the relevant pattern, often appearing as high training and held-out losses that are both similar. Overfitting occurs when the fitted rule follows details specific to the training sample, appearing as very low training loss with substantially higher held-out loss.",
        "A learning curve is a sequence of training and validation scores obtained by refitting the same procedure across several training-set sizes under one fixed validation protocol. It is not any graph with two loss bars. Learning curves matter because they can show how fit and held-out behavior change as more training examples are used. The test set still remains outside repeated diagnosis and model selection.",
      ],
      vocabulary: [
        {
          term: "Model capacity",
          definition:
            "The set of input-to-prediction rules that a model family can represent.",
        },
        {
          term: "Polynomial degree",
          definition:
            "The highest input power in a polynomial rule; higher degrees permit a wider family of curves.",
        },
        {
          term: "Held-out loss",
          definition:
            "Loss measured on separate examples that were not used to fit the evaluated model.",
        },
        {
          term: "Underfitting",
          definition:
            "Failure to capture the pattern, supported by high, similar training and held-out losses under a fixed protocol.",
        },
        {
          term: "Overfitting",
          definition:
            "Fitting training-sample details that do not transfer, supported by low training loss and much higher held-out loss.",
        },
        {
          term: "Learning curve",
          definition:
            "Training and validation performance measured after refitting across multiple training sizes with one fixed validation protocol.",
        },
      ],
      workedExample: {
        title: "Compare a matching quadratic with a high-degree interpolator",
        setup:
          "Training rows follow y = x squared at x values -2, -1, 0, 1, and 2. Validation rows use x values -1.5, 0.5, and 1.5 with targets 2.25, 0.25, and 2.25.",
        steps: [
          {
            label: "Evaluate the quadratic rule",
            explanation:
              "The degree-two rule y_hat = x squared predicts 4, 1, 0, 1, and 4 on training. Every residual is zero, so training MSE is zero.",
          },
          {
            label: "Check the quadratic on validation",
            explanation:
              "At -1.5, 0.5, and 1.5, x squared gives 2.25, 0.25, and 2.25. Validation MSE is also zero for these authored points.",
          },
          {
            label: "Introduce the higher-capacity rule",
            explanation:
              "Using coefficients in ascending powers [constant, x, x squared, x cubed, x to the fourth, x to the fifth], [0, 8, 1, -10, 0, 2] means y_hat = 8x + x squared - 10x cubed + 2x to the fifth. It also predicts every training target exactly, so its training MSE is zero.",
          },
          {
            label: "Trace one held-out miss",
            explanation:
              "At x = -1.5, the degree-five rule predicts 8.8125 instead of 2.25. Its residual is 6.5625, whose squared contribution is about 43.066.",
          },
          {
            label: "Compare the complete held-out result",
            explanation:
              "Across all three validation rows, the degree-five rule has MSE about 31.348. Equal zero training loss therefore hides very different held-out behavior.",
          },
          {
            label: "State the protocol boundary",
            explanation:
              "This is a capacity comparison on one fixed train-validation split. It is not a learning curve because the models were not refitted across several nested training sizes.",
          },
        ],
        takeaway:
          "Capacity diagnoses require both training and held-out loss, while a learning-curve claim additionally requires repeated fits across controlled training sizes.",
      },
      misconceptions: [
        {
          misconception: "The model with the lowest training loss is automatically best.",
          correction:
            "Training loss shows fit to seen examples. Compare held-out loss to determine whether that fit transfers under the evaluation protocol.",
        },
        {
          misconception: "A high held-out loss always proves overfitting.",
          correction:
            "Use the pair. High training and held-out losses support underfit; low training loss with a large held-out gap supports overfit.",
        },
        {
          misconception: "Two models trained on different data amounts form a learning curve.",
          correction:
            "A valid learning curve uses several training sizes and preserves one validation protocol so the size trend is interpretable.",
        },
      ],
      summary: [
        "Higher polynomial degree expands the family of representable curves but does not guarantee lower held-out loss.",
        "Diagnose underfit or overfit from training loss, held-out loss, and the gap between them.",
        "Reserve the term learning curve for repeated fits across multiple training sizes under one fixed evaluation protocol.",
      ],
      sourceIds: ["S71", "S72", "S10"],
    },
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
