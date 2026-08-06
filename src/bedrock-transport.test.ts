import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

import {
  bedrockTransportAvailable,
  invokeBedrock,
} from "./bedrock-transport";

beforeEach(() => {
  invokeMock.mockReset();
  isTauriMock.mockReset();
  isTauriMock.mockReturnValue(false);
  vi.stubEnv("VITE_TRACE_BEDROCK_HTTP", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Bedrock transport", () => {
  it("keeps desktop operations on the fixed Tauri commands", async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue({ available: true });

    await expect(
      invokeBedrock("lessonHelperReady"),
    ).resolves.toEqual({ available: true });
    expect(invokeMock).toHaveBeenCalledWith("lesson_helper_ready", {});
  });

  it("uses the fixed same-origin endpoint only in Tailnet builds", async () => {
    vi.stubEnv("VITE_TRACE_BEDROCK_HTTP", "1");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(bedrockTransportAvailable()).toBe(true);
    await expect(
      invokeBedrock("cancelLessonAnswer", { requestId: "request-1" }),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/_trace/bedrock/lesson-helper/cancel",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ requestId: "request-1" }),
      }),
    );
  });

  it("surfaces bounded server errors and stays disabled in ordinary web builds", async () => {
    expect(bedrockTransportAvailable()).toBe(false);
    await expect(
      invokeBedrock("lessonHelperReady"),
    ).rejects.toThrow("not enabled");

    vi.stubEnv("VITE_TRACE_BEDROCK_HTTP", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Bedrock is unavailable." }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      invokeBedrock("lessonHelperReady"),
    ).rejects.toThrow("Bedrock is unavailable.");
  });
});
