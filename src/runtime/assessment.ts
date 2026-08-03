import type { CodeCheck } from "../content/types";
import type { AssessmentCheckResult } from "./protocol";

function displayValue(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

export function assessPrimitiveValue(
  check: CodeCheck,
  actual: unknown,
): AssessmentCheckResult {
  const primitive =
    typeof actual === "string" ||
    typeof actual === "number" ||
    typeof actual === "boolean";
  return {
    id: check.id,
    label: check.label,
    passed: primitive && actual === check.expected,
    actual: primitive ? displayValue(actual) : "<non-primitive>",
    expected: displayValue(check.expected),
    ...(!primitive
      ? {
          error:
            "The authored check returned a non-primitive value. Normalize it to a string, number, or boolean.",
        }
      : {}),
  };
}

export function failedAssessmentCheck(
  check: CodeCheck,
  error: unknown,
): AssessmentCheckResult {
  return {
    id: check.id,
    label: check.label,
    passed: false,
    actual: "error",
    expected: displayValue(check.expected),
    error: error instanceof Error ? error.message : String(error),
  };
}
