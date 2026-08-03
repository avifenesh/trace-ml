import { describe, expect, it } from "vitest";
import { requireLesson } from "../content/course";
import type { TutorMessage } from "./conversations";
import { lessonHelperInternals } from "./lesson-helper";

const lesson = requireLesson("prerequisite-trace");
const baseRateChunk = pageChunk();

function pageChunk() {
  const chunk = lesson.blocks
    .flatMap((block) =>
      block.body.map((text, index) => ({
        id: `${block.id}:p${index + 1}`,
        text,
      }))
    )
    .find((chunk) => chunk.id === "00-base-rate:p1");
  if (!chunk) throw new Error("Missing base-rate chunk.");
  return chunk;
}

function history(): TutorMessage[] {
  return [{
    id: "message-1",
    role: "tutor",
    text: "The page defines a majority baseline.",
    createdAt: "2026-08-03T12:00:00.000Z",
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
    sourceBlockIds: ["00-base-rate"],
    sourceChunkIds: ["00-base-rate:p1"],
  }];
}

describe("native lesson helper boundary", () => {
  it("sends only authored identity, bounded history, and the question", () => {
    const request = lessonHelperInternals.requestFor(
      lesson,
      "What are the classes?",
      history(),
      "request-1",
    );

    expect(request).toEqual({
      requestId: "request-1",
      lessonId: lesson.id,
      lessonRevision: lesson.revision,
      question: "What are the classes?",
      history: [{
        role: "tutor",
        text: "The page defines a majority baseline.",
        sourceChunkIds: ["00-base-rate:p1"],
      }],
    });
    expect(request).not.toHaveProperty("chunks");
    expect(request).not.toHaveProperty("activities");
  });

  it("accepts an authored cited answer", () => {
    expect(
      lessonHelperInternals.normalizeAnswer(lesson, {
        status: "answered",
        text:
          "The classes are the negative and positive target-label categories.",
        claims: [{
          text:
            "The classes are the negative and positive target-label categories.",
          sourceChunkId: "00-base-rate:p1",
          quote: "Classes are the possible target-label categories.",
        }],
      }),
    ).toEqual({
      status: "answered",
      text:
        "The classes are the negative and positive target-label categories.",
      claims: [{
        text:
          "The classes are the negative and positive target-label categories.",
        sourceChunkId: "00-base-rate:p1",
        quote: "Classes are the possible target-label categories.",
      }],
    });
  });

  it("rejects uncited, invented, inexact, or refusal sources", () => {
    expect(() =>
      lessonHelperInternals.normalizeAnswer(lesson, {
        status: "answered",
        text: "An uncited answer.",
        claims: [],
      })
    ).toThrow("invalid sources");
    expect(() =>
      lessonHelperInternals.normalizeAnswer(lesson, {
        status: "answered",
        text: "An invented citation.",
        claims: [{
          text: "An invented citation.",
          sourceChunkId: "invented:p1",
          quote: "Invented.",
        }],
      })
    ).toThrow("invalid source quote");
    expect(() =>
      lessonHelperInternals.normalizeAnswer(lesson, {
        status: "answered",
        text: "The classes are negative and positive.",
        claims: [{
          text: "The classes are negative and positive.",
          sourceChunkId: "00-base-rate:p1",
          quote: "The classes are negative and positive.",
        }],
      })
    ).toThrow("invalid source quote");
    expect(() =>
      lessonHelperInternals.normalizeAnswer(lesson, {
        status: "boundary",
        text: "I cannot grade the response.",
        claims: [{
          text: "I cannot grade the response.",
          sourceChunkId: "00-base-rate:p1",
          quote: baseRateChunk.text,
        }],
      })
    ).toThrow("invalid sources");
  });

  it("bounds recent history by messages, Unicode characters, total size, and valid sources", () => {
    const messages = Array.from({ length: 13 }, (_, index): TutorMessage => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? "learner" : "tutor",
      text: index === 12 ? "🧠".repeat(4_001) : "a".repeat(4_000),
      createdAt: "2026-08-03T12:00:00.000Z",
      lessonId: lesson.id,
      lessonRevision: lesson.revision ?? "unversioned",
      sourceBlockIds: [],
      sourceChunkIds: [
        "00-base-rate:p1",
        "00-base-rate:p1",
        "invented:p1",
      ],
    }));

    const request = lessonHelperInternals.requestFor(
      lesson,
      "What are the classes?",
      messages,
      "request-bounded",
    );
    expect(request.history.length).toBe(6);
    expect(
      request.history.reduce(
        (total, message) => total + Array.from(message.text).length,
        0,
      ),
    ).toBe(24_000);
    expect(Array.from(request.history.at(-1)?.text ?? "").length).toBe(4_000);
    expect(request.history.at(-1)?.sourceChunkIds).toEqual([
      "00-base-rate:p1",
    ]);
  });
});
