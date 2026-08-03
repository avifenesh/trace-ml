import { describe, expect, it } from "vitest";
import { lessons } from "../../src/content/course";
import type { CodeLabActivity } from "../../src/content/types";
import {
  buildSolvedSource,
  CODE_LAB_SOLUTION_REPAIRS,
} from "./code-lab-solutions";

describe("authored code-lab solution fixtures", () => {
  it("keeps every bounded repair synchronized with its starter", () => {
    const activities = lessons
      .flatMap((lesson) => lesson.activities)
      .filter(
        (activity): activity is CodeLabActivity =>
          activity.kind === "code-lab",
      );

    expect(Object.keys(CODE_LAB_SOLUTION_REPAIRS)).toEqual(
      activities.map((activity) => activity.id),
    );
    activities.forEach((activity) => {
      const starter = activity.spec.starterFiles[0]?.contents ?? "";
      expect(buildSolvedSource(activity.id, starter)).not.toBe(starter);
    });
  });
});
