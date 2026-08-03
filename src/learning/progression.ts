import type {
  Lesson,
  LessonActivity,
} from "../content/types";
import { hasDemonstratedEvidence } from "./evidence";
import type { LearnerRecord } from "./types";

export type DerivedLessonState =
  | "current"
  | "available"
  | "locked"
  | "evidenced";

export type ObjectiveCheckpointActivity = Extract<
  LessonActivity,
  { kind: "prediction" | "visual-lab" | "code-lab" }
>;

export function activityEvidenceConceptIds(activity: LessonActivity) {
  return activity.evidenceConceptIds ?? activity.conceptIds;
}

export function objectiveCheckpointActivities(
  lesson: Lesson,
): ObjectiveCheckpointActivity[] {
  return lesson.activities.filter(
    (activity): activity is ObjectiveCheckpointActivity =>
      activity.kind === "prediction" ||
      activity.kind === "visual-lab" ||
      activity.kind === "code-lab",
  );
}

export function objectiveCheckpointComplete(
  lesson: Lesson,
  activity: ObjectiveCheckpointActivity,
  record: LearnerRecord,
) {
  const scope = {
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    activityId: activity.id,
  };
  return activityEvidenceConceptIds(activity).every((conceptId) =>
    hasDemonstratedEvidence(
      record,
      conceptId,
      activity.evidenceKind,
      scope,
    )
  );
}

export function lessonState(
  lesson: Lesson,
  activeLessonId: string,
  record: LearnerRecord,
): DerivedLessonState {
  if (!lesson.published) return "locked";
  if (lesson.id === activeLessonId) return "current";
  const checkpoints = objectiveCheckpointActivities(lesson);
  const exitSatisfied =
    checkpoints.length > 0 &&
    checkpoints.every((activity) =>
      objectiveCheckpointComplete(lesson, activity, record)
    );
  if (exitSatisfied) return "evidenced";
  return "available";
}
