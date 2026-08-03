import { describe, expect, it } from "vitest";
import {
  getLesson,
  lessons,
} from "../content/course";
import type { Lesson } from "../content/types";
import {
  createLearnerRecord,
  recordActivityAttempt,
} from "./evidence";
import {
  activityEvidenceConceptIds,
  lessonState,
  objectiveCheckpointActivities,
  objectiveCheckpointComplete,
  type ObjectiveCheckpointActivity,
} from "./progression";
import type {
  EvidenceLevel,
  LearnerRecord,
} from "./types";

function authoredLesson(lessonId: string): Lesson {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error(`Missing authored lesson: ${lessonId}`);
  return lesson;
}

function addCheckpointEvidence(
  record: LearnerRecord,
  lesson: Lesson,
  activity: ObjectiveCheckpointActivity,
  level: EvidenceLevel = "demonstrated",
): LearnerRecord {
  return recordActivityAttempt(record, {
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    activityId: activity.id,
    conceptIds: activityEvidenceConceptIds(activity),
    evidenceKind: activity.evidenceKind,
    response: `${level} response`,
    rubricSignals: [],
    level,
    summary: `${level} evidence for ${activity.id}`,
  });
}

describe("lesson progression", () => {
  it("requires every objective checkpoint at the demonstrated level", () => {
    const lesson = authoredLesson("prerequisite-trace");
    const checkpoints = objectiveCheckpointActivities(lesson);
    let record = createLearnerRecord();

    expect(lessonState(lesson, lesson.id, record)).toBe("current");

    checkpoints.slice(0, -1).forEach((activity) => {
      record = addCheckpointEvidence(record, lesson, activity);
    });
    const finalCheckpoint = checkpoints.at(-1);
    if (!finalCheckpoint) throw new Error("Expected an objective checkpoint.");
    record = addCheckpointEvidence(
      record,
      lesson,
      finalCheckpoint,
      "partial",
    );
    expect(lessonState(lesson, "another-lesson", record)).toBe("available");

    record = addCheckpointEvidence(
      record,
      lesson,
      finalCheckpoint,
    );
    expect(lessonState(lesson, "another-lesson", record)).toBe("evidenced");
  });

  it("does not satisfy objective checkpoints with matching evidence from another lesson", () => {
    const lesson = authoredLesson("split-and-leakage");
    let record = createLearnerRecord();
    objectiveCheckpointActivities(lesson).forEach((activity) => {
      record = recordActivityAttempt(record, {
        lessonId: "capacity-curves",
        lessonRevision: lesson.revision ?? "unversioned",
        activityId: activity.id,
        conceptIds: activityEvidenceConceptIds(activity),
        evidenceKind: activity.evidenceKind,
        response: "Evidence from a different lesson.",
        rubricSignals: [],
        level: "demonstrated",
        summary: "This must not satisfy an earlier lesson.",
      });
    });

    expect(lessonState(lesson, "another-lesson", record)).toBe("available");
  });

  it("requires only the concepts an activity explicitly evidences", () => {
    const lesson = authoredLesson("knn-versus-tree");
    const prediction = objectiveCheckpointActivities(lesson).find(
      (activity) => activity.kind === "prediction",
    );
    if (!prediction) throw new Error("Expected an authored prediction.");
    const narrowed = {
      ...prediction,
      evidenceConceptIds: [prediction.conceptIds[0]!],
    };
    let record = createLearnerRecord();
    record = addCheckpointEvidence(record, lesson, narrowed);

    expect(objectiveCheckpointComplete(lesson, narrowed, record)).toBe(true);
    expect(objectiveCheckpointComplete(lesson, prediction, record)).toBe(false);
  });

  it("does not let free-form prose certify objective completion", () => {
    const lesson = authoredLesson("decision-costs");
    let record = createLearnerRecord();
    lesson.activities
      .filter((activity) => activity.kind === "text-response")
      .forEach((activity) => {
        record = recordActivityAttempt(record, {
          lessonId: lesson.id,
          lessonRevision: lesson.revision ?? "unversioned",
          activityId: activity.id,
          conceptIds: activity.conceptIds,
          evidenceKind: activity.evidenceKind,
          response: "A free-form response.",
          rubricSignals: activity.rubric.criteria.map(
            (criterion) => criterion.id,
          ),
          level: "demonstrated",
          summary: "Legacy prose evidence must not complete a lesson.",
        });
      });

    expect(lessonState(lesson, "another-lesson", record)).toBe("available");
  });

  it("keeps every published authored lesson open for inspection", () => {
    const record = createLearnerRecord();
    const lateLesson = authoredLesson("attention-routing");

    expect(
      lessonState(lateLesson, "prerequisite-trace", record),
    ).toBe("available");
    expect(lessons.every((lesson) => lesson.published)).toBe(true);
  });

  it("keeps an unpublished editorial draft locked", () => {
    const lesson = authoredLesson("linear-model");
    expect(
      lessonState(
        { ...lesson, published: false },
        lesson.id,
        createLearnerRecord(),
      ),
    ).toBe("locked");
  });

  it("does not silently fall back when a lesson id is invalid", () => {
    expect(getLesson("not-a-real-lesson")).toBeUndefined();
  });
});
