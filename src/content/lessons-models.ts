import {
  lessonRevision,
  interactive,
  pythonLab,
  reading,
  responseActivity,
  video,
  videoAndReading,
} from "./lesson-helpers";
import type { Lesson } from "./types";

export const modelLessons: Lesson[] = [
  {
    id: "logistic-link",
    number: "07",
    moduleId: "models",
    phase: "model",
    published: true,
    title: "A linear score becomes a probability",
    question: "How can a linear model express a binary probability?",
    summary:
      "Trace a feature through a logit and sigmoid, then use log loss to measure a probabilistic prediction.",
    durationMinutes: 50,
    revision: lessonRevision("logistic-link"),
    sourceIds: ["S73", "S74", "S13"],
    teaching: {
      title: "From a weighted score to a modeled probability",
      introduction: [
        "Binary classification means choosing between two possible target classes, such as failure and no failure. A feature is an input measurement, a weight says how strongly that feature contributes, and a bias is an adjustable starting value. Logistic regression first combines them exactly as a linear model does: multiply each feature by its weight, add those products, and add the bias.",
        "That result is called the logit. In logistic regression, the logit is also the log-odds of the target class. If its probability is p, the other class has probability 1 - p, the odds are p / (1 - p), and the log-odds are z = ln(p / (1 - p)). Odds compare the target class with the other class: p = 0.75 gives odds 0.75 / 0.25 = 3, read as three to one.",
        "A logit can be any real number, so it is not itself a probability. The sigmoid p = 1 / (1 + exp(-z)) converts log-odds z to a probability, while z = ln(p / (1 - p)) converts that probability back to log-odds. The two transformations are inverses. A zero logit maps to 0.5, positive logits map above 0.5, and negative logits map below 0.5. Because sigmoid preserves order, it changes the scale without changing which example has the larger score.",
        "Training needs a loss that judges the probability against what actually happened. The natural logarithm ln reverses exp: exp(ln(a)) = a for positive a. Binary log loss reads the probability assigned to the observed target and takes its negative natural logarithm. Assigning a large probability to the observed class gives a small loss; assigning it a tiny probability gives a large loss. Training adjusts weights and bias to reduce average training loss, while held-out data is still needed to check whether the rule generalizes.",
      ],
      vocabulary: [
        {
          term: "Binary target",
          definition:
            "The observed outcome with two allowed classes, conventionally written as 0 and 1.",
        },
        {
          term: "Feature",
          definition:
            "An input value supplied to the model, such as temperature or vibration.",
        },
        {
          term: "Weight and bias",
          definition:
            "Learned numbers that scale feature contributions and shift the overall score.",
        },
        {
          term: "Odds and logit",
          definition:
            "Odds are p / (1 - p), comparing the target-class probability p with the other-class probability. The logit is the log-odds z = ln(p / (1 - p)); logistic regression models it as the unbounded weighted sum z = w dot x + b.",
        },
        {
          term: "Sigmoid",
          definition:
            "The inverse of the log-odds transformation: p = 1 / (1 + exp(-z)) maps a finite logit z back to a mathematical probability strictly between zero and one.",
        },
        {
          term: "Log loss",
          definition:
            "The negative natural logarithm of the probability assigned to the class that was actually observed.",
        },
        {
          term: "Exponential exp",
          definition:
            "The operation exp(a) = e raised to power a; sigmoid uses exp(-z) to convert a logit.",
        },
        {
          term: "Natural logarithm ln",
          definition:
            "The inverse of exp for positive values, so exp(ln(a)) = a and ln(exp(a)) = a.",
        },
      ],
      workedExample: {
        title: "Score one machine outcome from beginning to end",
        setup:
          "A bearing model produces logit z = ln(3) for the target class failure. Trace that one score into both possible target losses.",
        steps: [
          {
            label: "Keep the raw score",
            explanation:
              "The model's weighted feature calculation has produced z = ln(3), about 1.099. This is a positive logit, but it is not yet a probability or a final class.",
          },
          {
            label: "Read the score as log-odds",
            explanation:
              "Because z = ln(p / (1 - p)), exponentiating both sides gives p / (1 - p) = exp(z) = 3. The target-class odds are therefore three to one. Solving p = 3(1 - p) gives 4p = 3, so p = 0.75.",
          },
          {
            label: "Apply sigmoid",
            explanation:
              "Substitute the same z into p = 1 / (1 + exp(-z)). Because -ln(3) = ln(1/3), exp(-ln(3)) = 1/3. Therefore p(failure) = 1 / (1 + 1/3) = 1 / (4/3) = 0.75. Sigmoid recovers the same probability because it is the inverse of log-odds.",
          },
          {
            label: "Find the other class probability",
            explanation:
              "The two binary probabilities must add to one, so p(no failure) = 1 - 0.75 = 0.25.",
          },
          {
            label: "Score an observed failure",
            explanation:
              "If the target is 1, log loss reads p(failure): -ln(0.75), which is about 0.288.",
          },
          {
            label: "Score an observed non-failure",
            explanation:
              "If the target is 0, log loss reads p(no failure): -ln(0.25), which is about 1.386. The same prediction is penalized more because it assigned less probability to what happened.",
          },
        ],
        takeaway:
          "The calculation has three distinct objects: an unrestricted linear score, a bounded probability, and a target-dependent loss. Keeping them separate makes both prediction and training easier to trace.",
      },
      misconceptions: [
        {
          misconception: "A positive logit is already a probability.",
          correction:
            "A positive logit only places the example on one side of logit zero. Sigmoid must still convert that unrestricted score to a probability.",
        },
        {
          misconception: "Sigmoid makes the decision boundary curved.",
          correction:
            "At a 0.5 cutoff, sigmoid maps back to logit zero, so the boundary remains w dot x + b = 0 in the original feature space.",
        },
        {
          misconception: "A probability has one fixed loss.",
          correction:
            "Loss also depends on the observed target: p is read for target 1, while 1 - p is read for target 0.",
        },
      ],
      summary: [
        "First recompute the logit from the contributions that changed; do not treat the old probability as an input.",
        "Use logit zero and probability 0.5 as the shared reference point when reasoning about sigmoid.",
        "After finding a probability, identify the observed target before deciding which probability log loss will read.",
      ],
      sourceIds: ["S73", "S74", "S13"],
    },
    mechanism: {
      input: "Feature values, weights, a bias, and a binary target",
      process:
        "Form a logit, pass it through the sigmoid, and score the resulting probability with log loss",
      output:
        "A mathematical probability strictly between zero and one, subject to floating-point endpoint rounding, and its target-dependent loss",
    },
    starterQuestions: [
      "What does the sign of a logit tell us?",
      "Why is 0.5 the probability at logit zero?",
      "Why does log loss punish a confident wrong answer sharply?",
    ],
    prerequisiteConceptIds: [
      "linear-parameters",
      "loss",
      "generalization",
    ],
    outcomes: [
      {
        id: "logistic-logit-outcome",
        conceptId: "logit",
        text: "Compute a logit from features, weights, and a bias.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "logistic-sigmoid-outcome",
        conceptId: "sigmoid",
        text: "Explain how sigmoid maps any logit to a probability.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "logistic-loss-outcome",
        conceptId: "log-loss",
        text: "Connect log loss to the probability assigned to the observed target.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "logistic-score-first",
        kind: "opening",
        heading: "Keep the score visible",
        sourceIds: ["S73"],
        body: [
          "A binary classifier can begin with the same weighted sum used by a linear model: z = w1 x1 + w2 x2 + b. This unbounded number is the logit.",
          "The logit is not yet a class label or a probability. Its sign says which side of the boundary the example lies on, and its distance from zero records how strongly the linear score favors that side.",
        ],
        conceptIds: ["logit"],
        tags: ["logit", "weighted sum", "score", "boundary"],
      },
      {
        id: "logistic-sigmoid-map",
        kind: "worked-example",
        heading: "Sigmoid bends the number line",
        sourceIds: ["S73"],
        body: [
          "The sigmoid is p = 1 / (1 + exp(-z)). At z = 0, p = 0.5. Mathematically, every finite logit maps strictly between zero and one. In finite-precision arithmetic, an extreme finite logit may round to 0.0 or 1.0; that endpoint is numerical saturation, not the exact mathematical value.",
          "For z = ln(3), exp(-z) = 1/3, so p = 1 / (1 + 1/3) = 0.75. Reading backward, the odds are p / (1 - p) = 0.75 / 0.25 = 3 and ln(3) returns z. Sigmoid converts log-odds to probability; z = ln(p / (1 - p)) converts probability back to log-odds. The inverse transformations change the scale, not the ordering.",
        ],
        conceptIds: ["logit", "sigmoid"],
        tags: ["sigmoid", "probability", "monotonic", "ln 3"],
      },
      {
        id: "logistic-boundary",
        kind: "definition",
        heading: "The boundary remains linear",
        sourceIds: ["S73"],
        body: [
          "Using probability 0.5 as the decision cutoff is equivalent to using logit zero, because sigmoid(0) = 0.5. The boundary is therefore the set of inputs where w dot x + b = 0.",
          "Sigmoid changes how the score is interpreted, but it does not curve the boundary in the original feature space. Nonlinear boundaries require nonlinear features or a nonlinear composition.",
        ],
        conceptIds: ["logit", "sigmoid", "classification-score"],
        tags: ["decision boundary", "linear", "probability", "threshold"],
      },
      {
        id: "logistic-loss",
        kind: "worked-example",
        heading: "Log loss scores the probability of what happened",
        sourceIds: ["S74"],
        body: [
          "For target y = 1, log loss is -log(p). For target y = 0, it is -log(1 - p). In both cases, the loss reads the probability assigned to the observed target.",
          "Predicting p = 0.8 gives loss about 0.223 when y = 1 but about 1.609 when y = 0. A confident probability aimed at the wrong class is expensive because the probability assigned to the actual target is small.",
        ],
        conceptIds: ["log-loss", "sigmoid"],
        tags: ["log loss", "binary cross entropy", "target", "confidence"],
      },
      {
        id: "logistic-training-link",
        kind: "reading",
        heading: "Training still adjusts parameters",
        sourceIds: ["S13", "S74"],
        body: [
          "Training adjusts the weights and bias to reduce mean training log loss, tending to increase the probability assigned to observed targets in aggregate; an individual training example can still worsen. Inference holds those learned parameters fixed and computes logits and probabilities for new examples.",
          "A low training log loss is not proof of generalization. The same split discipline from regression still determines whether the probability rule works on unseen data.",
        ],
        conceptIds: ["log-loss", "generalization"],
        tags: ["training", "inference", "parameters", "generalization"],
      },
    ],
    activities: [
      {
        id: "logistic-sign-prediction",
        kind: "prediction",
        conceptIds: ["logit", "sigmoid"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "logistic-sign-prediction",
          prompt:
            "The weights and inputs stay fixed while the bias raises the logit from 0 to 2. What happens to the sigmoid probability?",
          options: [
            { id: "rises", label: "It rises above 0.5" },
            { id: "falls", label: "It falls below 0.5" },
            { id: "unchanged", label: "It stays at 0.5" },
          ],
          correctOptionId: "rises",
          supportedExplanation:
            "Correct. Sigmoid is monotonic, so a larger positive logit maps to a probability above 0.5.",
          revisitExplanation:
            "Anchor at sigmoid(0) = 0.5, then follow the direction of the logit change.",
        },
      },
      {
        id: "logistic-link-lab",
        kind: "visual-lab",
        labId: "logistic-link",
        conceptIds: ["logit", "sigmoid", "log-loss"],
        evidenceKind: "manipulation",
        title: "Move one logit through sigmoid and log loss",
        prompt:
          "Commit to a probability direction, then compare the exact probability and losses for target 0 and target 1 before and after the move.",
        invariant:
          "The feature vector, target alternatives, and sigmoid equation stay fixed.",
        intervention:
          "Change only the bias contribution to the logit and inspect the linked probability and losses.",
        control: {
          label: "Bias contribution",
          min: -4,
          max: 4,
          step: 0.5,
          initial: 0,
          lowLabel: "favors target 0",
          highLabel: "favors target 1",
        },
      },
      responseActivity(
        "logistic-mechanism-explanation",
        "explanation",
        ["logit", "sigmoid", "log-loss"],
        "Explain the complete path from features to log loss. Include why logit zero maps to probability 0.5 and why the same probability has different loss for targets 0 and 1.",
        "Name the weighted sum, sigmoid transformation, target-dependent probability, and negative logarithm.",
        [
          {
            id: "logit-weighted-sum",
            label: "identify the logit as a weighted sum plus bias",
            keywordGroups: [
              ["logit"],
              ["weighted sum", "weights", "w dot x"],
              ["bias"],
            ],
          },
          {
            id: "sigmoid-bounds",
            label:
              "state that mathematical sigmoid maps the logit strictly between zero and one",
            keywordGroups: [
              ["sigmoid"],
              ["zero and one", "0 and 1", "probability"],
            ],
          },
          {
            id: "zero-midpoint",
            label: "connect logit zero to probability 0.5",
            keywordGroups: [
              ["logit", "z"],
              ["zero", "0"],
              ["0.5", "one half", "half"],
            ],
          },
          {
            id: "target-probability",
            label: "make log loss depend on probability assigned to the target",
            keywordGroups: [
              ["log loss", "negative log", "-log"],
              ["target", "observed class", "actual class"],
              ["p", "1 - p", "probability assigned"],
            ],
          },
        ],
        "You traced the classifier from an unbounded score to a target-dependent probabilistic loss.",
        "Trace four named objects in order: logit, sigmoid probability, observed target, and negative log probability.",
      ),
      responseActivity(
        "logistic-sensor-transfer",
        "transfer",
        ["logit", "sigmoid", "log-loss"],
        "A quality-control model predicts whether a part is defective. For one part its defect logit is ln(1/4). Derive p(defect) and p(no defect), place the defect probability relative to 0.5, and explain why observing a defect produces the larger log loss.",
        "Use exp(-ln(1/4)) = 4, compute both class probabilities, and compare the probability assigned to each possible observed target.",
        [
          {
            id: "transfer-complement",
            label: "compute defect probability 0.2 and no-defect probability 0.8",
            keywordGroups: [
              ["0.2", "20%"],
              ["0.8", "80%"],
              ["defect", "no defect", "complement"],
            ],
          },
          {
            id: "transfer-boundary",
            label: "place 0.2 below the 0.5 boundary",
            keywordGroups: [
              ["0.2", "20%"],
              ["below", "less", "negative side"],
              ["0.5", "threshold", "boundary"],
            ],
          },
          {
            id: "transfer-loss-comparison",
            label: "explain that a defect receives the smaller assigned probability",
            keywordGroups: [
              ["defect", "target 1"],
              ["0.2", "smaller probability", "less probability"],
              ["larger loss", "higher loss", "negative log"],
            ],
          },
        ],
        "You transferred sigmoid and target-dependent loss to a new domain, sign, and probability pair.",
        "Compute both class probabilities first, then ask which probability the loss reads after each possible outcome.",
      ),
      pythonLab(
        "logistic-python-lab",
        ["logit", "sigmoid", "log-loss"],
        "logistic_link.py",
        "Predict the five check results before running, including the feature-vector logit and extreme-logit stability. Run the nearly working specimen, investigate why the target-0 loss is wrong, then modify log_loss so it reads p for target 1 and 1-p for target 0.",
        `import math


def linear_logit(features, weights, bias):
    return sum(x * w for x, w in zip(features, weights)) + bias


def sigmoid(logit):
    if logit >= 0:
        return 1.0 / (1.0 + math.exp(-logit))
    exp_logit = math.exp(logit)
    return exp_logit / (1.0 + exp_logit)


def log_loss(probability, target):
    probability = min(max(probability, 1e-12), 1.0 - 1e-12)
    # BUG TO REPAIR: this branch only scores target 1.
    return -math.log(probability)


def predict_probability(features, weights, bias):
    return sigmoid(linear_logit(features, weights, bias))


print("p(z=0):", sigmoid(0.0))
print("p(z=ln(3)):", sigmoid(math.log(3.0)))
print("loss(p=.8, y=1):", log_loss(0.8, 1))
print("loss(p=.8, y=0):", log_loss(0.8, 0))
`,
        [
          {
            id: "logistic-linear-logit-check",
            label: "Features, weights, and bias form the logit",
            expression:
              "round(linear_logit([2.0, -1.0], [0.5, 2.0], 0.25), 6)",
            expected: -0.75,
            conceptIds: ["logit"],
          },
          {
            id: "logistic-midpoint-check",
            label: "Logit zero maps to one half",
            expression: "round(sigmoid(0.0), 6)",
            expected: 0.5,
            conceptIds: ["sigmoid"],
          },
          {
            id: "logistic-ln-three-check",
            label:
              "Large finite logits stay stable and may round to endpoints",
            expression:
              "str(tuple(round(sigmoid(z), 6) for z in (-1000.0, math.log(3.0), 1000.0)))",
            expected: "(0.0, 0.75, 1.0)",
            conceptIds: ["logit", "sigmoid"],
          },
          {
            id: "logistic-positive-loss-check",
            label: "Target-one loss reads p",
            expression: "round(log_loss(0.8, 1), 6)",
            expected: 0.223144,
            conceptIds: ["log-loss"],
          },
          {
            id: "logistic-negative-loss-check",
            label:
              "Target-zero loss reads one minus p on a held-out probability",
            expression: "round(log_loss(0.8, 0), 6)",
            expected: 1.609438,
            conceptIds: ["log-loss"],
          },
        ],
        107,
      ),
    ],
    resources: [
      reading(
        "logistic-google-sigmoid",
        "Logistic regression: Calculating a probability with the sigmoid function",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/logistic-regression/sigmoid-function?hl=en",
        7,
        "logistic-python-lab",
        "Read after the local logit-to-probability derivation and code repair; compare its sigmoid trace with the authored values.",
        "S73",
      ),
      reading(
        "logistic-google-loss",
        "Logistic regression: Loss and regularization",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/logistic-regression/loss-regularization?hl=en",
        3,
        "logistic-python-lab",
        "Read after computing local log loss; use it to consolidate why confident wrong probabilities receive large loss.",
        "S74",
      ),
    ],
  },
  {
    id: "decision-costs",
    number: "08",
    moduleId: "models",
    phase: "evaluate",
    published: true,
    title: "A probability becomes a decision",
    question: "Which mistakes should a classifier be designed to make?",
    summary:
      "Hold scores fixed while a threshold changes the confusion matrix, precision, recall, and empirical total validation cost.",
    durationMinutes: 55,
    revision: lessonRevision("decision-costs"),
    sourceIds: ["S75", "S76", "S96", "S13"],
    teaching: {
      title: "Turn fixed probabilities into accountable decisions",
      introduction: [
        "A classifier can produce a probability without making an operational decision. A decision threshold is the rule that converts the probability into a predicted class. Under the convention used in this lesson, a score at or above the threshold becomes positive and a lower score becomes negative. Moving the threshold changes decisions even when every model score stays fixed.",
        "Each decision is compared with the observed target and placed in one of four confusion-matrix cells. A true positive and true negative are correct. A false positive calls a negative case positive, while a false negative calls a positive case negative. Precision asks how reliable the positive decisions were; recall asks how many actual positive cases were recovered. Their denominators differ, so they answer different questions.",
        "The preferred threshold depends on the cost of mistakes, not on a universal rule that 0.5 is best. Threshold selection should use validation cases while the final test set remains untouched. Calibration is a separate property: among cases assigned a probability such as 0.8, about 80 percent should actually be positive under the evaluation conditions. A model can rank cases well without its probability values having that frequency meaning.",
      ],
      vocabulary: [
        {
          term: "Decision threshold",
          definition:
            "The cutoff that converts a numeric score or probability into a positive or negative decision.",
        },
        {
          term: "Confusion matrix",
          definition:
            "The four counts formed by crossing predicted class with observed class: TP, FP, TN, and FN.",
        },
        {
          term: "Precision",
          definition:
            "TP / (TP + FP), the fraction of positive decisions that were truly positive.",
        },
        {
          term: "Recall",
          definition:
            "TP / (TP + FN), the fraction of actual positive cases that the policy found.",
        },
        {
          term: "Decision cost",
          definition:
            "A stated consequence assigned to an error type and used to compare candidate operating policies.",
        },
        {
          term: "Calibration",
          definition:
            "Agreement between predicted probabilities and observed outcome frequencies across comparable cases.",
        },
      ],
      workedExample: {
        title: "Audit one threshold on five validation cases",
        setup:
          "Use scores [0.9, 0.7, 0.6, 0.4, 0.2], targets [1, 0, 1, 0, 1], threshold 0.5, false-positive cost 1, and false-negative cost 5.",
        steps: [
          {
            label: "Create the decisions",
            explanation:
              "Scores at or above 0.5 become positive, giving predictions [1, 1, 1, 0, 0]. The scores themselves have not changed.",
          },
          {
            label: "Place every case",
            explanation:
              "The five prediction-target pairs are TP, FP, TP, TN, and FN. Therefore TP = 2, FP = 1, TN = 1, and FN = 1.",
          },
          {
            label: "Compute precision",
            explanation:
              "There are three positive decisions and two are true positives, so precision = 2 / (2 + 1) = 2/3, about 0.667.",
          },
          {
            label: "Compute recall",
            explanation:
              "There are three actual positives and two were found, so recall = 2 / (2 + 1) = 2/3, about 0.667.",
          },
          {
            label: "Compute empirical cost",
            explanation:
              "The validation cost is 1 x FP + 5 x FN = 1 x 1 + 5 x 1 = 6 units. Other candidate thresholds must be evaluated on the same fixed cases and costs.",
          },
        ],
        takeaway:
          "A threshold is a policy choice whose consequences can be counted. Precision, recall, and cost are derived from the same four cells, but they summarize those cells for different purposes.",
      },
      misconceptions: [
        {
          misconception: "The model changes when the threshold moves.",
          correction:
            "Changing only the threshold leaves all learned parameters and probabilities fixed; it changes the labels assigned by the policy.",
        },
        {
          misconception: "High accuracy or ranking proves good calibration.",
          correction:
            "Ranking concerns order, while calibration compares probability values with observed frequencies. One does not establish the other.",
        },
        {
          misconception: "The threshold with the highest recall is automatically best.",
          correction:
            "Recall ignores false positives. A defensible operating point must consider stated costs and constraints on fixed validation data.",
        },
      ],
      summary: [
        "When a threshold changes, begin by listing which fixed scores are now called positive.",
        "Rebuild the four confusion counts before calculating any metric or cost.",
        "Keep score ordering, probability calibration, and the final decision policy as three separate questions.",
      ],
      sourceIds: ["S75", "S76", "S96", "S13"],
    },
    mechanism: {
      input: "Fixed probabilities, binary targets, a threshold, and mistake costs",
      process:
        "Threshold the probabilities, count each outcome, compute metrics, and compare empirical total validation cost",
      output: "A decision policy with a visible precision-recall-cost tradeoff",
    },
    starterQuestions: [
      "What changes when a threshold moves but model scores do not?",
      "When is recall more important than precision?",
      "Why can a well-ranked model still be poorly calibrated?",
    ],
    prerequisiteConceptIds: [
      "classification-score",
      "sigmoid",
      "log-loss",
      "data-split",
    ],
    outcomes: [
      {
        id: "decision-matrix-outcome",
        conceptId: "confusion-matrix",
        text: "Assign every prediction-target pair to exactly one confusion-matrix cell.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "decision-cost-outcome",
        conceptId: "decision-cost",
        text: "Choose a threshold from stated false-positive and false-negative costs.",
        requiredEvidenceKinds: ["transfer", "code-check"],
      },
      {
        id: "decision-calibration-outcome",
        conceptId: "calibration",
        text: "Distinguish ranking, thresholded decisions, and calibrated probabilities.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
    ],
    blocks: [
      {
        id: "decision-policy-separate",
        kind: "opening",
        heading: "The model score and policy are different objects",
        sourceIds: ["S75"],
        body: [
          "A model can output the same probability for an example while two applications make different decisions. The threshold belongs to the decision policy, not to the target and not necessarily to training.",
          "Lowering a threshold makes more examples positive. Raising it makes fewer examples positive. That directional fact holds before any metric is computed.",
        ],
        conceptIds: ["classification-score", "decision-threshold"],
        tags: ["score", "threshold", "policy", "decision"],
      },
      {
        id: "decision-four-cells",
        kind: "definition",
        heading: "Every decision enters one of four cells",
        sourceIds: ["S75"],
        body: [
          "A true positive and true negative are correct decisions. A false positive is a negative target called positive; a false negative is a positive target called negative.",
          "The four counts describe decisions at one threshold. If the threshold changes, examples may move between cells even though their scores and targets stay fixed.",
        ],
        conceptIds: ["confusion-matrix", "decision-threshold"],
        tags: ["true positive", "false positive", "true negative", "false negative"],
      },
      {
        id: "decision-precision-recall",
        kind: "worked-example",
        heading: "Precision and recall ask different questions",
        sourceIds: ["S76"],
        body: [
          "Precision = TP / (TP + FP): among positive decisions, how many were truly positive? Recall = TP / (TP + FN): among actual positives, how many did the policy recover?",
          "If TP + FP is zero, there were no positive decisions, so precision is undefined; this lesson reports math.nan rather than inventing a measured zero. Recall is likewise undefined when TP + FN is zero.",
          "A lower threshold often raises recall and lowers precision because it admits more true positives and more false positives. This is a tradeoff, not a law for every finite dataset.",
        ],
        conceptIds: ["confusion-matrix", "decision-threshold"],
        tags: ["precision", "recall", "denominator", "tradeoff"],
      },
      {
        id: "decision-calibration",
        kind: "reading",
        heading: "Ranking is not calibration",
        sourceIds: ["S96"],
        body: [
          "Ranking asks whether higher-scored examples tend to be more positive. Calibration asks whether examples assigned probability 0.7 are positive about 70 percent of the time under the evaluation conditions.",
          "A monotonic transformation can preserve ranking while changing calibration. A threshold can then produce the same ordering but a different operating point.",
        ],
        conceptIds: ["classification-score", "calibration"],
        tags: ["ranking", "calibration", "probability", "frequency"],
      },
      {
        id: "decision-costs",
        kind: "worked-example",
        heading: "Costs make the operating point concrete",
        sourceIds: ["S75", "S76"],
        body: [
          "If a false negative costs 10 units and a false positive costs 1, the empirical total validation cost is 10 x FN + 1 x FP. The best tested threshold is the one with the lowest total across the fixed validation cases.",
          "The test set remains untouched while the threshold is chosen. Otherwise the reported test cost becomes part of tuning rather than an independent estimate.",
        ],
        conceptIds: ["decision-cost", "data-split", "decision-threshold"],
        tags: ["cost matrix", "validation", "test set", "selection"],
      },
    ],
    activities: [
      {
        id: "decision-threshold-prediction",
        kind: "prediction",
        conceptIds: ["decision-threshold", "confusion-matrix"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "decision-threshold-prediction",
          prompt:
            "Scores and targets stay fixed while the threshold falls from 0.7 to 0.4. Which statement must be true?",
          options: [
            {
              id: "more-positive",
              label: "The number of positive decisions cannot decrease",
            },
            {
              id: "more-negative",
              label: "The number of negative decisions cannot decrease",
            },
            {
              id: "same-matrix",
              label: "The confusion matrix must stay unchanged",
            },
          ],
          correctOptionId: "more-positive",
          supportedExplanation:
            "Correct. Every score that passed 0.7 still passes 0.4, and additional scores may now pass.",
          revisitExplanation:
            "List which fixed scores satisfy score >= threshold before and after lowering the threshold.",
        },
      },
      {
        id: "decision-costs-lab",
        kind: "visual-lab",
        labId: "decision-costs",
        conceptIds: [
          "decision-threshold",
          "confusion-matrix",
          "decision-cost",
          "calibration",
        ],
        evidenceConceptIds: [
          "decision-threshold",
          "confusion-matrix",
          "decision-cost",
        ],
        evidenceKind: "manipulation",
        title: "Move a policy across fixed scores",
        prompt:
          "Predict the direction first, then compare the exact confusion counts, precision, recall, and weighted cost at two thresholds.",
        invariant:
          "The model probabilities, binary targets, and false-positive and false-negative costs stay fixed.",
        intervention:
          "Change only the decision threshold that converts probabilities into labels.",
        control: {
          label: "Decision threshold",
          min: 0.1,
          max: 0.9,
          step: 0.05,
          initial: 0.5,
          lowLabel: "more positive decisions",
          highLabel: "fewer positive decisions",
        },
      },
      responseActivity(
        "decision-metrics-explanation",
        "explanation",
        ["confusion-matrix", "calibration", "decision-threshold"],
        "Explain why moving a threshold can change precision and recall without changing model probabilities. Then distinguish a high ranking score from a calibrated probability.",
        "Keep the fixed score list, thresholded labels, confusion counts, metric denominators, and observed frequencies separate.",
        [
          {
            id: "fixed-probabilities",
            label: "state that probabilities remain fixed when only threshold moves",
            keywordGroups: [
              ["probabilities", "scores"],
              ["fixed", "unchanged", "same"],
            ],
          },
          {
            id: "labels-change",
            label: "connect threshold movement to changed positive labels",
            keywordGroups: [
              ["threshold"],
              ["positive decisions", "predicted positive", "labels"],
              ["change", "more", "fewer"],
            ],
          },
          {
            id: "metrics-from-counts",
            label: "connect precision and recall to different confusion counts",
            keywordGroups: [
              ["precision"],
              ["recall"],
              ["false positive", "false negative", "confusion"],
            ],
          },
          {
            id: "calibration-frequency",
            label: "define calibration through predicted and observed frequencies",
            keywordGroups: [
              ["calibration", "calibrated"],
              ["predicted probability", "70%", "0.7"],
              ["observed frequency", "actually positive", "positive rate"],
            ],
          },
        ],
        "You separated model output, decision policy, metric counts, and calibration.",
        "Explain the chain in two layers: fixed probabilities become changing labels, while calibration compares probabilities with observed frequencies.",
      ),
      responseActivity(
        "decision-fire-transfer",
        "transfer",
        ["decision-cost", "confusion-matrix", "calibration"],
        "A wildfire alert system sends a crew to inspect predicted hotspots. A missed fire costs 20 units; an unnecessary inspection costs 2. Explain which threshold direction you would test first, which confusion cells drive cost, and how you would check whether predicted 0.8 risks are calibrated before deployment.",
        "Name the expensive error, the expected directional tradeoff, the cost expression, and an observed-frequency calibration check.",
        [
          {
            id: "fire-lower-threshold",
            label: "test a lower threshold to reduce missed fires",
            keywordGroups: [
              ["lower", "decrease"],
              ["threshold"],
              ["missed fire", "false negative", "recall"],
            ],
          },
          {
            id: "fire-cost-cells",
            label: "weight false negatives by 20 and false positives by 2",
            keywordGroups: [
              ["false negative", "missed fire"],
              ["20"],
              ["false positive", "unnecessary inspection"],
              ["2"],
            ],
          },
          {
            id: "fire-tradeoff",
            label: "acknowledge that false positives may increase",
            keywordGroups: [
              ["false positive", "unnecessary inspection"],
              ["increase", "more", "tradeoff"],
            ],
          },
          {
            id: "fire-calibration",
            label: "compare 0.8 predictions with an observed rate near 80 percent",
            keywordGroups: [
              ["0.8", "80%"],
              ["observed", "actual"],
              ["rate", "frequency", "about 80"],
            ],
          },
        ],
        "You chose and justified an operating point without confusing ranking, calibration, or test-set evaluation.",
        "Start with the 20-to-2 cost ratio, identify the corresponding confusion cells, then define what 0.8 should mean across many cases.",
      ),
      pythonLab(
        "decision-python-lab",
        ["decision-threshold", "confusion-matrix", "decision-cost"],
        "decision_costs.py",
        "Predict the confusion counts, undefined-precision result, and cheapest candidate threshold in both validation tables. Run the specimen, investigate why it chooses the most expensive threshold, then modify choose_threshold to minimize validation cost. The two tables deliberately have different winning thresholds.",
        `import math


def confusion_counts(scores, targets, threshold):
    tp = fp = tn = fn = 0
    for score, target in zip(scores, targets):
        prediction = int(score >= threshold)
        if prediction == 1 and target == 1:
            tp += 1
        elif prediction == 1 and target == 0:
            fp += 1
        elif prediction == 0 and target == 0:
            tn += 1
        else:
            fn += 1
    return tp, fp, tn, fn


def precision_recall(counts):
    tp, fp, _tn, fn = counts
    precision = tp / (tp + fp) if tp + fp else math.nan
    recall = tp / (tp + fn) if tp + fn else math.nan
    return precision, recall


def empirical_total_cost(counts, false_positive_cost, false_negative_cost):
    _tp, fp, _tn, fn = counts
    return fp * false_positive_cost + fn * false_negative_cost


def choose_threshold(scores, targets, candidates, fp_cost, fn_cost):
    scored = []
    for threshold in candidates:
        counts = confusion_counts(scores, targets, threshold)
        scored.append((empirical_total_cost(counts, fp_cost, fn_cost), threshold))
    # BUG TO REPAIR: policy selection should minimize validation cost.
    return max(scored)[1]


SCORES = [0.9, 0.7, 0.6, 0.4, 0.2]
TARGETS = [1, 0, 1, 0, 1]
ALTERNATE_SCORES = [0.9, 0.7, 0.4, 0.2]
ALTERNATE_TARGETS = [1, 0, 0, 0]
print("counts:", confusion_counts(SCORES, TARGETS, 0.5))
print("precision, recall:", precision_recall(confusion_counts(SCORES, TARGETS, 0.5)))
print("no-positive precision:", precision_recall((0, 0, 3, 2))[0])
print("chosen:", choose_threshold(SCORES, TARGETS, [0.3, 0.5, 0.8], 1, 5))
print("alternate chosen:", choose_threshold(ALTERNATE_SCORES, ALTERNATE_TARGETS, [0.3, 0.5, 0.8], 5, 1))
`,
        [
          {
            id: "decision-counts-check",
            label: "Each example enters the correct confusion cell",
            expression:
              "str(confusion_counts(SCORES, TARGETS, 0.5))",
            expected: "(2, 1, 1, 1)",
            conceptIds: ["confusion-matrix"],
          },
          {
            id: "decision-metrics-check",
            label:
              "Metrics use their denominators and undefined precision is NaN",
            expression:
              "str((tuple(round(v, 6) for v in precision_recall((2, 1, 1, 1))), math.isnan(precision_recall((0, 0, 3, 2))[0])))",
            expected: "((0.666667, 0.666667), True)",
            conceptIds: ["confusion-matrix"],
          },
          {
            id: "decision-cost-check",
            label: "Empirical total validation cost weights false positives and false negatives",
            expression: "empirical_total_cost((2, 1, 1, 1), 1, 5)",
            expected: 6,
            conceptIds: ["decision-cost"],
          },
          {
            id: "decision-threshold-check",
            label:
              "Validation selects the least-cost threshold in two different cost tables",
            expression:
              "str((choose_threshold(SCORES, TARGETS, [0.3, 0.5, 0.8], 1, 5), choose_threshold(ALTERNATE_SCORES, ALTERNATE_TARGETS, [0.3, 0.5, 0.8], 5, 1)))",
            expected: "(0.5, 0.8)",
            conceptIds: ["decision-threshold", "decision-cost"],
          },
        ],
        108,
      ),
    ],
    resources: [
      reading(
        "decision-google-threshold",
        "Thresholds and the confusion matrix",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/classification/thresholding?hl=en",
        8,
        "decision-python-lab",
        "Read after the local cost calculation and compare how changing only the threshold moves confusion-matrix counts.",
        "S75",
      ),
      reading(
        "decision-google-metrics",
        "Classification: Accuracy, recall, precision, and related metrics",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/classification/accuracy-precision-recall?hl=en",
        11,
        "decision-python-lab",
        "Read after local evidence is complete; recompute each metric from counts instead of treating the formulas as a second assessment.",
        "S76",
      ),
    ],
  },
  {
    id: "feature-pipeline",
    number: "09",
    moduleId: "models",
    phase: "build",
    published: true,
    title: "Features need a reproducible path",
    question: "How does raw data become model input without leaking the answer?",
    summary:
      "Fit numeric, categorical, and missing-value transformations on training data, then replay them unchanged.",
    durationMinutes: 55,
    revision: lessonRevision("feature-pipeline"),
    sourceIds: ["S77", "S78", "S07"],
    teaching: {
      title: "Build one feature definition and replay it everywhere",
      introduction: [
        "Models need numeric feature vectors, but raw rows may contain measurements in different units, named categories, and missing values. Preprocessing turns those raw fields into model inputs. Some preprocessing operations learn values from data, such as a mean, scale, imputation value, or category vocabulary. Those learned values are called fitted state.",
        "Fit and transform are different operations. Fit estimates preprocessing state from training rows. Transform applies already fitted state to a row without changing it. Validation, test, and future rows may be transformed, but they must not influence the fitted state. Otherwise information from held-out data changes the representation used by the model, which is a form of leakage.",
        "A pipeline records the ordered transformation steps, their fitted state, and the positions of the resulting features. Numeric values can be imputed and scaled; categories can be assigned stable one-hot positions; a missing indicator can preserve the fact that a raw value was absent. Replaying the same fitted pipeline gives the same raw row the same feature meaning across training and deployment.",
      ],
      vocabulary: [
        {
          term: "Fitted state",
          definition:
            "Values learned by preprocessing from data, such as a mean, scale, fill value, or category vocabulary.",
        },
        {
          term: "Fit",
          definition:
            "The operation that estimates transformation state, using training rows only.",
        },
        {
          term: "Transform",
          definition:
            "The operation that applies frozen fitted state to rows without estimating it again.",
        },
        {
          term: "Imputation",
          definition:
            "Replacing a missing input with a defined value, such as the mean computed from observed training values.",
        },
        {
          term: "One-hot encoding",
          definition:
            "Representing each known category with its own position, containing one 1 and zeros elsewhere.",
        },
        {
          term: "Pipeline",
          definition:
            "An ordered contract that stores transformations, fitted state, and stable output feature positions.",
        },
      ],
      workedExample: {
        title: "Fit on three rows, then transform a new night row",
        setup:
          "Training rows contain temperatures [10, missing, 30] and shifts [day, night, day]. Transform a complete new row [40, night] without refitting.",
        steps: [
          {
            label: "Fit the numeric fill value",
            explanation:
              "Use only observed training temperatures: (10 + 30) / 2 = 20. The stored imputation value is 20.",
          },
          {
            label: "Prepare the training numeric column",
            explanation:
              "Imputation changes the training values to [10, 20, 30]. A separate missing indicator is [0, 1, 0], preserving which raw row lacked a temperature.",
          },
          {
            label: "Fit the numeric reference",
            explanation:
              "The imputed values [10, 20, 30] differ from mean 20 by [-10, 0, 10]. Their squared deviations are [100, 0, 100], whose mean is population variance (100 + 0 + 100) / 3 = 200 / 3. The fitted scale is its square root, about 8.165.",
          },
          {
            label: "Fit stable category positions",
            explanation:
              "The training vocabulary [day, night] assigns day to [1, 0] and night to [0, 1]. Those positions cannot move when a later row arrives.",
          },
          {
            label: "Transform the new row",
            explanation:
              "Temperature 40 becomes (40 - 20) / 8.165, about 2.449. It was observed, so its missing indicator is 0; night becomes [day = 0, night = 1]. In the fixed order [scaled temperature, missing-temperature indicator, day, night], the final vector is [2.449, 0, 0, 1].",
          },
        ],
        takeaway:
          "The new row contributes values to its output vector but contributes nothing to fitted state. That one-way boundary is what keeps preprocessing reproducible and held-out evaluation meaningful.",
      },
      misconceptions: [
        {
          misconception: "Using a validation value during scaling is harmless because it is not a target.",
          correction:
            "Validation features still contain held-out information. Letting them alter a mean or scale changes the representation before evaluation.",
        },
        {
          misconception: "Mean imputation says the missing measurement was average.",
          correction:
            "Imputation supplies a usable numeric placeholder. A separate indicator records absence; neither operation recovers the unknown measurement.",
        },
        {
          misconception: "Category numbers such as day = 1 and night = 2 are equivalent to one-hot encoding.",
          correction:
            "Ordinary numeric codes introduce an order and distance. One-hot positions let the model assign separate effects without inventing that geometry.",
        },
      ],
      summary: [
        "For every preprocessing step, ask whether it learns state or only applies state.",
        "Any learned mean, scale, fill value, or vocabulary belongs to the training split.",
        "Held-out rows travel through the frozen pipeline in the same order and cannot redefine its feature positions.",
      ],
      sourceIds: ["S77", "S78", "S07"],
    },
    mechanism: {
      input: "Raw numeric and categorical fields with possible missing values",
      process:
        "Fit transformation state on training rows, then apply the same ordered transformations to every split",
      output: "A fixed numeric feature vector with traceable preprocessing state",
    },
    starterQuestions: [
      "Which preprocessing steps learn values from data?",
      "Why must category vocabularies be fitted on training rows only?",
      "When can a missing-value indicator carry useful information?",
    ],
    prerequisiteConceptIds: ["data-split", "leakage", "generalization"],
    outcomes: [
      {
        id: "pipeline-fit-outcome",
        conceptId: "pipeline",
        text: "Separate fit-time state from transform-time application.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "pipeline-feature-outcome",
        conceptId: "categorical-encoding",
        text: "Produce stable numeric and categorical feature positions.",
        requiredEvidenceKinds: ["transfer", "code-check"],
      },
      {
        id: "pipeline-leakage-outcome",
        conceptId: "missing-values",
        text: "Impute and mark missing values without learning from validation or test rows.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "pipeline-two-phases",
        kind: "opening",
        heading: "Fit once, transform many times",
        sourceIds: ["S77"],
        body: [
          "Some preprocessing learns state: a mean, a scale, a category vocabulary, or an imputation value. That state must be fitted using training rows only.",
          "Transform then applies the frozen state to training, validation, test, and future rows. Re-fitting on each split silently gives the model a different input definition.",
        ],
        conceptIds: ["pipeline", "leakage"],
        tags: ["fit", "transform", "state", "training only"],
      },
      {
        id: "pipeline-scaling",
        kind: "worked-example",
        heading: "Scaling records a reference system",
        sourceIds: ["S07", "S77"],
        body: [
          "In the shared lesson fixture, training temperatures [10, missing, 30] use a training-mean imputation of 20. The fitted population scale is sqrt(200 / 3), about 8.165, so a complete value of 40 becomes about 2.449 after scaling.",
          "Scaling does not create information. It changes numeric geometry so a distance or penalty does not become dominated merely by a larger unit.",
        ],
        conceptIds: ["feature-scaling", "pipeline"],
        tags: ["scaling", "mean", "distance", "units"],
      },
      {
        id: "pipeline-categories",
        kind: "worked-example",
        heading: "Categories become stable positions",
        sourceIds: ["S78"],
        body: [
          "A training vocabulary [day, night] can become two indicator positions. Day maps to [1, 0], night to [0, 1], and an unseen category needs an authored policy such as an all-zero unknown encoding.",
          "Integer codes such as day = 1 and night = 2 invent an ordering and distance that the raw categories did not contain.",
        ],
        conceptIds: ["categorical-encoding", "pipeline"],
        tags: ["one hot", "vocabulary", "unknown category", "ordering"],
      },
      {
        id: "pipeline-missing",
        kind: "reading",
        heading: "Missing is a condition, not a number",
        sourceIds: ["S07", "S77"],
        body: [
          "Replacing a missing numeric value with the training mean supplies a usable number, but it does not claim the measurement was actually average. A separate binary missing indicator marks only that the field was absent in the raw row; it does not recover the measurement or explain why it was absent.",
          "The reason for missingness may differ across environments. Both the imputation state and the missing rate should therefore remain visible.",
        ],
        conceptIds: ["missing-values", "pipeline"],
        tags: ["imputation", "missing indicator", "measurement", "shift"],
      },
      {
        id: "pipeline-order",
        kind: "definition",
        heading: "A pipeline is an ordered contract",
        sourceIds: ["S77"],
        body: [
          "A pipeline fixes transformation order, learned state, output positions, and model application. Feature crosses are built from already defined values, such as scaled temperature multiplied by a night-shift indicator.",
          "The same raw row must produce the same vector under the same fitted pipeline revision. This reproducibility is what makes debugging and deployment comparisons possible.",
        ],
        conceptIds: ["pipeline", "feature-scaling", "categorical-encoding"],
        tags: ["feature cross", "order", "reproducibility", "deployment"],
      },
    ],
    activities: [
      {
        id: "pipeline-leakage-prediction",
        kind: "prediction",
        conceptIds: ["pipeline", "leakage", "feature-scaling"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "pipeline-leakage-prediction",
          prompt:
            "Training temperatures are 10, 20, and 30. A held-out temperature is 100. Which mean may the fitted scaler store?",
          options: [
            { id: "twenty", label: "20, from training rows only" },
            { id: "forty", label: "40, from all four rows" },
            { id: "hundred", label: "100, from the held-out row" },
          ],
          correctOptionId: "twenty",
          supportedExplanation:
            "Correct. The held-out row may be transformed but must not influence fitted preprocessing state.",
          revisitExplanation:
            "Treat the scaler mean as a learned parameter. Only training rows may determine it.",
        },
      },
      {
        id: "feature-pipeline-lab",
        kind: "visual-lab",
        labId: "feature-pipeline",
        conceptIds: [
          "feature-scaling",
          "categorical-encoding",
          "missing-values",
          "pipeline",
        ],
        evidenceConceptIds: [
          "feature-scaling",
          "categorical-encoding",
          "pipeline",
        ],
        evidenceKind: "manipulation",
        title: "Scale one complete night row",
        prompt:
          "Predict the output vector, then vary only the temperature of one complete night row through the same frozen scaler and encoder.",
        invariant:
          "The row remains observed and night; training fixture [10, missing, 30], imputed mean 20, fitted scale sqrt(200 / 3), category order [day, night], and output positions stay fixed.",
        intervention:
          "Change only the incoming temperature and inspect its scaled value and final vector.",
        control: {
          label: "Incoming temperature",
          min: 0,
          max: 40,
          step: 5,
          initial: 20,
          lowLabel: "below training mean",
          highLabel: "above training mean",
        },
      },
      responseActivity(
        "pipeline-mechanism-explanation",
        "explanation",
        ["pipeline", "feature-scaling", "missing-values", "leakage"],
        "Explain why a scaler mean and imputation value fitted on all rows leak information, while applying training-fitted values to a held-out row does not.",
        "Separate learning transformation state from using already frozen state.",
        [
          {
            id: "pipeline-fit-state",
            label: "identify mean and imputation value as fitted state",
            keywordGroups: [
              ["mean"],
              ["imputation", "fill value", "missing value"],
              ["fitted", "learned", "estimated"],
            ],
          },
          {
            id: "pipeline-training-only",
            label: "fit state on training rows only",
            keywordGroups: [
              ["training"],
              ["only", "solely"],
              ["fit", "learn"],
            ],
          },
          {
            id: "pipeline-leak-definition",
            label: "explain that held-out values would influence the representation",
            keywordGroups: [
              ["validation", "test", "held-out"],
              ["influence", "affect", "used"],
              ["leak", "leakage", "peek"],
            ],
          },
          {
            id: "pipeline-transform-safe",
            label: "apply frozen training state without refitting",
            keywordGroups: [
              ["frozen", "same", "unchanged"],
              ["transform", "apply"],
              ["held-out", "validation", "test"],
            ],
          },
        ],
        "You separated learning preprocessing state from replaying that state on unseen rows.",
        "Ask which operation estimates a value and which operation only substitutes that already estimated value.",
      ),
      responseActivity(
        "pipeline-maintenance-transfer",
        "transfer",
        ["pipeline", "categorical-encoding", "missing-values"],
        "A maintenance model receives vibration, machine type, and operator shift. Validation contains a new machine type, and some vibration readings are missing. Specify a leak-free transformation path, including the unknown category, missing indicator, and when any feature cross is computed.",
        "Describe fit state, transform order, stable output positions, and an explicit unknown-category policy.",
        [
          {
            id: "maintenance-training-fit",
            label: "fit numeric and categorical state on training rows",
            keywordGroups: [
              ["training"],
              ["mean", "scale", "imputation"],
              ["vocabulary", "categories", "machine type"],
              ["fit", "learn"],
            ],
          },
          {
            id: "maintenance-unknown",
            label: "use an explicit unknown-category representation",
            keywordGroups: [
              ["new machine type", "unseen", "unknown category"],
              ["all zero", "unknown position", "unknown encoding"],
            ],
          },
          {
            id: "maintenance-missing",
            label: "impute vibration and preserve a missing indicator",
            keywordGroups: [
              ["vibration"],
              ["impute", "fill"],
              ["missing indicator", "missing flag"],
            ],
          },
          {
            id: "maintenance-cross-order",
            label: "compute a cross after its component values are defined",
            keywordGroups: [
              ["feature cross", "interaction", "cross"],
              ["after", "then"],
              ["scaled", "encoded", "transformed"],
            ],
          },
          {
            id: "maintenance-replay",
            label: "replay identical state and feature positions on validation",
            keywordGroups: [
              ["same", "frozen", "identical"],
              ["validation"],
              ["positions", "order", "pipeline"],
            ],
          },
        ],
        "You designed a stable feature contract for missing and previously unseen inputs.",
        "List what the training split learns, then walk one validation row through the frozen steps in order.",
      ),
      pythonLab(
        "pipeline-python-lab",
        ["feature-scaling", "categorical-encoding", "missing-values", "pipeline"],
        "feature_pipeline.py",
        "Predict the training mean, output width, and unknown-category row before running. Run the scikit-learn specimen and inspect how fitting again on validation silently replaces learned state. Modify only the validation call from fit_transform to transform, rerun, and verify that the training imputer, scaler, missing indicator, and category positions stay frozen.",
        `import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.impute import MissingIndicator, SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def make_preprocessor():
    numeric = Pipeline([
        ("imputer", SimpleImputer(strategy="mean")),
        ("scaler", StandardScaler()),
    ])
    missing = MissingIndicator(missing_values=None, features="all")
    category = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    return ColumnTransformer(
        [
            ("numeric", numeric, [0]),
            ("missing", missing, [0]),
            ("shift", category, [1]),
        ],
        verbose_feature_names_out=False,
    )


TRAIN = np.array([
    [10.0, "day"],
    [None, "night"],
    [30.0, "day"],
], dtype=object)
VALIDATION = np.array([
    [None, "weekend"],
    [40.0, "night"],
], dtype=object)

PREPROCESSOR = make_preprocessor()
TRAIN_FEATURES = PREPROCESSOR.fit_transform(TRAIN)
# LEAK TO REPAIR: validation must replay state, not fit new state.
VALIDATION_FEATURES = PREPROCESSOR.fit_transform(VALIDATION)

print("training features:", np.round(TRAIN_FEATURES, 3))
print("validation features:", np.round(VALIDATION_FEATURES, 3))
print("feature names:", PREPROCESSOR.get_feature_names_out().tolist())
`,
        [
          {
            id: "pipeline-training-mean-check",
            label: "Held-out rows do not affect fitted state",
            expression:
              "float(PREPROCESSOR.named_transformers_['numeric'].named_steps['imputer'].statistics_[0])",
            expected: 20,
            conceptIds: ["pipeline", "leakage"],
          },
          {
            id: "pipeline-scaled-check",
            label: "Training mean and scale define the numeric coordinate",
            expression:
              "abs(float(VALIDATION_FEATURES[1, 0]) - 2.449489742783178) < 1e-10",
            expected: true,
            conceptIds: ["feature-scaling"],
          },
          {
            id: "pipeline-missing-check",
            label:
              "Stored training mean imputes the value and the indicator marks absence",
            expression:
              "float(PREPROCESSOR.named_transformers_['numeric'].named_steps['imputer'].statistics_[0]) == 20.0 and abs(float(VALIDATION_FEATURES[0, 0])) < 1e-12 and float(VALIDATION_FEATURES[0, 1]) == 1.0",
            expected: true,
            conceptIds: ["missing-values", "pipeline"],
          },
          {
            id: "pipeline-unknown-check",
            label: "An unseen category cannot move known category positions",
            expression:
              "PREPROCESSOR.named_transformers_['shift'].categories_[0].tolist() == ['day', 'night'] and VALIDATION_FEATURES[0, 2:].tolist() == [0.0, 0.0]",
            expected: true,
            conceptIds: ["categorical-encoding", "pipeline"],
          },
        ],
        109,
        ["scikit-learn"],
      ),
    ],
    resources: [
      reading(
        "pipeline-sklearn-guide",
        "Pipeline: chaining estimators",
        "scikit-learn developers",
        "https://scikit-learn.org/1.8/modules/compose.html#pipeline-chaining-estimators",
        8,
        "pipeline-python-lab",
        "Read after repairing the local scikit-learn pipeline and compare how fitted transform state is chained without leakage.",
        "S77",
      ),
      reading(
        "pipeline-google-categorical",
        "Categorical data: Vocabulary and one-hot encoding",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/categorical-data/one-hot-encoding?hl=en",
        8,
        "pipeline-python-lab",
        "Read after the local unknown-category check passes and compare the stable vocabulary positions with the authored pipeline.",
        "S78",
      ),
    ],
  },
  {
    id: "knn-versus-tree",
    number: "10",
    moduleId: "classical",
    phase: "model",
    published: true,
    title: "Two models draw different neighborhoods",
    question: "What assumptions do k-nearest neighbors and decision trees make?",
    summary:
      "Compare a distance-based vote with recursive axis-aligned splits and expose the inductive bias of each.",
    durationMinutes: 50,
    revision: lessonRevision("knn-versus-tree"),
    sourceIds: ["S79", "S51", "S07", "S14"],
    teaching: {
      title: "Compare a neighborhood vote with a learned rule path",
      introduction: [
        "A model contains assumptions about which patterns should be easy to learn. These assumptions are called inductive bias. k-nearest neighbors, or kNN, assumes that nearby examples often share a target. It stores labeled training points and waits until a new query arrives before computing distances, selecting the closest k points, and combining their labels.",
        "A decision tree learns a different structure. During fitting, it chooses feature-threshold questions that divide training rows into branches. During prediction, a query follows those questions until it reaches a leaf, which returns a prediction. A standard numeric split examines one feature at a time, so repeated splits form axis-aligned, block-like regions.",
        "Neither assumption is universally better. kNN depends directly on the distance definition, feature scales, and chosen k. A tree depends on which splits were learned and how deeply it was allowed to grow. A small k or deep tree can follow training detail closely; a larger k or shallow tree can smooth over real detail. Compare them with the same preprocessing, split, and held-out criterion.",
      ],
      vocabulary: [
        {
          term: "Query point",
          definition:
            "The new example whose target the fitted model must predict.",
        },
        {
          term: "k-nearest neighbors",
          definition:
            "A predictor that finds the k closest stored training examples and combines their labels.",
        },
        {
          term: "Distance",
          definition:
            "A numeric measure of separation between feature vectors, meaningful only relative to the chosen representation and scale.",
        },
        {
          term: "Decision tree",
          definition:
            "A predictor that routes an example through learned feature-threshold questions to a leaf.",
        },
        {
          term: "Leaf",
          definition:
            "A terminal tree region that returns a class or numeric prediction.",
        },
        {
          term: "Inductive bias",
          definition:
            "The structural preference a learning method uses to extend from training examples to unseen cases.",
        },
      ],
      workedExample: {
        title: "Send one query through both models",
        setup:
          "Training points are (1, class 0), (3, class 0), (6, class 1), and (8, class 1). Predict query x = 5 with k = 3, then with a fitted tree split x < 5.5 whose left leaf predicts 0 and right leaf predicts 1.",
        steps: [
          {
            label: "Measure every kNN distance",
            explanation:
              "The absolute distances from x = 5 are 4 to x = 1, 2 to x = 3, 1 to x = 6, and 3 to x = 8.",
          },
          {
            label: "Select exactly k neighbors",
            explanation:
              "Sorting by distance gives x = 6 with class 1, x = 3 with class 0, and x = 8 with class 1 as the closest three.",
          },
          {
            label: "Take the neighbor vote",
            explanation:
              "The selected labels are [1, 0, 1]. Two of three are class 1, so this kNN configuration predicts class 1.",
          },
          {
            label: "Route through the tree",
            explanation:
              "The tree asks whether 5 < 5.5. The answer is yes, so the query follows the left branch to the leaf that predicts class 0.",
          },
          {
            label: "Explain the disagreement",
            explanation:
              "kNN used a local majority around the query. The tree used one previously learned threshold region. Different inductive biases can therefore assign different labels to the same input.",
          },
        ],
        takeaway:
          "A prediction is not just a label: it has a trace. For kNN, inspect distances, selected neighbors, and votes. For a tree, inspect threshold questions, branch directions, and the reached leaf.",
      },
      misconceptions: [
        {
          misconception: "kNN learns a set of threshold rules during training.",
          correction:
            "kNN mainly stores labeled examples; the neighborhood calculation happens when a query is predicted.",
        },
        {
          misconception: "A larger numeric feature should naturally matter more in distance.",
          correction:
            "A larger unit can dominate distance without being more informative. Scaling defines a comparable numeric geometry before kNN is used.",
        },
        {
          misconception: "A tree that perfectly fits training rows has discovered the true rule.",
          correction:
            "A deep tree can isolate individual rows. Its usefulness must be checked on previously unseen data under the same evaluation protocol.",
        },
      ],
      summary: [
        "For kNN, write the distance to every candidate before selecting the closest k.",
        "For a tree, evaluate one threshold at a time and follow only the resulting branch.",
        "When predictions differ, explain the local-neighborhood assumption and threshold-partition assumption before judging either model.",
      ],
      sourceIds: ["S79", "S51", "S07", "S14"],
    },
    mechanism: {
      input: "Labeled feature points and one query point",
      process:
        "Either vote among nearby stored examples or route the query through learned feature thresholds",
      output: "A class prediction and a boundary shaped by the model's inductive bias",
    },
    starterQuestions: [
      "What does k control in k-nearest neighbors?",
      "Why can feature scaling change a neighbor vote?",
      "Why does a shallow tree produce block-like regions?",
    ],
    prerequisiteConceptIds: [
      "feature-scaling",
      "categorical-encoding",
      "pipeline",
      "decision-threshold",
    ],
    outcomes: [
      {
        id: "knn-outcome",
        conceptId: "knn",
        text: "Trace a prediction through distances, neighbor selection, and voting.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "tree-outcome",
        conceptId: "decision-tree",
        text: "Trace a prediction through feature-threshold branches.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "bias-outcome",
        conceptId: "inductive-bias",
        text: "Choose between local smoothness and axis-aligned partition assumptions.",
        requiredEvidenceKinds: ["transfer"],
      },
    ],
    blocks: [
      {
        id: "knn-memory",
        kind: "opening",
        heading: "kNN predicts from stored examples",
        sourceIds: ["S14"],
        body: [
          "k-nearest neighbors stores the labeled training examples. For a new point, it computes distances, selects the k closest examples, and combines their labels.",
          "The method assumes that nearby points should often have similar targets. That local-similarity assumption is its central inductive bias.",
        ],
        conceptIds: ["knn", "inductive-bias"],
        tags: ["distance", "neighbors", "vote", "local similarity"],
      },
      {
        id: "knn-k-scale",
        kind: "worked-example",
        heading: "k and scale change the neighborhood",
        sourceIds: ["S14"],
        body: [
          "A small k follows local detail and can react strongly to one mislabeled point. A larger k averages over a wider region and can erase a small but real cluster.",
          "Distance depends on feature scale. If age ranges over tens and income over hundreds of thousands, unscaled income can dominate which points count as near.",
        ],
        conceptIds: ["knn", "feature-scaling"],
        tags: ["k", "variance", "smoothing", "scale"],
      },
      {
        id: "tree-rules",
        kind: "definition",
        heading: "A tree predicts by routing",
        sourceIds: ["S51"],
        body: [
          "A decision tree asks a sequence of questions such as temperature < 18 or pressure >= 4.5. Each split partitions the current rows, and a leaf returns a prediction.",
          "A standard numeric split is axis-aligned: one feature and one threshold at a time. Repeated splits create rectangular regions in feature space.",
        ],
        conceptIds: ["decision-tree", "inductive-bias"],
        tags: ["split", "threshold", "leaf", "axis aligned"],
      },
      {
        id: "tree-depth",
        kind: "worked-example",
        heading: "Depth controls partition detail",
        sourceIds: ["S51", "S79"],
        body: [
          "A shallow tree has few large regions and may miss a real interaction. A deep tree can isolate individual training examples and become unstable when the sample changes.",
          "Unlike kNN, a fitted tree stores split rules rather than consulting every training point for each prediction. Both can overfit, but through different mechanisms.",
        ],
        conceptIds: ["decision-tree", "model-capacity", "inductive-bias"],
        tags: ["depth", "overfit", "instability", "capacity"],
      },
      {
        id: "compare-bias",
        kind: "reading",
        heading: "Model choice is a claim about structure",
        sourceIds: ["S79"],
        body: [
          "kNN favors local similarity under a chosen distance. A tree favors a hierarchy of threshold rules. Neither bias is universally correct.",
          "Compare them under the same preprocessing, splits, and metric. A more flexible boundary on training data is not enough; the choice must survive validation and transfer to new cases.",
        ],
        conceptIds: ["knn", "decision-tree", "inductive-bias", "generalization"],
        tags: ["comparison", "validation", "boundary", "assumption"],
      },
    ],
    activities: [
      {
        id: "knn-tree-prediction",
        kind: "prediction",
        conceptIds: ["knn", "decision-tree"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "knn-tree-prediction",
          prompt:
            "A 1D kNN query is x=3.6. The training points are (1,0), (2,0), (4,1), and (5,1). With k=3, what is the majority prediction?",
          options: [
            { id: "one", label: "Class 1" },
            { id: "zero", label: "Class 0" },
            { id: "tie", label: "A tie" },
          ],
          correctOptionId: "one",
          supportedExplanation:
            "Correct. The three closest labels are 1 at x=4, 1 at x=5, and 0 at x=2.",
          revisitExplanation:
            "Compute the four absolute distances, sort them, and retain only the closest three.",
        },
      },
      {
        id: "knn-versus-tree-lab",
        kind: "visual-lab",
        labId: "knn-versus-tree",
        conceptIds: ["knn", "decision-tree", "inductive-bias"],
        evidenceKind: "manipulation",
        title: "Compare a moving neighborhood with a fixed split",
        prompt:
          "Predict both labels first, then move one query across the same data and inspect neighbor membership beside tree routing.",
        invariant:
          "The labeled training points, feature scaling, k, and fitted tree split stay fixed.",
        intervention:
          "Move only the query point and compare which neighbors vote and which tree branch receives it.",
        control: {
          label: "Query position",
          min: 0,
          max: 6,
          step: 0.25,
          initial: 3,
          lowLabel: "left region",
          highLabel: "right region",
        },
      },
      responseActivity(
        "knn-tree-explanation",
        "explanation",
        ["knn", "decision-tree", "inductive-bias"],
        "Explain how kNN and a decision tree can assign different labels to the same point. Trace each computation and name the structural assumption responsible.",
        "For kNN, name distance, k, and voting. For the tree, name learned thresholds, routing, and leaves.",
        [
          {
            id: "knn-trace",
            label: "trace kNN through distance, k closest points, and vote",
            keywordGroups: [
              ["distance", "near", "closest"],
              ["k", "neighbors"],
              ["vote", "majority"],
            ],
          },
          {
            id: "tree-trace",
            label: "trace the tree through threshold branches to a leaf",
            keywordGroups: [
              ["threshold", "split"],
              ["branch", "route"],
              ["leaf"],
            ],
          },
          {
            id: "knn-bias",
            label: "name local similarity as the kNN assumption",
            keywordGroups: [
              ["local", "nearby", "neighbor"],
              ["similar", "same class", "smooth"],
            ],
          },
          {
            id: "tree-bias",
            label: "name hierarchical axis-aligned partitioning as the tree assumption",
            keywordGroups: [
              ["axis-aligned", "one feature", "feature threshold"],
              ["partition", "rectangular", "hierarchy", "rules"],
            ],
          },
        ],
        "You traced both predictors and made their different inductive biases explicit.",
        "Describe the exact route to a label for each model before comparing their assumptions.",
      ),
      responseActivity(
        "knn-tree-dispatch-transfer",
        "transfer",
        ["knn", "decision-tree", "inductive-bias", "feature-scaling"],
        "An emergency dispatcher predicts whether a call needs a specialist team from response distance and symptom severity. Similar past calls form curved local clusters, but policy also requires an auditable rule. Compare kNN and a shallow tree, including scaling, boundary shape, noise sensitivity, and the operational tradeoff.",
        "Do not name a universal winner. State what each model assumes and what evidence would decide.",
        [
          {
            id: "dispatch-scaling",
            label: "scale distance and severity before kNN distance",
            keywordGroups: [
              ["scale", "standardize", "normalize"],
              ["distance", "severity"],
              ["kNN", "neighbor"],
            ],
          },
          {
            id: "dispatch-knn-shape",
            label: "connect kNN to curved local clusters and noise sensitivity",
            keywordGroups: [
              ["kNN", "neighbor"],
              ["local", "curved", "cluster"],
              ["noise", "outlier", "small k", "k"],
            ],
          },
          {
            id: "dispatch-tree-shape",
            label: "connect the tree to auditable threshold regions",
            keywordGroups: [
              ["tree"],
              ["threshold", "rule", "branch"],
              ["auditable", "explain", "inspect"],
            ],
          },
          {
            id: "dispatch-validation",
            label: "choose under a common held-out protocol",
            keywordGroups: [
              ["validation", "held-out", "unseen"],
              ["same", "common"],
              ["metric", "cost", "performance"],
            ],
          },
        ],
        "You compared the two biases against both data geometry and operational constraints.",
        "Address the geometry first, then the human policy constraint, and finish with a held-out comparison.",
      ),
      pythonLab(
        "knn-tree-python-lab",
        ["knn", "decision-tree", "inductive-bias"],
        "knn_vs_tree.py",
        "Predict the kNN vote and stump route before running. The specimen's stump routing is reversed; investigate the failed checks and repair only that comparison.",
        `def majority(labels):
    return int(sum(labels) * 2 >= len(labels))


def knn_predict(points, query, k):
    ranked = sorted(points, key=lambda point: (abs(point[0] - query), point[0]))
    return majority([label for _x, label in ranked[:k]])


def stump_predict(query, threshold, left_label, right_label):
    # BUG TO REPAIR: values below threshold must route left.
    return right_label if query < threshold else left_label


def stump_error(points, threshold, left_label, right_label):
    return sum(
        stump_predict(x, threshold, left_label, right_label) != label
        for x, label in points
    )


POINTS = [(1.0, 0), (2.0, 0), (4.0, 1), (5.0, 1)]
print("kNN at 3.6:", knn_predict(POINTS, 3.6, 3))
print("stump at 2.5:", stump_predict(2.5, 3.0, 0, 1))
print("stump error:", stump_error(POINTS, 3.0, 0, 1))
`,
        [
          {
            id: "knn-vote-check",
            label: "kNN votes among exactly the closest k points",
            expression: "knn_predict(POINTS, 3.6, 3)",
            expected: 1,
            conceptIds: ["knn"],
          },
          {
            id: "knn-local-check",
            label: "A different query produces a different local vote",
            expression: "knn_predict(POINTS, 1.4, 3)",
            expected: 0,
            conceptIds: ["knn"],
          },
          {
            id: "tree-left-check",
            label: "A value below the split routes left",
            expression: "stump_predict(2.5, 3.0, 0, 1)",
            expected: 0,
            conceptIds: ["decision-tree"],
          },
          {
            id: "tree-perfect-split-check",
            label: "The authored threshold separates the four points",
            expression: "stump_error(POINTS, 3.0, 0, 1)",
            expected: 0,
            conceptIds: ["decision-tree", "inductive-bias"],
          },
        ],
        110,
      ),
    ],
    resources: [
      interactive(
        "knn-tree-classifier-comparison",
        "Classifier comparison",
        "scikit-learn developers",
        "https://scikit-learn.org/1.8/auto_examples/classification/plot_classifier_comparison.html",
        5,
        "knn-tree-python-lab",
        "Inspect after tracing both mechanisms locally; compare boundary shape across fixed datasets without ranking one classifier universally.",
        "S79",
      ),
      interactive(
        "knn-tree-r2d3",
        "A Visual Introduction to Machine Learning, Part 1",
        "R2D3",
        "https://r2d3.us/visual-intro-to-machine-learning-part-1/",
        9,
        "knn-tree-python-lab",
        "Explore after the local transfer and track how each split changes the decision regions rather than treating a clean tree as inevitable.",
        "S51",
      ),
    ],
  },
  {
    id: "regularization-path",
    number: "11",
    moduleId: "classical",
    phase: "evaluate",
    published: true,
    title: "Control flexibility without touching the test set",
    question: "How do regularization and cross-validation constrain model selection?",
    summary:
      "Predict coefficient shrinkage, compare L1 with L2, and select a penalty from validation folds while preserving a final test.",
    durationMinutes: 55,
    revision: lessonRevision("regularization-path"),
    sourceIds: ["S81", "S82", "S07"],
    teaching: {
      title: "Constrain fitting, compare settings, and protect the final test",
      introduction: [
        "A flexible model can lower training loss by using large or finely tuned coefficients, yet those details may not repeat on new data. Regularization changes the fitting objective by adding a cost for coefficient size. The regularization strength, usually written lambda, controls how strongly that cost competes with fitting the training targets.",
        "L2 regularization penalizes the sum of squared coefficients and generally spreads shrinkage across them. L1 regularization penalizes the sum of absolute coefficients and can make some fitted coefficients exactly zero. Neither pattern proves that a retained feature is causal or that a zeroed feature is useless. The penalty is a modeling preference, and lambda is a setting that must be selected from evidence.",
        "Cross-validation supplies that evidence by rotating a validation role through the available development data. For each candidate lambda, fit on all but one fold and evaluate on the held-out fold, repeating until every fold has been held out. Average the fold losses, select the setting by that predefined criterion, then freeze it. The separate final test remains unopened until preprocessing, model family, and lambda are fixed.",
      ],
      vocabulary: [
        {
          term: "Regularization",
          definition:
            "A modification of the training objective that charges for coefficient complexity in addition to data loss.",
        },
        {
          term: "Lambda",
          definition:
            "The hyperparameter that sets the strength of the regularization penalty.",
        },
        {
          term: "L1 penalty",
          definition:
            "Lambda times the sum of absolute coefficient values, a shape that can produce exact zeros.",
        },
        {
          term: "L2 penalty",
          definition:
            "Lambda times the sum of squared coefficients, which encourages distributed shrinkage toward zero.",
        },
        {
          term: "Cross-validation fold",
          definition:
            "One partition that serves as validation while the remaining development partitions are used for fitting.",
        },
        {
          term: "Hyperparameter",
          definition:
            "A setting such as lambda chosen around model fitting rather than optimized as a coefficient within one fit.",
        },
      ],
      workedExample: {
        title: "Choose one lambda from three validation folds",
        setup:
          "Keep the final test sealed. Three candidate lambdas have fold losses: 0.0 -> [0.52, 0.66, 0.61], 0.5 -> [0.48, 0.51, 0.50], and 2.0 -> [0.62, 0.57, 0.65]. Lower loss is better.",
        steps: [
          {
            label: "Preserve comparable folds",
            explanation:
              "Every candidate uses the same three held-out folds, and preprocessing is fitted again inside each corresponding training-fold set.",
          },
          {
            label: "Average lambda 0.0",
            explanation:
              "Its mean validation loss is (0.52 + 0.66 + 0.61) / 3 = 1.79 / 3, about 0.597.",
          },
          {
            label: "Average lambda 0.5",
            explanation:
              "Its mean is (0.48 + 0.51 + 0.50) / 3 = 1.49 / 3, about 0.497.",
          },
          {
            label: "Average lambda 2.0",
            explanation:
              "Its mean is (0.62 + 0.57 + 0.65) / 3 = 1.84 / 3, about 0.613.",
          },
          {
            label: "Select by the stated rule",
            explanation:
              "Lambda 0.5 has the lowest mean fold loss, so it is selected. No test outcome participated in that comparison.",
          },
          {
            label: "Refit and evaluate once",
            explanation:
              "Refit the complete pipeline and regularized model on all development data with lambda fixed at 0.5, then use the final test once to estimate the frozen procedure.",
          },
        ],
        takeaway:
          "Regularization controls fitting, while cross-validation controls selection. Keeping those roles distinct prevents the final test from quietly becoming another tuning fold.",
      },
      misconceptions: [
        {
          misconception: "Stronger regularization must improve every loss.",
          correction:
            "It constrains fitting and can raise training loss. Validation loss may improve if reduced overfitting outweighs the lost flexibility, but that must be measured.",
        },
        {
          misconception: "An L1 zero proves a feature has no relationship with the target.",
          correction:
            "The selected pattern depends on penalty strength, sample, scaling, and correlated alternatives. A zero is a fitted model result, not a causal conclusion.",
        },
        {
          misconception: "Checking the test after each lambda gives more reliable selection.",
          correction:
            "Repeated test-guided changes tune to the test. Selection belongs inside development data, with the final test reserved for the frozen procedure.",
        },
      ],
      summary: [
        "Hold the data fit fixed in your reasoning and inspect how the penalty term changes as lambda changes.",
        "Compare candidate settings with all of their validation folds, not one convenient fold.",
        "Separate coefficient fitting, hyperparameter selection, final refitting, and one-time testing into distinct stages.",
      ],
      sourceIds: ["S81", "S82", "S07"],
    },
    mechanism: {
      input: "Training folds, candidate penalty strengths, model coefficients, and validation losses",
      process:
        "Fit penalized models repeatedly, aggregate validation loss, and freeze the selected setting",
      output: "A regularized model selected without using final test outcomes",
    },
    starterQuestions: [
      "What does a larger regularization strength do to coefficients?",
      "Why can L1 produce exact zeros while L2 usually does not?",
      "What question does cross-validation answer?",
    ],
    prerequisiteConceptIds: [
      "data-split",
      "generalization",
      "model-capacity",
      "pipeline",
    ],
    outcomes: [
      {
        id: "regularization-outcome",
        conceptId: "regularization",
        text: "Explain and compute coefficient shrinkage under L1 and L2 penalties.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "cross-validation-outcome",
        conceptId: "cross-validation",
        text: "Aggregate held-out fold losses for every candidate.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "selection-outcome",
        conceptId: "hyperparameter-selection",
        text: "Select a penalty without using the final test set.",
        requiredEvidenceKinds: ["transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "regularization-objective",
        kind: "opening",
        heading: "Penalize complexity inside the training objective",
        sourceIds: ["S82"],
        body: [
          "Regularized fitting minimizes data loss plus a coefficient penalty. The penalty changes which parameter values count as cheap even when two models fit training data similarly.",
          "This lesson's manual ridge calculation uses one feature through the origin and exactly minimizes J_SSE(w) = sum_i (y_i - w * x_i)^2 + lambda_SSE * w^2. There is no fitted intercept in this specimen. Under this summed-squared-error convention, the solution is w = sum_i (x_i * y_i) / (sum_i x_i^2 + lambda_SSE).",
          "If the data term is instead mean squared error, the objective is J_MSE(w) = (1/n) * sum_i (y_i - w * x_i)^2 + lambda_MSE * w^2, and the denominator becomes sum_i x_i^2 + n * lambda_MSE. The two objectives produce the same fit only when lambda_SSE = n * lambda_MSE, so the same printed lambda value does not mean the same penalty under both conventions.",
          "The regularization strength lambda is a hyperparameter: training optimizes coefficients for a fixed lambda, while validation evidence helps choose lambda.",
        ],
        conceptIds: ["regularization", "hyperparameter-selection"],
        tags: ["penalty", "lambda", "coefficient", "hyperparameter"],
      },
      {
        id: "regularization-l2",
        kind: "worked-example",
        heading: "L2 spreads shrinkage",
        sourceIds: ["S82"],
        body: [
          "L2 adds lambda times the sum of squared coefficients. For one feature through the origin, the fitted weight becomes sum(xy) / (sum(x squared) + lambda).",
          "With x = [1, 2] and y = [2, 4], the unregularized weight is 10/5 = 2. At lambda = 5 it becomes 10/10 = 1. Larger lambda pulls it toward zero.",
        ],
        conceptIds: ["regularization"],
        tags: ["L2", "ridge", "shrinkage", "closed form"],
      },
      {
        id: "regularization-l1",
        kind: "worked-example",
        heading: "L1 can create exact zeros",
        sourceIds: ["S81"],
        body: [
          "L1 adds lambda times the sum of absolute coefficients. Its sharp corner at zero can make some fitted coefficients exactly zero.",
          "A zero coefficient does not prove the feature is useless or causal. With correlated features, small data changes can alter which one L1 retains.",
        ],
        conceptIds: ["regularization", "inductive-bias"],
        tags: ["L1", "lasso", "sparsity", "correlation"],
      },
      {
        id: "regularization-cv",
        kind: "definition",
        heading: "Cross-validation rotates the validation role",
        sourceIds: ["S07", "S81"],
        body: [
          "In k-fold cross-validation, split the available training data into k folds. Fit on k-1 folds and evaluate on the remaining fold, rotating until every fold has served as validation.",
          "Each candidate lambda must use the same folds and the complete fitted pipeline inside each training fold. Average validation loss estimates the selection criterion.",
        ],
        conceptIds: ["cross-validation", "pipeline", "hyperparameter-selection"],
        tags: ["fold", "validation", "average", "pipeline"],
      },
      {
        id: "regularization-test",
        kind: "reading",
        heading: "Selection ends before final testing",
        sourceIds: ["S07", "S81"],
        body: [
          "After selecting lambda, refit the pipeline and model on the full development data under that frozen setting. Evaluate the final test set once for an independent estimate.",
          "Repeatedly checking test performance while changing lambda turns the test set into another validation set. The optimistic result no longer answers how the frozen procedure handles untouched data.",
        ],
        conceptIds: ["hyperparameter-selection", "data-split", "leakage"],
        tags: ["test set", "selection", "refit", "optimism"],
      },
    ],
    activities: [
      {
        id: "regularization-direction-prediction",
        kind: "prediction",
        conceptIds: ["regularization"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "regularization-direction-prediction",
          prompt:
            "For ridge weight sum(xy)/(sum(x^2)+lambda), what happens to the weight magnitude when lambda increases from 0 to 5?",
          options: [
            { id: "shrinks", label: "It shrinks toward zero" },
            { id: "grows", label: "It grows away from zero" },
            { id: "unchanged", label: "It cannot change" },
          ],
          correctOptionId: "shrinks",
          supportedExplanation:
            "Correct. Lambda enlarges the positive denominator while the numerator stays fixed.",
          revisitExplanation:
            "Hold sum(xy) and sum(x squared) fixed, then inspect only the denominator.",
        },
      },
      {
        id: "regularization-path-lab",
        kind: "visual-lab",
        labId: "regularization-path",
        conceptIds: [
          "regularization",
          "cross-validation",
          "hyperparameter-selection",
        ],
        evidenceKind: "manipulation",
        title: "Follow coefficients and validation loss along lambda",
        prompt:
          "Predict shrinkage first, then compare coefficient paths, training loss, and mean fold loss at two penalty strengths.",
        invariant:
          "The data, folds, feature pipeline, model family, and loss definition stay fixed.",
        intervention:
          "Change only lambda and inspect fitted coefficients plus training and cross-validation losses.",
        control: {
          label: "Regularization strength",
          min: 0,
          max: 4,
          step: 0.25,
          initial: 0,
          lowLabel: "weak penalty",
          highLabel: "strong penalty",
        },
      },
      responseActivity(
        "regularization-cv-explanation",
        "explanation",
        ["regularization", "cross-validation", "hyperparameter-selection"],
        "Explain why stronger regularization can raise training loss yet lower cross-validation loss. Include how L1 and L2 differ and why lambda is not chosen on the test set.",
        "Connect coefficient flexibility to fit, fold-to-fold generalization, penalty shape, and the role of the untouched test.",
        [
          {
            id: "regularization-training",
            label: "connect stronger penalty to smaller coefficients and constrained fit",
            keywordGroups: [
              ["stronger", "larger lambda", "more regularization"],
              ["smaller", "shrink", "toward zero"],
              ["coefficient", "weight"],
            ],
          },
          {
            id: "regularization-generalization",
            label: "explain the possible validation improvement through reduced overfit",
            keywordGroups: [
              ["validation", "cross-validation", "fold"],
              ["overfit", "variance", "generalize"],
              ["lower", "improve"],
            ],
          },
          {
            id: "regularization-l1-l2",
            label: "distinguish L1 sparsity from L2 distributed shrinkage",
            keywordGroups: [
              ["L1", "lasso"],
              ["zero", "sparse"],
              ["L2", "ridge"],
              ["shrink", "squared"],
            ],
          },
          {
            id: "regularization-test-role",
            label: "reserve test data for the frozen selected procedure",
            keywordGroups: [
              ["test"],
              ["untouched", "once", "final", "frozen"],
              ["not choose", "not tune", "selection"],
            ],
          },
        ],
        "You connected penalty geometry, training fit, cross-validation, and final testing.",
        "Explain separately what lambda does during fitting and what cross-validation does during selection.",
      ),
      responseActivity(
        "regularization-sensor-transfer",
        "transfer",
        ["regularization", "cross-validation", "hyperparameter-selection"],
        "A vibration model has 40 correlated sensor features and only 160 machines. Describe a defensible comparison of L1 and L2, including fold-local preprocessing, the evidence used to select lambda, what coefficient patterns you expect, and when the test set is opened.",
        "Account for correlation, pipeline fitting inside folds, repeated validation, and the final frozen evaluation.",
        [
          {
            id: "sensor-fold-pipeline",
            label: "fit preprocessing inside each training fold",
            keywordGroups: [
              ["each fold", "training fold"],
              ["preprocessing", "scaler", "pipeline"],
              ["fit"],
            ],
          },
          {
            id: "sensor-candidate-comparison",
            label: "compare candidate lambdas using mean validation loss",
            keywordGroups: [
              ["lambda", "penalty"],
              ["validation", "cross-validation"],
              ["mean", "average", "across folds"],
            ],
          },
          {
            id: "sensor-patterns",
            label: "expect L1 zeros and L2 shared shrinkage under correlation",
            keywordGroups: [
              ["L1"],
              ["zero", "sparse", "select"],
              ["L2"],
              ["share", "distributed", "shrink"],
              ["correlated"],
            ],
          },
          {
            id: "sensor-test-once",
            label: "open test data only after freezing model and lambda",
            keywordGroups: [
              ["test"],
              ["after", "only once", "final"],
              ["freeze", "selected", "chosen"],
            ],
          },
        ],
        "You transferred regularized selection to a small, correlated dataset without contaminating final evaluation.",
        "Walk through one fold, then selection across folds, then the single final test.",
      ),
      pythonLab(
        "regularization-python-lab",
        ["regularization", "cross-validation", "hyperparameter-selection"],
        "regularization_path.py",
        "Predict the manual ridge weights and soft-threshold outputs. Run the specimen, compare the explicit formula with scikit-learn Ridge, investigate why cross-validation chooses the worst candidate, then repair choose_lambda to minimize mean fold loss.",
        `import numpy as np
from sklearn.linear_model import Ridge


def ridge_weight(xs, ys, penalty):
    numerator = sum(x * y for x, y in zip(xs, ys))
    denominator = sum(x * x for x in xs) + penalty
    return numerator / denominator


def soft_threshold(value, penalty):
    if value > penalty:
        return value - penalty
    if value < -penalty:
        return value + penalty
    return 0.0


def mean(values):
    return sum(values) / len(values)


def sklearn_ridge_weight(xs, ys, penalty):
    features = np.asarray(xs, dtype=float).reshape(-1, 1)
    targets = np.asarray(ys, dtype=float)
    model = Ridge(alpha=penalty, fit_intercept=False)
    model.fit(features, targets)
    return float(model.coef_[0])


def choose_lambda(fold_losses):
    scored = [(mean(losses), penalty) for penalty, losses in fold_losses.items()]
    # BUG TO REPAIR: lower validation loss is better.
    return max(scored)[1]


FOLD_LOSSES = {
    0.0: [0.52, 0.66, 0.61],
    0.5: [0.48, 0.51, 0.50],
    2.0: [0.62, 0.57, 0.65],
}
ALTERNATE_FOLD_LOSSES = {
    0.0: [0.10, 0.90, 0.80],
    0.5: [0.30, 0.35, 0.40],
    2.0: [0.50, 0.20, 0.15],
}
print("ridge lambda 0:", ridge_weight([1.0, 2.0], [2.0, 4.0], 0.0))
print("ridge lambda 5:", ridge_weight([1.0, 2.0], [2.0, 4.0], 5.0))
print("scikit-learn lambda 5:", sklearn_ridge_weight([1.0, 2.0], [2.0, 4.0], 5.0))
print("chosen lambda:", choose_lambda(FOLD_LOSSES))
`,
        [
          {
            id: "regularization-ridge-zero-check",
            label: "Unregularized one-feature weight fits the slope",
            expression:
              "round(ridge_weight([1.0, 2.0], [2.0, 4.0], 0.0), 6)",
            expected: 2,
            conceptIds: ["regularization"],
          },
          {
            id: "regularization-ridge-shrink-check",
            label: "L2 penalty shrinks the weight",
            expression:
              "round(ridge_weight([1.0, 2.0], [2.0, 4.0], 5.0), 6)",
            expected: 1,
            conceptIds: ["regularization"],
          },
          {
            id: "regularization-library-check",
            label: "The library ridge fit matches the exposed one-feature formula",
            expression:
              "round(sklearn_ridge_weight([1.0, 2.0], [2.0, 4.0], 5.0), 6)",
            expected: 1,
            conceptIds: ["regularization"],
          },
          {
            id: "regularization-l1-zero-check",
            label: "Soft thresholding can produce an exact zero",
            expression: "soft_threshold(0.2, 0.5)",
            expected: 0,
            conceptIds: ["regularization"],
          },
          {
            id: "regularization-cv-choice-check",
            label: "Cross-validation selects the lowest mean fold loss",
            expression: "choose_lambda(FOLD_LOSSES)",
            expected: 0.5,
            conceptIds: ["cross-validation", "hyperparameter-selection"],
          },
          {
            id: "regularization-cv-aggregation-check",
            label:
              "Selection aggregates all folds and can choose a different lambda",
            expression: "choose_lambda(ALTERNATE_FOLD_LOSSES)",
            expected: 2,
            conceptIds: ["cross-validation", "hyperparameter-selection"],
          },
        ],
        111,
        ["scikit-learn"],
      ),
    ],
    resources: [
      reading(
        "regularization-lasso-selection",
        "Lasso model selection: AIC-BIC / cross-validation",
        "scikit-learn developers",
        "https://scikit-learn.org/1.8/auto_examples/linear_model/plot_lasso_model_selection.html",
        10,
        "regularization-python-lab",
        "Inspect after implementing shrinkage and selection; distinguish criterion-based and cross-validated choices before final testing.",
        "S81",
      ),
      reading(
        "regularization-google-l2",
        "Overfitting: L2 regularization",
        "Google for Developers",
        "https://developers.google.com/machine-learning/crash-course/overfitting/regularization?hl=en",
        6,
        "regularization-python-lab",
        "Read after the manual and library ridge weights agree; compare the penalty effect without reopening the test set.",
        "S82",
      ),
    ],
  },
  {
    id: "ensemble-votes",
    number: "12",
    moduleId: "classical",
    phase: "model",
    published: true,
    title: "Many weak views can form one stronger model",
    question: "When do bagging, random forests, and boosting improve a predictor?",
    summary:
      "Separate parallel averaging from sequential correction and identify whether each ensemble attacks variance or bias.",
    durationMinutes: 50,
    revision: lessonRevision("ensemble-votes"),
    sourceIds: ["S83", "S84", "S07"],
    teaching: {
      title: "Combine different learners for a specific reason",
      introduction: [
        "An ensemble combines predictions from multiple base learners. The combination helps only when the learners contribute meaningfully different errors or corrections. Repeating one deterministic model with identical data and settings merely repeats the same output. The design question is therefore not just how many models to train, but how they differ and how their outputs are combined.",
        "Bagging creates parallel learners by fitting each one on a bootstrap sample: a same-sized sample drawn from training rows with replacement. Regression outputs are averaged and class outputs can be voted. This is especially useful for unstable learners such as deep trees, whose fitted structure can change when training rows change. A random forest adds random feature subsets at candidate splits to reduce similarity among its trees.",
        "Boosting uses a different timeline. It builds learners sequentially, with each new stage aimed at error left by the current ensemble. Under squared error, training first computes residual targets as target minus current prediction, then fits a small learner g(x) to those residuals. The update adds learning_rate times g(x), not each row's raw target or residual. Once fitted, g predicts from features at inference time without receiving the unknown target. Bagging and forests primarily target sample-driven instability, while boosting can reduce systematic underfit; validation is still required for either choice.",
      ],
      vocabulary: [
        {
          term: "Ensemble",
          definition:
            "A predictor formed by combining outputs from multiple fitted base learners.",
        },
        {
          term: "Base learner",
          definition:
            "One component model whose output contributes to the ensemble.",
        },
        {
          term: "Bootstrap sample",
          definition:
            "A same-sized training sample drawn with replacement, so rows can repeat and others can be absent.",
        },
        {
          term: "Bagging",
          definition:
            "Training diverse learners on bootstrap samples in parallel and aggregating their outputs.",
        },
        {
          term: "Random forest",
          definition:
            "A tree ensemble that combines bootstrap variation with random feature subsets during split selection.",
        },
        {
          term: "Boosting",
          definition:
            "Building an ensemble in sequence so each added learner addresses error remaining from earlier stages.",
        },
      ],
      workedExample: {
        title: "Trace parallel averaging and sequential correction",
        setup:
          "For one regression case with target 12, three bootstrap-fitted trees predict 8, 11, and 14. Separately, a boosting model currently predicts 2 for a different case whose target is 4, with learning rate 0.5.",
        steps: [
          {
            label: "Aggregate the bagged trees",
            explanation:
              "The regression ensemble prediction is their mean: (8 + 11 + 14) / 3 = 33 / 3 = 11.",
          },
          {
            label: "Compare component errors",
            explanation:
              "Using prediction minus target, the three errors are -4, -1, and 2. They are not identical, so averaging allows some disagreement to offset.",
          },
          {
            label: "Keep the bagging timeline parallel",
            explanation:
              "Each tree was fitted from its own bootstrap sample without receiving another tree's residual. Their interaction occurs only when outputs are aggregated.",
          },
          {
            label: "Compute the boosting residual",
            explanation:
              "For the second case, residual target = target - current prediction = 4 - 2 = 2. During training, the next base learner g is fitted across all training rows to approximate their residual targets from features.",
          },
          {
            label: "Use the fitted learner's prediction",
            explanation:
              "Assume the fitted learner predicts g(x) = 1.5 for this case. The ensemble update is F_new(x) = F(x) + learning_rate * g(x) = 2 + 0.5(1.5) = 2.75. The correction can miss the raw residual because g is a constrained learner shared across rows.",
          },
          {
            label: "Separate training from inference",
            explanation:
              "Targets are used to create residual training targets and fit g. For a new case, the saved ensemble evaluates its already fitted learners from the new features; the unknown target is not an input to prediction.",
          },
        ],
        takeaway:
          "Bagging combines independently varied fits after training; boosting changes what the next learner is asked to correct. The arithmetic may involve addition in both cases, but the training procedures are different.",
      },
      misconceptions: [
        {
          misconception: "More copies of the same model automatically reduce variance.",
          correction:
            "Identical outputs have perfectly aligned errors, so their average is unchanged. Stabilization requires useful diversity.",
        },
        {
          misconception: "A random forest is just one very deep tree.",
          correction:
            "It aggregates many trees and deliberately varies both sampled rows and candidate features to reduce tree correlation.",
        },
        {
          misconception:
            "Boosting trains learners independently or copies each new case's target residual.",
          correction:
            "Boosting is sequential: training targets define residuals for fitting the next stage, but at inference each fitted stage predicts its scaled correction from features without the unknown target.",
        },
      ],
      summary: [
        "Before averaging, ask what created differences among the component learners.",
        "Keep parallel bootstrap fitting separate from sequential residual correction.",
        "Match the proposed ensemble to observed instability or underfit, then require held-out evidence rather than assuming improvement.",
      ],
      sourceIds: ["S83", "S84", "S07"],
    },
    mechanism: {
      input: "Training rows, base learners, resampled datasets or residual errors",
      process:
        "Train diverse learners in parallel and aggregate them, or train learners sequentially to correct remaining error",
      output: "An ensemble prediction with changed variance or bias",
    },
    starterQuestions: [
      "Why does averaging identical models add no diversity?",
      "How does a random forest decorrelate its trees?",
      "What information does the next boosting stage receive?",
    ],
    prerequisiteConceptIds: [
      "decision-tree",
      "model-capacity",
      "regularization",
      "generalization",
    ],
    outcomes: [
      {
        id: "bagging-outcome",
        conceptId: "bagging",
        text: "Explain bootstrap fitting and parallel aggregation as a variance intervention.",
        requiredEvidenceKinds: ["explanation", "code-check"],
      },
      {
        id: "forest-outcome",
        conceptId: "random-forest",
        text: "Explain why random feature subsets can reduce tree correlation.",
        requiredEvidenceKinds: ["explanation", "transfer"],
      },
      {
        id: "boosting-outcome",
        conceptId: "boosting",
        text: "Trace a sequential correction of residual error.",
        requiredEvidenceKinds: ["transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "ensemble-diversity",
        kind: "opening",
        heading: "Aggregation needs disagreement",
        sourceIds: ["S83"],
        body: [
          "Averaging can stabilize predictions only when component errors are not perfectly aligned. Copying one deterministic model many times produces the same prediction and no variance reduction.",
          "An ensemble therefore combines two ideas: create meaningfully different base learners, then aggregate or sequence their outputs.",
        ],
        conceptIds: ["bagging", "random-forest"],
        tags: ["ensemble", "diversity", "correlation", "aggregation"],
      },
      {
        id: "ensemble-bagging",
        kind: "worked-example",
        heading: "Bagging trains in parallel",
        sourceIds: ["S83"],
        body: [
          "Bagging draws bootstrap samples from the training rows, fits one base learner per sample, then averages regression predictions or votes on classes.",
          "Deep trees are unstable: a changed sample can change early splits. Averaging many such trees can reduce this sample-driven variance while retaining flexible fits.",
        ],
        conceptIds: ["bagging", "decision-tree"],
        tags: ["bootstrap", "parallel", "average", "variance"],
      },
      {
        id: "ensemble-forest",
        kind: "definition",
        heading: "Random forests also vary the available features",
        sourceIds: ["S83"],
        body: [
          "If one strong feature dominates every tree, bootstrap trees can remain highly correlated. A random forest offers only a random subset of features at each candidate split.",
          "Feature subsampling can force different useful structures to appear, reducing correlation among trees. It may weaken individual trees while strengthening their average.",
        ],
        conceptIds: ["random-forest", "bagging"],
        tags: ["feature subsampling", "decorrelation", "tree", "forest"],
      },
      {
        id: "ensemble-boosting",
        kind: "worked-example",
        heading: "Boosting trains in sequence",
        sourceIds: ["S84"],
        body: [
          "Boosting adds a small learner that focuses on what the current ensemble still gets wrong. For squared error, training computes residual targets as target minus current prediction, then fits the next learner g(x) to approximate those residuals from features.",
          "The updated ensemble is F_new(x) = F(x) + learning_rate times g(x). The fitted correction can differ from an individual row's raw residual because one constrained learner must serve multiple rows. At inference, the saved g(x) reads features, not the unknown target.",
        ],
        conceptIds: ["boosting"],
        tags: ["sequential", "residual", "correction", "learning rate"],
      },
      {
        id: "ensemble-bias-variance",
        kind: "reading",
        heading: "Name the failure before choosing the ensemble",
        sourceIds: ["S83", "S84"],
        body: [
          "Bagging and random forests primarily address unstable, high-variance learners. Boosting can reduce systematic underfit by composing many small corrections, though it also needs regularization and validation.",
          "The labels variance and bias are diagnostic summaries, not guarantees. Compare learning curves, multi-seed variation, and held-out error under the same protocol.",
        ],
        conceptIds: ["bagging", "random-forest", "boosting", "generalization"],
        tags: ["bias", "variance", "underfit", "validation"],
      },
    ],
    activities: [
      {
        id: "ensemble-diversity-prediction",
        kind: "prediction",
        conceptIds: ["bagging", "random-forest"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "ensemble-diversity-prediction",
          prompt:
            "Three regression trees fitted on different bootstrap samples predict 6, 9, and 15 for one case. What is their simple bagged average?",
          options: [
            { id: "six", label: "6" },
            { id: "nine", label: "9" },
            { id: "ten", label: "10" },
            { id: "fifteen", label: "15" },
          ],
          correctOptionId: "ten",
          supportedExplanation:
            "Correct. The simple average is (6 + 9 + 15) / 3 = 30 / 3 = 10.",
          revisitExplanation:
            "Add the three predictions and divide by the number of trees.",
        },
      },
      {
        id: "ensemble-votes-lab",
        kind: "visual-lab",
        labId: "ensemble-votes",
        conceptIds: ["bagging", "random-forest", "boosting"],
        evidenceKind: "manipulation",
        title: "Change correlation, not the target",
        prompt:
          "Predict the ensemble spread first, then compare repeated samples as tree correlation changes while individual error scale stays fixed.",
        invariant:
          "The target function, number of learners, individual error scale, split, and aggregation rule stay fixed.",
        intervention:
          "Change only how correlated the base learners are and inspect ensemble variability across repeated samples.",
        control: {
          label: "Base-learner correlation",
          min: 0,
          max: 1,
          step: 0.1,
          initial: 1,
          lowLabel: "diverse errors",
          highLabel: "aligned errors",
        },
      },
      responseActivity(
        "ensemble-mechanism-explanation",
        "explanation",
        ["bagging", "random-forest", "boosting"],
        "Explain why bootstrap trees can reduce variance, why random feature subsets may improve their average, and why boosting is not bagging.",
        "Contrast parallel resampling and aggregation with sequential error correction.",
        [
          {
            id: "bagging-bootstrap",
            label: "connect bootstrap samples to different parallel trees",
            keywordGroups: [
              ["bootstrap", "resample"],
              ["different", "diverse"],
              ["trees", "learners"],
              ["parallel", "independent"],
            ],
          },
          {
            id: "bagging-variance",
            label: "connect averaging imperfectly correlated trees to lower variance",
            keywordGroups: [
              ["average", "vote", "aggregate"],
              ["correlated", "correlation", "different errors"],
              ["variance", "stability"],
            ],
          },
          {
            id: "forest-features",
            label: "explain feature subsampling as tree decorrelation",
            keywordGroups: [
              ["random forest"],
              ["feature subset", "random features", "feature subsampling"],
              ["decorrelate", "less correlated", "different splits"],
            ],
          },
          {
            id: "boosting-sequence",
            label: "explain boosting as sequential correction",
            keywordGroups: [
              ["boosting"],
              ["sequential", "next learner", "stage"],
              ["residual", "error", "mistake", "correct"],
            ],
          },
        ],
        "You separated diversity and averaging from staged residual correction.",
        "Use two timelines: bagging learners train beside one another; boosting learners train one after another.",
      ),
      responseActivity(
        "ensemble-grid-transfer",
        "transfer",
        ["bagging", "random-forest", "boosting"],
        "A power-grid tree model changes sharply when a few training days are replaced, and most trees always split first on temperature. A separate shallow model underfits every fold. Propose one ensemble intervention for each failure and state the evidence that would support it.",
        "Diagnose instability, correlated trees, and systematic underfit separately.",
        [
          {
            id: "grid-instability-bagging",
            label: "use bagging for sample-driven tree instability",
            keywordGroups: [
              ["bagging", "bootstrap"],
              ["unstable", "changes sharply", "variance"],
              ["average", "vote"],
            ],
          },
          {
            id: "grid-correlation-forest",
            label: "use random feature subsets to reduce temperature dominance",
            keywordGroups: [
              ["random forest", "feature subset", "random features"],
              ["temperature"],
              ["correlation", "diversity", "different splits"],
            ],
          },
          {
            id: "grid-underfit-boost",
            label: "use sequential boosting for residual underfit",
            keywordGroups: [
              ["boosting"],
              ["underfit", "bias"],
              ["residual", "correct", "next learner"],
            ],
          },
          {
            id: "grid-evidence",
            label: "require held-out and multi-sample evidence",
            keywordGroups: [
              ["validation", "held-out", "unseen"],
              ["seeds", "samples", "folds", "repeated"],
              ["error", "variance", "performance"],
            ],
          },
        ],
        "You matched each ensemble mechanism to a distinct observed failure and named the evidence needed.",
        "Treat the unstable tree, correlated trees, and underfitting shallow model as three separate diagnoses.",
      ),
      {
        ...pythonLab(
        "ensemble-python-lab",
        ["bagging", "random-forest", "boosting"],
        "ensemble_votes.py",
        "Predict the vote and average, then compute residual targets for the four training rows. Fit the one-split residual stump by averaging residuals on each side, and predict its shared corrections before running. Investigate the boosting sign error, then modify only the update direction so the fitted stump moves the ensemble toward the targets.",
        `def majority_vote(predictions):
    return int(sum(predictions) * 2 >= len(predictions))


def average_predictions(model_predictions):
    columns = zip(*model_predictions)
    return [sum(values) / len(values) for values in columns]


def residuals(predictions, targets):
    return [target - prediction for prediction, target in zip(predictions, targets)]


def fit_residual_stump(features, residual_targets, threshold):
    left = [
        residual
        for feature, residual in zip(features, residual_targets)
        if feature < threshold
    ]
    right = [
        residual
        for feature, residual in zip(features, residual_targets)
        if feature >= threshold
    ]
    return sum(left) / len(left), sum(right) / len(right)


def stump_predictions(features, threshold, left_value, right_value):
    return [
        left_value if feature < threshold else right_value
        for feature in features
    ]


def boost_step(features, predictions, targets, threshold, learning_rate):
    stage_targets = residuals(predictions, targets)
    left_value, right_value = fit_residual_stump(
        features,
        stage_targets,
        threshold,
    )
    corrections = stump_predictions(
        features,
        threshold,
        left_value,
        right_value,
    )
    # BUG TO REPAIR: add the fitted learner's correction instead of moving away.
    return [
        prediction - learning_rate * correction
        for prediction, correction in zip(predictions, corrections)
    ]


def mse(predictions, targets):
    return sum((prediction - target) ** 2 for prediction, target in zip(predictions, targets)) / len(targets)


FEATURES = [0.0, 1.0, 2.0, 3.0]
BASE_PREDICTIONS = [2.0, 2.0, 5.0, 5.0]
TARGETS = [4.0, 2.0, 1.0, 3.0]
STUMP_THRESHOLD = 2.0

print("vote:", majority_vote([1, 0, 1]))
print("average:", average_predictions([[1.0, 3.0], [3.0, 5.0], [5.0, 7.0]]))
print("residuals:", residuals(BASE_PREDICTIONS, TARGETS))
print("boosted:", boost_step(FEATURES, BASE_PREDICTIONS, TARGETS, STUMP_THRESHOLD, 0.5))
`,
        [
          {
            id: "ensemble-vote-check",
            label: "Classification learners combine by majority vote",
            expression: "majority_vote([1, 0, 1])",
            expected: 1,
            conceptIds: ["bagging"],
          },
          {
            id: "ensemble-average-check",
            label: "Regression learners combine pointwise by averaging",
            expression:
              "str(average_predictions([[1.0, 3.0], [3.0, 5.0], [5.0, 7.0]]))",
            expected: "[3.0, 5.0]",
            conceptIds: ["bagging"],
          },
          {
            id: "ensemble-boost-stump-check",
            label:
              "The weak learner fits one shared residual value per region",
            expression:
              "str(fit_residual_stump(FEATURES, residuals(BASE_PREDICTIONS, TARGETS), STUMP_THRESHOLD))",
            expected: "(1.0, -3.0)",
            conceptIds: ["boosting"],
          },
          {
            id: "ensemble-boost-step-check",
            label:
              "The fitted residual learner updates the ensemble and lowers loss",
            expression:
              "str((boost_step(FEATURES, BASE_PREDICTIONS, TARGETS, STUMP_THRESHOLD, 0.5), round(mse(boost_step(FEATURES, BASE_PREDICTIONS, TARGETS, STUMP_THRESHOLD, 0.5), TARGETS), 6)))",
            expected: "([2.5, 2.5, 3.5, 3.5], 2.25)",
            conceptIds: ["boosting"],
          },
          {
            id: "ensemble-boost-rate-check",
            label: "Learning rate scales the fitted learner's contribution",
            expression:
              "str(boost_step(FEATURES, BASE_PREDICTIONS, TARGETS, STUMP_THRESHOLD, 0.25))",
            expected: "[2.25, 2.25, 4.25, 4.25]",
            conceptIds: ["boosting"],
          },
        ],
        112,
        ),
        evidenceConceptIds: ["bagging", "boosting"],
      },
    ],
    resources: [
      videoAndReading(
        "ensemble-bagging-video",
        "Intuitions on ensemble models: bagging",
        "Inria Learning Lab",
        "https://inria.github.io/scikit-learn-mooc/ensemble/bagging_slides.html",
        13,
        "ensemble-python-lab",
        "After the local vote and averaging mechanisms, watch the 12:43 explanation and compare its resampling story with the authored variance diagnosis.",
        "S83",
      ),
      videoAndReading(
        "ensemble-boosting-video",
        "Intuitions on ensemble models: boosting",
        "Inria Learning Lab",
        "https://inria.github.io/scikit-learn-mooc/ensemble/boosting_slides.html",
        15,
        "ensemble-python-lab",
        "After repairing the local residual direction, watch the 14:22 explanation and compare sequential correction with independent bagging.",
        "S84",
      ),
    ],
  },
  {
    id: "xor-hidden-space",
    number: "13",
    moduleId: "neural",
    phase: "model",
    published: true,
    title: "Hidden units can rebuild the space",
    question: "How can nonlinear composition solve XOR?",
    summary:
      "Construct two nonlinear hidden features that turn XOR into a linearly separable hidden representation.",
    durationMinutes: 50,
    revision: lessonRevision("xor-hidden-space"),
    sourceIds: ["S80", "S49", "S15"],
    teaching: {
      title: "Create new coordinates before drawing the final boundary",
      introduction: [
        "XOR, short for exclusive OR, is a binary rule that returns 1 when exactly one of two inputs is 1. Its four cases are 0 for (0,0), 1 for (1,0), 1 for (0,1), and 0 for (1,1). Plotted as four corners of a square, the two positive cases sit at opposite corners, so one straight line cannot place both positives on one side and both negatives on the other.",
        "A neural layer first forms weighted sums plus biases. If one such linear calculation feeds directly into another, substitution collapses them into another single linear calculation. More layers alone therefore do not change the kind of boundary available. An activation function inserts a nonlinear operation between layers. ReLU, the rectified linear unit, returns max(0, a): it keeps a positive input and replaces a negative input with zero.",
        "A hidden unit is an intermediate calculation, and the values produced by hidden units form a hidden representation. For XOR, two directed differences can create useful new coordinates: h1 = ReLU(x1 - x2) and h2 = ReLU(x2 - x1). Equal inputs map to (0,0), while the two unequal cases activate different coordinates. A final linear sum can then separate the hidden representations with a simple threshold.",
      ],
      vocabulary: [
        {
          term: "XOR",
          definition:
            "A two-input binary rule whose output is 1 exactly when the input values differ.",
        },
        {
          term: "Linear boundary",
          definition:
            "A straight dividing line in a two-feature plane, produced by thresholding one weighted sum.",
        },
        {
          term: "Hidden unit",
          definition:
            "An intermediate weighted calculation followed here by an activation function.",
        },
        {
          term: "Activation function",
          definition:
            "A transformation applied between layers that can make their composition nonlinear.",
        },
        {
          term: "ReLU",
          definition:
            "The nonlinear function ReLU(a) = max(0, a), which clips negative values to zero.",
        },
        {
          term: "Hidden representation",
          definition:
            "The new coordinate values computed by hidden units and supplied to the output layer.",
        },
      ],
      workedExample: {
        title: "Trace all four XOR cases through two hidden units",
        setup:
          "Use h1 = ReLU(x1 - x2), h2 = ReLU(x2 - x1), output score s = h1 + h2, and predicted class 1 when s is at least 0.5.",
        steps: [
          {
            label: "Trace input (0,0)",
            explanation:
              "Both differences are 0, so the hidden pair is (0,0). The score is 0 + 0 = 0, which is below 0.5 and produces class 0.",
          },
          {
            label: "Trace input (1,0)",
            explanation:
              "The directed differences are 1 and -1. ReLU produces hidden pair (1,0); the score is 1, so the output is class 1.",
          },
          {
            label: "Trace input (0,1)",
            explanation:
              "The directed differences are -1 and 1. ReLU produces hidden pair (0,1); the score is again 1, so the output is class 1.",
          },
          {
            label: "Trace input (1,1)",
            explanation:
              "Both differences are 0, giving hidden pair (0,0), score 0, and class 0.",
          },
          {
            label: "Read the new geometry",
            explanation:
              "Equal inputs share hidden point (0,0). Unequal inputs have hidden sums of 1. The final threshold is linear in hidden space because the nonlinear work already happened in the ReLU features.",
          },
        ],
        takeaway:
          "The network does not force one line to solve the original corner pattern. It first computes a representation in which equal and unequal inputs have a simple numeric separation, then applies a linear output rule.",
      },
      misconceptions: [
        {
          misconception: "Two weighted-sum layers automatically make a nonlinear model.",
          correction:
            "Without an activation between them, substituting the first affine expression into the second yields another affine expression.",
        },
        {
          misconception: "ReLU is a threshold that directly returns the XOR label.",
          correction:
            "Each ReLU hidden unit returns a numeric coordinate. The output layer combines both coordinates and applies the final decision threshold.",
        },
        {
          misconception: "Every learned hidden unit has a stable human-readable meaning.",
          correction:
            "These two formulas are deliberately constructed and transparent. Hidden coordinates learned in larger networks need not match named human concepts.",
        },
      ],
      summary: [
        "Write the four input-target pairs before reasoning about any proposed XOR model.",
        "When layers are composed, inspect whether a nonlinear activation actually sits between their weighted sums.",
        "Trace input coordinates, hidden coordinates, output score, and threshold as separate stages.",
      ],
      sourceIds: ["S80", "S49", "S15"],
    },
    mechanism: {
      input: "Two binary inputs, hidden weights and biases, and an output rule",
      process:
        "Apply nonlinear hidden units to create new coordinates, then combine those coordinates linearly",
      output: "An XOR score that is positive exactly when one input is active",
    },
    starterQuestions: [
      "Why can no single line separate XOR in the original plane?",
      "What new coordinates do hidden units create?",
      "Why is a nonlinear activation essential between linear layers?",
    ],
    prerequisiteConceptIds: [
      "linear-parameters",
      "classification-score",
      "inductive-bias",
    ],
    outcomes: [
      {
        id: "xor-boundary-outcome",
        conceptId: "xor",
        text: "Explain why one linear boundary cannot classify XOR.",
        requiredEvidenceKinds: ["explanation"],
      },
      {
        id: "xor-hidden-outcome",
        conceptId: "hidden-representation",
        text: "Compute hidden coordinates that separate XOR.",
        requiredEvidenceKinds: ["explanation", "transfer", "code-check"],
      },
      {
        id: "xor-composition-outcome",
        conceptId: "nonlinear-composition",
        text: "Explain why two linear layers need a nonlinear activation between them.",
        requiredEvidenceKinds: ["transfer", "code-check"],
      },
    ],
    blocks: [
      {
        id: "xor-pattern",
        kind: "opening",
        heading: "XOR labels opposite corners together",
        sourceIds: ["S15"],
        body: [
          "XOR is 1 when exactly one binary input is 1. Its four cases are (0,0) -> 0, (1,0) -> 1, (0,1) -> 1, and (1,1) -> 0.",
          "In the input plane, the positive examples occupy opposite corners. Any single straight boundary that isolates one positive corner places the other on the wrong side.",
        ],
        conceptIds: ["xor", "inductive-bias"],
        tags: ["XOR", "binary", "linearly separable", "corners"],
      },
      {
        id: "xor-linear-collapse",
        kind: "definition",
        heading: "Stacked linear maps remain linear",
        sourceIds: ["S80"],
        body: [
          "If one layer computes h = A x + a and the next computes z = B h + b, substitution gives z = B A x + B a + b. The composition is still one linear map plus a bias.",
          "Depth alone does not create a curved or disconnected boundary. A nonlinear activation between layers changes that algebra.",
        ],
        conceptIds: ["nonlinear-composition"],
        tags: ["linear map", "composition", "substitution", "activation"],
      },
      {
        id: "xor-hidden-features",
        kind: "worked-example",
        heading: "Rectification exposes disagreement",
        sourceIds: ["S15", "S80"],
        body: [
          "ReLU(a) = max(0, a): positive inputs pass through unchanged, while negative inputs become zero. This is the nonlinear activation used in the two authored hidden features.",
          "Let h1 = ReLU(x1 - x2) and h2 = ReLU(x2 - x1). For (1,0), the hidden pair is (1,0); for (0,1), it is (0,1).",
          "For both equal-input cases, (0,0) and (1,1), the hidden pair is (0,0). The hidden coordinates have turned opposite positive corners into points that share a simple property: h1 + h2 is positive.",
        ],
        conceptIds: ["hidden-representation", "xor"],
        tags: ["ReLU", "hidden unit", "coordinate", "difference"],
      },
      {
        id: "xor-output",
        kind: "worked-example",
        heading: "The output layer reads the new geometry",
        sourceIds: ["S15", "S80"],
        body: [
          "An output score s = h1 + h2 is 1 for unequal inputs and 0 for equal inputs. Thresholding at 0.5 reproduces the XOR truth table.",
          "The output operation is linear in hidden space. The model succeeds because the nonlinear hidden transformation changed the representation before that final line was drawn.",
        ],
        conceptIds: ["hidden-representation", "nonlinear-composition", "xor"],
        tags: ["output layer", "hidden space", "threshold", "truth table"],
      },
      {
        id: "xor-interpretation",
        kind: "reading",
        heading: "Hidden coordinates are computations, not little names",
        sourceIds: ["S15", "S49"],
        body: [
          "Here each hidden unit has a transparent authored formula. In a trained network, useful coordinates are learned jointly and need not correspond to stable human concepts.",
          "A visual boundary can show what the network computes on a small domain, but it does not by itself explain generalization, calibration, or causality.",
        ],
        conceptIds: ["hidden-representation", "generalization"],
        tags: ["interpretation", "learned representation", "causality", "boundary"],
      },
    ],
    activities: [
      {
        id: "xor-linear-prediction",
        kind: "prediction",
        conceptIds: ["xor", "nonlinear-composition"],
        evidenceKind: "prediction",
        renderer: "choice",
        checkpoint: {
          id: "xor-linear-prediction",
          prompt:
            "Use h1 = ReLU(x1 - x2), h2 = ReLU(x2 - x1), and score s = h1 + h2. What score is produced for x1 = 2 and x2 = 0?",
          options: [
            { id: "zero", label: "0" },
            { id: "one", label: "1" },
            { id: "two", label: "2" },
            { id: "negative-two", label: "-2" },
          ],
          correctOptionId: "two",
          supportedExplanation:
            "Correct. h1 = ReLU(2) = 2, h2 = ReLU(-2) = 0, and s = 2 + 0 = 2.",
          revisitExplanation:
            "Compute both directed differences, apply ReLU to each, and then add the two hidden values.",
        },
      },
      {
        id: "xor-hidden-space-lab",
        kind: "visual-lab",
        labId: "xor-hidden-space",
        conceptIds: ["xor", "hidden-representation", "nonlinear-composition"],
        evidenceKind: "manipulation",
        title: "Watch XOR become separable",
        prompt:
          "Predict all four hidden pairs first, then move from a linear pass-through to the authored ReLU difference features and compare fixed targets with changing predictions.",
        invariant:
          "The four XOR inputs, immutable targets, final output weights, and threshold stay fixed.",
        intervention:
          "Change only the strength of the nonlinear hidden transformation and inspect input coordinates, hidden coordinates, and output scores.",
        control: {
          label: "Hidden nonlinearity strength",
          min: 0,
          max: 1,
          step: 0.1,
          initial: 0,
          lowLabel: "linear pass-through",
          highLabel: "ReLU difference features",
        },
      },
      responseActivity(
        "xor-mechanism-explanation",
        "explanation",
        ["xor", "hidden-representation", "nonlinear-composition"],
        "Explain why one linear boundary fails on XOR and trace all four inputs through h1 = ReLU(x1 - x2), h2 = ReLU(x2 - x1), and score h1 + h2.",
        "Name the input geometry, hidden coordinates for equal and unequal inputs, and the final threshold.",
        [
          {
            id: "xor-opposite-corners",
            label: "identify positive and negative XOR cases as opposite corners",
            keywordGroups: [
              ["opposite corners", "diagonal"],
              ["positive", "class 1", "unequal"],
              ["negative", "class 0", "equal"],
            ],
          },
          {
            id: "xor-linear-failure",
            label: "state that one straight boundary cannot separate both positive corners",
            keywordGroups: [
              ["line", "linear boundary", "straight boundary"],
              ["cannot", "not separable", "fails"],
              ["both", "opposite"],
            ],
          },
          {
            id: "xor-row-00",
            label: "trace input 0,0 to hidden 0,0, score 0, and label 0",
            keywordGroups: [
              ["input (0,0)", "input 0 0", "(0,0)"],
              ["hidden (0,0)", "hidden 0 0", "h1 = 0 and h2 = 0"],
              ["score 0"],
              ["label 0", "class 0"],
            ],
          },
          {
            id: "xor-row-10",
            label: "trace input 1,0 to hidden 1,0, score 1, and label 1",
            keywordGroups: [
              ["input (1,0)", "input 1 0", "(1,0)"],
              ["hidden (1,0)", "hidden 1 0", "h1 = 1 and h2 = 0"],
              ["score 1"],
              ["label 1", "class 1"],
            ],
          },
          {
            id: "xor-row-01",
            label: "trace input 0,1 to hidden 0,1, score 1, and label 1",
            keywordGroups: [
              ["input (0,1)", "input 0 1", "(0,1)"],
              ["hidden (0,1)", "hidden 0 1", "h1 = 0 and h2 = 1"],
              ["score 1"],
              ["label 1", "class 1"],
            ],
          },
          {
            id: "xor-row-11",
            label: "trace input 1,1 to hidden 0,0, score 0, and label 0",
            keywordGroups: [
              ["input (1,1)", "input 1 1", "(1,1)"],
              ["hidden (0,0)", "hidden 0 0", "h1 = 0 and h2 = 0"],
              ["score 0"],
              ["label 0", "class 0"],
            ],
          },
          {
            id: "xor-output-threshold",
            label: "sum hidden values and threshold at one half",
            keywordGroups: [
              ["sum", "h1 + h2", "add"],
              ["0.5", "one half", "threshold"],
            ],
          },
        ],
        "You showed exactly how nonlinear hidden coordinates turn XOR into a simple output threshold.",
        "Build a four-row table with input, h1, h2, score, and label, then explain why no input-space line matches it.",
      ),
      responseActivity(
        "xor-switch-transfer",
        "transfer",
        ["xor", "hidden-representation", "nonlinear-composition"],
        "A safety lamp should turn on when exactly one of two override switches is active, but stay off when both are equal. Map this problem to XOR, give two hidden ReLU features, and explain why the final output can be linear in hidden space.",
        "Use the switch states as binary inputs and show the equal versus unequal hidden coordinates.",
        [
          {
            id: "switch-xor-map",
            label: "map exactly one active switch to XOR positive",
            keywordGroups: [
              ["exactly one", "one switch"],
              ["XOR", "exclusive or", "positive", "lamp on"],
            ],
          },
          {
            id: "switch-hidden-formulas",
            label: "provide both directed ReLU difference features",
            keywordGroups: [
              ["ReLU"],
              ["x1 - x2", "switch 1 - switch 2"],
              ["x2 - x1", "switch 2 - switch 1"],
            ],
          },
          {
            id: "switch-equal-zero",
            label: "show equal switch states map to zero-zero",
            keywordGroups: [
              ["both off", "both on", "equal"],
              ["zero", "(0,0)", "both hidden"],
            ],
          },
          {
            id: "switch-linear-output",
            label: "explain that hidden sum separates unequal from equal states",
            keywordGroups: [
              ["sum", "h1 + h2", "add"],
              ["hidden space", "hidden representation"],
              ["linear", "threshold", "0.5"],
            ],
          },
        ],
        "You transferred nonlinear representation building from a geometric puzzle to a control rule.",
        "Translate each of the four switch states first, then reuse the two directional difference features.",
      ),
      pythonLab(
        "xor-python-lab",
        ["xor", "hidden-representation", "nonlinear-composition"],
        "xor_hidden_space.py",
        "Predict the hidden coordinates and truth table before running. Run the nearly working specimen, find the duplicated hidden direction, then repair h2 so it responds to the opposite unequal input.",
        `def relu(value):
    return max(0.0, value)


def hidden_features(x1, x2):
    h1 = relu(x1 - x2)
    # BUG TO REPAIR: h2 must detect the opposite directed difference.
    h2 = relu(x1 - x2)
    return h1, h2


def xor_score(x1, x2):
    h1, h2 = hidden_features(x1, x2)
    return h1 + h2


def xor_predict(x1, x2):
    return int(xor_score(x1, x2) >= 0.5)


CASES = [(0, 0), (1, 0), (0, 1), (1, 1)]
print("hidden:", [hidden_features(x1, x2) for x1, x2 in CASES])
print("predictions:", [xor_predict(x1, x2) for x1, x2 in CASES])
`,
        [
          {
            id: "xor-all-hidden-check",
            label: "All four inputs produce the exact authored hidden pairs",
            expression:
              "str([hidden_features(x1, x2) for x1, x2 in CASES])",
            expected: "[(0.0, 0.0), (1, 0.0), (0.0, 1), (0.0, 0.0)]",
            conceptIds: ["hidden-representation", "xor"],
          },
          {
            id: "xor-truth-table-check",
            label: "The hidden representation reproduces XOR",
            expression:
              "str([xor_predict(x1, x2) for x1, x2 in CASES])",
            expected: "[0, 1, 1, 0]",
            conceptIds: ["xor", "nonlinear-composition"],
          },
          {
            id: "xor-score-table-check",
            label: "All four hidden scores preserve the authored table",
            expression:
              "str([xor_score(x1, x2) for x1, x2 in CASES])",
            expected: "[0.0, 1.0, 1.0, 0.0]",
            conceptIds: ["hidden-representation", "nonlinear-composition"],
          },
        ],
        113,
      ),
    ],
    resources: [
      video(
        "xor-3blue1brown",
        "But what is a neural network?",
        "3Blue1Brown",
        "https://www.3blue1brown.com/lessons/neural-networks/",
        19,
        "xor-python-lab",
        "After constructing XOR locally, watch the 18:40 visual lesson as reinforcement; do not treat named visual units as guaranteed semantic explanations.",
        "S49",
      ),
      interactive(
        "xor-tensorflow-playground",
        "TensorFlow Playground",
        "TensorFlow team",
        "https://playground.tensorflow.org/",
        15,
        "xor-python-lab",
        "After the reproducible local truth table passes, explore one external XOR run while changing only one control. Its initialization can vary between runs.",
        "S15",
      ),
    ],
  },
];
