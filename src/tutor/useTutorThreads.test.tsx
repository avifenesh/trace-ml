// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireLesson } from "../content/course";
import { useTutorThreads } from "./useTutorThreads";

const lesson = requireLesson("linear-model");
const lessonRevision = lesson.revision ?? "unversioned";
const storedValues = new Map<string, string>();
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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("useTutorThreads", () => {
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
});
