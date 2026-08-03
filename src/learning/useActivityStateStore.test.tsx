// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useActivityStateStore } from "./useActivityStateStore";

const scope = {
  lessonId: "linear-model",
  lessonRevision: "2026-08-03",
  activityId: "linear-python-lab",
};
const storageDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage",
);
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
  localStorageStub.clear();
});

afterEach(() => {
  cleanup();
  if (storageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

describe("useActivityStateStore", () => {
  it("rehydrates a revision-scoped code draft", () => {
    const first = renderHook(() => useActivityStateStore());
    act(() => {
      first.result.current.saveActivityState(scope, {
        kind: "code-lab",
        source: "weight = 2",
      });
    });
    first.unmount();

    const second = renderHook(() => useActivityStateStore());
    expect(second.result.current.getActivityState(scope)).toEqual({
      kind: "code-lab",
      source: "weight = 2",
    });
    expect(
      second.result.current.getActivityState({
        ...scope,
        lessonRevision: "2026-08-04",
      }),
    ).toBeNull();
  });

  it("keeps the snapshot in memory and reports a failed storage write", () => {
    const blockedStorage: Storage = {
      ...localStorageStub,
      setItem() {
        throw new DOMException("blocked", "QuotaExceededError");
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: blockedStorage,
    });

    const { result } = renderHook(() => useActivityStateStore());
    act(() => {
      result.current.saveActivityState(scope, {
        kind: "text-response",
        response: "A saved session-only draft.",
      });
    });

    expect(result.current.getActivityState(scope)).toEqual({
      kind: "text-response",
      response: "A saved session-only draft.",
    });
    expect(result.current.persistenceStatus).toBe("memory-only");
  });
});
