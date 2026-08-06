import { invoke, isTauri } from "@tauri-apps/api/core";

type BedrockOperation =
  | "lessonHelperReady"
  | "answerLessonQuestion"
  | "cancelLessonAnswer"
  | "proseAssessmentReady"
  | "assessProse"
  | "cancelProseAssessment";

const OPERATIONS: Record<
  BedrockOperation,
  { command: string; endpoint: string }
> = {
  lessonHelperReady: {
    command: "lesson_helper_ready",
    endpoint: "/_trace/bedrock/lesson-helper/readiness",
  },
  answerLessonQuestion: {
    command: "answer_lesson_question",
    endpoint: "/_trace/bedrock/lesson-helper",
  },
  cancelLessonAnswer: {
    command: "cancel_lesson_answer",
    endpoint: "/_trace/bedrock/lesson-helper/cancel",
  },
  proseAssessmentReady: {
    command: "prose_assessment_ready",
    endpoint: "/_trace/bedrock/prose-assessment/readiness",
  },
  assessProse: {
    command: "assess_prose",
    endpoint: "/_trace/bedrock/prose-assessment",
  },
  cancelProseAssessment: {
    command: "cancel_prose_assessment",
    endpoint: "/_trace/bedrock/prose-assessment/cancel",
  },
};

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function tailnetTransportEnabled() {
  return import.meta.env.VITE_TRACE_BEDROCK_HTTP === "1";
}

export function bedrockTransportAvailable() {
  return isTauri() || tailnetTransportEnabled();
}

export async function invokeBedrock<T>(
  operation: BedrockOperation,
  arguments_: Record<string, unknown> = {},
): Promise<T> {
  const target = OPERATIONS[operation];
  if (isTauri()) {
    return invoke<T>(target.command, arguments_);
  }
  if (!tailnetTransportEnabled()) {
    throw new Error("The Bedrock service is not enabled in this web build.");
  }

  const response = await fetch(target.endpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arguments_),
  });
  let envelope: Record<string, unknown> | null = null;
  try {
    envelope = objectRecord(await response.json());
  } catch {
    // A non-JSON proxy error is handled by the generic message below.
  }
  if (!response.ok) {
    const error = envelope?.error;
    throw new Error(
      typeof error === "string" && error.trim()
        ? error
        : "The Bedrock service is unavailable.",
    );
  }
  if (!envelope || !("result" in envelope)) {
    throw new Error("The Bedrock service returned an invalid response.");
  }
  return envelope.result as T;
}
