import { describe, expect, it } from "vitest";
import { requireLesson } from "../content/course";
import { pageChunksForLesson } from "../content/types";
import {
  answerFromLesson,
  type TutorAnswer,
  type TutorHistoryMessage,
} from "./answer";

const lesson = requireLesson("linear-model");
const lessonRevision = lesson.revision ?? "unversioned";

function historyFor(
  question: string,
  answer: TutorAnswer,
): TutorHistoryMessage[] {
  return [
    {
      role: "learner",
      text: question,
      lessonId: lesson.id,
      lessonRevision,
      sourceChunkIds: [],
    },
    {
      role: "tutor",
      text: answer.text,
      lessonId: lesson.id,
      lessonRevision,
      sourceChunkIds: answer.sources.map((source) => source.chunkId),
    },
  ];
}

function expectExactPageSources(answer: TutorAnswer) {
  const pageChunks = new Map(
    pageChunksForLesson(lesson).map((chunk) => [chunk.id, chunk]),
  );
  for (const source of answer.sources) {
    const currentChunk = pageChunks.get(source.chunkId);
    expect(currentChunk).toBeDefined();
    expect(source.excerpt).toBe(currentChunk?.text);
    expect(answer.text).toContain(currentChunk?.text);
  }
}

describe("multi-turn page-grounded answers", () => {
  it("resolves a referential follow-up from the last grounded exchange", () => {
    const question =
      "What does the weight change between neighboring x values?";
    const firstAnswer = answerFromLesson(question, lesson);
    const followUp = answerFromLesson(
      "Why does that happen?",
      lesson,
      undefined,
      historyFor(question, firstAnswer),
    );

    expect(followUp.matchedCaseId).toBe("causal-question");
    expect(followUp.sources[0]?.chunkId).toBe(
      firstAnswer.sources[0]?.chunkId,
    );
    expectExactPageSources(followUp);
  });

  it("lets a clear new topic replace the prior conversational anchor", () => {
    const question =
      "What does the weight change between neighboring x values?";
    const firstAnswer = answerFromLesson(question, lesson);
    const followUp = answerFromLesson(
      "What about the bias?",
      lesson,
      undefined,
      historyFor(question, firstAnswer),
    );

    expect(followUp.sources[0]?.blockId).toBe("02-bias");
    expect(followUp.sources).toHaveLength(1);
    expectExactPageSources(followUp);
  });

  it("does not trust stale source IDs or prior tutor prose", () => {
    const history: TutorHistoryMessage[] = [
      {
        role: "learner",
        text: "Tell me about private legal documents.",
        lessonId: lesson.id,
        lessonRevision,
        sourceChunkIds: [],
      },
      {
        role: "tutor",
        text: "An unsupported claim from outside the page.",
        lessonId: lesson.id,
        lessonRevision,
        sourceChunkIds: ["another-page:p1"],
      },
    ];
    const answer = answerFromLesson(
      "Why does that happen?",
      lesson,
      undefined,
      history,
    );

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("Which term or mechanism");
    expect(answer.text).not.toContain("unsupported claim");
  });

  it("does not reuse a grounded exchange from an older lesson revision", () => {
    const question =
      "What does the weight change between neighboring x values?";
    const firstAnswer = answerFromLesson(question, lesson);
    const staleHistory = historyFor(question, firstAnswer).map((message) => ({
      ...message,
      lessonRevision: "older-revision",
    }));

    const answer = answerFromLesson(
      "Why does that happen?",
      lesson,
      undefined,
      staleHistory,
    );

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("Which term or mechanism");
  });
});

describe("helper-only boundary", () => {
  it.each([
    "Teach me this lesson.",
    "Tutor me through weight and bias step by step.",
    "Give me a hint about the weight.",
    "Remediate my weak understanding of bias.",
    "Which lesson should I study next?",
    "Choose what I should learn next.",
    "Create another example for me.",
    "Build me a practice problem involving weight and bias.",
    "Is my answer correct?",
    "Have I learned enough about weight?",
    "Grade my answer and unlock the next lesson.",
    "Arrange the curriculum around my weak points.",
    "Put these lessons in a different order.",
    "Coach me through every step of weight and bias.",
    "Please offer a hint about why bias shifts the line.",
    "Recommend which module I should take after linear models.",
    "Generate a fresh quiz about weight and bias.",
    "Assess my reasoning that bias changes the intercept.",
    "Mark this activity complete for me.",
    "Advance me to the next module.",
  ])("refuses curriculum control or teaching: %s", (question) => {
    const groundedAnswer = answerFromLesson(
      "What does the weight change between neighboring x values?",
      lesson,
    );
    const answer = answerFromLesson(
      question,
      lesson,
      undefined,
      historyFor("What does the weight change?", groundedAnswer),
    );

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("I cannot teach lessons");
  });

  it("prefers a specific contrast case over a generic question word", () => {
    const answer = answerFromLesson(
      "What is the difference between weight and bias?",
      lesson,
    );

    expect(answer.matchedCaseId).toBe("contrast-question");
  });

  it("still answers an in-page evaluation question", () => {
    const answer = answerFromLesson(
      "How do we evaluate the prediction at x = 0?",
      lesson,
    );

    expect(answer.sources.length).toBeGreaterThan(0);
    expectExactPageSources(answer);
  });

  it("does not invent a causal relationship between separately ranked passages", () => {
    const answer = answerFromLesson(
      "Why does the mean baseline cause parameters to update?",
      requireLesson("data-and-baseline"),
    );

    expect(answer.text).not.toContain("connects the mechanism");
    expect(answer.text).not.toContain("in two steps");
  });

  it("clarifies a context-only follow-up when no grounded exchange exists", () => {
    const answer = answerFromLesson("Why not?", lesson);

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("Which term or mechanism");
  });
});
