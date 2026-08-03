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

export const COURSE_REVISION = "2026-08-03-r2";
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
    verifiedAt: COURSE_REVISION,
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
