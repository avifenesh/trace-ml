import { describe, expect, it } from "vitest";
import type { CodeCheck } from "../content/types";
import {
  assessPrimitiveValue,
  failedAssessmentCheck,
} from "./assessment";

const checks: CodeCheck[] = [
  {
    id: "answer",
    label: "answer is 42",
    expression: "answer",
    expected: 42,
    conceptIds: ["python-model"],
  },
];

describe("code assessment protocol", () => {
  it("compares only typed primitive results", () => {
    expect(assessPrimitiveValue(checks[0], 42)).toMatchObject({
      id: "answer",
      passed: true,
      actual: "42",
      expected: "42",
    });
    expect(assessPrimitiveValue(checks[0], "42")).toMatchObject({
      passed: false,
      actual: '"42"',
    });
  });

  it("fails non-primitive values and evaluator errors closed", () => {
    expect(assessPrimitiveValue(checks[0], { value: 42 })).toMatchObject({
      passed: false,
      actual: "<non-primitive>",
      error: expect.stringContaining("non-primitive"),
    });
    expect(failedAssessmentCheck(checks[0], new Error("missing answer"))).toMatchObject({
      passed: false,
      actual: "error",
      error: "missing answer",
    });
  });
});
