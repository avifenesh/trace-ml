// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireLesson } from "../content/course";
import type { BedrockReadiness } from "../bedrock-readiness";
import { useTutorThreads } from "./useTutorThreads";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

const lesson = requireLesson("linear-model");
const verifiedReadiness = {
  available: true,
  model: "openai.gpt-5.6-sol",
  retentionMode: "provider_data_share",
  retentionSource: "account",
  allowedRetentionModes: ["default", "provider_data_share"],
} satisfies BedrockReadiness;
const lessonRevision = lesson.revision ?? "unversioned";
const threadsKey = "trace-ml:tutor-threads:v1";
const journalKeyPrefix = `${threadsKey}:journal:`;
const storedValues = new Map<string, string>();
const navigatorLocksDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "locks",
);
const localStorageStub: Storage = {
  get length() {
    return storedValues.size;
  },
  clear() {
    storedValues.clear();
  },
  getItem(key) {
    return storedValues.get(key) ?? null;
  },
  key(index) {
    return [...storedValues.keys()][index] ?? null;
  },
  removeItem(key) {
    storedValues.delete(key);
  },
  setItem(key, value) {
    storedValues.set(key, value);
  },
};

beforeEach(() => {
  invokeMock.mockReset();
  isTauriMock.mockReset();
  isTauriMock.mockReturnValue(false);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  if (navigatorLocksDescriptor) {
    Object.defineProperty(
      globalThis.navigator,
      "locks",
      navigatorLocksDescriptor,
    );
  } else {
    delete (globalThis.navigator as { locks?: LockManager }).locks;
  }
});

describe("useTutorThreads", () => {
  function persistedThreadIds() {
    const serialized = localStorage.getItem(threadsKey);
    if (!serialized) return [];
    const parsed = JSON.parse(serialized) as {
      threads: Array<{ id: string }>;
    };
    return parsed.threads.map((thread) => thread.id);
  }

  function storedThread(
    id: string,
    lessonId: string,
    updatedAt: string,
    messageCount = 1,
  ) {
    return {
      id,
      lessonId,
      lessonRevision,
      title: id,
      createdAt: updatedAt,
      updatedAt,
      messages: Array.from({ length: messageCount }, (_, index) => ({
        id: `${id}-message-${index}`,
        role: index % 2 === 0 ? "learner" : "tutor",
        text: `${id} message ${index} ${"x".repeat(100)}`,
        createdAt: new Date(
          Date.parse(updatedAt) + index,
        ).toISOString(),
        lessonId,
        lessonRevision,
        sourceBlockIds: [],
        sourceChunkIds: [],
      })),
    };
  }

  it("passes the active thread into a follow-up answer", () => {
    const { result } = renderHook(() => useTutorThreads(lesson));

    act(() => {
      result.current.send(
        "What does the weight change between neighboring x values?",
      );
    });
    const firstTutorMessage = result.current.activeThread.messages.at(-1);
    expect(firstTutorMessage?.sourceChunkIds.length).toBeGreaterThan(0);

    act(() => {
      result.current.send("Why does that happen?");
    });
    const followUpMessage = result.current.activeThread.messages.at(-1);

    expect(followUpMessage?.role).toBe("tutor");
    expect(followUpMessage?.sourceChunkIds[0]).toBe(
      firstTutorMessage?.sourceChunkIds[0],
    );
  });

  it("never exposes the previous lesson transcript after a lesson switch", () => {
    const nextLesson = requireLesson("shift-monitor");
    const { result, rerender } = renderHook(
      ({ currentLesson }) => useTutorThreads(currentLesson),
      { initialProps: { currentLesson: lesson } },
    );

    act(() => {
      result.current.send(
        "What does the weight change between neighboring x values?",
      );
    });
    expect(result.current.activeThread.lessonId).toBe(lesson.id);

    rerender({ currentLesson: nextLesson });

    expect(result.current.activeThread.lessonId).toBe(nextLesson.id);
    expect(
      result.current.activeThread.messages.some(
        (message) => message.lessonId !== nextLesson.id,
      ),
    ).toBe(false);
  });

  it("isolates stored threads when the same lesson receives a new revision", () => {
    const revisedLesson = {
      ...lesson,
      revision: `${lessonRevision}-next`,
    };
    const { result, rerender } = renderHook(
      ({ currentLesson }) => useTutorThreads(currentLesson),
      { initialProps: { currentLesson: lesson } },
    );

    act(() => {
      result.current.send(
        "What does the weight change between neighboring x values?",
      );
    });
    const originalThreadId = result.current.activeThread.id;
    expect(result.current.activeThread.lessonRevision).toBe(lessonRevision);

    rerender({ currentLesson: revisedLesson });

    const revisedThreadId = result.current.activeThread.id;
    expect(revisedThreadId).not.toBe(originalThreadId);
    expect(result.current.activeThread.lessonId).toBe(lesson.id);
    expect(result.current.activeThread.lessonRevision).toBe(
      revisedLesson.revision,
    );
    expect(result.current.activeThread.messages).toHaveLength(1);
    expect(
      result.current.activeThread.messages.every(
        (message) => message.lessonRevision === revisedLesson.revision,
      ),
    ).toBe(true);
    expect(
      result.current.threads.every(
        (thread) => thread.lessonRevision === revisedLesson.revision,
      ),
    ).toBe(true);
    expect(
      localStorage.getItem(
        `trace-ml:active-thread:v1:${lesson.id}:${revisedLesson.revision}`,
      ),
    ).toBe(revisedThreadId);

    rerender({ currentLesson: lesson });

    expect(result.current.activeThread.id).toBe(originalThreadId);
    expect(result.current.activeThread.lessonRevision).toBe(lessonRevision);
    expect(
      result.current.activeThread.messages.some(
        (message) =>
          message.text ===
          "What does the weight change between neighboring x values?",
      ),
    ).toBe(true);
  });

  it("filters malformed stored threads instead of crashing the lesson", () => {
    localStorage.setItem(
      "trace-ml:tutor-threads:v1",
      JSON.stringify({
        version: 1,
        threads: [null, { id: "broken", messages: [null] }],
      }),
    );

    const { result } = renderHook(() => useTutorThreads(lesson));

    expect(result.current.activeThread.lessonId).toBe(lesson.id);
    expect(result.current.activeThread.messages[0]?.role).toBe("tutor");
  });

  it("filters stored messages from another lesson or revision", () => {
    const createdAt = "2026-08-03T08:00:00.000Z";
    localStorage.setItem(
      "trace-ml:tutor-threads:v1",
      JSON.stringify({
        version: 1,
        threads: [
          {
            id: "mixed-thread",
            lessonId: lesson.id,
            lessonRevision,
            title: "Mixed scope",
            createdAt,
            updatedAt: createdAt,
            messages: [
              {
                id: "current-message",
                role: "learner",
                text: "What does weight change?",
                createdAt,
                lessonId: lesson.id,
                lessonRevision,
                sourceBlockIds: [],
                sourceChunkIds: [],
              },
              {
                id: "foreign-lesson-message",
                role: "tutor",
                text: "Content from another lesson.",
                createdAt,
                lessonId: "gradient-descent",
                lessonRevision,
                sourceBlockIds: ["04-update"],
                sourceChunkIds: ["04-update:p1"],
              },
              {
                id: "stale-revision-message",
                role: "tutor",
                text: "Content from an older revision.",
                createdAt,
                lessonId: lesson.id,
                lessonRevision: "older-revision",
                sourceBlockIds: ["02-weight"],
                sourceChunkIds: ["02-weight:p1"],
              },
            ],
          },
        ],
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      "mixed-thread",
    );

    const { result } = renderHook(() => useTutorThreads(lesson));

    expect(
      result.current.activeThread.messages.map((message) => message.id),
    ).toEqual(["current-message"]);
    expect(
      result.current.activeThread.messages.every(
        (message) =>
          message.lessonId === lesson.id &&
          message.lessonRevision === lessonRevision,
      ),
    ).toBe(true);
  });

  it("keeps working and reports when storage access is unavailable", async () => {
    const blockedStorage = {
      ...localStorageStub,
      getItem() {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: blockedStorage,
    });

    const { result } = renderHook(() => useTutorThreads(lesson));
    act(() => {
      result.current.send("What does the weight change?");
    });

    expect(result.current.activeThread.messages.at(-1)?.role).toBe("tutor");
    await waitFor(() => {
      expect(result.current.persistenceStatus).toBe("memory-only");
    });
  });

  it("keeps a thread visible when its durable deletion journal cannot be written", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const threadId = result.current.activeThread.id;
    await waitFor(() => {
      expect(persistedThreadIds()).toContain(threadId);
    });
    const storageWithBlockedDeletion = {
      ...localStorageStub,
      setItem(key: string, value: string) {
        if (key.startsWith(journalKeyPrefix)) {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storageWithBlockedDeletion,
    });

    let deleted = true;
    act(() => {
      deleted = result.current.deleteThread(threadId);
    });

    expect(deleted).toBe(false);
    expect(result.current.activeThread.id).toBe(threadId);
    expect(result.current.threads.some((thread) => thread.id === threadId))
      .toBe(true);
    expect(persistedThreadIds()).toContain(threadId);
    expect(
      [...storedValues.keys()].some((key) => key.startsWith(journalKeyPrefix)),
    ).toBe(false);
    expect(result.current.helperNotice).toBeNull();
    expect(result.current.helperErrorMessage).toMatch(
      /could not be deleted because local storage is unavailable/i,
    );
    expect(result.current.persistenceStatus).toBe("memory-only");
  });

  it("recovers a journaled deletion when the canonical aggregate write fails", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const threadId = result.current.activeThread.id;
    await waitFor(() => {
      expect(persistedThreadIds()).toContain(threadId);
    });
    const storageWithBlockedAggregate = {
      ...localStorageStub,
      setItem(key: string, value: string) {
        if (key === threadsKey) {
          throw new DOMException("blocked", "QuotaExceededError");
        }
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storageWithBlockedAggregate,
    });

    let deleted = true;
    act(() => {
      deleted = result.current.deleteThread(threadId);
    });

    expect(deleted).toBe(true);
    expect(result.current.activeThread.id).not.toBe(threadId);
    expect(persistedThreadIds()).toContain(threadId);
    expect(result.current.helperNotice).toBe("Conversation deleted.");
    expect(result.current.helperErrorMessage).toBeNull();
    expect(
      [...storedValues.keys()].some((key) => key.startsWith(journalKeyPrefix)),
    ).toBe(true);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    const relaunched = renderHook(() => useTutorThreads(lesson));
    expect(
      relaunched.result.current.threads.some(
        (thread) => thread.id === threadId,
      ),
    ).toBe(false);
  });

  it("globally evicts the oldest inactive threads and messages", async () => {
    const activeId = "active-old-thread";
    const base = Date.parse("2026-08-01T00:00:00.000Z");
    const inactiveThreads = Array.from({ length: 60 }, (_, index) =>
      storedThread(
        `inactive-${index}`,
        `lesson-${index}`,
        new Date(base + index * 1_000).toISOString(),
        20,
      )
    );
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: [
          storedThread(
            activeId,
            lesson.id,
            "2026-07-01T00:00:00.000Z",
            20,
          ),
          ...inactiveThreads,
        ],
        deletedThreadIds: [],
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      activeId,
    );

    renderHook(() => useTutorThreads(lesson));

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem(threadsKey) ?? "{}",
      ) as {
        threads: Array<{ id: string; messages: unknown[] }>;
      };
      expect(stored.threads).toHaveLength(48);
      expect(
        stored.threads.reduce(
          (total, thread) => total + thread.messages.length,
          0,
        ),
      ).toBeLessThanOrEqual(640);
      expect(stored.threads.some((thread) => thread.id === activeId)).toBe(true);
      expect(stored.threads.some((thread) => thread.id === "inactive-59"))
        .toBe(true);
      expect(stored.threads.some((thread) => thread.id === "inactive-12"))
        .toBe(false);
    });
  });

  it("keeps only the newest bounded deletion IDs", async () => {
    const activeId = "active-thread";
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: [
          storedThread(
            activeId,
            lesson.id,
            "2026-08-01T00:00:00.000Z",
          ),
        ],
        deletedThreadIds: Array.from(
          { length: 300 },
          (_, index) => `deleted-${index}`,
        ),
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      activeId,
    );

    renderHook(() => useTutorThreads(lesson));

    await waitFor(() => {
      const stored = JSON.parse(
        localStorage.getItem(threadsKey) ?? "{}",
      ) as { deletedThreadIds: string[] };
      expect(stored.deletedThreadIds).toHaveLength(256);
      expect(stored.deletedThreadIds[0]).toBe("deleted-44");
      expect(stored.deletedThreadIds.at(-1)).toBe("deleted-299");
    });
  });

  it("keeps a concurrent deletion newer than 256 stale tombstones", async () => {
    const deletedThreadId = "concurrently-deleted-thread";
    const deletedIds = Array.from(
      { length: 256 },
      (_, index) => `old-deletion-${index}`,
    );
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: [
          storedThread(
            deletedThreadId,
            lesson.id,
            "2026-08-01T00:00:00.000Z",
          ),
        ],
        deletedThreadIds: deletedIds,
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      deletedThreadId,
    );
    const staleWindow = renderHook(() => useTutorThreads(lesson));
    const deletingWindow = renderHook(() => useTutorThreads(lesson));

    act(() => {
      expect(
        deletingWindow.result.current.deleteThread(deletedThreadId),
      ).toBe(true);
    });
    await waitFor(() => {
      expect(persistedThreadIds()).not.toContain(deletedThreadId);
    });

    act(() => {
      staleWindow.result.current.send(
        "This stale question must not restore the deleted conversation.",
      );
    });

    const persisted = JSON.parse(
      localStorage.getItem(threadsKey) ?? "{}",
    ) as {
      threads: Array<{ id: string }>;
      deletedThreadIds: string[];
    };
    expect(persisted.threads.some((thread) => thread.id === deletedThreadId))
      .toBe(false);
    expect(persisted.deletedThreadIds).toContain(deletedThreadId);

    const relaunched = renderHook(() => useTutorThreads(lesson));
    expect(
      relaunched.result.current.threads.some(
        (thread) => thread.id === deletedThreadId,
      ),
    ).toBe(false);
  });

  it("retries quota failures with the active thread compacted", async () => {
    const activeId = "active-quota-thread";
    const base = Date.parse("2026-08-01T00:00:00.000Z");
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: [
          storedThread(
            activeId,
            lesson.id,
            "2026-07-01T00:00:00.000Z",
            20,
          ),
          ...Array.from({ length: 47 }, (_, index) =>
            storedThread(
              `quota-inactive-${index}`,
              `quota-lesson-${index}`,
              new Date(base + index * 1_000).toISOString(),
              20,
            )
          ),
        ],
        deletedThreadIds: [],
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      activeId,
    );
    const aggregateWriteSizes: number[] = [];
    const quotaStorage = {
      ...localStorageStub,
      setItem(key: string, value: string) {
        if (key === threadsKey) {
          aggregateWriteSizes.push(value.length);
          if (value.length > 12_000) {
            throw new DOMException("full", "QuotaExceededError");
          }
        }
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: quotaStorage,
    });

    const { result } = renderHook(() => useTutorThreads(lesson));

    await waitFor(() => {
      expect(result.current.persistenceStatus).toBe("persistent");
      const stored = JSON.parse(
        localStorage.getItem(threadsKey) ?? "{}",
      ) as {
        threads: Array<{
          id: string;
          messages: Array<{ id: string }>;
        }>;
      };
      expect(aggregateWriteSizes.some((size) => size > 12_000)).toBe(true);
      expect(aggregateWriteSizes.some((size) => size <= 12_000)).toBe(true);
      expect(stored.threads).toHaveLength(1);
      expect(stored.threads[0]?.id).toBe(activeId);
      expect(stored.threads[0]?.messages.at(-1)?.id).toBe(
        `${activeId}-message-19`,
      );
    });
  });

  it("consolidates pending journals before they exceed the global cap", () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const blockedAggregateStorage = {
      ...localStorageStub,
      get length() {
        return localStorageStub.length;
      },
      setItem(key: string, value: string) {
        if (key === threadsKey) {
          throw new DOMException("full", "QuotaExceededError");
        }
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: blockedAggregateStorage,
    });

    for (let index = 0; index < 20; index += 1) {
      act(() => {
        result.current.send(`Journal cap question ${index}`);
      });
    }

    const journals = [...storedValues.entries()].filter(([key]) =>
      key.startsWith(journalKeyPrefix)
    );
    expect(journals.length).toBeLessThanOrEqual(12);
    expect(journals.some(([, value]) =>
      value.includes("Journal cap question 19")
    )).toBe(true);
  });

  it("does not lose either mutation when capped journal writes overlap", () => {
    const activeId = "journal-race-active";
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: [
          storedThread(
            activeId,
            lesson.id,
            "2026-08-01T00:00:00.000Z",
          ),
        ],
        deletedThreadIds: [],
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      activeId,
    );
    for (let index = 0; index < 11; index += 1) {
      localStorage.setItem(
        `${journalKeyPrefix}${index.toString().padStart(2, "0")}`,
        JSON.stringify({
          version: 1,
          threads: [
            storedThread(
              `pending-${index}`,
              `pending-lesson-${index}`,
              new Date(
                Date.parse("2026-07-01T00:00:00.000Z") + index,
              ).toISOString(),
            ),
          ],
          deletedThreadIds: [],
        }),
      );
    }
    const queuedWrites: Array<() => void> = [];
    Object.defineProperty(globalThis.navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(
          (
            _name: string,
            callback: () => void,
          ) =>
            new Promise<void>((resolve) => {
              queuedWrites.push(() => {
                callback();
                resolve();
              });
            }),
        ),
      },
    });
    const firstWindow = renderHook(() => useTutorThreads(lesson));
    const secondWindow = renderHook(() => useTutorThreads(lesson));
    let overlapTriggered = false;
    const overlappingStorage: Storage = {
      ...localStorageStub,
      get length() {
        return localStorageStub.length;
      },
      setItem(key, value) {
        if (!overlapTriggered && key.startsWith(journalKeyPrefix)) {
          overlapTriggered = true;
          secondWindow.result.current.send("Question from the second tab.");
        }
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: overlappingStorage,
    });

    act(() => {
      firstWindow.result.current.send("Question from the first tab.");
    });
    expect(overlapTriggered).toBe(true);
    expect(queuedWrites.length).toBeGreaterThanOrEqual(2);
    firstWindow.unmount();
    secondWindow.unmount();

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageStub,
    });
    delete (globalThis.navigator as { locks?: LockManager }).locks;
    const relaunched = renderHook(() => useTutorThreads(lesson));
    const learnerQuestions = relaunched.result.current.activeThread.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.text);
    expect(learnerQuestions).toEqual(
      expect.arrayContaining([
        "Question from the first tab.",
        "Question from the second tab.",
      ]),
    );
  });

  it("keeps semantic Q&A pending until cancellation releases the request", async () => {
    isTauriMock.mockReturnValue(true);
    let resolveAnswer: (value: unknown) => void = () => {};
    const answer = new Promise((resolve) => {
      resolveAnswer = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "lesson_helper_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "answer_lesson_question") return answer;
      if (command === "cancel_lesson_answer") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const { result } = renderHook(() => useTutorThreads(lesson));
    await waitFor(() => {
      expect(result.current.helperMode).toBe("semantic");
    });

    act(() => {
      result.current.send("What does the weight change?");
    });
    const messageCount = result.current.activeThread.messages.length;
    act(() => {
      result.current.cancelAnswer();
    });

    expect(result.current.pendingAnswer?.cancelling).toBe(true);
    expect(result.current.helperNotice).toBeNull();
    act(() => {
      result.current.send("Can I retry immediately?");
    });
    expect(result.current.activeThread.messages).toHaveLength(messageCount);

    await act(async () => {
      resolveAnswer({
        status: "unsupported",
        text: "This page does not contain enough information.",
        claims: [],
      });
      await answer;
    });

    expect(result.current.pendingAnswer).toBeNull();
    expect(result.current.helperNotice).toBe(
      "Lesson answer cancelled. Your thread is saved.",
    );
    expect(result.current.activeThread.messages).toHaveLength(messageCount);
  });

  it("deletes another lesson thread without changing the current selection", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const firstThreadId = result.current.activeThread.id;

    act(() => {
      result.current.newThread();
    });
    const currentThreadId = result.current.activeThread.id;
    expect(currentThreadId).not.toBe(firstThreadId);

    act(() => {
      result.current.deleteThread(firstThreadId);
    });

    expect(result.current.activeThread.id).toBe(currentThreadId);
    expect(
      result.current.threads.some((thread) => thread.id === firstThreadId),
    ).toBe(false);
    await waitFor(() => {
      expect(persistedThreadIds()).not.toContain(firstThreadId);
    });
  });

  it("replaces a deleted active sole thread with a fresh authored thread", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const deletedThreadId = result.current.activeThread.id;

    act(() => {
      result.current.deleteThread(deletedThreadId);
    });

    const freshThread = result.current.activeThread;
    expect(freshThread.id).not.toBe(deletedThreadId);
    expect(freshThread.title).toBe(lesson.title);
    expect(freshThread.messages).toHaveLength(1);
    expect(freshThread.messages[0]?.role).toBe("tutor");
    expect(
      result.current.threads.some(
        (thread) => thread.id === deletedThreadId,
      ),
    ).toBe(false);
    await waitFor(() => {
      expect(persistedThreadIds()).not.toContain(deletedThreadId);
      expect(
        localStorage.getItem(
          `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
        ),
      ).toBe(freshThread.id);
    });
  });

  it("replaces a deleted active thread while retaining other lesson threads", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const retainedThreadId = result.current.activeThread.id;
    act(() => {
      result.current.newThread();
    });
    const deletedThreadId = result.current.activeThread.id;

    act(() => {
      result.current.deleteThread(deletedThreadId);
    });

    expect(result.current.activeThread.id).not.toBe(deletedThreadId);
    expect(result.current.activeThread.id).not.toBe(retainedThreadId);
    expect(
      result.current.threads.some(
        (thread) => thread.id === retainedThreadId,
      ),
    ).toBe(true);
    await waitFor(() => {
      expect(persistedThreadIds()).not.toContain(deletedThreadId);
    });
  });

  it("does not let a stale same-origin window resurrect a deleted thread", async () => {
    const deletingWindow = renderHook(() => useTutorThreads(lesson));
    const staleWindow = renderHook(() => useTutorThreads(lesson));
    const deletedThreadId = deletingWindow.result.current.activeThread.id;
    expect(staleWindow.result.current.activeThread.id).toBe(
      deletedThreadId,
    );
    const oldValue = localStorage.getItem(threadsKey);

    act(() => {
      deletingWindow.result.current.deleteThread(deletedThreadId);
    });
    await waitFor(() => {
      expect(persistedThreadIds()).not.toContain(deletedThreadId);
    });

    localStorage.setItem(threadsKey, oldValue ?? "");
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: threadsKey,
          oldValue: null,
          newValue: oldValue,
        }),
      );
    });

    expect(
      staleWindow.result.current.threads.some(
        (thread) => thread.id === deletedThreadId,
      ),
    ).toBe(false);
    expect(staleWindow.result.current.activeThread.id).not.toBe(
      deletedThreadId,
    );
    const repairedRecord = JSON.parse(
      localStorage.getItem(threadsKey) ?? "{}",
    ) as { deletedThreadIds?: string[] };
    expect(repairedRecord.deletedThreadIds).toContain(deletedThreadId);

    const reloadedWindow = renderHook(() => useTutorThreads(lesson));
    expect(
      reloadedWindow.result.current.threads.some(
        (thread) => thread.id === deletedThreadId,
      ),
    ).toBe(false);
    expect(reloadedWindow.result.current.activeThread.id).not.toBe(
      deletedThreadId,
    );
  });

  it("does not reinterpret an ordinary stale aggregate write as a deletion", async () => {
    const { result } = renderHook(() => useTutorThreads(lesson));
    const retainedThreadId = result.current.activeThread.id;
    act(() => {
      result.current.newThread();
    });
    const concurrentlyCreatedId = result.current.activeThread.id;
    await waitFor(() => {
      expect(persistedThreadIds()).toEqual(
        expect.arrayContaining([retainedThreadId, concurrentlyCreatedId]),
      );
    });
    const currentSerialized = localStorage.getItem(threadsKey);
    const staleRecord = JSON.parse(currentSerialized ?? "{}") as {
      version: 1;
      threads: Array<{ id: string }>;
    };
    staleRecord.threads = staleRecord.threads.filter(
      (thread) => thread.id !== concurrentlyCreatedId,
    );
    const staleSerialized = JSON.stringify(staleRecord);

    localStorage.setItem(threadsKey, staleSerialized);
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: threadsKey,
          oldValue: currentSerialized,
          newValue: staleSerialized,
        }),
      );
    });

    expect(
      result.current.threads.some(
        (thread) => thread.id === concurrentlyCreatedId,
      ),
    ).toBe(true);
    const stored = JSON.parse(
      localStorage.getItem(threadsKey) ?? "{}",
    ) as { deletedThreadIds?: string[] };
    expect(stored.deletedThreadIds ?? []).not.toContain(concurrentlyCreatedId);
    await waitFor(() => {
      expect(persistedThreadIds()).toContain(concurrentlyCreatedId);
    });
  });

  it("converges at the global cap without republishing tab-local active threads", () => {
    const base = Date.parse("2026-08-01T00:00:00.000Z");
    const firstActiveId = "active-oldest";
    const secondActiveId = "active-second-oldest";
    const lessonThreads = [
      storedThread(
        firstActiveId,
        lesson.id,
        new Date(base).toISOString(),
      ),
      storedThread(
        secondActiveId,
        lesson.id,
        new Date(base + 1_000).toISOString(),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        storedThread(
          `lesson-thread-${index}`,
          lesson.id,
          new Date(base + (index + 2) * 1_000).toISOString(),
        )
      ),
    ];
    const otherThreads = Array.from({ length: 40 }, (_, index) =>
      storedThread(
        `other-thread-${index}`,
        `other-lesson-${index}`,
        new Date(base + (index + 8) * 1_000).toISOString(),
      )
    );
    const initialThreads = [...lessonThreads, ...otherThreads];
    localStorage.setItem(
      threadsKey,
      JSON.stringify({
        version: 1,
        threads: initialThreads,
        deletedThreadIds: [],
      }),
    );
    localStorage.setItem(
      `trace-ml:active-thread:v1:${lesson.id}:${lessonRevision}`,
      firstActiveId,
    );
    const firstWindow = renderHook(() => useTutorThreads(lesson));
    const secondWindow = renderHook(() => useTutorThreads(lesson));
    act(() => {
      firstWindow.result.current.selectThread(firstActiveId);
      secondWindow.result.current.selectThread(secondActiveId);
    });

    const newest = storedThread(
      "newest-external-thread",
      "newest-external-lesson",
      new Date(base + 100_000).toISOString(),
    );
    const canonical = JSON.stringify({
      version: 1,
      threads: [
        ...initialThreads.filter((thread) => thread.id !== firstActiveId),
        newest,
      ],
      deletedThreadIds: [],
    });
    localStorageStub.setItem(threadsKey, canonical);
    let aggregateWrites = 0;
    const countingStorage: Storage = {
      ...localStorageStub,
      get length() {
        return localStorageStub.length;
      },
      setItem(key, value) {
        if (key === threadsKey) aggregateWrites += 1;
        localStorageStub.setItem(key, value);
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: countingStorage,
    });

    for (let index = 0; index < 3; index += 1) {
      act(() => {
        globalThis.dispatchEvent(
          new StorageEvent("storage", {
            key: threadsKey,
            oldValue: null,
            newValue: canonical,
          }),
        );
      });
    }

    expect(aggregateWrites).toBe(0);
    expect(firstWindow.result.current.activeThread.id).toBe(firstActiveId);
    expect(secondWindow.result.current.activeThread.id).toBe(secondActiveId);
    expect(persistedThreadIds()).toHaveLength(48);
    expect(persistedThreadIds()).not.toContain(firstActiveId);
    expect(persistedThreadIds()).toContain("newest-external-thread");
  });

  it("merges simultaneous questions in one thread by message id", () => {
    const firstWindow = renderHook(() => useTutorThreads(lesson));
    const secondWindow = renderHook(() => useTutorThreads(lesson));
    const sharedThreadId = firstWindow.result.current.activeThread.id;
    expect(secondWindow.result.current.activeThread.id).toBe(sharedThreadId);

    act(() => {
      firstWindow.result.current.send("What does the weight change?");
      secondWindow.result.current.send("What does the bias change?");
    });

    const relaunched = renderHook(() => useTutorThreads(lesson));
    const learnerQuestions = relaunched.result.current.activeThread.messages
      .filter((message) => message.role === "learner")
      .map((message) => message.text);
    expect(learnerQuestions).toEqual(
      expect.arrayContaining([
        "What does the weight change?",
        "What does the bias change?",
      ]),
    );
    expect(learnerQuestions).toHaveLength(2);
  });

  it("does not let a delayed previous-lesson lock restore its selection", () => {
    const queuedWrites: Array<() => void> = [];
    Object.defineProperty(globalThis.navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(
          (
            _name: string,
            callback: () => void,
          ) =>
            new Promise<void>((resolve) => {
              queuedWrites.push(() => {
                callback();
                resolve();
              });
            }),
        ),
      },
    });
    const nextLesson = requireLesson("shift-monitor");
    const { result, rerender } = renderHook(
      ({ currentLesson }) => useTutorThreads(currentLesson),
      { initialProps: { currentLesson: lesson } },
    );
    expect(queuedWrites.length).toBeGreaterThan(0);
    const delayedLessonWrite = queuedWrites[0];
    if (!delayedLessonWrite) throw new Error("Expected a queued lesson write.");

    rerender({ currentLesson: nextLesson });
    const nextThreadId = result.current.activeThread.id;
    const messageCount = result.current.activeThread.messages.length;

    act(() => {
      delayedLessonWrite();
    });
    act(() => {
      result.current.send("Does the monitor compare the current window?");
    });

    expect(result.current.activeThread.id).toBe(nextThreadId);
    expect(result.current.activeThread.lessonId).toBe(nextLesson.id);
    expect(result.current.activeThread.messages).toHaveLength(messageCount + 2);
    expect(
      result.current.activeThread.messages.some(
        (message) =>
          message.text === "Does the monitor compare the current window?",
      ),
    ).toBe(true);
  });
});
