import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BedrockReadiness } from "../bedrock-readiness";
import {
  pageChunksForLesson,
  type Lesson,
} from "../content/types";
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
  type TutorClaim,
  type TutorMessage,
} from "./conversations";
import {
  answerLessonQuestion,
  cancelLessonAnswer,
  lessonHelperError,
  lessonHelperReady,
  nativeLessonHelperAvailable,
} from "./lesson-helper";

const STORAGE_KEY = "trace-ml:tutor-threads:v1";
const ACTIVE_THREAD_KEY = "trace-ml:active-thread:v1";
const DELETED_THREAD_KEY_PREFIX = "trace-ml:tutor-thread-deleted:v1:";
const STORAGE_LOCK = `${STORAGE_KEY}:write`;
const JOURNAL_KEY_PREFIX = `${STORAGE_KEY}:journal:`;
const LEGACY_REVISION = "legacy-unversioned";
const MAX_THREADS_PER_LESSON = 8;
const MAX_STORED_THREADS = 48;
const MAX_STORED_MESSAGES = 640;
const MAX_DELETED_THREAD_IDS = 256;
const MAX_JOURNAL_ENTRIES = 12;
const MAX_FALLBACK_MESSAGES = 24;
const MAX_FALLBACK_DELETED_THREAD_IDS = 64;
const EMPTY_COMMITTED_ACTIVITY_IDS = new Set<string>();

interface DeletedThreadMarker {
  threadId: string;
  sequence: number;
  deletedAt: string;
  markerId: string;
}

interface StoredThreads {
  version: 1;
  threads: ConversationThread[];
  deletedThreadIds: string[];
  deletedThreadMarkers: DeletedThreadMarker[];
}

interface TutorState extends StoredThreads {
  activeThreadId: string;
}

export type LessonHelperMode = "checking" | "semantic" | "local";

interface PendingLessonAnswer {
  requestId: string;
  threadId: string;
  cancelling: boolean;
}

function activeThreadKey(lesson: Lesson) {
  return `${ACTIVE_THREAD_KEY}:${lesson.id}:${revisionForLesson(lesson)}`;
}

function storedActiveThreadIds(lesson: Lesson) {
  return [...new Set([
    readLocalStorage(ACTIVE_THREAD_KEY),
    readLocalStorage(activeThreadKey(lesson)),
  ].filter((id): id is string => Boolean(id)))].sort();
}

function threadIdFromDeletedKey(key: string) {
  if (!key.startsWith(DELETED_THREAD_KEY_PREFIX)) return null;
  try {
    return decodeURIComponent(key.slice(DELETED_THREAD_KEY_PREFIX.length));
  } catch {
    return null;
  }
}

function newestThreadFirst(
  left: ConversationThread,
  right: ConversationThread,
) {
  return right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.id.localeCompare(right.id);
}

function limitThreads(
  threads: ConversationThread[],
  activeThreadId = "",
  maxThreads = MAX_STORED_THREADS,
  maxMessages = MAX_STORED_MESSAGES,
  protectedThreadIds: readonly string[] = [],
) {
  const counts = new Map<string, number>();
  const sorted = [...threads].sort(newestThreadFirst);
  const active = sorted.find((thread) => thread.id === activeThreadId);
  const additionalProtectedIds = [...new Set(protectedThreadIds)]
    .filter((id) => id !== activeThreadId)
    .sort();
  const protectedIds = [
    ...(active ? [active.id] : []),
    ...additionalProtectedIds,
  ];
  const protectedSet = new Set(protectedIds);
  const protectedThreads = protectedIds
    .map((id) => sorted.find((thread) => thread.id === id))
    .filter((thread): thread is ConversationThread => Boolean(thread));
  const scopeOrder = [
    ...protectedThreads,
    ...sorted.filter((thread) => !protectedSet.has(thread.id)),
  ];
  const eligible = scopeOrder.filter((thread) => {
    const scope = `${thread.lessonId}:${thread.lessonRevision}`;
    const count = counts.get(scope) ?? 0;
    if (count >= MAX_THREADS_PER_LESSON) return false;
    counts.set(scope, count + 1);
    return true;
  }).sort(newestThreadFirst);
  const eligibleIds = new Set(eligible.map((thread) => thread.id));
  const selectedProtectedIds = protectedIds.filter((id) => eligibleIds.has(id));
  const selectedProtectedSet = new Set(selectedProtectedIds);
  const selectedIds = new Set(
    selectedProtectedIds
      .concat(
        eligible
          .filter((thread) => !selectedProtectedSet.has(thread.id))
          .map((thread) => thread.id),
      )
      .slice(0, maxThreads)
  );
  const selected = eligible.filter((thread) => selectedIds.has(thread.id));
  const allocationOrder = [
    ...selectedProtectedIds
      .map((id) => selected.find((thread) => thread.id === id))
      .filter((thread): thread is ConversationThread => Boolean(thread)),
    ...selected.filter((thread) => !selectedProtectedSet.has(thread.id)),
  ];
  const allocated = new Map<string, TutorMessage[]>();
  let remainingMessages = maxMessages;

  allocationOrder.forEach((thread, index) => {
    const remainingThreads = allocationOrder.length - index - 1;
    const available = Math.max(1, remainingMessages - remainingThreads);
    const messageCount = Math.min(thread.messages.length, available);
    allocated.set(thread.id, thread.messages.slice(-messageCount));
    remainingMessages -= messageCount;
  });

  return selected.map((thread) => ({
    ...thread,
    messages: allocated.get(thread.id) ?? thread.messages.slice(-1),
  }));
}

function deletedMarkerId() {
  const value = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `deletion-${value}`;
}

function compareDeletedMarkers(
  left: DeletedThreadMarker,
  right: DeletedThreadMarker,
) {
  return left.sequence - right.sequence ||
    left.deletedAt.localeCompare(right.deletedAt) ||
    left.markerId.localeCompare(right.markerId) ||
    left.threadId.localeCompare(right.threadId);
}

function mergeDeletedThreadMarkers(
  markers: DeletedThreadMarker[],
  maximum = MAX_DELETED_THREAD_IDS,
) {
  const newestByThread = new Map<string, DeletedThreadMarker>();
  markers.forEach((marker) => {
    const current = newestByThread.get(marker.threadId);
    if (!current || compareDeletedMarkers(current, marker) < 0) {
      newestByThread.set(marker.threadId, marker);
    }
  });
  return [...newestByThread.values()]
    .sort(compareDeletedMarkers)
    .slice(-maximum);
}

function legacyDeletedThreadMarkers(ids: string[]) {
  return ids.map((threadId, index) => ({
    threadId,
    sequence: index + 1,
    deletedAt: "",
    markerId: `legacy-${index.toString().padStart(6, "0")}-${threadId}`,
  }));
}

function deletedThreadMarker(
  current: StoredThreads,
  threadId: string,
): DeletedThreadMarker {
  const sequence = current.deletedThreadMarkers.reduce(
    (maximum, marker) => Math.max(maximum, marker.sequence),
    0,
  ) + 1;
  return {
    threadId,
    sequence,
    deletedAt: new Date().toISOString(),
    markerId: deletedMarkerId(),
  };
}

function storedThreads(
  threads: ConversationThread[],
  deletedThreadMarkers: DeletedThreadMarker[],
): StoredThreads {
  const boundedMarkers = mergeDeletedThreadMarkers(deletedThreadMarkers);
  return {
    version: 1,
    threads,
    deletedThreadIds: boundedMarkers.map((marker) => marker.threadId),
    deletedThreadMarkers: boundedMarkers,
  };
}

function boundStoredThreads(
  record: StoredThreads,
  protectedThreadIds: readonly string[] = [],
): StoredThreads {
  return storedThreads(
    limitThreads(
      record.threads,
      "",
      MAX_STORED_THREADS,
      MAX_STORED_MESSAGES,
      protectedThreadIds,
    ),
    record.deletedThreadMarkers,
  );
}

function quotaFallbackRecord(
  record: StoredThreads,
  activeThreadId: string,
): StoredThreads {
  const newest = [...record.threads].sort(newestThreadFirst);
  const active = newest.find((thread) => thread.id === activeThreadId) ??
    newest[0];
  return storedThreads(
    active
      ? [{
          ...active,
          messages: active.messages.slice(-MAX_FALLBACK_MESSAGES).map(
            (message) => ({
              ...message,
              claims: message.claims?.map((claim) => ({
                ...claim,
                text: claim.text.slice(0, 500),
                quote: claim.quote.slice(0, 500),
              })),
            }),
          ),
        }]
      : [],
    mergeDeletedThreadMarkers(
      record.deletedThreadMarkers,
      MAX_FALLBACK_DELETED_THREAD_IDS,
    ),
  );
}

function writeBoundedRecord(
  key: string,
  record: StoredThreads,
  activeThreadId: string,
  protectedThreadIds: readonly string[] = [],
) {
  const bounded = boundStoredThreads(record, protectedThreadIds);
  if (writeLocalStorage(key, JSON.stringify(bounded))) return bounded;
  const fallback = quotaFallbackRecord(bounded, activeThreadId);
  return writeLocalStorage(key, JSON.stringify(fallback)) ? fallback : null;
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

function normalizeClaims(value: unknown): TutorClaim[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 5) {
    return undefined;
  }
  const claims: TutorClaim[] = [];
  for (const rawClaim of value) {
    const claim = objectRecord(rawClaim);
    if (
      !claim ||
      typeof claim.text !== "string" ||
      !claim.text.trim() ||
      typeof claim.sourceChunkId !== "string" ||
      !claim.sourceChunkId ||
      typeof claim.quote !== "string" ||
      !claim.quote.trim()
    ) {
      return undefined;
    }
    claims.push({
      text: claim.text.trim().slice(0, 2_000),
      sourceChunkId: claim.sourceChunkId.slice(0, 300),
      quote: claim.quote.trim().slice(0, 10_000),
    });
  }
  return claims;
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
    claims: normalizeClaims(message.claims),
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
    .filter(
      (message) =>
        message.lessonId === lessonId &&
        message.lessonRevision === lessonRevision,
    )
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

function normalizeDeletedThreadMarker(
  value: unknown,
): DeletedThreadMarker | null {
  const marker = objectRecord(value);
  if (
    !marker ||
    typeof marker.threadId !== "string" ||
    !marker.threadId ||
    marker.threadId.length > 300 ||
    typeof marker.sequence !== "number" ||
    !Number.isSafeInteger(marker.sequence) ||
    marker.sequence < 0 ||
    typeof marker.deletedAt !== "string" ||
    marker.deletedAt.length > 100 ||
    typeof marker.markerId !== "string" ||
    !marker.markerId ||
    marker.markerId.length > 500
  ) {
    return null;
  }
  return {
    threadId: marker.threadId,
    sequence: marker.sequence,
    deletedAt: marker.deletedAt,
    markerId: marker.markerId,
  };
}

function legacyDeletedThreadIdsFromStorage() {
  const deleted: string[] = [];
  try {
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (!key) continue;
      const threadId = threadIdFromDeletedKey(key);
      if (threadId && readLocalStorage(key) !== null) deleted.push(threadId);
    }
  } catch {
    // Legacy markers are best-effort migration input.
  }
  return deleted.sort().slice(-MAX_DELETED_THREAD_IDS);
}

function removeLegacyDeletedMarkers() {
  const keys: string[] = [];
  try {
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (key?.startsWith(DELETED_THREAD_KEY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => globalThis.localStorage.removeItem(key));
  } catch {
    // The canonical tombstone list remains authoritative.
  }
}

function parseStoredThreads(
  serialized: string | null,
  lesson: Lesson,
  protectedThreadIds: readonly string[] = [],
): StoredThreads {
  if (!serialized) {
    return storedThreads([], []);
  }
  try {
    const parsed = objectRecord(JSON.parse(serialized));
    if (
      parsed?.version === 1 &&
      Array.isArray(parsed.threads)
    ) {
      const deletedThreadIds = Array.isArray(parsed.deletedThreadIds)
        ? parsed.deletedThreadIds.filter(
          (id): id is string =>
            typeof id === "string" && Boolean(id) && id.length <= 300,
        )
        : [];
      const normalizedMarkers = Array.isArray(parsed.deletedThreadMarkers)
        ? parsed.deletedThreadMarkers
          .map(normalizeDeletedThreadMarker)
          .filter((marker): marker is DeletedThreadMarker => marker !== null)
        : [];
      const markerThreadIds = new Set(
        normalizedMarkers.map((marker) => marker.threadId),
      );
      const deletedThreadMarkers = mergeDeletedThreadMarkers([
        ...normalizedMarkers,
        ...legacyDeletedThreadMarkers(
          deletedThreadIds.filter((id) => !markerThreadIds.has(id)),
        ),
      ]);
      const normalized = storedThreads([], deletedThreadMarkers);
      const deleted = new Set(normalized.deletedThreadIds);
      return boundStoredThreads(
        storedThreads(
          parsed.threads
            .map((thread) => normalizeThread(thread, lesson))
            .filter((thread): thread is ConversationThread => thread !== null)
            .filter((thread) => !deleted.has(thread.id)),
          deletedThreadMarkers,
        ),
        protectedThreadIds,
      );
    }
  } catch {
    // A malformed local record should never block the lesson.
  }
  return storedThreads([], []);
}

function mergeMessages(
  first: TutorMessage[],
  second: TutorMessage[],
) {
  const messages = new Map<
    string,
    { message: TutorMessage; order: number }
  >();
  for (const list of [first, second]) {
    list.forEach((message, order) => {
      const existing = messages.get(message.id);
      if (!existing || message.createdAt >= existing.message.createdAt) {
        messages.set(message.id, {
          message,
          order: existing ? Math.min(existing.order, order) : order,
        });
      } else {
        existing.order = Math.min(existing.order, order);
      }
    });
  }
  return [...messages.values()]
    .sort((left, right) =>
      left.message.createdAt.localeCompare(right.message.createdAt) ||
      left.order - right.order ||
      left.message.id.localeCompare(right.message.id)
    )
    .map((entry) => entry.message)
    .slice(-80);
}

function mergeThread(
  first: ConversationThread,
  second: ConversationThread,
) {
  const newest = second.updatedAt >= first.updatedAt ? second : first;
  const messages = mergeMessages(first.messages, second.messages);
  const latestMessageAt = messages.at(-1)?.createdAt ?? newest.updatedAt;
  return {
    ...newest,
    createdAt: first.createdAt <= second.createdAt
      ? first.createdAt
      : second.createdAt,
    updatedAt: [first.updatedAt, second.updatedAt, latestMessageAt].sort().at(-1)
      ?? newest.updatedAt,
    messages,
  };
}

function mergeThreads(
  first: ConversationThread[],
  second: ConversationThread[],
) {
  const merged = new Map<string, ConversationThread>();
  for (const thread of [...first, ...second]) {
    const existing = merged.get(thread.id);
    merged.set(thread.id, existing ? mergeThread(existing, thread) : thread);
  }
  return limitThreads([...merged.values()]);
}

function mergeStoredThreads(
  records: StoredThreads[],
  protectedThreadIds: readonly string[] = [],
): StoredThreads {
  const deletedThreadMarkers = mergeDeletedThreadMarkers(
    records.flatMap((record) => record.deletedThreadMarkers),
  );
  const deleted = new Set(
    deletedThreadMarkers.map((marker) => marker.threadId),
  );
  const threads = records
    .reduce(
      (merged, record) =>
        mergeThreads(merged, record.threads),
      [] as ConversationThread[],
    )
    .filter((thread) => !deleted.has(thread.id));
  return boundStoredThreads(
    storedThreads(threads, deletedThreadMarkers),
    protectedThreadIds,
  );
}

function journalEntries(lesson: Lesson) {
  const entries: Array<{ key: string; record: StoredThreads }> = [];
  const protectedThreadIds = storedActiveThreadIds(lesson);
  try {
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (!key?.startsWith(JOURNAL_KEY_PREFIX)) continue;
      const serialized = readLocalStorage(key);
      if (!serialized) continue;
      entries.push({
        key,
        record: parseStoredThreads(serialized, lesson, protectedThreadIds),
      });
    }
  } catch {
    // Unavailable journal storage is reported by the mutation that attempted it.
  }
  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

function removeJournal(key: string) {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Stable message and thread IDs make a retained journal safe to merge again.
  }
}

function writeJournal(
  record: StoredThreads,
  activeThreadId: string,
) {
  const id = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const key = `${JOURNAL_KEY_PREFIX}${Date.now().toString().padStart(13, "0")}:${id}`;
  return writeBoundedRecord(key, record, activeThreadId, [activeThreadId])
    ? key
    : null;
}

function consolidateJournalEntries(
  entries: Array<{ key: string; record: StoredThreads }>,
  protectedThreadIds: readonly string[],
) {
  if (entries.length <= MAX_JOURNAL_ENTRIES) return true;
  const consolidated = mergeStoredThreads(
    entries.map((entry) => entry.record),
    protectedThreadIds,
  );
  const id = globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const key = `${JOURNAL_KEY_PREFIX}${Date.now().toString().padStart(13, "0")}:${id}`;
  if (!writeLocalStorage(key, JSON.stringify(consolidated))) return false;
  entries.forEach((entry) => removeJournal(entry.key));
  return true;
}

function removeThreads(
  current: TutorState,
  removedThreadIds: ReadonlySet<string>,
  lesson: Lesson,
  lessonRevision: string,
) {
  const removed = current.threads.filter((thread) =>
    removedThreadIds.has(thread.id)
  );
  if (removed.length === 0) return current;

  const retained = current.threads.filter(
    (thread) => !removedThreadIds.has(thread.id),
  );
  const activeRemoved = removedThreadIds.has(current.activeThreadId);
  const lessonThreadRemains = retained.some(
    (thread) =>
      thread.lessonId === lesson.id &&
      thread.lessonRevision === lessonRevision,
  );
  if (!activeRemoved && lessonThreadRemains) {
    return { ...current, threads: retained };
  }

  const fresh = createConversationThread(lesson);
  return {
    ...current,
    threads: limitThreads([fresh, ...retained], fresh.id),
    activeThreadId: fresh.id,
  };
}

function stateForLesson(
  stored: StoredThreads,
  preferredThreadId: string,
  lesson: Lesson,
): TutorState {
  const lessonRevision = revisionForLesson(lesson);
  const preferred = stored.threads.find(
    (thread) =>
      thread.id === preferredThreadId &&
      thread.lessonId === lesson.id &&
      thread.lessonRevision === lessonRevision,
  );
  const existing = preferred ?? stored.threads.find(
    (thread) =>
      thread.lessonId === lesson.id &&
      thread.lessonRevision === lessonRevision,
  );
  if (existing) return { ...stored, activeThreadId: existing.id };

  const created = createConversationThread(lesson);
  return {
    ...stored,
    threads: limitThreads([created, ...stored.threads], created.id),
    activeThreadId: created.id,
  };
}

function withLocalActiveThread(
  stored: StoredThreads,
  current: TutorState,
): StoredThreads {
  const active = current.threads.find(
    (thread) => thread.id === current.activeThreadId,
  );
  if (!active || stored.deletedThreadIds.includes(active.id)) return stored;
  const persistedActive = stored.threads.find(
    (thread) => thread.id === active.id,
  );
  const localActive = persistedActive
    ? mergeThread(persistedActive, active)
    : active;
  return storedThreads(
    limitThreads(
      [
        localActive,
        ...stored.threads.filter((thread) => thread.id !== localActive.id),
      ],
      localActive.id,
    ),
    stored.deletedThreadMarkers,
  );
}

function mutationJournal(current: TutorState, next: TutorState): StoredThreads {
  const currentThreads = new Map(
    current.threads.map((thread) => [thread.id, JSON.stringify(thread)]),
  );
  const currentDeleted = new Map(
    current.deletedThreadMarkers.map((marker) => [
      marker.threadId,
      marker.markerId,
    ]),
  );
  const deletedThreadMarkers = next.deletedThreadMarkers.filter(
    (marker) => currentDeleted.get(marker.threadId) !== marker.markerId,
  );
  return storedThreads(
    next.threads.filter(
      (thread) => currentThreads.get(thread.id) !== JSON.stringify(thread),
    ),
    deletedThreadMarkers,
  );
}

function loadState(lesson: Lesson): TutorState {
  const activeThreadId =
    readLocalStorage(activeThreadKey(lesson)) ??
    readLocalStorage(ACTIVE_THREAD_KEY) ??
    "";
  const protectedThreadIds = activeThreadId ? [activeThreadId] : [];
  const stored = mergeStoredThreads([
    parseStoredThreads(
      readLocalStorage(STORAGE_KEY),
      lesson,
      protectedThreadIds,
    ),
    storedThreads(
      [],
      legacyDeletedThreadMarkers(legacyDeletedThreadIdsFromStorage()),
    ),
    ...journalEntries(lesson).map((entry) => entry.record),
  ], protectedThreadIds);
  return stateForLesson(stored, activeThreadId, lesson);
}

export function useTutorThreads(
  lesson: Lesson,
  activeBlockId?: string,
  committedActivityIds: ReadonlySet<string> = EMPTY_COMMITTED_ACTIVITY_IDS,
) {
  const lessonRevision = revisionForLesson(lesson);
  const [state, setState] = useState<TutorState>(() => loadState(lesson));
  const stateRef = useRef(state);
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;
  const nativeHelper = nativeLessonHelperAvailable();
  const [helperMode, setHelperMode] = useState<LessonHelperMode>(
    nativeHelper ? "checking" : "local",
  );
  const [helperReadiness, setHelperReadiness] =
    useState<BedrockReadiness | null>(null);
  const [pendingAnswer, setPendingAnswer] =
    useState<PendingLessonAnswer | null>(null);
  const pendingAnswerRef = useRef<PendingLessonAnswer | null>(null);
  const [helperErrorMessage, setHelperErrorMessage] =
    useState<string | null>(null);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);
  const [persistenceStatus, setPersistenceStatus] = useState<
    "persistent" | "memory-only"
  >("persistent");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyState = useCallback((next: TutorState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const synchronizeAndWrite = useCallback(() => {
    const currentLesson = lessonRef.current;
    const current = stateRef.current;
    const protectedThreadIds = storedActiveThreadIds(currentLesson);
    const pendingJournals = journalEntries(currentLesson);
    const merged = mergeStoredThreads([
      parseStoredThreads(
        readLocalStorage(STORAGE_KEY),
        currentLesson,
        protectedThreadIds,
      ),
      storedThreads(current.threads, current.deletedThreadMarkers),
      ...pendingJournals.map((entry) => entry.record),
    ], protectedThreadIds);
    const persisted = writeBoundedRecord(
      STORAGE_KEY,
      merged,
      current.activeThreadId,
      protectedThreadIds,
    );
    if (!persisted) {
      consolidateJournalEntries(pendingJournals, protectedThreadIds);
      setPersistenceStatus("memory-only");
      return;
    }
    pendingJournals.forEach((entry) => removeJournal(entry.key));
    removeLegacyDeletedMarkers();
    const next = stateForLesson(
      withLocalActiveThread(persisted, current),
      current.activeThreadId,
      currentLesson,
    );
    applyState(next);
    setPersistenceStatus("persistent");
  }, [applyState]);

  const persistMergedState = useCallback(() => {
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

  const commitThreadState = useCallback(
    (
      update: (current: TutorState) => TutorState,
      requireDurableJournal = false,
    ) => {
      const current = stateRef.current;
      const next = update(current);
      if (next === current) return true;
      const journal = mutationJournal(current, next);
      const hasMutation =
        journal.threads.length > 0 ||
        journal.deletedThreadMarkers.length > 0;
      const journalKey = hasMutation
        ? writeJournal(journal, next.activeThreadId)
        : "selection-only";
      if (!journalKey && requireDurableJournal) {
        setPersistenceStatus("memory-only");
        return false;
      }
      if (next.activeThreadId !== current.activeThreadId) {
        const currentLesson = lessonRef.current;
        const writesSucceeded = [
          writeLocalStorage(ACTIVE_THREAD_KEY, next.activeThreadId),
          writeLocalStorage(
            activeThreadKey(currentLesson),
            next.activeThreadId,
          ),
        ].every(Boolean);
        if (!writesSucceeded) setPersistenceStatus("memory-only");
      }
      applyState(next);
      if (!hasMutation) return true;
      setPersistenceStatus(journalKey ? "persistent" : "memory-only");
      if (journalKey) persistMergedState();
      return true;
    },
    [applyState, persistMergedState],
  );

  useEffect(() => {
    if (!nativeHelper) {
      setHelperReadiness(null);
      setHelperMode("local");
      return;
    }
    let current = true;
    setHelperReadiness(null);
    setHelperMode("checking");
    void lessonHelperReady().then((readiness) => {
      if (!current) return;
      setHelperReadiness(readiness);
      setHelperMode(readiness?.available ? "semantic" : "local");
    });
    return () => {
      current = false;
    };
  }, [nativeHelper]);

  useEffect(
    () => () => {
      const pending = pendingAnswerRef.current;
      pendingAnswerRef.current = null;
      setPendingAnswer(null);
      setHelperErrorMessage(null);
      setHelperNotice(null);
      if (pending) void cancelLessonAnswer(pending.requestId);
    },
    [lesson.id, lessonRevision],
  );

  useEffect(() => {
    const writesSucceeded = [
      writeLocalStorage(ACTIVE_THREAD_KEY, state.activeThreadId),
      writeLocalStorage(activeThreadKey(lesson), state.activeThreadId),
    ].every(Boolean);
    if (!writesSucceeded) setPersistenceStatus("memory-only");
  }, [lesson, state.activeThreadId]);

  useEffect(() => {
    persistMergedState();
  }, [lesson.id, lessonRevision, persistMergedState]);

  useLayoutEffect(() => {
    const current = stateRef.current;
    const active = current.threads.find(
      (thread) => thread.id === current.activeThreadId,
    );
    if (
      active?.lessonId === lesson.id &&
      active.lessonRevision === lessonRevision
    ) {
      return;
    }

    const savedThreadId = readLocalStorage(activeThreadKey(lesson));
    applyState(
      stateForLesson(
        storedThreads(current.threads, current.deletedThreadMarkers),
        savedThreadId ?? "",
        lesson,
      ),
    );
  }, [applyState, lesson, lessonRevision]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const deletedThreadId = event.key
        ? threadIdFromDeletedKey(event.key)
        : null;
      if (deletedThreadId && event.newValue !== null) {
        const current = stateRef.current;
        const deletedThreadMarkers = mergeDeletedThreadMarkers(
          [
            ...current.deletedThreadMarkers,
            deletedThreadMarker(current, deletedThreadId),
          ],
        );
        const next = removeThreads(
          {
            ...current,
            deletedThreadIds: deletedThreadMarkers.map(
              (marker) => marker.threadId,
            ),
            deletedThreadMarkers,
          },
          new Set([deletedThreadId]),
          lessonRef.current,
          revisionForLesson(lessonRef.current),
        );
        applyState(next);
        persistMergedState();
        return;
      }

      if (
        event.key !== STORAGE_KEY &&
        !event.key?.startsWith(JOURNAL_KEY_PREFIX)
      ) {
        return;
      }
      const currentLesson = lessonRef.current;
      const protectedThreadIds = storedActiveThreadIds(currentLesson);
      const incoming = parseStoredThreads(
        event.newValue,
        currentLesson,
        protectedThreadIds,
      );
      const current = stateRef.current;
      const canonical = parseStoredThreads(
        readLocalStorage(STORAGE_KEY),
        currentLesson,
        protectedThreadIds,
      );
      const merged = mergeStoredThreads([
        storedThreads(current.threads, current.deletedThreadMarkers),
        incoming,
        canonical,
        ...journalEntries(currentLesson).map((entry) => entry.record),
      ], protectedThreadIds);
      const next = stateForLesson(
        withLocalActiveThread(merged, current),
        current.activeThreadId,
        currentLesson,
      );
      applyState(next);
      if (JSON.stringify(merged) !== JSON.stringify(canonical)) {
        persistMergedState();
      }
    };
    globalThis.addEventListener?.("storage", handleStorage);
    return () => globalThis.removeEventListener?.("storage", handleStorage);
  }, [applyState, lesson, persistMergedState]);

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
    if (pendingAnswerRef.current) return;
    const thread = createConversationThread(lesson);
    setHelperErrorMessage(null);
    setHelperNotice(null);
    commitThreadState((current) => ({
      ...current,
      threads: limitThreads([thread, ...current.threads], thread.id),
      activeThreadId: thread.id,
    }));
  }, [commitThreadState, lesson]);

  const selectThread = useCallback(
    (threadId: string) => {
      if (pendingAnswerRef.current) return;
      setHelperErrorMessage(null);
      setHelperNotice(null);
      commitThreadState((current) => {
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
    [commitThreadState, lesson.id, lessonRevision],
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      if (pendingAnswerRef.current) return false;
      setHelperErrorMessage(null);
      setHelperNotice(null);
      const deleted = stateRef.current.threads.find(
        (thread) =>
          thread.id === threadId &&
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      );
      if (!deleted) return false;
      const deletedSuccessfully = commitThreadState(
        (current) => {
          const deletedThreadMarkers = mergeDeletedThreadMarkers(
            [
              ...current.deletedThreadMarkers,
              deletedThreadMarker(current, deleted.id),
            ],
          );
          return removeThreads(
            {
              ...current,
              deletedThreadIds: deletedThreadMarkers.map(
                (marker) => marker.threadId,
              ),
              deletedThreadMarkers,
            },
            new Set([deleted.id]),
            lesson,
            lessonRevision,
          );
        },
        true,
      );
      if (!deletedSuccessfully) {
        setHelperErrorMessage(
          "The conversation could not be deleted because local storage is unavailable.",
        );
        return false;
      }
      setHelperNotice("Conversation deleted.");
      return true;
    },
    [commitThreadState, lesson, lessonRevision],
  );

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (
        !trimmed ||
        pendingAnswerRef.current ||
        helperMode === "checking"
      ) {
        return;
      }
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
      const current = stateRef.current;
      const activeThread = current.threads.find(
        (thread) =>
          thread.id === current.activeThreadId &&
          thread.lessonId === lesson.id &&
          thread.lessonRevision === lessonRevision,
      );
      if (!activeThread) return;
      const hasLearnerMessage = activeThread.messages.some(
        (message) => message.role === "learner",
      );
      const title = hasLearnerMessage
        ? activeThread.title
        : titleFromQuestion(trimmed);
      setHelperErrorMessage(null);
      setHelperNotice(null);

      if (helperMode === "local") {
        const answer = answerFromLesson(
          trimmed,
          lesson,
          activeBlockId,
          activeThread.messages,
          committedActivityIds,
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
        commitThreadState((latest) => ({
          ...latest,
          threads: latest.threads.map((thread) =>
            thread.id === activeThread.id
              ? {
                  ...thread,
                  title,
                  updatedAt: createdAt,
                  messages: [
                    ...thread.messages,
                    learnerMessage,
                    tutorMessage,
                  ].slice(-80),
                }
              : thread,
          ),
        }));
        return;
      }

      const requestId = [
        "lesson-answer",
        Date.now().toString(36),
        tutorMessageId,
      ].join("-");
      const pending: PendingLessonAnswer = {
        requestId,
        threadId: activeThread.id,
        cancelling: false,
      };
      pendingAnswerRef.current = pending;
      setPendingAnswer(pending);
      commitThreadState((latest) => ({
        ...latest,
        threads: latest.threads.map((thread) =>
          thread.id === activeThread.id
            ? {
                ...thread,
                title,
                updatedAt: createdAt,
                messages: [...thread.messages, learnerMessage].slice(-80),
              }
            : thread
        ),
      }));

      const appendAnswer = (
        text: string,
        claims: TutorClaim[],
        fallbackSourceChunkIds: string[] = [],
      ) => {
        const sourceChunkIds = claims.length > 0
          ? [...new Set(claims.map((claim) => claim.sourceChunkId))]
          : fallbackSourceChunkIds;
        const chunks = new Map(
          pageChunksForLesson(lesson).map((chunk) => [chunk.id, chunk]),
        );
        const sourceBlockIds = sourceChunkIds
          .map((id) => chunks.get(id)?.blockId)
          .filter((id): id is string => Boolean(id));
        const answeredAt = new Date().toISOString();
        const tutorMessage: TutorMessage = {
          id: tutorMessageId,
          role: "tutor",
          text,
          createdAt: answeredAt,
          lessonId: lesson.id,
          lessonRevision,
          sourceBlockIds,
          sourceChunkIds,
          ...(claims.length > 0 ? { claims } : {}),
        };
        commitThreadState((latest) => ({
          ...latest,
          threads: latest.threads.map((thread) =>
            thread.id === activeThread.id &&
              thread.lessonId === lesson.id &&
              thread.lessonRevision === lessonRevision
              ? {
                  ...thread,
                  updatedAt: answeredAt,
                  messages: [...thread.messages, tutorMessage].slice(-80),
                }
              : thread
          ),
        }));
      };

      void answerLessonQuestion(
        lesson,
        trimmed,
        activeThread.messages,
        requestId,
        committedActivityIds,
      )
        .then((answer) => {
          const currentPending = pendingAnswerRef.current;
          if (currentPending?.requestId !== requestId) return;
          if (currentPending.cancelling) {
            setHelperNotice("Lesson answer cancelled. Your thread is saved.");
            return;
          }
          appendAnswer(answer.text, answer.claims);
        })
        .catch((error) => {
          const currentPending = pendingAnswerRef.current;
          if (currentPending?.requestId !== requestId) return;
          const message = lessonHelperError(error);
          if (
            currentPending.cancelling ||
            message.toLocaleLowerCase().includes("cancel")
          ) {
            setHelperNotice("Lesson answer cancelled. Your thread is saved.");
            return;
          }
          setHelperErrorMessage(
            `${message} Showing the exact-page fallback instead.`,
          );
          const fallback = answerFromLesson(
            trimmed,
            lesson,
            activeBlockId,
            activeThread.messages,
            committedActivityIds,
          );
          appendAnswer(
            fallback.text,
            [],
            fallback.sources.map((source) => source.chunkId),
          );
        })
        .finally(() => {
          if (pendingAnswerRef.current?.requestId !== requestId) return;
          pendingAnswerRef.current = null;
          setPendingAnswer(null);
        });
    },
    [
      activeBlockId,
      commitThreadState,
      committedActivityIds,
      helperMode,
      lesson,
      lessonRevision,
    ],
  );

  const cancelAnswer = useCallback(() => {
    const pending = pendingAnswerRef.current;
    if (!pending || pending.cancelling) return;
    const cancelling = { ...pending, cancelling: true };
    pendingAnswerRef.current = cancelling;
    setPendingAnswer(cancelling);
    setHelperNotice(null);
    setHelperErrorMessage(null);
    void cancelLessonAnswer(pending.requestId)
      .then((accepted) => {
        if (!accepted) {
          throw new Error("The lesson answer could not be cancelled.");
        }
      })
      .catch((error) => {
        if (pendingAnswerRef.current?.requestId !== pending.requestId) {
          return;
        }
        const active = { ...pending, cancelling: false };
        pendingAnswerRef.current = active;
        setPendingAnswer(active);
        setHelperErrorMessage(lessonHelperError(error));
      });
  }, []);

  return {
    threads: lessonThreads,
    activeThread,
    persistenceStatus,
    helperMode,
    helperReadiness,
    pendingAnswer,
    helperErrorMessage,
    helperNotice,
    newThread,
    selectThread,
    deleteThread,
    send,
    cancelAnswer,
  };
}
