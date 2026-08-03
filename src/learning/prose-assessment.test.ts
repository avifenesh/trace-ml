import { describe, expect, it } from "vitest";
import { lessons } from "../content/course";
import type { TextResponseActivity } from "../content/types";
import { proseAssessmentInternals } from "./prose-assessment";

function fixture() {
  const lesson = lessons[0];
  const activity = lesson?.activities.find(
    (candidate): candidate is TextResponseActivity =>
      candidate.kind === "text-response",
  );
  if (!lesson || !activity) throw new Error("Missing prose assessment fixture.");
  return { activity, lesson };
}

describe("semantic prose assessment boundary", () => {
  it("sends only authored identifiers and the learner draft", () => {
    const { activity, lesson } = fixture();
    const request = proseAssessmentInternals.requestFor(
      lesson,
      activity,
      "A novice explanation.",
      "request-1",
    );

    expect(request).toEqual({
      requestId: "request-1",
      lessonId: lesson.id,
      lessonRevision: lesson.revision,
      activityId: activity.id,
      learnerResponse: "A novice explanation.",
    });
    expect(request).not.toHaveProperty("lessonContext");
    expect(request).not.toHaveProperty("criteria");
  });

  it("accepts only a complete, consistent partition of authored criteria", () => {
    const { activity } = fixture();
    const ids = activity.rubric.criteria.map((criterion) => criterion.id);
    const assessment = proseAssessmentInternals.normalizeSemanticAssessment(
      activity,
      {
        level: "demonstrated",
        matchedCriteria: ids,
        missingCriteria: [],
        uncertainCriteria: [],
        feedback: "The response connects every authored mechanism.",
      },
    );

    expect(assessment).toEqual({
      assessmentMode: "semantic",
      level: "demonstrated",
      matchedCriteria: ids,
      missingCriteria: [],
      uncertainCriteria: [],
      feedback: "The response connects every authored mechanism.",
    });
  });

  it("rejects unknown criterion ids and inconsistent levels", () => {
    const { activity } = fixture();
    const ids = activity.rubric.criteria.map((criterion) => criterion.id);

    expect(() =>
      proseAssessmentInternals.normalizeSemanticAssessment(activity, {
        level: "demonstrated",
        matchedCriteria: [...ids, "invented-criterion"],
        missingCriteria: [],
        uncertainCriteria: [],
        feedback: "Everything is fine.",
      })
    ).toThrow("invalid rubric result");

    expect(() =>
      proseAssessmentInternals.normalizeSemanticAssessment(activity, {
        level: "unsupported",
        matchedCriteria: ids,
        missingCriteria: [],
        uncertainCriteria: [],
        feedback: "Everything is fine.",
      })
    ).toThrow("inconsistent result");
  });

  it("preserves genuine ambiguity as a clarification state", () => {
    const { activity } = fixture();
    const ids = activity.rubric.criteria.map((criterion) => criterion.id);
    const firstId = ids[0];
    if (!firstId) throw new Error("Missing first rubric criterion.");
    const assessment = proseAssessmentInternals.normalizeSemanticAssessment(
      activity,
      {
        level: "partial",
        matchedCriteria: [firstId],
        missingCriteria: [],
        uncertainCriteria: ids.slice(1),
        feedback:
          "The first relationship is clear. Can you make the remaining links explicit?",
      },
    );

    expect(assessment.level).toBe("partial");
    expect(assessment.missingCriteria).toEqual([]);
    expect(assessment.uncertainCriteria).toEqual(ids.slice(1));
  });

  it("rejects stale or corrupted persisted rubric partitions", () => {
    const { activity } = fixture();
    const ids = activity.rubric.criteria.map((criterion) => criterion.id);

    expect(() =>
      proseAssessmentInternals.normalizeExplanationAssessment(activity, {
        assessmentMode: "semantic",
        level: "demonstrated",
        matchedCriteria: ids.slice(0, -1),
        missingCriteria: [],
        uncertainCriteria: [],
        feedback: "A stale result.",
      })
    ).toThrow("invalid rubric result");

    expect(() =>
      proseAssessmentInternals.normalizeExplanationAssessment(activity, {
        assessmentMode: "structure",
        level: "demonstrated",
        matchedCriteria: ids,
        missingCriteria: [],
        uncertainCriteria: [],
        feedback: "A local check cannot demonstrate meaning.",
      })
    ).toThrow("inconsistent result");
  });
});
