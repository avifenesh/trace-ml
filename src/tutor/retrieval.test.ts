import { describe, expect, it } from "vitest";
import { lessons, requireLesson } from "../content/course";
import { pageChunksForLesson } from "../content/types";
import { answerFromLesson } from "./answer";
import { retrieveLessonContext } from "./retrieval";

const lesson = requireLesson("linear-model");

describe("page-context retrieval", () => {
  it("retrieves the exact authored paragraph for a weight question", () => {
    const results = retrieveLessonContext(
      "How does the weight change the prediction?",
      lesson,
    );
    expect(results[0]?.chunkId).toContain(":p");
    expect(results[0]?.conceptIds).toContain("linear-parameters");
    expect(results[0]?.excerpt.toLocaleLowerCase()).toContain("weight");
  });

  it("uses a question case only as framing around page evidence", () => {
    const answer = answerFromLesson(
      "How does the weight affect the line?",
      lesson,
    );
    expect(answer.matchedCaseId).toBe("causal-question");
    expect(answer.retrievalMode).toBe("page-context-and-case");
    expect(answer.sources.length).toBeGreaterThan(0);
    expect(answer.text).toContain(answer.sources[0].excerpt);
  });

  it("does not use case mode without page grounding", () => {
    const answer = answerFromLesson(
      "How does the weight affect the line?",
      {
        ...lesson,
        teaching: {
          title: "",
          introduction: [],
          vocabulary: [],
          workedExample: {
            title: "",
            setup: "",
            steps: [],
            takeaway: "",
          },
          misconceptions: [],
          summary: [],
          sourceIds: [],
        },
        blocks: [],
      },
    );
    expect(answer.matchedCaseId).toBeUndefined();
    expect(answer.retrievalMode).toBe("page-context");
    expect(answer.sources).toEqual([]);
  });

  it("does not fabricate a page citation for unrelated questions", () => {
    const answer = answerFromLesson(
      "How should I fine tune a language model on private legal documents?",
      lesson,
      lesson.blocks[0]?.id,
    );
    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("does not contain enough information");
  });

  it("abstains from an unrelated question that shares one lesson word", () => {
    const answer = answerFromLesson(
      "How much weight can a bridge support?",
      lesson,
    );

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("does not contain enough information");
  });

  it("abstains when two lesson terms are embedded in an unrelated intent", () => {
    const answer = answerFromLesson(
      "What weight and bias should a judge use to decide prison sentences?",
      lesson,
    );

    expect(answer.sources).toEqual([]);
  });

  it.each([
    [
      "linear-model",
      "Could newspaper bias change how a jury weighs evidence?",
    ],
    [
      "data-and-baseline",
      "What is the baseline interest rate for a home loan?",
    ],
    [
      "attention-routing",
      "How much attention should I give a noisy neighbor?",
    ],
    [
      "q-learning",
      "Which rewards credit card has the best delayed payment terms?",
    ],
  ])("abstains from an unrelated %s paraphrase", (lessonId, question) => {
    const answer = answerFromLesson(question, requireLesson(lessonId));

    expect(answer.sources).toEqual([]);
    expect(answer.text).toContain("does not contain enough information");
  });

  it("answers every authored starter question from its own lesson", () => {
    for (const authoredLesson of lessons) {
      const pageChunkIds = new Set(
        pageChunksForLesson(authoredLesson).map((chunk) => chunk.id),
      );
      for (const question of authoredLesson.starterQuestions ?? []) {
        const answer = answerFromLesson(question, authoredLesson);
        expect(
          answer.sources.length,
          `${authoredLesson.id}: ${question}`,
        ).toBeGreaterThan(0);
        for (const source of answer.sources) {
          expect(pageChunkIds, `${authoredLesson.id}: ${question}`).toContain(
            source.chunkId,
          );
          expect(answer.text).toContain(source.excerpt);
        }
      }
    }
  });

  it("cites the teaching summary for the authored availability question", () => {
    const dataLesson = requireLesson("data-and-baseline");
    const results = retrieveLessonContext(
      "Which values exist when a new prediction is requested?",
      dataLesson,
    );

    expect(results[0]?.chunkId).toBe(
      "data-and-baseline-teaching:summary-2",
    );
  });

  it("explains the classes named by the 80-to-20 baseline", () => {
    const prerequisiteLesson = requireLesson("prerequisite-trace");
    const question =
      "Explain what are the classes mentioned in 80-to-20 classes still give an 80% majority baseline.";
    const answer = answerFromLesson(question, prerequisiteLesson);

    expect(answer.sources[0]?.chunkId).toBe("00-base-rate:p1");
    expect(answer.text).toContain(
      "Classes are the possible target-label categories.",
    );
    expect(answer.text).toContain(
      "80 of 100 recorded cases are negative and the other 20 are positive",
    );
  });
});
