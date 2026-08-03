import type {
  ConceptId,
  EvidenceKind,
} from "../learning/types";

export type LessonPhase = "observe" | "model" | "learn" | "evaluate" | "build";

export interface LearningOutcome {
  id: string;
  conceptId: ConceptId;
  text: string;
  requiredEvidenceKinds: EvidenceKind[];
}

export interface LessonBlock {
  id: string;
  kind: "opening" | "reading" | "worked-example" | "definition" | "checkpoint";
  heading: string;
  body: string[];
  conceptIds: ConceptId[];
  tags: string[];
  sourceIds: string[];
}

export interface PageChunk {
  id: string;
  blockId: string;
  heading: string;
  text: string;
  conceptIds: ConceptId[];
  tags: string[];
  sourceIds: string[];
}

export interface LessonResource {
  id: string;
  kind: "video" | "reading" | "video-and-reading" | "interactive";
  role: "core" | "extension" | "remediation" | "math-refresh";
  afterActivityId: string;
  title: string;
  publisher: string;
  url: string;
  durationMinutes: number;
  placement: string;
  verifiedAt: string;
  sourceId?: string;
}

export interface LessonCheckpoint {
  id: string;
  prompt: string;
  options: Array<{
    id: string;
    label: string;
  }>;
  correctOptionId: string;
  supportedExplanation: string;
  revisitExplanation: string;
}

export interface PredictionActivity {
  id: string;
  kind: "prediction";
  conceptIds: ConceptId[];
  evidenceConceptIds?: ConceptId[];
  evidenceKind: "prediction";
  checkpoint: LessonCheckpoint;
  renderer?: "choice" | "line-model";
}

export interface TextRubricCriterion {
  id: string;
  label: string;
  keywordGroups: string[][];
}

export interface TextResponseActivity {
  id: string;
  kind: "text-response";
  conceptIds: ConceptId[];
  evidenceConceptIds?: ConceptId[];
  evidenceKind: "explanation" | "transfer";
  prompt: string;
  guidance: string;
  rubric: {
    criteria: TextRubricCriterion[];
    demonstratedFeedback: string;
    unsupportedFeedback: string;
  };
}

export interface VisualLabActivity {
  id: string;
  kind: "visual-lab";
  labId:
    | "dataset-evidence"
    | "loss-comparison"
    | "holdout-behavior"
    | "gradient-direction"
    | "descent-loop"
    | "classification-threshold"
    | "hidden-representation"
    | "backprop-credit"
    | "training-dynamics"
    | "evaluation-tradeoffs"
    | "prerequisite-trace"
    | "data-and-baseline"
    | "linear-model"
    | "loss-landscape"
    | "gradient-descent"
    | "split-and-leakage"
    | "capacity-curves"
    | "logistic-link"
    | "decision-costs"
    | "feature-pipeline"
    | "knn-versus-tree"
    | "regularization-path"
    | "ensemble-votes"
    | "xor-hidden-space"
    | "backprop-graph"
    | "optimizer-traces"
    | "cluster-project"
    | "convolution-field"
    | "attention-routing"
    | "q-learning"
    | "shift-monitor";
  conceptIds: ConceptId[];
  evidenceConceptIds?: ConceptId[];
  evidenceKind: "manipulation";
  title: string;
  prompt: string;
  invariant?: string;
  intervention?: string;
  control?: {
    label: string;
    min: number;
    max: number;
    step: number;
    initial: number;
    lowLabel: string;
    highLabel: string;
  };
}

export interface CodeCheck {
  id: string;
  label: string;
  expression: string;
  expected: string | number | boolean;
  conceptIds: ConceptId[];
}

export interface CodeLabSpec {
  runtimeId: "pyodide-314.0.3";
  environmentDigest: string;
  seed: number;
  timeoutMs: number;
  maxOutputBytes: number;
  maxOutputLines: number;
  instructions: string;
  starterFiles: Array<{
    path: string;
    language: "python";
    contents: string;
  }>;
  checks: CodeCheck[];
  allowedPackages: string[];
}

export interface CodeLabActivity {
  id: string;
  kind: "code-lab";
  conceptIds: ConceptId[];
  evidenceConceptIds?: ConceptId[];
  evidenceKind: "code-check";
  spec: CodeLabSpec;
}

export type LessonActivity =
  | PredictionActivity
  | TextResponseActivity
  | VisualLabActivity
  | CodeLabActivity;

export interface Lesson {
  id: string;
  number: string;
  moduleId: string;
  phase: LessonPhase;
  published: boolean;
  title: string;
  question: string;
  summary: string;
  durationMinutes: number;
  revision?: string;
  sourceIds?: string[];
  mechanism?: {
    input: string;
    process: string;
    output: string;
  };
  starterQuestions?: string[];
  prerequisiteConceptIds: ConceptId[];
  outcomes: LearningOutcome[];
  blocks: LessonBlock[];
  activities: LessonActivity[];
  resources: LessonResource[];
  checkpoint?: LessonCheckpoint;
}

export interface CourseModule {
  id: string;
  number: string;
  title: string;
  purpose: string;
  lessonIds: string[];
}

export function pageChunksForLesson(lesson: Lesson): PageChunk[] {
  return lesson.blocks.flatMap((block) =>
    block.body.map((text, index) => ({
      id: `${block.id}:p${index + 1}`,
      blockId: block.id,
      heading: block.heading,
      text,
      conceptIds: block.conceptIds,
      tags: block.tags,
      sourceIds: block.sourceIds,
    })),
  );
}
