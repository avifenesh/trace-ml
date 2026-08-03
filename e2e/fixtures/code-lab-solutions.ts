interface SolutionRepair {
  before: string;
  after: string;
}

export const CODE_LAB_SOLUTION_REPAIRS = {
  "00-python-numpy-plot": {
    before: "return np.row_stack((x, prediction))",
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
      "    # Modify: return the fixed diagnosis when both alert thresholds fail.\n    return None",
    after: `    # Return the fixed diagnosis when both release gates fail.
    if shift > shift_threshold and gap > gap_threshold:
        return "data-shift-and-subgroup-gap"
    return "within-fixed-release-gates"`,
  },
} as const satisfies Record<string, SolutionRepair>;

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
