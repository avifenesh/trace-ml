// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RecordActivityInput } from "./evidence";
import { useLearnerRecord } from "./useLearnerRecord";

const STORAGE_KEY = "trace-ml:learner-record:v1";
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
const explanationAttempt: RecordActivityInput = {
  lessonId: "linear-model",
  lessonRevision: "2026-08-02",
  activityId: "linear-explanation",
  conceptIds: ["linear-parameters"],
  evidenceKind: "explanation",
  response: "Weight changes slope and bias changes the intercept.",
  rubricSignals: ["weight", "bias"],
  level: "demonstrated",
  summary: "Named both parameter effects.",
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

describe("useLearnerRecord", () => {
  it("filters malformed persisted entries before exposing the record", () => {
    localStorageStub.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        events: [
          null,
          {
            id: "resource-1",
            type: "resource",
            lessonId: "linear-model",
            resourceId: "resource",
            status: "opened",
            observedAt: "2026-08-03T00:00:00.000Z",
          },
          { type: "activity", response: 7 },
        ],
        evidence: [
          null,
          { id: "broken" },
          {
            id: "orphan-evidence",
            conceptId: "linear-parameters",
            sourceAttemptId: "missing-attempt",
            lessonId: "linear-model",
            lessonRevision: "2026-08-02",
            activityId: "linear-explanation",
            kind: "explanation",
            level: "demonstrated",
            summary: "Must be discarded.",
            observedAt: "2026-08-03T00:00:00.000Z",
          },
        ],
      }),
    );

    const { result } = renderHook(() => useLearnerRecord());

    expect(result.current.record.events).toHaveLength(1);
    expect(result.current.record.evidence).toEqual([]);
  });

  it("continues in memory when browser storage throws", () => {
    const blockedStorage = {
      get length() {
        return 0;
      },
      clear() {},
      getItem() {
        throw new DOMException("blocked", "SecurityError");
      },
      key() {
        return null;
      },
      removeItem() {},
      setItem() {
        throw new DOMException("blocked", "SecurityError");
      },
    } satisfies Storage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: blockedStorage,
    });

    const { result } = renderHook(() => useLearnerRecord());
    act(() => {
      result.current.addActivityAttempt(explanationAttempt);
    });

    expect(result.current.record.events).toHaveLength(1);
    expect(result.current.record.evidence).toHaveLength(1);
    expect(result.current.persistenceStatus).toBe("memory-only");
  });

  it("merges a stale window with the latest persisted ledger before writing", () => {
    const first = renderHook(() => useLearnerRecord());
    const second = renderHook(() => useLearnerRecord());

    act(() => {
      first.result.current.addActivityAttempt(explanationAttempt);
    });
    act(() => {
      second.result.current.addActivityAttempt({
        ...explanationAttempt,
        activityId: "linear-transfer",
        evidenceKind: "transfer",
        response: "The same slope and intercept roles apply to a new route.",
      });
    });

    const stored = JSON.parse(
      localStorageStub.getItem(STORAGE_KEY) ?? "null",
    ) as { events: Array<{ activityId?: string }> };
    expect(stored.events.map((event) => event.activityId)).toEqual(
      expect.arrayContaining(["linear-explanation", "linear-transfer"]),
    );
    expect(stored.events).toHaveLength(2);
    expect(second.result.current.record.events).toHaveLength(2);
  });

  it("merges storage events from another window into the live record", () => {
    const { result } = renderHook(() => useLearnerRecord());
    const incoming = renderHook(() => useLearnerRecord());
    act(() => {
      incoming.result.current.addActivityAttempt(explanationAttempt);
    });
    const stored = localStorageStub.getItem(STORAGE_KEY);
    if (!stored) throw new Error("Expected a persisted learner record.");

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEY,
          newValue: stored,
        }),
      );
    });

    expect(result.current.record.events).toHaveLength(1);
    expect(result.current.persistenceStatus).toBe("persistent");
  });
});
