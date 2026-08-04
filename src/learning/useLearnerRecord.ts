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
const JOURNAL_KEY_PREFIX = `${STORAGE_KEY}:journal:`;
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

function loadStoredRecord() {
  try {
    const stored = readLocalStorage(STORAGE_KEY);
    return stored ? normalizeLearnerRecord(JSON.parse(stored)) : createLearnerRecord();
  } catch {
    // Invalid local state falls back to a fresh evidence ledger.
  }
  return createLearnerRecord();
}

function journalEntries() {
  const entries: Array<{ key: string; record: LearnerRecord }> = [];
  try {
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (!key?.startsWith(JOURNAL_KEY_PREFIX)) continue;
      const serialized = readLocalStorage(key);
      if (!serialized) continue;
      entries.push({
        key,
        record: normalizeLearnerRecord(JSON.parse(serialized)),
      });
    }
  } catch {
    // Unavailable or malformed journal entries are handled as memory-only state.
  }
  return entries;
}

function loadRecord() {
  return mergeLearnerRecords(
    loadStoredRecord(),
    ...journalEntries().map((entry) => entry.record),
  );
}

function recordDelta(previous: LearnerRecord, next: LearnerRecord) {
  const previousEventIds = new Set(previous.events.map((event) => event.id));
  const previousEvidenceIds = new Set(previous.evidence.map((item) => item.id));
  return compactLearnerRecord({
    version: 1,
    events: next.events.filter((event) => !previousEventIds.has(event.id)),
    evidence: next.evidence.filter((item) => !previousEvidenceIds.has(item.id)),
  });
}

function writeJournal(record: LearnerRecord) {
  const firstEventId = record.events[0]?.id;
  if (!firstEventId) return null;
  const key = `${JOURNAL_KEY_PREFIX}${encodeURIComponent(firstEventId)}`;
  return writeLocalStorage(key, JSON.stringify(record)) ? key : null;
}

function removeJournal(key: string) {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // A retained journal is harmless because learner records merge by stable IDs.
  }
}

export function useLearnerRecord() {
  const [record, setRecord] = useState<LearnerRecord>(loadRecord);
  const [persistenceStatus, setPersistenceStatus] = useState<
    "persistent" | "memory-only"
  >("persistent");
  const recordRef = useRef(record);

  const synchronizeAndWrite = useCallback(() => {
    const pendingJournals = journalEntries();
    const next = mergeLearnerRecords(
      recordRef.current,
      loadStoredRecord(),
      ...pendingJournals.map((entry) => entry.record),
    );
    recordRef.current = next;
    setRecord(next);
    if (!writeLocalStorage(STORAGE_KEY, JSON.stringify(next))) {
      setPersistenceStatus("memory-only");
      return;
    }
    pendingJournals.forEach((entry) => removeJournal(entry.key));
    setPersistenceStatus("persistent");
  }, []);

  const persistMergedRecord = useCallback(() => {
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
  }, [synchronizeAndWrite]);

  const commit = useCallback(
    (update: (current: LearnerRecord) => LearnerRecord) => {
      const current = recordRef.current;
      const optimistic = update(current);
      const journalKey = writeJournal(recordDelta(current, optimistic));
      recordRef.current = optimistic;
      setRecord(optimistic);
      setPersistenceStatus(journalKey ? "persistent" : "memory-only");
      persistMergedRecord();
    },
    [persistMergedRecord],
  );

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (
        (event.key !== STORAGE_KEY &&
          !event.key?.startsWith(JOURNAL_KEY_PREFIX)) ||
        !event.newValue
      ) {
        return;
      }
      try {
        const incoming = normalizeLearnerRecord(JSON.parse(event.newValue));
        const merged = mergeLearnerRecords(recordRef.current, incoming);
        recordRef.current = merged;
        setRecord(merged);
        if (JSON.stringify(merged) === JSON.stringify(incoming)) {
          setPersistenceStatus("persistent");
        } else {
          persistMergedRecord();
        }
      } catch {
        // Ignore malformed writes from another window.
      }
    };
    globalThis.addEventListener?.("storage", synchronize);
    return () => globalThis.removeEventListener?.("storage", synchronize);
  }, [persistMergedRecord]);

  useEffect(() => {
    if (journalEntries().length > 0) persistMergedRecord();
  }, [persistMergedRecord]);

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
