import { normalizeBedrockReadiness } from "../bedrock-readiness";
import {
  bedrockTransportAvailable,
  invokeBedrock,
} from "../bedrock-transport";
import type {
  Lesson,
  TextResponseActivity,
} from "../content/types";
import type {
  EvidenceLevel,
  ExplanationAssessment,
} from "./types";

interface SemanticAssessmentRequest {
  requestId: string;
  lessonId: string;
  lessonRevision: string;
  activityId: string;
  learnerResponse: string;
}

const MAX_FEEDBACK_CHARACTERS = 1_200;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }
  const strings = value as string[];
  return new Set(strings).size === strings.length ? strings : null;
}

function normalizeExplanationAssessment(
  activity: TextResponseActivity,
  value: unknown,
  forcedMode?: ExplanationAssessment["assessmentMode"],
): ExplanationAssessment {
  const result = objectRecord(value);
  const levels = new Set<EvidenceLevel>([
    "unsupported",
    "partial",
    "demonstrated",
  ]);
  const assessmentMode = forcedMode ?? result?.assessmentMode;
  const level = result?.level;
  const matched = uniqueStrings(result?.matchedCriteria);
  const missing = uniqueStrings(result?.missingCriteria);
  const uncertain = uniqueStrings(result?.uncertainCriteria);
  const feedback = result?.feedback;
  if (
    !result ||
    (assessmentMode !== "semantic" && assessmentMode !== "structure") ||
    typeof level !== "string" ||
    !levels.has(level as EvidenceLevel) ||
    !matched ||
    !missing ||
    !uncertain ||
    typeof feedback !== "string" ||
    !feedback.trim() ||
    Array.from(feedback).length > MAX_FEEDBACK_CHARACTERS
  ) {
    throw new Error("The assessment service returned an invalid result.");
  }

  const criterionIds = activity.rubric.criteria.map((criterion) => criterion.id);
  const expected = new Set(criterionIds);
  const matchedSet = new Set(matched);
  const missingSet = new Set(missing);
  const uncertainSet = new Set(uncertain);
  const partition = new Set([...matched, ...missing, ...uncertain]);
  if (
    partition.size !== expected.size ||
    [...partition].some((id) => !expected.has(id)) ||
    criterionIds.some((id) => !partition.has(id)) ||
    [...matchedSet].some(
      (id) => missingSet.has(id) || uncertainSet.has(id),
    ) ||
    [...missingSet].some((id) => uncertainSet.has(id)) ||
    (assessmentMode === "structure" && uncertain.length > 0)
  ) {
    throw new Error("The assessment service returned an invalid rubric result.");
  }

  const expectedLevel: EvidenceLevel = assessmentMode === "semantic"
    ? matched.length === 0 && uncertain.length === 0
      ? "unsupported"
      : missing.length === 0 && uncertain.length === 0
        ? "demonstrated"
        : "partial"
    : matched.length === 0
      ? "unsupported"
      : "partial";
  if (level !== expectedLevel) {
    throw new Error("The assessment service returned an inconsistent result.");
  }

  return {
    assessmentMode,
    level: expectedLevel,
    matchedCriteria: criterionIds.filter((id) => matchedSet.has(id)),
    missingCriteria: criterionIds.filter((id) => missingSet.has(id)),
    uncertainCriteria: criterionIds.filter((id) => uncertainSet.has(id)),
    feedback: feedback.trim(),
  };
}

function normalizeSemanticAssessment(
  activity: TextResponseActivity,
  value: unknown,
) {
  return normalizeExplanationAssessment(activity, value, "semantic");
}

export function restoredExplanationAssessment(
  activity: TextResponseActivity,
  value: unknown,
) {
  try {
    return normalizeExplanationAssessment(activity, value);
  } catch {
    return null;
  }
}

function requestFor(
  lesson: Lesson,
  activity: TextResponseActivity,
  response: string,
  requestId: string,
): SemanticAssessmentRequest {
  return {
    requestId,
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    activityId: activity.id,
    learnerResponse: response,
  };
}

export function semanticProseAssessmentAvailable() {
  return bedrockTransportAvailable();
}

export async function proseAssessmentReady() {
  if (!bedrockTransportAvailable()) return null;
  try {
    return normalizeBedrockReadiness(
      await invokeBedrock<unknown>("proseAssessmentReady"),
    );
  } catch {
    return null;
  }
}

export async function assessProseSemantically(
  lesson: Lesson,
  activity: TextResponseActivity,
  response: string,
  requestId: string,
) {
  const result = await invokeBedrock<unknown>("assessProse", {
    request: requestFor(lesson, activity, response, requestId),
  });
  return normalizeSemanticAssessment(activity, result);
}

export async function cancelProseAssessment(requestId: string) {
  if (!bedrockTransportAvailable()) return false;
  return invokeBedrock<boolean>("cancelProseAssessment", { requestId });
}

export function proseAssessmentError(error: unknown) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Prose review is unavailable. Your draft is saved; try again.";
}

export const proseAssessmentInternals = {
  normalizeExplanationAssessment,
  normalizeSemanticAssessment,
  requestFor,
};
