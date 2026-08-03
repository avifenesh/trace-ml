import { describe, expect, it } from "vitest";
import {
  createLearnerRecord,
  hasActivityAttempt,
  hasDemonstratedEvidence,
  hasResourceAttempt,
  recordActivityAttempt,
  recordResourceAttempt,
  strongestEvidenceLevel,
} from "./evidence";

describe("learner evidence", () => {
  it.each(["opened", "returned", "skipped"] as const)(
    "tracks a %s resource attempt without treating it as understanding",
    (status) => {
      const record = recordResourceAttempt(createLearnerRecord(), {
        lessonId: "model-is-a-rule",
        resourceId: "google-linear-regression",
        status,
      });

      expect(hasResourceAttempt(record, "google-linear-regression")).toBe(true);
      expect(record.events).toHaveLength(1);
      expect(record.evidence).toEqual([]);
      expect(
        strongestEvidenceLevel(record, "input-versus-parameter"),
      ).toBeNull();
      expect(
        hasDemonstratedEvidence(record, "input-versus-parameter"),
      ).toBe(false);
    },
  );

  it("derives the strongest level by concept and optional evidence kind", () => {
    let record = createLearnerRecord();
    record = recordActivityAttempt(record, {
      lessonId: "model-is-a-rule",
      lessonRevision: "test-revision",
      activityId: "unsupported-prediction",
      conceptIds: ["linear-rule"],
      evidenceKind: "prediction",
      response: "It stays the same.",
      rubricSignals: [],
      level: "unsupported",
      summary: "Did not predict the parameter effect.",
    });
    record = recordActivityAttempt(record, {
      lessonId: "model-is-a-rule",
      lessonRevision: "test-revision",
      activityId: "revised-prediction",
      conceptIds: ["linear-rule"],
      evidenceKind: "prediction",
      response: "It should increase, but I am not sure why.",
      rubricSignals: ["direction-correct"],
      level: "partial",
      summary: "Predicted the direction without a causal account.",
    });
    record = recordActivityAttempt(record, {
      lessonId: "model-is-a-rule",
      lessonRevision: "test-revision",
      activityId: "line-manipulation",
      conceptIds: ["linear-rule"],
      evidenceKind: "manipulation",
      response: "Raised pace and observed a larger duration.",
      rubricSignals: ["parameter-effect-observed"],
      level: "demonstrated",
      summary: "Manipulated pace and connected it to the output.",
    });
    record = recordActivityAttempt(record, {
      lessonId: "model-is-a-rule",
      lessonRevision: "test-revision",
      activityId: "later-partial-manipulation",
      conceptIds: ["linear-rule"],
      evidenceKind: "manipulation",
      response: "Changed the line.",
      rubricSignals: [],
      level: "partial",
      summary: "Later response only partially described the manipulation.",
    });

    expect(strongestEvidenceLevel(record, "linear-rule")).toBe("demonstrated");
    expect(strongestEvidenceLevel(record, "linear-rule", "prediction")).toBe(
      "partial",
    );
    expect(strongestEvidenceLevel(record, "linear-rule", "manipulation")).toBe(
      "demonstrated",
    );
    expect(strongestEvidenceLevel(record, "linear-rule", "explanation")).toBeNull();
    expect(
      strongestEvidenceLevel(record, "input-versus-parameter"),
    ).toBeNull();
    expect(hasDemonstratedEvidence(record, "linear-rule")).toBe(true);
    expect(
      hasDemonstratedEvidence(record, "linear-rule", "prediction"),
    ).toBe(false);
  });

  it("does not let matching evidence from another lesson, revision, or activity satisfy a scope", () => {
    const record = recordActivityAttempt(createLearnerRecord(), {
      lessonId: "later-lesson",
      lessonRevision: "revision-1",
      activityId: "later-transfer",
      conceptIds: ["generalization"],
      evidenceKind: "transfer",
      response: "A response from another lesson.",
      rubricSignals: ["supported"],
      level: "demonstrated",
      summary: "Demonstrated in the later lesson.",
    });

    expect(
      hasDemonstratedEvidence(record, "generalization", "transfer", {
        lessonId: "earlier-lesson",
        lessonRevision: "revision-1",
      }),
    ).toBe(false);
    expect(
      hasDemonstratedEvidence(record, "generalization", "transfer", {
        lessonId: "later-lesson",
        lessonRevision: "revision-1",
        activityId: "different-transfer",
      }),
    ).toBe(false);
    expect(
      hasDemonstratedEvidence(record, "generalization", "transfer", {
        lessonId: "later-lesson",
        lessonRevision: "revision-2",
        activityId: "later-transfer",
      }),
    ).toBe(false);
    expect(
      hasDemonstratedEvidence(record, "generalization", "transfer", {
        lessonId: "later-lesson",
        lessonRevision: "revision-1",
        activityId: "later-transfer",
      }),
    ).toBe(true);
  });

  it("does not treat evidence without its source attempt as demonstrated", () => {
    const complete = recordActivityAttempt(createLearnerRecord(), {
      lessonId: "linear-model",
      lessonRevision: "revision-1",
      activityId: "linear-explanation",
      conceptIds: ["linear-parameters"],
      evidenceKind: "explanation",
      response: "Weight changes slope and bias changes intercept.",
      rubricSignals: ["weight", "bias"],
      level: "demonstrated",
      summary: "Matched both authored criteria.",
    });
    const orphaned = { ...complete, events: [] };

    expect(
      hasDemonstratedEvidence(
        orphaned,
        "linear-parameters",
        "explanation",
      ),
    ).toBe(false);
  });

  it("treats any committed prediction as an attempt regardless of correctness", () => {
    const record = recordActivityAttempt(createLearnerRecord(), {
      lessonId: "linear-model",
      lessonRevision: "revision-1",
      activityId: "linear-prediction",
      conceptIds: ["linear-parameters"],
      evidenceKind: "prediction",
      response: "wrong-option",
      rubricSignals: [],
      level: "unsupported",
      summary: "The prediction was committed before the reveal.",
    });

    expect(
      hasActivityAttempt(
        record,
        "linear-model",
        "revision-1",
        "linear-prediction",
      ),
    ).toBe(true);
    expect(
      hasDemonstratedEvidence(record, "linear-parameters", "prediction"),
    ).toBe(false);
  });

  it("drops evidence with attempts removed by record retention", () => {
    let record = createLearnerRecord();
    for (let index = 0; index < 501; index += 1) {
      record = recordActivityAttempt(
        record,
        {
          lessonId: "linear-model",
          lessonRevision: "revision-1",
          activityId: `attempt-${index}`,
          conceptIds: ["linear-parameters"],
          evidenceKind: "explanation",
          response: `response ${index}`,
          rubricSignals: [],
          level: "demonstrated",
          summary: `summary ${index}`,
        },
        new Date(index * 1_000).toISOString(),
      );
    }

    const retainedAttemptIds = new Set(record.events.map((event) => event.id));
    expect(record.events).toHaveLength(500);
    expect(record.evidence).toHaveLength(500);
    expect(
      record.evidence.every((item) =>
        retainedAttemptIds.has(item.sourceAttemptId)
      ),
    ).toBe(true);
  });
});
