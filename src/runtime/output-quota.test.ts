import { describe, expect, it } from "vitest";
import {
  OutputQuota,
  truncateUtf8,
  Utf8TextQuota,
} from "./output-quota";

const bytes = (value: string) => new TextEncoder().encode(value);

describe("Python output quota", () => {
  it("keeps stdout and stderr while accounting for a shared byte limit", () => {
    const output = new OutputQuota(12, 10);
    output.write("stdout", bytes("hello\n"));
    output.write("stderr", bytes("error\n"));

    expect(output.finish()).toEqual({
      stdout: "hello\n",
      stderr: "error\n",
      output: [
        { stream: "stdout", text: "hello\n" },
        { stream: "stderr", text: "error\n" },
      ],
      outputTruncated: false,
      bytesProduced: 12,
    });
  });

  it("preserves interleaved stdout and stderr display order", () => {
    const output = new OutputQuota(100, 10);
    output.write("stdout", bytes("before\n"));
    output.write("stderr", bytes("middle\n"));
    output.write("stdout", bytes("after\n"));

    expect(output.finish().output).toEqual([
      { stream: "stdout", text: "before\n" },
      { stream: "stderr", text: "middle\n" },
      { stream: "stdout", text: "after\n" },
    ]);
  });

  it("discards bytes beyond the quota and reports truncation", () => {
    const output = new OutputQuota(5, 10);
    output.write("stdout", bytes("abcdefgh"));

    expect(output.finish()).toMatchObject({
      stdout: "abcde",
      outputTruncated: true,
      bytesProduced: 8,
    });
  });

  it.each(["stdout", "stderr"] as const)(
    "does not split a multibyte character at the %s byte boundary",
    (stream) => {
      const output = new OutputQuota(2, 10);
      output.write(stream, bytes("€"));

      const result = output.finish();
      expect(result[stream]).toBe("");
      expect(bytes(result[stream]).byteLength).toBeLessThanOrEqual(2);
      expect(result.outputTruncated).toBe(true);
      expect(result.bytesProduced).toBe(3);
    },
  );

  it("preserves a multibyte character split across valid stream chunks", () => {
    const encoded = bytes("€");
    const output = new OutputQuota(3, 10);
    output.write("stdout", encoded.subarray(0, 2));
    output.write("stdout", encoded.subarray(2));

    expect(output.finish()).toMatchObject({
      stdout: "€",
      outputTruncated: false,
      bytesProduced: 3,
    });
  });

  it("bounds an infinite-style stream by line count", () => {
    const output = new OutputQuota(1_000, 2);
    output.write("stdout", bytes("one\ntwo\nthree\n"));

    expect(output.finish()).toMatchObject({
      stdout: "one\ntwo",
      outputTruncated: true,
    });
  });
});

describe("structured-clone text quota", () => {
  it("caps UTF-8 without splitting a multibyte character", () => {
    expect(truncateUtf8("A😀B", 5)).toEqual({
      text: "A😀",
      truncated: true,
      bytes: 5,
    });
  });

  it("shares one byte budget across final result fields", () => {
    const quota = new Utf8TextQuota(7);

    expect(quota.take("four")).toBe("four");
    expect(quota.take("€x")).toBe("€");
    expect(quota.take("unused")).toBe("");
    expect(quota.truncated).toBe(true);
  });
});
