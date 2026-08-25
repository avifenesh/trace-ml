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

export interface TeachingTerm {
  term: string;
  definition: string;
}

export interface TeachingStep {
  label: string;
  explanation: string;
}

export interface TeachingMisconception {
  misconception: string;
  correction: string;
}

export interface LessonTeachingGuide {
  title: string;
  introduction: string[];
  vocabulary: TeachingTerm[];
  workedExample: {
    title: string;
    setup: string;
    steps: TeachingStep[];
    takeaway: string;
  };
  misconceptions: TeachingMisconception[];
  summary: string[];
  sourceIds: string[];
}

export interface PageChunk {
  id: string;
  blockId: string;
  anchorId: string;
  citationLabel: string;
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
  runtimeId: "pyodide-314.0.4";
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
  teaching: LessonTeachingGuide;
  blocks: LessonBlock[];
  activities: LessonActivity[];
  resources: LessonResource[];
  checkpoint?: LessonCheckpoint;
}

export function teachingBlockIdForLesson(lesson: Lesson) {
  return `${lesson.id}-teaching`;
}

type TeachingChunkKind =
  | "introduction"
  | "term"
  | "example-setup"
  | "example-step"
  | "example-takeaway"
  | "misconception"
  | "summary";

export function teachingChunkIdForLesson(
  lesson: Lesson,
  kind: TeachingChunkKind,
  index?: number,
) {
  const suffix = index === undefined ? kind : `${kind}-${index + 1}`;
  return `${teachingBlockIdForLesson(lesson)}:${suffix}`;
}

export function teachingChunksForLesson(lesson: Lesson): PageChunk[] {
  const blockId = teachingBlockIdForLesson(lesson);
  const conceptIds = lesson.outcomes.map((outcome) => outcome.conceptId);
  const shared = {
    blockId,
    conceptIds,
    sourceIds: lesson.teaching.sourceIds,
  };
  return [
    ...lesson.teaching.introduction.map((text, index) => ({
      ...shared,
      id: teachingChunkIdForLesson(lesson, "introduction", index),
      anchorId: teachingChunkIdForLesson(lesson, "introduction", index),
      citationLabel:
        `${lesson.teaching.title} · introduction ${index + 1}`,
      heading: lesson.teaching.title,
      text,
      tags: ["teaching", "mental model", "introduction"],
    })),
    ...lesson.teaching.vocabulary.map(({ term, definition }, index) => ({
      ...shared,
      id: teachingChunkIdForLesson(lesson, "term", index),
      anchorId: teachingChunkIdForLesson(lesson, "term", index),
      citationLabel: `Terms you need · ${term}`,
      heading: `Terms you need · ${term}`,
      text: definition,
      tags: ["teaching", "definition", term],
    })),
    {
      ...shared,
      id: teachingChunkIdForLesson(lesson, "example-setup"),
      anchorId: teachingChunkIdForLesson(lesson, "example-setup"),
      citationLabel: `${lesson.teaching.workedExample.title} · given`,
      heading: lesson.teaching.workedExample.title,
      text: lesson.teaching.workedExample.setup,
      tags: ["teaching", "worked example", "setup"],
    },
    ...lesson.teaching.workedExample.steps.map(
      ({ label, explanation }, index) => ({
        ...shared,
        id: teachingChunkIdForLesson(lesson, "example-step", index),
        anchorId: teachingChunkIdForLesson(lesson, "example-step", index),
        citationLabel:
          `${lesson.teaching.workedExample.title} · step ${index + 1}`,
        heading: `${lesson.teaching.workedExample.title} · ${label}`,
        text: explanation,
        tags: ["teaching", "worked example", "step"],
      }),
    ),
    {
      ...shared,
      id: teachingChunkIdForLesson(lesson, "example-takeaway"),
      anchorId: teachingChunkIdForLesson(lesson, "example-takeaway"),
      citationLabel: `${lesson.teaching.workedExample.title} · takeaway`,
      heading: lesson.teaching.workedExample.title,
      text: lesson.teaching.workedExample.takeaway,
      tags: ["teaching", "worked example", "takeaway"],
    },
    ...lesson.teaching.misconceptions.map(
      ({ correction }, index) => ({
        ...shared,
        id: teachingChunkIdForLesson(lesson, "misconception", index),
        anchorId: teachingChunkIdForLesson(lesson, "misconception", index),
        citationLabel: `Common confusions · correction ${index + 1}`,
        heading: "Common confusions",
        text: correction,
        tags: ["teaching", "misconception", "correction"],
      }),
    ),
    ...lesson.teaching.summary.map((text, index) => ({
      ...shared,
      id: teachingChunkIdForLesson(lesson, "summary", index),
      anchorId: teachingChunkIdForLesson(lesson, "summary", index),
      citationLabel: `Before you predict · point ${index + 1}`,
      heading: "Before you predict",
      text,
      tags: ["teaching", "summary", "prediction preparation"],
    })),
  ];
}

export interface CourseModule {
  id: string;
  number: string;
  title: string;
  purpose: string;
  lessonIds: string[];
}

export function pageChunksForLesson(lesson: Lesson): PageChunk[] {
  return [
    ...teachingChunksForLesson(lesson),
    ...lesson.blocks.flatMap((block) =>
      block.body.map((text, index) => ({
        id: `${block.id}:p${index + 1}`,
        blockId: block.id,
        anchorId: `${block.id}:p${index + 1}`,
        citationLabel: `${block.heading} · paragraph ${index + 1}`,
        heading: block.heading,
        text,
        conceptIds: block.conceptIds,
        tags: block.tags,
        sourceIds: block.sourceIds,
      })),
    ),
  ];
}

export function lessonContextForAssessment(lesson: Lesson) {
  const teachingSections = teachingChunksForLesson(lesson).map(
    (chunk) => `${chunk.heading}\n${chunk.text}`,
  );
  const readingSections = lesson.blocks.map(
    (block) => [block.heading, ...block.body].join("\n"),
  );
  return [...teachingSections, ...readingSections].join("\n\n");
}
