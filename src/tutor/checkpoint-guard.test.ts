import { describe, expect, it } from "vitest";
import { lessons, requireLesson } from "../content/course";
import {
  unfinishedPredictionTargeted,
} from "./checkpoint-guard";

describe("unfinished prediction protection", () => {
  it("protects every authored prediction prompt before commitment", () => {
    for (const lesson of lessons) {
      const prediction = lesson.activities.find(
        (activity) => activity.kind === "prediction",
      );
      if (!prediction) throw new Error(`Missing prediction for ${lesson.id}`);

      expect(
        unfinishedPredictionTargeted(
          prediction.checkpoint.prompt,
          lesson,
          new Set(),
        ),
        lesson.id,
      ).toMatchObject({ activityId: prediction.id });
    }
  });

  it("allows a prediction question after that activity is committed", () => {
    for (const lesson of lessons) {
      const prediction = lesson.activities.find(
        (activity) => activity.kind === "prediction",
      );
      if (!prediction) throw new Error(`Missing prediction for ${lesson.id}`);

      expect(
        unfinishedPredictionTargeted(
          prediction.checkpoint.prompt,
          lesson,
          new Set([prediction.id]),
        ),
        lesson.id,
      ).toBeNull();
    }
  });

  it("protects a high-overlap paraphrase but permits concept questions", () => {
    const lesson = requireLesson("gradient-descent");

    expect(
      unfinishedPredictionTargeted(
        "With w at 2, gradient +4, and learning rate .25, what updated weight do I get?",
        lesson,
        new Set(),
      ),
    ).toMatchObject({ activityId: "04-direction-prediction" });
    expect(
      unfinishedPredictionTargeted(
        "Why does gradient descent move opposite the gradient?",
        lesson,
        new Set(),
      ),
    ).toBeNull();
  });
});
