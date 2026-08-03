import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  pageChunksForLesson,
  type Lesson,
} from "../content/types";
import type {
  TutorClaim,
  TutorMessage,
} from "./conversations";

export type LessonHelperStatus = "answered" | "unsupported" | "boundary";

export interface LessonHelperAnswer {
  status: LessonHelperStatus;
  text: string;
  claims: TutorClaim[];
}

interface NativeHistoryMessage {
  role: TutorMessage["role"];
  text: string;
  sourceChunkIds: string[];
}

interface NativeHelperRequest {
  requestId: string;
  lessonId: string;
  lessonRevision: string;
  question: string;
  history: NativeHistoryMessage[];
}

const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_MESSAGE_CHARS = 4_000;
const MAX_HISTORY_CHARS = 24_000;
const MAX_CLAIMS = 5;
const MAX_SOURCES = 3;

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function sliceCharacters(value: string, limit: number) {
  return Array.from(value).slice(0, limit).join("");
}

function boundedHistory(
  lesson: Lesson,
  history: readonly TutorMessage[],
): NativeHistoryMessage[] {
  const validChunkIds = new Set(
    pageChunksForLesson(lesson).map((chunk) => chunk.id),
  );
  const messages: NativeHistoryMessage[] = [];
  let remainingCharacters = MAX_HISTORY_CHARS;

  for (
    let index = history.length - 1;
    index >= 0 &&
    messages.length < MAX_HISTORY_MESSAGES &&
    remainingCharacters > 0;
    index -= 1
  ) {
    const message = history[index];
    if (!message) continue;
    const text = sliceCharacters(
      message.text.trim(),
      Math.min(MAX_HISTORY_MESSAGE_CHARS, remainingCharacters),
    );
    if (!text) continue;
    const sourceChunkIds = [...new Set(message.sourceChunkIds)]
      .filter((id) => validChunkIds.has(id))
      .slice(0, MAX_SOURCES);
    messages.push({
      role: message.role,
      text,
      sourceChunkIds,
    });
    remainingCharacters -= Array.from(text).length;
  }

  return messages.reverse();
}

function requestFor(
  lesson: Lesson,
  question: string,
  history: readonly TutorMessage[],
  requestId: string,
): NativeHelperRequest {
  return {
    requestId,
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    question,
    history: boundedHistory(lesson, history),
  };
}

function normalizeAnswer(lesson: Lesson, value: unknown): LessonHelperAnswer {
  const answer = objectRecord(value);
  const status = answer?.status;
  const text = answer?.text;
  const rawClaims = answer?.claims;
  if (
    !answer ||
    (status !== "answered" &&
      status !== "unsupported" &&
      status !== "boundary") ||
    typeof text !== "string" ||
    !text.trim() ||
    Array.from(text).length > 2_000 ||
    !Array.isArray(rawClaims)
  ) {
    throw new Error("The lesson helper returned an invalid answer.");
  }

  const chunks = new Map(
    pageChunksForLesson(lesson).map((chunk) => [chunk.id, chunk]),
  );
  const claims = rawClaims.map((value): TutorClaim => {
    const claim = objectRecord(value);
    const claimText = claim?.text;
    const sourceChunkId = claim?.sourceChunkId;
    const quote = claim?.quote;
    if (
      !claim ||
      typeof claimText !== "string" ||
      !claimText.trim() ||
      typeof sourceChunkId !== "string" ||
      typeof quote !== "string" ||
      !quote.trim() ||
      Array.from(claimText).length > 2_000
    ) {
      throw new Error("The lesson helper returned an invalid cited claim.");
    }
    const chunk = chunks.get(sourceChunkId);
    if (!chunk || !chunk.text.includes(quote.trim())) {
      throw new Error("The lesson helper returned an invalid source quote.");
    }
    return {
      text: claimText.trim(),
      sourceChunkId,
      quote: quote.trim(),
    };
  });
  const sourceChunkIds = [...new Set(
    claims.map((claim) => claim.sourceChunkId),
  )];
  const expectedText = claims.map((claim) => claim.text).join(" ");
  if (
    claims.length > MAX_CLAIMS ||
    sourceChunkIds.length > MAX_SOURCES ||
    (status === "answered" &&
      (claims.length === 0 || text.trim() !== expectedText)) ||
    (status !== "answered" && claims.length > 0)
  ) {
    throw new Error("The lesson helper returned invalid sources.");
  }

  return {
    status,
    text: text.trim(),
    claims,
  };
}

export function nativeLessonHelperAvailable() {
  return isTauri();
}

export async function lessonHelperReady() {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>("lesson_helper_ready");
  } catch {
    return false;
  }
}

export async function answerLessonQuestion(
  lesson: Lesson,
  question: string,
  history: readonly TutorMessage[],
  requestId: string,
) {
  const result = await invoke<unknown>("answer_lesson_question", {
    request: requestFor(lesson, question, history, requestId),
  });
  return normalizeAnswer(lesson, result);
}

export async function cancelLessonAnswer(requestId: string) {
  if (!isTauri()) return false;
  return invoke<boolean>("cancel_lesson_answer", { requestId });
}

export function lessonHelperError(error: unknown) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The lesson helper is unavailable. Your thread is saved.";
}

export const lessonHelperInternals = {
  normalizeAnswer,
  requestFor,
};
