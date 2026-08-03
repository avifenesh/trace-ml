import { useCallback, useRef, useState } from "react";
import { readLocalStorage, writeLocalStorage } from "../storage";
import type { ExplanationAssessment } from "./types";

const STORAGE_PREFIX = "trace-ml:activity-state:v1";

export interface ActivityStateScope {
  lessonId: string;
  lessonRevision: string;
  activityId: string;
}

export type ActivityState =
  | {
      kind: "prediction";
      selectedOptionId?: string;
      committedOptionId?: string;
    }
  | {
      kind: "text-response";
      response: string;
      submittedResponse?: string;
      assessment?: ExplanationAssessment;
    }
  | {
      kind: "visual-lab";
      value: number;
      baselineValue?: number;
      comparisonValue?: number;
    }
  | {
      kind: "code-lab";
      source: string;
    };

interface StoredActivityState extends ActivityStateScope {
  version: 1;
  updatedAt: string;
  state: ActivityState;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown, limit: number) {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, limit)
    : undefined;
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function optionalExplanationAssessment(
  value: unknown,
): ExplanationAssessment | undefined {
  const assessment = objectRecord(value);
  const level = assessment?.level;
  const assessmentMode = assessment?.assessmentMode;
  const matchedCriteria = assessment?.matchedCriteria;
  const missingCriteria = assessment?.missingCriteria;
  const uncertainCriteria = assessment?.uncertainCriteria;
  const feedback = assessment?.feedback;
  if (
    !assessment ||
    (assessmentMode !== "semantic" && assessmentMode !== "structure") ||
    (level !== "unsupported" && level !== "partial" && level !== "demonstrated") ||
    !Array.isArray(matchedCriteria) ||
    !matchedCriteria.every((item) => typeof item === "string") ||
    !Array.isArray(missingCriteria) ||
    !missingCriteria.every((item) => typeof item === "string") ||
    !Array.isArray(uncertainCriteria) ||
    !uncertainCriteria.every((item) => typeof item === "string") ||
    typeof feedback !== "string" ||
    !feedback.trim()
  ) {
    return undefined;
  }

  return {
    assessmentMode,
    level,
    matchedCriteria: [...new Set(matchedCriteria)].slice(0, 12),
    missingCriteria: [...new Set(missingCriteria)].slice(0, 12),
    uncertainCriteria: [...new Set(uncertainCriteria)].slice(0, 12),
    feedback: feedback.slice(0, 2_000),
  };
}

export function normalizeStoredActivityState(
  value: unknown,
): StoredActivityState | null {
  const stored = objectRecord(value);
  const rawState = objectRecord(stored?.state);
  if (
    !stored ||
    stored.version !== 1 ||
    typeof stored.lessonId !== "string" ||
    typeof stored.lessonRevision !== "string" ||
    typeof stored.activityId !== "string" ||
    typeof stored.updatedAt !== "string" ||
    !rawState ||
    typeof rawState.kind !== "string"
  ) {
    return null;
  }

  let state: ActivityState | null = null;
  if (rawState.kind === "prediction") {
    state = {
      kind: "prediction",
      selectedOptionId: optionalString(rawState.selectedOptionId, 200),
      committedOptionId: optionalString(rawState.committedOptionId, 200),
    };
  } else if (
    rawState.kind === "text-response" &&
    typeof rawState.response === "string"
  ) {
    state = {
      kind: "text-response",
      response: rawState.response.slice(0, 20_000),
      submittedResponse: optionalString(rawState.submittedResponse, 20_000),
      assessment: optionalExplanationAssessment(rawState.assessment),
    };
  } else if (rawState.kind === "visual-lab") {
    const value = optionalFiniteNumber(rawState.value);
    if (value !== undefined) {
      state = {
        kind: "visual-lab",
        value,
        baselineValue: optionalFiniteNumber(rawState.baselineValue),
        comparisonValue: optionalFiniteNumber(rawState.comparisonValue),
      };
    }
  } else if (
    rawState.kind === "code-lab" &&
    typeof rawState.source === "string"
  ) {
    state = {
      kind: "code-lab",
      source: rawState.source.slice(0, 100_000),
    };
  }
  if (!state) return null;

  return {
    version: 1,
    lessonId: stored.lessonId,
    lessonRevision: stored.lessonRevision,
    activityId: stored.activityId,
    updatedAt: stored.updatedAt,
    state,
  };
}

function stateKey(scope: ActivityStateScope) {
  return [
    STORAGE_PREFIX,
    scope.lessonId,
    scope.lessonRevision,
    scope.activityId,
  ].map(encodeURIComponent).join(":");
}

export function useActivityStateStore() {
  const memory = useRef(new Map<string, ActivityState>());
  const [persistenceStatus, setPersistenceStatus] = useState<
    "persistent" | "memory-only"
  >("persistent");

  const getActivityState = useCallback((scope: ActivityStateScope) => {
    const key = stateKey(scope);
    const cached = memory.current.get(key);
    if (cached) return cached;

    const serialized = readLocalStorage(key);
    if (!serialized) return null;
    try {
      const stored = normalizeStoredActivityState(JSON.parse(serialized));
      if (
        stored &&
        stored.lessonId === scope.lessonId &&
        stored.lessonRevision === scope.lessonRevision &&
        stored.activityId === scope.activityId
      ) {
        memory.current.set(key, stored.state);
        return stored.state;
      }
    } catch {
      // A malformed activity snapshot must not block the authored lesson.
    }
    return null;
  }, []);

  const saveActivityState = useCallback(
    (scope: ActivityStateScope, state: ActivityState) => {
      const key = stateKey(scope);
      const stored = normalizeStoredActivityState({
        version: 1,
        ...scope,
        updatedAt: new Date().toISOString(),
        state,
      });
      if (!stored) {
        setPersistenceStatus("memory-only");
        return;
      }

      memory.current.set(key, stored.state);
      setPersistenceStatus(
        writeLocalStorage(key, JSON.stringify(stored))
          ? "persistent"
          : "memory-only",
      );
    },
    [],
  );

  return {
    persistenceStatus,
    getActivityState,
    saveActivityState,
  };
}
