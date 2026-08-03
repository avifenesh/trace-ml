import { useCallback, useEffect, useRef, useState } from "react";
import {
  compactLearnerRecord,
  createLearnerRecord,
  mergeLearnerRecords,
  recordActivityAttempt,
  recordResourceAttempt,
  type RecordActivityInput,
} from "./evidence";
import { readLocalStorage, writeLocalStorage } from "../storage";
import type {
  ActivityAttempt,
  ConceptEvidence,
  EvidenceKind,
  EvidenceLevel,
  LearnerRecord,
  ResourceAttempt,
} from "./types";

const STORAGE_KEY = "trace-ml:learner-record:v1";
const STORAGE_LOCK = `${STORAGE_KEY}:write`;
const evidenceKinds = new Set<EvidenceKind>([
  "prediction",
  "manipulation",
  "explanation",
  "transfer",
  "code-check",
]);
const evidenceLevels = new Set<EvidenceLevel>([
  "unsupported",
  "partial",
  "demonstrated",
]);

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit)
    : [];
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizeEvent(value: unknown): ResourceAttempt | ActivityAttempt | null {
  const item = objectRecord(value);
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.lessonId !== "string" ||
    typeof item.observedAt !== "string"
  ) {
    return null;
  }
  if (
    item.type === "resource" &&
    typeof item.resourceId === "string" &&
    (item.status === "opened" ||
      item.status === "returned" ||
      item.status === "skipped")
  ) {
    return {
      id: item.id,
      type: "resource",
      lessonId: item.lessonId,
      resourceId: item.resourceId,
      status: item.status,
      observedAt: item.observedAt,
    };
  }
  if (
    item.type === "activity" &&
    typeof item.activityId === "string" &&
    typeof item.evidenceKind === "string" &&
    evidenceKinds.has(item.evidenceKind as EvidenceKind) &&
    typeof item.response === "string" &&
    typeof item.level === "string" &&
    evidenceLevels.has(item.level as EvidenceLevel)
  ) {
    return {
      id: item.id,
      type: "activity",
      lessonId: item.lessonId,
      lessonRevision: optionalString(item.lessonRevision),
      activityId: item.activityId,
      evidenceKind: item.evidenceKind as EvidenceKind,
      response: item.response.slice(0, 2_000),
      rubricSignals: strings(item.rubricSignals, 12),
      level: item.level as EvidenceLevel,
      observedAt: item.observedAt,
    };
  }
  return null;
}

function normalizeEvidence(value: unknown): ConceptEvidence | null {
  const item = objectRecord(value);
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.conceptId !== "string" ||
    typeof item.sourceAttemptId !== "string" ||
    typeof item.kind !== "string" ||
    !evidenceKinds.has(item.kind as EvidenceKind) ||
    typeof item.level !== "string" ||
    !evidenceLevels.has(item.level as EvidenceLevel) ||
    typeof item.summary !== "string" ||
    typeof item.observedAt !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    conceptId: item.conceptId as ConceptEvidence["conceptId"],
    sourceAttemptId: item.sourceAttemptId,
    lessonId: optionalString(item.lessonId),
    lessonRevision: optionalString(item.lessonRevision),
    activityId: optionalString(item.activityId),
    kind: item.kind as EvidenceKind,
    level: item.level as EvidenceLevel,
    summary: item.summary.slice(0, 600),
    observedAt: item.observedAt,
  };
}

export function normalizeLearnerRecord(value: unknown): LearnerRecord {
  const parsed = objectRecord(value);
  if (
    !parsed ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.events) ||
    !Array.isArray(parsed.evidence)
  ) {
    return createLearnerRecord();
  }
  return compactLearnerRecord({
    version: 1,
    events: parsed.events
      .map(normalizeEvent)
      .filter((item): item is ResourceAttempt | ActivityAttempt => item !== null),
    evidence: parsed.evidence
      .map(normalizeEvidence)
      .filter((item): item is ConceptEvidence => item !== null),
  });
}

function loadRecord() {
  try {
    const stored = readLocalStorage(STORAGE_KEY);
    return stored ? normalizeLearnerRecord(JSON.parse(stored)) : createLearnerRecord();
  } catch {
    // Invalid local state falls back to a fresh evidence ledger.
  }
  return createLearnerRecord();
}

export function useLearnerRecord() {
  const [record, setRecord] = useState<LearnerRecord>(loadRecord);
  const [persistenceStatus, setPersistenceStatus] = useState<
    "persistent" | "memory-only"
  >("persistent");
  const recordRef = useRef(record);

  const commit = useCallback(
    (update: (current: LearnerRecord) => LearnerRecord) => {
      const optimistic = update(recordRef.current);
      recordRef.current = optimistic;
      setRecord(optimistic);

      const synchronizeAndWrite = () => {
        const latestStored = loadRecord();
        const next = mergeLearnerRecords(recordRef.current, latestStored);
        recordRef.current = next;
        setRecord(next);
        setPersistenceStatus(
          writeLocalStorage(STORAGE_KEY, JSON.stringify(next))
            ? "persistent"
            : "memory-only",
        );
      };
      const locks = globalThis.navigator?.locks;
      if (!locks) {
        synchronizeAndWrite();
        return;
      }
      try {
        void locks
          .request(STORAGE_LOCK, synchronizeAndWrite)
          .catch(() => setPersistenceStatus("memory-only"));
      } catch {
        setPersistenceStatus("memory-only");
      }
    },
    [],
  );

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const incoming = normalizeLearnerRecord(JSON.parse(event.newValue));
        const merged = mergeLearnerRecords(recordRef.current, incoming);
        recordRef.current = merged;
        setRecord(merged);
        setPersistenceStatus("persistent");
      } catch {
        // Ignore malformed writes from another window.
      }
    };
    globalThis.addEventListener?.("storage", synchronize);
    return () => globalThis.removeEventListener?.("storage", synchronize);
  }, []);

  const addResourceAttempt = useCallback(
    (
      input: Omit<ResourceAttempt, "id" | "type" | "observedAt">,
    ) => {
      commit((current) => recordResourceAttempt(current, input));
    },
    [commit],
  );

  const addActivityAttempt = useCallback((input: RecordActivityInput) => {
    commit((current) => recordActivityAttempt(current, input));
  }, [commit]);

  return {
    record,
    persistenceStatus,
    addResourceAttempt,
    addActivityAttempt,
  };
}
