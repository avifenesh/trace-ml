import type {
  CodeCheck,
  CodeLabActivity,
  LessonResource,
  TextResponseActivity,
} from "./types";
import type {
  ConceptId,
  EvidenceKind,
} from "../learning/types";
import { researchSourceForId } from "./research-sources";

export const COURSE_REVISION = "2026-08-07-r1";
export const LESSON_REVISIONS = {
  "prerequisite-trace": "2026-08-07-r1",
  "data-and-baseline": "2026-08-04-r1",
  "linear-model": "2026-08-04-r1",
  "loss-landscape": "2026-08-04-r1",
  "gradient-descent": "2026-08-04-r1",
  "split-and-leakage": "2026-08-04-r1",
  "capacity-curves": "2026-08-04-r2",
  "logistic-link": "2026-08-04-r2",
  "decision-costs": "2026-08-04-r1",
  "feature-pipeline": "2026-08-04-r1",
  "knn-versus-tree": "2026-08-04-r1",
  "regularization-path": "2026-08-04-r2",
  "ensemble-votes": "2026-08-04-r1",
  "xor-hidden-space": "2026-08-04-r1",
  "backprop-graph": "2026-08-04-r1",
  "optimizer-traces": "2026-08-04-r2",
  "cluster-project": "2026-08-04-r1",
  "convolution-field": "2026-08-04-r1",
  "attention-routing": "2026-08-04-r1",
  "q-learning": "2026-08-04-r1",
  "shift-monitor": "2026-08-04-r2",
} as const;

export function lessonRevision(lessonId: string) {
  const revision = (LESSON_REVISIONS as Record<string, string>)[lessonId];
  if (!revision) throw new Error(`Missing lesson revision: ${lessonId}`);
  return revision;
}

export const PREREQUISITE_TRACE_REVISION =
  LESSON_REVISIONS["prerequisite-trace"];
export const PYODIDE_ENVIRONMENT =
  "pyodide-314.0.3-python-3.14.2-numpy-2.4.3-autograd-1.9.1-sklearn-1.8.0-local-assets";

export function reading(
  id: string,
  title: string,
  publisher: string,
  url: string,
  durationMinutes: number,
  afterActivityId: string,
  placement: string,
  sourceId: string,
  role: LessonResource["role"] = "extension",
): LessonResource {
  return {
    id,
    kind: "reading",
    role,
    afterActivityId,
    title,
    publisher,
    url,
    durationMinutes,
    placement,
    verifiedAt: researchSourceForId(sourceId).verifiedAt,
    sourceId,
  };
}

export function video(
  id: string,
  title: string,
  publisher: string,
  url: string,
  durationMinutes: number,
  afterActivityId: string,
  placement: string,
  sourceId: string,
  role: LessonResource["role"] = "extension",
): LessonResource {
  return {
    ...reading(
      id,
      title,
      publisher,
      url,
      durationMinutes,
      afterActivityId,
      placement,
      sourceId,
      role,
    ),
    kind: "video",
  };
}

export function videoAndReading(
  id: string,
  title: string,
  publisher: string,
  url: string,
  durationMinutes: number,
  afterActivityId: string,
  placement: string,
  sourceId: string,
  role: LessonResource["role"] = "extension",
): LessonResource {
  return {
    ...reading(
      id,
      title,
      publisher,
      url,
      durationMinutes,
      afterActivityId,
      placement,
      sourceId,
      role,
    ),
    kind: "video-and-reading",
  };
}

export function interactive(
  id: string,
  title: string,
  publisher: string,
  url: string,
  durationMinutes: number,
  afterActivityId: string,
  placement: string,
  sourceId: string,
  role: LessonResource["role"] = "extension",
): LessonResource {
  return {
    ...reading(
      id,
      title,
      publisher,
      url,
      durationMinutes,
      afterActivityId,
      placement,
      sourceId,
      role,
    ),
    kind: "interactive",
  };
}

interface ResponseCriterion {
  id: string;
  label: string;
  keywordGroups: string[][];
}

export function responseActivity(
  id: string,
  evidenceKind: Extract<EvidenceKind, "explanation" | "transfer">,
  conceptIds: ConceptId[],
  prompt: string,
  guidance: string,
  criteria: ResponseCriterion[],
  demonstratedFeedback: string,
  unsupportedFeedback: string,
): TextResponseActivity {
  return {
    id,
    kind: "text-response",
    conceptIds,
    evidenceKind,
    prompt,
    guidance,
    rubric: {
      criteria,
      demonstratedFeedback,
      unsupportedFeedback,
    },
  };
}

export function pythonLab(
  id: string,
  conceptIds: ConceptId[],
  filename: string,
  instructions: string,
  contents: string,
  checks: CodeCheck[],
  seed: number,
  allowedPackages: string[] = [],
): CodeLabActivity {
  return {
    id,
    kind: "code-lab",
    conceptIds,
    evidenceKind: "code-check",
    spec: {
      runtimeId: "pyodide-314.0.3",
      environmentDigest: PYODIDE_ENVIRONMENT,
      seed,
      timeoutMs: 7_500,
      maxOutputBytes: 65_536,
      maxOutputLines: 500,
      instructions,
      starterFiles: [
        {
          path: filename,
          language: "python",
          contents,
        },
      ],
      checks,
      allowedPackages,
    },
  };
}
