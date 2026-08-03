import type { Lesson } from "../content/types";

const stopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "has",
  "how",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "one",
  "the",
  "their",
  "to",
  "what",
  "when",
  "which",
  "with",
]);

function normalizedText(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9.+-]+/g, " ")
    .trim();
}

function significantTokens(value: string) {
  return [
    ...new Set(
      normalizedText(value)
        .split(/\s+/)
        .filter((token) => token.length > 1 && !stopWords.has(token)),
    ),
  ];
}

function substantiallyMatches(question: string, prompt: string) {
  const normalizedQuestion = normalizedText(question);
  const normalizedPrompt = normalizedText(prompt);
  if (
    normalizedQuestion === normalizedPrompt ||
    normalizedQuestion.includes(normalizedPrompt) ||
    normalizedPrompt.includes(normalizedQuestion)
  ) {
    return true;
  }

  const questionTokens = new Set(significantTokens(question));
  const promptTokens = significantTokens(prompt);
  if (questionTokens.size < 3 || promptTokens.length < 3) return false;
  const overlap = promptTokens.filter((token) => questionTokens.has(token)).length;
  return (
    overlap >= 4 &&
    overlap / promptTokens.length >= 0.45 &&
    overlap / questionTokens.size >= 0.5
  );
}

export interface ProtectedPrediction {
  activityId: string;
  prompt: string;
}

export function unfinishedPredictionTargeted(
  question: string,
  lesson: Lesson,
  committedActivityIds: ReadonlySet<string>,
): ProtectedPrediction | null {
  for (const activity of lesson.activities) {
    if (
      activity.kind !== "prediction" ||
      committedActivityIds.has(activity.id)
    ) {
      continue;
    }
    if (substantiallyMatches(question, activity.checkpoint.prompt)) {
      return {
        activityId: activity.id,
        prompt: activity.checkpoint.prompt,
      };
    }
  }
  return null;
}

export const unfinishedPredictionBoundary =
  "I can explain the underlying term or mechanism, but I cannot solve an unfinished prediction. Commit your own choice first, then ask about the reasoning or feedback.";

export const checkpointGuardInternals = {
  normalizedText,
  significantTokens,
  substantiallyMatches,
};
