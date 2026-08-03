import type {
  ActivityAttempt,
  ConceptEvidence,
  ConceptId,
  EvidenceKind,
  EvidenceLevel,
  LearnerRecord,
  ResourceAttempt,
} from "./types";

const levelRank: Record<EvidenceLevel, number> = {
  unsupported: 0,
  partial: 1,
  demonstrated: 2,
};
const MAX_EVENTS = 500;
const MAX_EVIDENCE = 1_000;

function identifier(prefix: string) {
  const value = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36);
  return `${prefix}-${value}`;
}

export function createLearnerRecord(): LearnerRecord {
  return {
    version: 1,
    events: [],
    evidence: [],
  };
}

function observedOrder(
  left: { id: string; observedAt: string },
  right: { id: string; observedAt: string },
) {
  return left.observedAt.localeCompare(right.observedAt) ||
    left.id.localeCompare(right.id);
}

export function compactLearnerRecord(record: LearnerRecord): LearnerRecord {
  const events = [...new Map(record.events.map((event) => [event.id, event]))
    .values()]
    .sort(observedOrder)
    .slice(-MAX_EVENTS);
  const retainedAttemptIds = new Set(
    events
      .filter((event): event is ActivityAttempt => event.type === "activity")
      .map((event) => event.id),
  );
  const evidence = [
    ...new Map(record.evidence.map((item) => [item.id, item])).values(),
  ]
    .filter((item) => retainedAttemptIds.has(item.sourceAttemptId))
    .sort(observedOrder)
    .slice(-MAX_EVIDENCE);

  return { version: 1, events, evidence };
}

export function mergeLearnerRecords(
  ...records: LearnerRecord[]
): LearnerRecord {
  return compactLearnerRecord({
    version: 1,
    events: records.flatMap((record) => record.events),
    evidence: records.flatMap((record) => record.evidence),
  });
}

export function recordResourceAttempt(
  record: LearnerRecord,
  input: Omit<ResourceAttempt, "id" | "type" | "observedAt">,
  observedAt = new Date().toISOString(),
): LearnerRecord {
  const attempt: ResourceAttempt = {
    ...input,
    id: identifier("resource-attempt"),
    type: "resource",
    observedAt,
  };
  return compactLearnerRecord({
    ...record,
    events: [...record.events, attempt],
  });
}

export interface RecordActivityInput {
  lessonId: string;
  lessonRevision: string;
  activityId: string;
  conceptIds: ConceptId[];
  evidenceKind: EvidenceKind;
  response: string;
  rubricSignals: string[];
  level: EvidenceLevel;
  summary: string;
}

export function recordActivityAttempt(
  record: LearnerRecord,
  input: RecordActivityInput,
  observedAt = new Date().toISOString(),
): LearnerRecord {
  const attemptId = identifier("activity-attempt");
  const attempt: ActivityAttempt = {
    id: attemptId,
    type: "activity",
    lessonId: input.lessonId,
    lessonRevision: input.lessonRevision,
    activityId: input.activityId,
    evidenceKind: input.evidenceKind,
    response: input.response.slice(0, 2_000),
    rubricSignals: input.rubricSignals.slice(0, 12),
    level: input.level,
    observedAt,
  };
  const evidence = input.conceptIds.map<ConceptEvidence>((conceptId) => ({
    id: identifier("evidence"),
    conceptId,
    sourceAttemptId: attemptId,
    lessonId: input.lessonId,
    lessonRevision: input.lessonRevision,
    activityId: input.activityId,
    kind: input.evidenceKind,
    level: input.level,
    summary: input.summary.slice(0, 600),
    observedAt,
  }));
  return compactLearnerRecord({
    ...record,
    events: [...record.events, attempt],
    evidence: [...record.evidence, ...evidence],
  });
}

export interface EvidenceScope {
  lessonId: string;
  lessonRevision: string;
  activityId?: string;
}

function isInScope(item: ConceptEvidence, scope?: EvidenceScope) {
  if (!scope) return true;
  return (
    item.lessonId === scope.lessonId &&
    item.lessonRevision === scope.lessonRevision &&
    (scope.activityId === undefined || item.activityId === scope.activityId)
  );
}

export function strongestEvidenceLevel(
  record: LearnerRecord,
  conceptId: ConceptId,
  kind?: EvidenceKind,
  scope?: EvidenceScope,
): EvidenceLevel | null {
  const retainedAttemptIds = new Set(
    record.events
      .filter((event): event is ActivityAttempt => event.type === "activity")
      .map((event) => event.id),
  );
  const levels = record.evidence
    .filter(
      (item) =>
        retainedAttemptIds.has(item.sourceAttemptId) &&
        item.conceptId === conceptId &&
        (kind === undefined || item.kind === kind) &&
        isInScope(item, scope),
    )
    .map((item) => item.level);
  if (levels.length === 0) return null;
  return levels.reduce((strongest, level) =>
    levelRank[level] > levelRank[strongest] ? level : strongest,
  );
}

export function hasDemonstratedEvidence(
  record: LearnerRecord,
  conceptId: ConceptId,
  kind?: EvidenceKind,
  scope?: EvidenceScope,
) {
  return strongestEvidenceLevel(record, conceptId, kind, scope) === "demonstrated";
}

export function hasResourceAttempt(
  record: LearnerRecord,
  resourceId: string,
  lessonId?: string,
) {
  return record.events.some(
    (event) =>
      event.type === "resource" &&
      event.resourceId === resourceId &&
      (lessonId === undefined || event.lessonId === lessonId),
  );
}

export function hasActivityAttempt(
  record: LearnerRecord,
  lessonId: string,
  lessonRevision: string,
  activityId: string,
) {
  return record.events.some(
    (event) =>
      event.type === "activity" &&
      event.lessonId === lessonId &&
      event.lessonRevision === lessonRevision &&
      event.activityId === activityId,
  );
}
