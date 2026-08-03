import { describe, expect, it } from "vitest";
import { lessons } from "../../src/content/course";
import type { CodeLabActivity } from "../../src/content/types";
import {
  buildBypassSource,
  buildSolvedSource,
  CODE_LAB_BYPASS_PROBES,
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

  it("keeps every semantic-bypass probe synchronized with solved source", () => {
    const activities = new Map(
      lessons
        .flatMap((lesson) => lesson.activities)
        .filter(
          (activity): activity is CodeLabActivity =>
            activity.kind === "code-lab",
        )
        .map((activity) => [activity.id, activity]),
    );

    CODE_LAB_BYPASS_PROBES.forEach((probe) => {
      const activity = activities.get(probe.activityId);
      if (!activity) throw new Error(`Missing activity ${probe.activityId}`);
      const starter = activity.spec.starterFiles[0]?.contents ?? "";
      const solved = buildSolvedSource(activity.id, starter);
      const bypass = buildBypassSource(activity.id, probe.id, solved);
      expect(bypass, probe.id).not.toBe(solved);
      probe.rejectedBy.forEach((checkId) => {
        expect(
          activity.spec.checks.some((check) => check.id === checkId),
          `${probe.id} names missing check ${checkId}`,
        ).toBe(true);
      });
    });
  });

  it("pins the Lesson 00 hard-coded plotting bypass", () => {
    expect(
      CODE_LAB_BYPASS_PROBES.find(
        (probe) => probe.id === "line-points-returns-authored-fixture",
      ),
    ).toMatchObject({
      activityId: "00-python-numpy-plot",
      rejectedBy: ["00-code-held-out-coordinates"],
    });
  });

  it("pins the Q-learning hard-coded discount bypass", () => {
    expect(
      CODE_LAB_BYPASS_PROBES.find(
        (probe) => probe.id === "q-bellman-hard-codes-discount",
      ),
    ).toMatchObject({
      activityId: "q-learning-python-lab",
      rejectedBy: ["q-bellman-continuing"],
    });
  });
});
