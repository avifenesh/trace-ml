import type { Lesson } from "../content/types";

export type TutorRole = "learner" | "tutor";

export interface TutorClaim {
  text: string;
  sourceChunkId: string;
  quote: string;
}

export interface TutorMessage {
  id: string;
  role: TutorRole;
  text: string;
  createdAt: string;
  lessonId: string;
  lessonRevision: string;
  sourceBlockIds: string[];
  sourceChunkIds: string[];
  claims?: TutorClaim[];
}

export interface ConversationThread {
  id: string;
  lessonId: string;
  lessonRevision: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: TutorMessage[];
}

function identifier(prefix: string) {
  const value = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
  return `${prefix}-${value}`;
}

export function revisionForLesson(lesson: Lesson) {
  return lesson.revision ?? "unversioned";
}

export function createConversationThread(
  lesson: Lesson,
  createdAt = new Date().toISOString(),
): ConversationThread {
  const lessonRevision = revisionForLesson(lesson);
  return {
    id: identifier("thread"),
    lessonId: lesson.id,
    lessonRevision,
    title: lesson.title,
    createdAt,
    updatedAt: createdAt,
    messages: [
      {
        id: identifier("message"),
        role: "tutor",
        text:
          "Ask me about this page. I will answer from its authored paragraphs and show the exact sources I used.",
        createdAt,
        lessonId: lesson.id,
        lessonRevision,
        sourceBlockIds: [],
        sourceChunkIds: [],
      },
    ],
  };
}

export function titleFromQuestion(question: string) {
  const trimmed = question.trim().replace(/\s+/g, " ");
  return trimmed.length > 42 ? `${trimmed.slice(0, 41)}…` : trimmed;
}
