import { describe, expect, it, vi } from "vitest";
import { finishPythonOutput } from "./python-output";

describe("Python stream finalization", () => {
  it("flushes Python streams before collecting output", () => {
    const order: string[] = [];

    const result = finishPythonOutput(
      () => order.push("flush"),
      () => {
        order.push("finish");
        return "output";
      },
    );

    expect(result).toBe("output");
    expect(order).toEqual(["flush", "finish"]);
  });

  it("still collects output when flushing fails", () => {
    const finish = vi.fn(() => "original result");

    expect(
      finishPythonOutput(() => {
        throw new Error("broken stream");
      }, finish),
    ).toBe("original result");
    expect(finish).toHaveBeenCalledOnce();
  });
});
