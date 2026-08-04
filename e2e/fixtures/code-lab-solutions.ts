interface SolutionRepair {
  before: string;
  after: string;
}

interface SourceReplacement extends SolutionRepair {
  occurrences?: number;
}

interface BypassProbe {
  id: string;
  activityId: string;
  replacements: SourceReplacement[];
  rejectedBy: string[];
}

export const CODE_LAB_SOLUTION_REPAIRS = {
  "00-python-numpy-plot": {
    before: "return np.vstack((x, prediction))",
    after: "return np.column_stack((x, prediction))",
  },
  "03-python-loss": {
    before:
      "trial_weight = 1.0  # Modify to 2.0 after the first run.",
    after:
      "trial_weight = 2.0  # Modified after inspecting the first run.",
  },
  "04-python-descent": {
    before:
      "learning_rate = 0.5  # Modify to 0.05 after investigating the first trace.",
    after:
      "learning_rate = 0.05  # Modified after investigating the first trace.",
  },
  "05-python-splits": {
    before:
      "SELECTION_ROWS = TEST_ROWS  # Leakage: modify this to VALIDATION_ROWS.",
    after:
      "SELECTION_ROWS = VALIDATION_ROWS  # Selection uses validation only.",
  },
  "06-python-capacity": {
    before:
      "chosen_coefficients = OVERFIT_COEFFICIENTS  # Modify to QUADRATIC_COEFFICIENTS.",
    after:
      "chosen_coefficients = QUADRATIC_COEFFICIENTS  # Selected using validation evidence.",
  },
  "logistic-python-lab": {
    before: "return -math.log(probability)",
    after:
      "return -math.log(probability if target == 1 else 1.0 - probability)",
  },
  "decision-python-lab": {
    before: "return max(scored)[1]",
    after: "return min(scored)[1]",
  },
  "pipeline-python-lab": {
    before:
      "VALIDATION_FEATURES = PREPROCESSOR.fit_transform(VALIDATION)",
    after: "VALIDATION_FEATURES = PREPROCESSOR.transform(VALIDATION)",
  },
  "knn-tree-python-lab": {
    before: "return right_label if query < threshold else left_label",
    after: "return left_label if query < threshold else right_label",
  },
  "regularization-python-lab": {
    before: "return max(scored)[1]",
    after: "return min(scored)[1]",
  },
  "ensemble-python-lab": {
    before: "prediction - learning_rate * correction",
    after: "prediction + learning_rate * correction",
  },
  "xor-python-lab": {
    before: "h2 = relu(x1 - x2)",
    after: "h2 = relu(x2 - x1)",
  },
  "backprop-python-lab": {
    before:
      "    # Modify: return both path contributions and their accumulated sum.\n    return None",
    after:
      "    # Return both route contributions and their accumulated gradient.\n    return product_contribution, square_contribution, product_contribution + square_contribution",
  },
  "optimizer-python-lab": {
    before:
      "    # Modify: apply the bias-corrected Adam parameter update.\n    next_weight = None",
    after:
      "    # Apply the bias-corrected Adam parameter update.\n    next_weight = weight - learning_rate * corrected_first / (\n        corrected_second ** 0.5 + epsilon\n    )",
  },
  "cluster-python-lab": {
    before:
      "    # Modify: return the index of the nearest centroid for every point.\n    return None",
    after: `    # Return the index of the nearest centroid for every point.
    return [
        min(
            range(len(centroids)),
            key=lambda index: squared_distance(point, centroids[index]),
        )
        for point in points
    ]`,
  },
  "convolution-python-lab": {
    before:
      "            # Modify: accumulate patch values times the same kernel values.\n            value = None",
    after: `            # Accumulate this patch with the same shared kernel.
            value = sum(
                image[row + kernel_row][column + kernel_column]
                * kernel[kernel_row][kernel_column]
                for kernel_row in range(len(kernel))
                for kernel_column in range(len(kernel[0]))
            )`,
  },
  "attention-python-lab": {
    before: "    output = None",
    after:
      "    output = sum(weight * value for weight, value in zip(weights, values))",
  },
  "q-learning-python-lab": {
    before:
      "    # Modify: terminal uses reward only; otherwise bootstrap from max next value.\n    return None",
    after:
      "    # Terminal uses reward only; otherwise bootstrap from max next value.\n    return reward if terminal else reward + discount * max(next_values)",
  },
  "shift-monitor-python-lab": {
    before:
      "    # Modify: return the fixed diagnosis for both, one, or no alert.\n    return None",
    after: `    # Return the fixed diagnosis for both, one, or no alert.
    shift_alert = shift > shift_threshold
    gap_alert = gap > gap_threshold
    if shift_alert and gap_alert:
        return "data-shift-and-subgroup-gap"
    if shift_alert:
        return "data-shift-only"
    if gap_alert:
        return "subgroup-gap-only"
    return "within-alert-thresholds"`,
  },
} as const satisfies Record<string, SolutionRepair>;

export const CODE_LAB_BYPASS_PROBES: BypassProbe[] = [
  {
    id: "line-points-returns-authored-fixture",
    activityId: "00-python-numpy-plot",
    replacements: [
      {
        before: "return np.column_stack((x, prediction))",
        after:
          "return np.array([[0.0, 1.0], [1.0, 3.0], [2.0, 5.0]])",
      },
    ],
    rejectedBy: ["00-code-held-out-coordinates"],
  },
  {
    id: "logistic-loss-returns-authored-constant",
    activityId: "logistic-python-lab",
    replacements: [
      {
        before:
          "return -math.log(probability if target == 1 else 1.0 - probability)",
        after: "return 0.2231435513",
      },
    ],
    rejectedBy: ["logistic-negative-loss-check"],
  },
  {
    id: "threshold-selector-hardcodes-one-candidate",
    activityId: "decision-python-lab",
    replacements: [
      {
        before: "return min(scored)[1]",
        after: "return 0.5",
      },
    ],
    rejectedBy: ["decision-threshold-check"],
  },
  {
    id: "displayed-descent-trace-ignores-rate",
    activityId: "04-python-descent",
    replacements: [
      {
        before:
          "final_weight, loss_history = train(ROWS, 0.0, learning_rate, 12)",
        after:
          "final_weight, loss_history = train(ROWS, 0.0, 0.5, 12)",
      },
    ],
    rejectedBy: ["04-code-convergence"],
  },
  {
    id: "regularization-uses-first-fold",
    activityId: "regularization-python-lab",
    replacements: [
      {
        before: "return min(scored)[1]",
        after:
          "return min(fold_losses, key=lambda penalty: fold_losses[penalty][0])",
      },
    ],
    rejectedBy: ["regularization-cv-aggregation-check"],
  },
  {
    id: "regularization-selector-hardcodes-one-lambda",
    activityId: "regularization-python-lab",
    replacements: [
      {
        before: "return min(scored)[1]",
        after: "return 0.5",
      },
    ],
    rejectedBy: ["regularization-cv-aggregation-check"],
  },
  {
    id: "boosting-hardcodes-half-residual",
    activityId: "ensemble-python-lab",
    replacements: [
      {
        before: "prediction + learning_rate * correction",
        after: "prediction + correction / 2",
      },
    ],
    rejectedBy: ["ensemble-boost-rate-check"],
  },
  {
    id: "boosting-copies-raw-training-residuals",
    activityId: "ensemble-python-lab",
    replacements: [
      {
        before: `corrections = stump_predictions(
        features,
        threshold,
        left_value,
        right_value,
    )`,
        after: "corrections = stage_targets",
      },
    ],
    rejectedBy: ["ensemble-boost-step-check"],
  },
  {
    id: "backprop-swaps-route-contributions",
    activityId: "backprop-python-lab",
    replacements: [
      {
        before:
          "return product_contribution, square_contribution, product_contribution + square_contribution",
        after:
          "return square_contribution, product_contribution, product_contribution + square_contribution",
      },
    ],
    rejectedBy: ["backprop-route-identity"],
  },
  {
    id: "adam-uses-gradient-sign",
    activityId: "optimizer-python-lab",
    replacements: [
      {
        before: `next_weight = weight - learning_rate * corrected_first / (
        corrected_second ** 0.5 + epsilon
    )`,
        after:
          "next_weight = weight - learning_rate * (1.0 if gradient > 0 else -1.0)",
      },
    ],
    rejectedBy: ["optimizer-adam-stateful-second-step"],
  },
  {
    id: "cluster-returns-authored-assignments",
    activityId: "cluster-python-lab",
    replacements: [
      {
        before: `return [
        min(
            range(len(centroids)),
            key=lambda index: squared_distance(point, centroids[index]),
        )
        for point in points
    ]`,
        after: "return [0, 0, 1, 1]",
      },
    ],
    rejectedBy: ["cluster-alternate-assignments"],
  },
  {
    id: "convolution-returns-authored-grid",
    activityId: "convolution-python-lab",
    replacements: [
      {
        before: `value = sum(
                image[row + kernel_row][column + kernel_column]
                * kernel[kernel_row][kernel_column]
                for kernel_row in range(len(kernel))
                for kernel_column in range(len(kernel[0]))
            )`,
        after:
          "value = [[0.0, -1.0], [-1.0, 1.0]][row][column]",
      },
    ],
    rejectedBy: ["convolution-manual-output"],
  },
  {
    id: "attention-leaves-output-incomplete",
    activityId: "attention-python-lab",
    replacements: [
      {
        before:
          "output = sum(weight * value for weight, value in zip(weights, values))",
        after: "output = None",
      },
    ],
    rejectedBy: ["attention-no-training"],
  },
  {
    id: "attention-returns-authored-output",
    activityId: "attention-python-lab",
    replacements: [
      {
        before:
          "output = sum(weight * value for weight, value in zip(weights, values))",
        after: "output = 8.0",
      },
    ],
    rejectedBy: ["attention-weighted-output"],
  },
  {
    id: "q-table-does-not-mutate",
    activityId: "q-learning-python-lab",
    replacements: [
      {
        before:
          "table[state][action] = q_update(table[state][action], target, learning_rate)",
        after:
          "q_update(table[state][action], target, learning_rate)",
      },
    ],
    rejectedBy: ["q-table-mutation", "q-terminal-table-mutation"],
  },
  {
    id: "q-bellman-hard-codes-discount",
    activityId: "q-learning-python-lab",
    replacements: [
      {
        before:
          "return reward if terminal else reward + discount * max(next_values)",
        after:
          "return reward if terminal else reward + 0.9 * max(next_values)",
      },
    ],
    rejectedBy: ["q-bellman-continuing"],
  },
  {
    id: "q-terminal-reads-next-state",
    activityId: "q-learning-python-lab",
    replacements: [
      {
        before:
          "next_values = [] if terminal else list(table[next_state].values())",
        after: "next_values = list(table[next_state].values())",
      },
    ],
    rejectedBy: ["q-terminal-table-mutation"],
  },
  {
    id: "release-treats-missing-support-as-zero",
    activityId: "shift-monitor-python-lab",
    replacements: [
      {
        before: "    if not positives:\n        return None",
        after: "    if not positives:\n        return 0.0",
        occurrences: 2,
      },
    ],
    rejectedBy: ["shift-missing-support"],
  },
  {
    id: "diagnosis-collapses-one-alert-branches",
    activityId: "shift-monitor-python-lab",
    replacements: [
      {
        before: `    if shift_alert and gap_alert:
        return "data-shift-and-subgroup-gap"
    if shift_alert:
        return "data-shift-only"
    if gap_alert:
        return "subgroup-gap-only"
    return "within-alert-thresholds"`,
        after: `    if shift_alert and gap_alert:
        return "data-shift-and-subgroup-gap"
    return "within-alert-thresholds"`,
      },
    ],
    rejectedBy: ["shift-fixed-diagnosis"],
  },
];

function replaceExpectedOccurrences(
  source: string,
  replacement: SourceReplacement,
  context: string,
) {
  const expectedOccurrences = replacement.occurrences ?? 1;
  const actualOccurrences = source.split(replacement.before).length - 1;
  if (actualOccurrences !== expectedOccurrences) {
    throw new Error(
      `${context} expected ${expectedOccurrences} repair target occurrence(s), found ${actualOccurrences}.`,
    );
  }
  return source.split(replacement.before).join(replacement.after);
}

export function buildSolvedSource(activityId: string, starter: string) {
  if (!Object.hasOwn(CODE_LAB_SOLUTION_REPAIRS, activityId)) {
    throw new Error(`Missing solved source repair for ${activityId}.`);
  }

  const repair =
    CODE_LAB_SOLUTION_REPAIRS[
      activityId as keyof typeof CODE_LAB_SOLUTION_REPAIRS
    ];
  const firstMatch = starter.indexOf(repair.before);
  const secondMatch = starter.indexOf(
    repair.before,
    firstMatch + repair.before.length,
  );

  if (firstMatch < 0) {
    throw new Error(
      `The authored starter for ${activityId} no longer contains its bounded repair target.`,
    );
  }
  if (secondMatch >= 0) {
    throw new Error(
      `The authored starter for ${activityId} contains its bounded repair target more than once.`,
    );
  }

  return (
    starter.slice(0, firstMatch) +
    repair.after +
    starter.slice(firstMatch + repair.before.length)
  );
}

export function buildBypassSource(
  activityId: string,
  probeId: string,
  solvedSource: string,
) {
  const probe = CODE_LAB_BYPASS_PROBES.find(
    (candidate) =>
      candidate.activityId === activityId && candidate.id === probeId,
  );
  if (!probe) {
    throw new Error(`Missing bypass probe ${activityId}/${probeId}.`);
  }
  return probe.replacements.reduce(
    (source, replacement) =>
      replaceExpectedOccurrences(
        source,
        replacement,
        `Bypass probe ${activityId}/${probeId}`,
      ),
    solvedSource,
  );
}
