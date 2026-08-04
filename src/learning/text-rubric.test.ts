import { describe, expect, it } from "vitest";
import type {
  TextResponseActivity,
  TextRubricCriterion,
} from "../content/types";
import { lessons } from "../content/course";
import { assessTextResponse } from "./text-rubric";

const cancellationCriterion: TextRubricCriterion = {
  id: "squares-prevent-cancellation",
  label: "explain why squared residuals cannot cancel",
  keywordGroups: [["square"], ["prevent"], ["cancel"]],
};

const testBoundaryCriterion: TextRubricCriterion = {
  id: "test-boundary",
  label: "reserve test data from tuning",
  keywordGroups: [["test"], ["not used"], ["tuning"]],
};

function activityWith(
  ...criteria: TextRubricCriterion[]
): TextResponseActivity {
  return {
    id: "text-rubric-test",
    kind: "text-response",
    conceptIds: ["loss"],
    evidenceKind: "explanation",
    prompt: "Explain the mechanism.",
    guidance: "Connect the relevant terms.",
    rubric: {
      criteria,
      demonstratedFeedback: "Demonstrated.",
      unsupportedFeedback: "Unsupported.",
    },
  };
}

describe("deterministic text-response assessment", () => {
  it("accepts a coherent response for the prerequisite trace rubric", () => {
    const activity = lessons
      .flatMap((lesson) => lesson.activities)
      .find(
        (candidate): candidate is TextResponseActivity =>
          candidate.kind === "text-response" &&
          candidate.id === "00-mechanism-explanation",
      );
    if (!activity) throw new Error("Missing prerequisite explanation.");

    const assessment = assessTextResponse(
      activity,
      "Four examples remain because the feature axis combines three inputs with three weights. The outer derivative factor 6 multiplies the inner derivative factor 2, producing 12. The baseline equals 80 percent because the negative majority contains 80 out of 100 cases.",
    );

    expect(assessment.level).toBe("partial");
    expect(assessment.matchedCriteria).toHaveLength(3);
  });

  it("reports complete structural coverage without claiming semantic understanding", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion, testBoundaryCriterion),
      "Squared residuals prevent positive and negative errors from canceling. Test data is not used for tuning.",
    );

    expect(assessment.level).toBe("partial");
    expect(assessment.matchedCriteria).toEqual([
      cancellationCriterion.id,
      testBoundaryCriterion.id,
    ]);
    expect(assessment.missingCriteria).toEqual([]);
  });

  it("recognizes one relationship expressed across adjacent natural clauses", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion),
      "Squaring makes residuals nonnegative. This prevents residuals with opposite signs from canceling when they are averaged.",
    );

    expect(assessment.matchedCriteria).toEqual([
      cancellationCriterion.id,
    ]);
    expect(assessment.missingCriteria).toEqual([]);
  });

  it("keeps an otherwise valid answer partial when one criterion is absent", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion, testBoundaryCriterion),
      "Squared residuals prevent positive and negative errors from canceling.",
    );

    expect(assessment.level).toBe("partial");
    expect(assessment.matchedCriteria).toEqual([cancellationCriterion.id]);
    expect(assessment.missingCriteria).toEqual([testBoundaryCriterion.id]);
  });

  it("rejects keyword-stuffed fragments without a coherent assertion", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion, testBoundaryCriterion),
      "Squared, prevent, canceling; test, not used, tuning.",
    );

    expect(assessment.level).toBe("unsupported");
    expect(assessment.matchedCriteria).toEqual([]);
  });

  it("rejects connector stuffing across every authored text rubric", () => {
    const failures = lessons.flatMap((lesson) =>
      lesson.activities
        .filter(
          (activity): activity is TextResponseActivity =>
            activity.kind === "text-response",
        )
        .flatMap((activity) => {
          const response = activity.rubric.criteria
            .map((criterion) =>
              criterion.keywordGroups
                .map((group) => group[0] ?? "")
                .join(" because "),
            )
            .join(". ");
          const assessment = assessTextResponse(activity, response);
          return assessment.matchedCriteria.length > 0
            ? [{
                activityId: activity.id,
                matchedCriteria: assessment.matchedCriteria,
                response,
              }]
            : [];
        }),
    );

    expect(failures).toEqual([]);
  });

  it("rejects junk-object relation stuffing across every authored rubric", () => {
    const failures = lessons.flatMap((lesson) =>
      lesson.activities
        .filter(
          (activity): activity is TextResponseActivity =>
            activity.kind === "text-response",
        )
        .flatMap((activity) => {
          const response = activity.rubric.criteria
            .map((criterion) =>
              `${criterion.keywordGroups
                .map((group) => group[0] ?? "")
                .join(" ")} causes banana`,
            )
            .join(". ");
          const assessment = assessTextResponse(activity, response);
          return assessment.matchedCriteria.length > 0
            ? [{
                activityId: activity.id,
                matchedCriteria: assessment.matchedCriteria,
                response,
              }]
            : [];
        }),
    );

    expect(failures).toEqual([]);
  });

  it("rejects directly negated evidence", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion),
      "Squares do not prevent cancellation.",
    );

    expect(assessment.level).toBe("unsupported");
    expect(assessment.matchedCriteria).toEqual([]);
  });

  it("accepts a valid negative boundary instead of banning negation globally", () => {
    const assessment = assessTextResponse(
      activityWith(testBoundaryCriterion),
      "Test data is not used for tuning.",
    );

    expect(assessment.level).toBe("partial");
    expect(assessment.matchedCriteria).toEqual([testBoundaryCriterion.id]);
  });

  it("rejects explicit contradictory clauses around the same evidence", () => {
    const shrinkCriterion: TextRubricCriterion = {
      id: "coefficient-shrinkage",
      label: "state that the coefficient shrinks",
      keywordGroups: [["shrink"]],
    };
    const assessment = assessTextResponse(
      activityWith(shrinkCriterion),
      "It shrinks, but it does not shrink.",
    );

    expect(assessment.level).toBe("unsupported");
    expect(assessment.matchedCriteria).toEqual([]);
  });

  it.each([
    "Squared residuals prevent errors from canceling. Everything above is false.",
    "Squared residuals prevent errors from canceling. None of that is true.",
    "Squared residuals prevent errors from canceling. Retract everything I said.",
  ])("rejects a global retraction: %s", (response) => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion),
      response,
    );

    expect(assessment.level).toBe("unsupported");
    expect(assessment.matchedCriteria).toEqual([]);
    expect(assessment.feedback).toContain("retracts its own claims");
  });

  it("labels a complete match as a structure check rather than inferred understanding", () => {
    const assessment = assessTextResponse(
      activityWith(cancellationCriterion),
      "Squared residuals prevent errors from canceling.",
    );

    expect(assessment.feedback).toContain("cannot verify causal meaning");
  });

  it("never promotes a role-reversed calibration sentence to demonstrated evidence", () => {
    const activity = lessons
      .flatMap((lesson) => lesson.activities)
      .find(
        (candidate): candidate is TextResponseActivity =>
          candidate.kind === "text-response" &&
          candidate.id === "decision-metrics-explanation",
      );
    if (!activity) throw new Error("Missing decision explanation.");

    const assessment = assessTextResponse(
      activity,
      "Calibration causes model predicted probability to change observed frequency.",
    );

    expect(assessment.level).not.toBe("demonstrated");
  });
});
