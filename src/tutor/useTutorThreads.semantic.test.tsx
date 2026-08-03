// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireLesson } from "../content/course";
import { useTutorThreads } from "./useTutorThreads";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

const lesson = requireLesson("prerequisite-trace");
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
  invokeMock.mockReset();
  isTauriMock.mockReset();
  isTauriMock.mockReturnValue(true);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageStub,
  });
  localStorage.clear();
});

afterEach(cleanup);

describe("useTutorThreads native helper", () => {
  it("persists the question and appends the cited Bedrock answer", async () => {
    let resolveAnswer: (value: unknown) => void = () => {};
    const answer = new Promise((resolve) => {
      resolveAnswer = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "lesson_helper_ready") return Promise.resolve(true);
      if (command === "answer_lesson_question") return answer;
      if (command === "cancel_lesson_answer") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const { result } = renderHook(() => useTutorThreads(lesson));
    await waitFor(() => expect(result.current.helperMode).toBe("semantic"));

    act(() => {
      result.current.send(
        "Explain what are the classes mentioned in the 80-to-20 baseline.",
      );
    });
    expect(result.current.pendingAnswer).not.toBeNull();
    expect(result.current.activeThread.messages.at(-1)?.role).toBe("learner");

    await act(async () => {
      resolveAnswer({
        status: "answered",
        text:
          "The two classes are the negative and positive target-label categories.",
        claims: [{
          text:
            "The two classes are the negative and positive target-label categories.",
          sourceChunkId: "00-base-rate:p1",
          quote: "Classes are the possible target-label categories.",
        }],
      });
      await answer;
    });

    await waitFor(() => expect(result.current.pendingAnswer).toBeNull());
    expect(result.current.activeThread.messages.at(-1)).toMatchObject({
      role: "tutor",
      text:
        "The two classes are the negative and positive target-label categories.",
      sourceBlockIds: ["00-base-rate"],
      sourceChunkIds: ["00-base-rate:p1"],
      claims: [{
        sourceChunkId: "00-base-rate:p1",
        quote: "Classes are the possible target-label categories.",
      }],
    });
  });

  it("invalidates and cancels an in-flight answer when the lesson changes", async () => {
    let resolveOldAnswer: (value: unknown) => void = () => {};
    const oldAnswer = new Promise((resolve) => {
      resolveOldAnswer = resolve;
    });
    let answerCalls = 0;
    invokeMock.mockImplementation((command: string) => {
      if (command === "lesson_helper_ready") return Promise.resolve(true);
      if (command === "answer_lesson_question") {
        answerCalls += 1;
        if (answerCalls === 1) return oldAnswer;
        return Promise.resolve({
          status: "answered",
          text: "The weight controls how much the prediction changes per input unit.",
          claims: [{
            text: "The weight controls how much the prediction changes per input unit.",
            sourceChunkId: "02-weight:p1",
            quote:
              "increasing x by one increases y_hat by three while b stays fixed",
          }],
        });
      }
      if (command === "cancel_lesson_answer") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const nextLesson = requireLesson("linear-model");
    const { result, rerender } = renderHook(
      ({ currentLesson }) => useTutorThreads(currentLesson),
      { initialProps: { currentLesson: lesson } },
    );
    await waitFor(() => expect(result.current.helperMode).toBe("semantic"));

    act(() => {
      result.current.send("What are the two classes?");
    });
    rerender({ currentLesson: nextLesson });
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "cancel_lesson_answer",
        expect.objectContaining({ requestId: expect.any(String) }),
      )
    );
    await waitFor(() => expect(result.current.pendingAnswer).toBeNull());

    act(() => {
      result.current.send("What does the weight control?");
    });
    await waitFor(() => expect(answerCalls).toBe(2));
    await waitFor(() => expect(result.current.pendingAnswer).toBeNull());
    expect(result.current.activeThread.messages.at(-1)).toMatchObject({
      role: "tutor",
      text: "The weight controls how much the prediction changes per input unit.",
      sourceChunkIds: ["02-weight:p1"],
    });

    await act(async () => {
      resolveOldAnswer({
        status: "answered",
        text: "A late answer from the previous lesson.",
        claims: [{
          text: "A late answer from the previous lesson.",
          sourceChunkId: "00-base-rate:p1",
          quote: "Classes are the possible target-label categories.",
        }],
      });
      await oldAnswer;
    });
    expect(result.current.activeThread.lessonId).toBe(nextLesson.id);
    expect(
      result.current.activeThread.messages.some(
        (message) => message.text === "A late answer from the previous lesson.",
      ),
    ).toBe(false);
  });

  it("uses the exact-page fallback after a remote failure", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "lesson_helper_ready") return Promise.resolve(true);
      if (command === "answer_lesson_question") {
        return Promise.reject("The lesson helper is unavailable.");
      }
      return Promise.resolve(false);
    });
    const { result } = renderHook(() => useTutorThreads(lesson));
    await waitFor(() => expect(result.current.helperMode).toBe("semantic"));

    act(() => {
      result.current.send(
        "Explain what are the classes mentioned in 80-to-20 classes still give an 80% majority baseline.",
      );
    });

    await waitFor(() => expect(result.current.pendingAnswer).toBeNull());
    expect(result.current.helperErrorMessage).toContain(
      "Showing the exact-page fallback",
    );
    expect(result.current.activeThread.messages.at(-1)?.text).toContain(
      "Classes are the possible target-label categories.",
    );
  });

  it("invalidates locally on cancel and ignores a late native answer", async () => {
    let resolveAnswer: (value: unknown) => void = () => {};
    const answer = new Promise((resolve) => {
      resolveAnswer = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "lesson_helper_ready") return Promise.resolve(true);
      if (command === "answer_lesson_question") return answer;
      if (command === "cancel_lesson_answer") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const { result } = renderHook(() => useTutorThreads(lesson));
    await waitFor(() => expect(result.current.helperMode).toBe("semantic"));

    act(() => {
      result.current.send("What are the two classes?");
    });
    const messageCount = result.current.activeThread.messages.length;
    act(() => {
      result.current.cancelAnswer();
    });
    expect(result.current.pendingAnswer).toBeNull();
    expect(result.current.helperNotice).toContain("cancelled");

    await act(async () => {
      resolveAnswer({
        status: "answered",
        text: "This late answer must be ignored.",
        claims: [{
          text: "This late answer must be ignored.",
          sourceChunkId: "00-base-rate:p1",
          quote: "Classes are the possible target-label categories.",
        }],
      });
      await answer;
    });

    expect(result.current.activeThread.messages).toHaveLength(messageCount);
    expect(
      result.current.activeThread.messages.some(
        (message) => message.text === "This late answer must be ignored.",
      ),
    ).toBe(false);
  });
});
