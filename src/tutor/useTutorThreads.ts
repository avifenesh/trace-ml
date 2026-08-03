import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { Lesson } from "../content/types";
import {
  readLocalStorage,
  writeLocalStorage,
} from "../storage";
import { answerFromLesson } from "./answer";
import {
  createConversationThread,
  revisionForLesson,
  titleFromQuestion,
  type ConversationThread,
  type TutorMessage,
} from "./conversations";

const STORAGE_KEY = "trace-ml:tutor-threads:v1";
const ACTIVE_THREAD_KEY = "trace-ml:active-thread:v1";
const LEGACY_REVISION = "legacy-unversioned";
const MAX_THREADS_PER_LESSON = 8;

interface StoredThreads {
  version: 1;
  threads: ConversationThread[];
}

interface TutorState extends StoredThreads {
  activeThreadId: string;
}

function activeThreadKey(lesson: Lesson) {
  return `${ACTIVE_THREAD_KEY}:${lesson.id}:${revisionForLesson(lesson)}`;
}

function limitThreads(threads: ConversationThread[]) {
  const counts = new Map<string, number>();
  return threads.filter((thread) => {
    const key = `${thread.lessonId}:${thread.lessonRevision}`;
    const count = counts.get(key) ?? 0;
    if (count >= MAX_THREADS_PER_LESSON) return false;
    counts.set(key, count + 1);
    return true;
  });
}

function messageId() {
  const value = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
  return `message-${value}`;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, 12)
    : [];
}

function normalizeMessage(
  value: unknown,
  lessonId: string,
  lessonRevision: string,
): TutorMessage | null {
  const message = objectRecord(value);
  if (
    !message ||
    typeof message.id !== "string" ||
    (message.role !== "learner" && message.role !== "tutor") ||
    typeof message.text !== "string" ||
    typeof message.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: message.id,
    role: message.role,
    text: message.text.slice(0, 4_000),
    createdAt: message.createdAt,
    lessonId:
      typeof message.lessonId === "string" ? message.lessonId : lessonId,
    lessonRevision:
      typeof message.lessonRevision === "string"
        ? message.lessonRevision
        : lessonRevision,
    sourceBlockIds: stringList(message.sourceBlockIds),
    sourceChunkIds: stringList(message.sourceChunkIds),
  };
}

function normalizeThread(
  value: unknown,
  lesson: Lesson,
): ConversationThread | null {
  const thread = objectRecord(value);
  if (!thread || typeof thread.id !== "string") return null;
  const rawMessages = Array.isArray(thread.messages) ? thread.messages : [];
  const firstMessage = objectRecord(rawMessages[0]);
  const lessonRevision =
    typeof thread.lessonRevision === "string"
      ? thread.lessonRevision
      : typeof firstMessage?.lessonRevision === "string"
        ? firstMessage.lessonRevision
        : LEGACY_REVISION;
  const lessonId =
    typeof thread.lessonId === "string"
      ? thread.lessonId
      : typeof firstMessage?.lessonId === "string"
        ? firstMessage.lessonId
        : lesson.id;
  const messages = rawMessages
    .map((message) => normalizeMessage(message, lessonId, lessonRevision))
    .filter((message): message is TutorMessage => message !== null)
    .slice(-80);
  if (messages.length === 0) return null;
  const createdAt =
    typeof thread.createdAt === "string"
      ? thread.createdAt
      : messages[0]?.createdAt ?? new Date().toISOString();
  return {
    id: thread.id,
    lessonId,
    lessonRevision,
    title:
      typeof thread.title === "string"
        ? thread.title.slice(0, 80)
        : lesson.title,
    createdAt,
    updatedAt:
      typeof thread.updatedAt === "string" ? thread.updatedAt : createdAt,
    messages,
  };
}

function parseStoredThreads(
  serialized: string | null,
  lesson: Lesson,
): ConversationThread[] {
  if (!serialized) return [];
  try {
    const parsed = objectRecord(JSON.parse(serialized));
    if (
      parsed?.version === 1 &&
      Array.isArray(parsed.threads) &&
      parsed.threads.length > 0
    ) {
      return limitThreads(
        parsed.threads
          .map((thread) => normalizeThread(thread, lesson))
          .filter((thread): thread is ConversationThread => thread !== null),
      );
    }
  } catch {
    // A malformed local record should never block the lesson.
  }
  return [];
}

function mergeThreads(
  first: ConversationThread[],
  second: ConversationThread[],
) {
  const merged = new Map<string, ConversationThread>();
  for (const thread of [...first, ...second]) {
    const existing = merged.get(thread.id);
    if (!existing || thread.updatedAt >= existing.updatedAt) {
      merged.set(thread.id, thread);
    }
  }
  return limitThreads(
    [...merged.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    ),
  );
}

function loadState(lesson: Lesson): TutorState {
  const lessonRevision = revisionForLesson(lesson);
  const threads = parseStoredThreads(readLocalStorage(STORAGE_KEY), lesson);

  const activeThreadId =
    readLocalStorage(activeThreadKey(lesson)) ??
    readLocalStorage(ACTIVE_THREAD_KEY) ??
    "";
  const activeForLesson = threads.find(
    (thread) =>
      thread.id === activeThreadId &&
      thread.lessonId === lesson.id &&
      thread.lessonRevision === lessonRevision,
  );
  const existingForLesson =
    activeForLesson ??
    threads.find(
      (thread) =>
        thread.lessonId === lesson.id &&
        thread.lessonRevision === lessonRevision,
    );
  if (existingForLesson) {
    return { version: 1, threads, activeThreadId: existingForLesson.id };
  }

  const created = createConversationThread(lesson);
  return {
    version: 1,
    threads: limitThreads([created, ...threads]),
    activeThreadId: created.id,
  };
}

export function useTutorThreads(lesson: Lesson, activeBlockId?: string) {
  const lessonRevision = revisionForLesson(lesson);
  const [state, setState] = useState<TutorState>(() => loadState(lesson));
  const [persistenceStatus, setPersistenceStatus] = useState<
    "persistent" | "memory-only"
  >("persistent");

  useEffect(() => {
    const stored = parseStoredThreads(readLocalStorage(STORAGE_KEY), lesson);
    const merged = mergeThreads(stored, state.threads);
    const writesSucceeded = [
      writeLocalStorage(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          threads: merged,
        } satisfies StoredThreads),
      ),
      writeLocalStorage(ACTIVE_THREAD_KEY, state.activeThreadId),
      writeLocalStorage(activeThreadKey(lesson), state.activeThreadId),
    ].every(Boolean);
    setPersistenceStatus(
      writesSucceeded ? "persistent" : "memory-only",
    );
  }, [lesson, state.activeThreadId, state.threads]);

  useLayoutEffect(() => {
    setState((current) => {
      const active = current.threads.find(
        (thread) => thread.id === current.activeThreadId,
      );
      if (
        active?.lessonId === lesson.id &&
        active.lessonRevision === lessonRevision
      ) {
        return current;
      }

      const savedThreadId = readLocalStorage(activeThreadKey(lesson));
      const existing = current.threads.find(
        (thread) =>
          thread.id === savedThreadId &&
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      ) ?? current.threads.find(
        (thread) =>
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      );
      if (existing) {
        return { ...current, activeThreadId: existing.id };
      }

      const created = createConversationThread(lesson);
      return {
        ...current,
        threads: limitThreads([created, ...current.threads]),
        activeThreadId: created.id,
      };
    });
  }, [lesson, lessonRevision]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const incoming = parseStoredThreads(event.newValue, lesson);
      if (incoming.length === 0) return;
      setState((current) => ({
        ...current,
        threads: mergeThreads(current.threads, incoming),
      }));
    };
    globalThis.addEventListener?.("storage", handleStorage);
    return () => globalThis.removeEventListener?.("storage", handleStorage);
  }, [lesson]);

  const activeThread = useMemo(() => {
    const current = state.threads.find(
      (thread) =>
        thread.id === state.activeThreadId &&
        thread.lessonId === lesson.id &&
        thread.lessonRevision === lessonRevision,
    );
    return (
      current ??
      state.threads.find(
        (thread) =>
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      ) ??
      createConversationThread(lesson)
    );
  }, [lesson, lessonRevision, state]);

  const lessonThreads = useMemo(
    () =>
      state.threads.filter(
        (thread) =>
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      ),
    [lesson.id, lessonRevision, state.threads],
  );

  const newThread = useCallback(() => {
    const thread = createConversationThread(lesson);
    setState((current) => ({
      ...current,
      threads: limitThreads([thread, ...current.threads]),
      activeThreadId: thread.id,
    }));
  }, [lesson]);

  const selectThread = useCallback(
    (threadId: string) => {
      setState((current) => {
        const selected = current.threads.find(
          (thread) =>
            thread.id === threadId &&
            thread.lessonId === lesson.id &&
            thread.lessonRevision === lessonRevision,
        );
        return selected
          ? { ...current, activeThreadId: selected.id }
          : current;
      });
    },
    [lesson.id, lessonRevision],
  );

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const createdAt = new Date().toISOString();
      const learnerMessage: TutorMessage = {
        id: messageId(),
        role: "learner",
        text: trimmed.slice(0, 2_000),
        createdAt,
        lessonId: lesson.id,
        lessonRevision,
        sourceBlockIds: [],
        sourceChunkIds: [],
      };
      const tutorMessageId = messageId();

      setState((current) => {
        const activeThread = current.threads.find(
          (thread) =>
            thread.id === current.activeThreadId &&
            thread.lessonId === lesson.id &&
            thread.lessonRevision === lessonRevision,
        );
        if (!activeThread) return current;

        const answer = answerFromLesson(
          trimmed,
          lesson,
          activeBlockId,
          activeThread.messages,
        );
        const tutorMessage: TutorMessage = {
          id: tutorMessageId,
          role: "tutor",
          text: answer.text,
          createdAt,
          lessonId: lesson.id,
          lessonRevision,
          sourceBlockIds: answer.sources.map((source) => source.blockId),
          sourceChunkIds: answer.sources.map((source) => source.chunkId),
        };
        const hasLearnerMessage = activeThread.messages.some(
          (message) => message.role === "learner",
        );

        return {
          ...current,
          threads: current.threads.map((thread) =>
            thread.id === activeThread.id
              ? {
                  ...thread,
                  title: hasLearnerMessage
                    ? thread.title
                    : titleFromQuestion(trimmed),
                  updatedAt: createdAt,
                  messages: [
                    ...thread.messages,
                    learnerMessage,
                    tutorMessage,
                  ].slice(-80),
                }
              : thread,
          ),
        };
      });
    },
    [activeBlockId, lesson, lessonRevision],
  );

  return {
    threads: lessonThreads,
    activeThread,
    persistenceStatus,
    newThread,
    selectThread,
    send,
  };
}
