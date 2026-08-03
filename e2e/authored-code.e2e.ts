import { expect, test, type Page } from "@playwright/test";
import type { CodeLabActivity } from "../src/content/types";
import {
  buildBypassSource,
  buildSolvedSource,
  CODE_LAB_BYPASS_PROBES,
  CODE_LAB_SOLUTION_REPAIRS,
} from "./fixtures/code-lab-solutions";

test.describe.configure({ mode: "serial" });

const EXPECTED_LAB_COUNT = 19;
const EXPECTED_CHECK_COUNT = 92;

async function runStarterAndSolution(
  page: Page,
  activity: CodeLabActivity,
  solvedSource: string,
  bypassSources: { id: string; source: string }[],
) {
  return page.evaluate(
    async ({ authoredActivity, solution, bypasses }) => {
      // @ts-expect-error Browser-only Vite module URL.
      const { PyodideRunner } = await import(
        "/src/runtime/PyodideRunner.ts"
      );
      const spec = authoredActivity.spec;
      const runner = new PyodideRunner({
        allowedPackages: spec.allowedPackages,
      });
      const run = (code: string) =>
        runner.runClean({
          code,
          checks: spec.checks,
          filename: spec.starterFiles[0].path,
          seed: spec.seed,
          timeoutMs: spec.timeoutMs,
          maxOutputBytes: spec.maxOutputBytes,
          maxOutputLines: spec.maxOutputLines,
        });

      try {
        const starter = await run(spec.starterFiles[0].contents);
        const solved = await run(solution);
        const bypassResults = [];
        for (const bypass of bypasses) {
          bypassResults.push({
            id: bypass.id,
            result: await run(bypass.source),
          });
        }
        return { starter, solved, bypassResults };
      } finally {
        runner.dispose();
      }
    },
    {
      authoredActivity: activity,
      solution: solvedSource,
      bypasses: bypassSources,
    },
  );
}

function checkFailureLabel(
  activity: CodeLabActivity,
  check: CodeLabActivity["spec"]["checks"][number],
  result:
    | {
        actual: string;
        error?: string;
      }
    | undefined,
) {
  return [
    `${activity.id}/${check.id}: ${check.label}`,
    `expression: ${check.expression}`,
    `expected: ${JSON.stringify(check.expected)}`,
    `actual: ${result?.actual ?? "<missing>"}`,
    `error: ${result?.error ?? "<none>"}`,
  ].join("\n");
}

test("all 19 authored Python labs are satisfiable in real Pyodide", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  await page.goto("/");

  const activities = (await page.evaluate(async () => {
    // @ts-expect-error Browser-only Vite module URL.
    const { lessons } = await import("/src/content/course.ts");
    return lessons
      .flatMap((lesson) => lesson.activities)
      .filter((activity) => activity.kind === "code-lab");
  })) as CodeLabActivity[];

  const authoredIds = activities.map((activity) => activity.id);
  const solutionIds = Object.keys(CODE_LAB_SOLUTION_REPAIRS);
  const authoredCheckCount = activities.reduce(
    (total, activity) => total + activity.spec.checks.length,
    0,
  );

  expect(
    activities,
    "The executable course contract must still contain exactly 19 code labs.",
  ).toHaveLength(EXPECTED_LAB_COUNT);
  expect(
    authoredCheckCount,
    "The executable course contract must still contain exactly 92 checks.",
  ).toBe(EXPECTED_CHECK_COUNT);
  expect(
    solutionIds,
    "Every and only authored code-lab activity must have a bounded solved-source repair.",
  ).toEqual(authoredIds);

  for (const activity of activities) {
    await test.step(`${activity.id}: starter fails and solution passes`, async () => {
      const starterFile = activity.spec.starterFiles[0];
      expect(
        starterFile,
        `${activity.id}: expected exactly one authored starter file.`,
      ).toBeDefined();
      if (!starterFile) return;

      const solvedSource = buildSolvedSource(
        activity.id,
        starterFile.contents,
      );
      const activityProbes = CODE_LAB_BYPASS_PROBES.filter(
        (probe) => probe.activityId === activity.id,
      );
      const bypassSources = activityProbes.map((probe) => ({
        id: probe.id,
        source: buildBypassSource(activity.id, probe.id, solvedSource),
      }));
      expect(
        solvedSource,
        `${activity.id}: the bounded repair must change the authored starter.`,
      ).not.toBe(starterFile.contents);

      const { starter, solved, bypassResults } = await runStarterAndSolution(
        page,
        activity,
        solvedSource,
        bypassSources,
      );
      const expectedCheckIds = activity.spec.checks.map(
        (check) => check.id,
      );

      expect(
        starter.status,
        `${activity.id}: the authored starter itself must execute before its failed checks are inspected.\n${starter.error ?? ""}`,
      ).toBe("completed");
      expect(
        starter.checks.map((check) => check.id),
        `${activity.id}: starter execution must return every authored check.`,
      ).toEqual(expectedCheckIds);
      expect(
        starter.checks.some((check) => !check.passed),
        `${activity.id}: the unmodified starter unexpectedly satisfied all authored checks.`,
      ).toBe(true);

      expect(
        solved.status,
        `${activity.id}: solved source did not complete.\n${solved.error ?? ""}`,
      ).toBe("completed");
      expect(
        solved.outputTruncated,
        `${activity.id}: solved source exceeded its authored output limits.`,
      ).toBe(false);
      expect(
        Object.keys(solved.environment.packages).sort(),
        `${activity.id}: Pyodide loaded a different package set than the authored spec.`,
      ).toEqual([...activity.spec.allowedPackages].sort());
      expect(
        solved.checks.map((check) => check.id),
        `${activity.id}: solved execution must return every authored check.`,
      ).toEqual(expectedCheckIds);

      for (const authoredCheck of activity.spec.checks) {
        const result = solved.checks.find(
          (candidate) => candidate.id === authoredCheck.id,
        );
        expect(
          result?.passed,
          checkFailureLabel(activity, authoredCheck, result),
        ).toBe(true);
      }

      for (const probe of activityProbes) {
        const bypass = bypassResults.find(
          (candidate) => candidate.id === probe.id,
        );
        expect(
          bypass?.result.status,
          `${activity.id}/${probe.id}: bypass source did not complete.\n${bypass?.result.error ?? ""}`,
        ).toBe("completed");
        for (const checkId of probe.rejectedBy) {
          const result = bypass?.result.checks.find(
            (check) => check.id === checkId,
          );
          expect(
            result?.passed,
            `${activity.id}/${probe.id}: known bypass still passed ${checkId}.`,
          ).toBe(false);
        }
      }
    });
  }
});
