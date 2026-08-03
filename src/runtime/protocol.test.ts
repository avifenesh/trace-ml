import { describe, expect, it } from "vitest";
import {
  isWorkerConnectRequest,
  isWorkerMessage,
  isWorkerRequest,
  RUNTIME_PROTOCOL_LIMITS,
} from "./protocol";

describe("Python worker protocol validation", () => {
  it("accepts only the expected connection bootstrap", () => {
    expect(isWorkerConnectRequest({ type: "connect" })).toBe(true);
    expect(isWorkerConnectRequest({ type: "run" })).toBe(false);
    expect(isWorkerConnectRequest(null)).toBe(false);
  });

  it("rejects malformed and unbounded run requests", () => {
    const valid = {
      type: "run",
      runId: "run-1",
      code: "6 * 7",
      checks: [],
      filename: "lesson.py",
      seed: 0,
      maxOutputBytes: 65_536,
      maxOutputLines: 500,
    };

    expect(isWorkerRequest(valid)).toBe(true);
    expect(isWorkerRequest({ ...valid, checks: "not-an-array" })).toBe(
      false,
    );
    expect(
      isWorkerRequest({
        ...valid,
        maxOutputBytes: RUNTIME_PROTOCOL_LIMITS.maxOutputBytes + 1,
      }),
    ).toBe(false);
    expect(
      isWorkerRequest({
        ...valid,
        code: "x".repeat(
          RUNTIME_PROTOCOL_LIMITS.maxCodeCharacters + 1,
        ),
      }),
    ).toBe(false);
  });

  it("requires bounded, fully shaped worker messages", () => {
    const result = {
      type: "run-result",
      runId: "run-1",
      result: {
        status: "completed",
        stdout: "",
        stderr: "",
        output: [],
        result: "42",
        checks: [],
        error: null,
        outputTruncated: false,
        bytesProduced: 0,
      },
    };

    expect(isWorkerMessage(result)).toBe(true);
    expect(
      isWorkerMessage({
        ...result,
        result: { ...result.result, outputTruncated: "false" },
      }),
    ).toBe(false);
    expect(
      isWorkerMessage({
        type: "fatal",
        error: "runtime failed",
        errorTruncated: false,
      }),
    ).toBe(true);
    expect(
      isWorkerMessage({
        type: "fatal",
        error: "runtime failed",
      }),
    ).toBe(false);
  });
});
