export type CurrentConceptId =
  | "array-shape"
  | "python-state"
  | "numpy-array"
  | "plot-axes"
  | "slope-chain-rule"
  | "probability-baseline"
  | "data-role"
  | "prediction-contract"
  | "parameter-update"
  | "training-versus-inference"
  | "baseline"
  | "linear-parameters"
  | "residual"
  | "loss"
  | "loss-landscape"
  | "gradient-direction"
  | "gradient-descent"
  | "learning-rate"
  | "data-split"
  | "leakage"
  | "generalization"
  | "model-capacity"
  | "learning-curves"
  | "logit"
  | "sigmoid"
  | "log-loss"
  | "classification-score"
  | "decision-threshold"
  | "confusion-matrix"
  | "calibration"
  | "decision-cost"
  | "feature-scaling"
  | "categorical-encoding"
  | "missing-values"
  | "pipeline"
  | "knn"
  | "decision-tree"
  | "inductive-bias"
  | "regularization"
  | "cross-validation"
  | "hyperparameter-selection"
  | "bagging"
  | "random-forest"
  | "boosting"
  | "hidden-representation"
  | "nonlinear-composition"
  | "xor"
  | "computational-graph"
  | "chain-rule"
  | "backpropagation"
  | "autodiff"
  | "mini-batch"
  | "initialization"
  | "momentum"
  | "adam"
  | "optimization-dynamics"
  | "k-means"
  | "pca"
  | "embedding-objective"
  | "convolution"
  | "weight-sharing"
  | "receptive-field"
  | "residual-path"
  | "attention"
  | "qkv"
  | "transformer"
  | "bandit"
  | "mdp"
  | "bellman-update"
  | "q-learning"
  | "distribution-shift"
  | "fairness"
  | "monitoring"
  | "system-diagnosis";

// Kept for migration of persisted evidence while the fresh fixed course replaces
// the discarded trial curriculum. New lesson content must not use these IDs.
export type LegacyConceptId =
  | "input-versus-parameter"
  | "target-versus-prediction"
  | "model-versus-learning-algorithm"
  | "linear-rule"
  | "prediction-error"
  | "examples-as-evidence"
  | "train-test-split"
  | "python-model"
  | "evaluation-metrics"
  | "model-selection"
  | "end-to-end-project";

export type ConceptId = CurrentConceptId | LegacyConceptId;

export type EvidenceKind =
  | "prediction"
  | "manipulation"
  | "explanation"
  | "transfer"
  | "code-check";

export type EvidenceLevel = "unsupported" | "partial" | "demonstrated";

export interface ResourceAttempt {
  id: string;
  type: "resource";
  lessonId: string;
  resourceId: string;
  status: "opened" | "returned" | "skipped";
  observedAt: string;
}

export interface ActivityAttempt {
  id: string;
  type: "activity";
  lessonId: string;
  lessonRevision?: string;
  activityId: string;
  evidenceKind: EvidenceKind;
  response: string;
  rubricSignals: string[];
  level: EvidenceLevel;
  observedAt: string;
}

export type LearnerEvent = ResourceAttempt | ActivityAttempt;

export interface ConceptEvidence {
  id: string;
  conceptId: ConceptId;
  sourceAttemptId: string;
  lessonId?: string;
  lessonRevision?: string;
  activityId?: string;
  kind: EvidenceKind;
  level: EvidenceLevel;
  summary: string;
  observedAt: string;
}

export interface LearnerRecord {
  version: 1;
  events: LearnerEvent[];
  evidence: ConceptEvidence[];
}

export interface ExplanationAssessment {
  level: EvidenceLevel;
  matchedCriteria: string[];
  missingCriteria: string[];
  feedback: string;
}
