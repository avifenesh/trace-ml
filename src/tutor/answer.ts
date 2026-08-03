import type { Lesson } from "../content/types";
import type { TutorMessage } from "./conversations";
import {
  retrieveLessonContext,
  retrieveLessonContextByChunkIds,
  type RetrievedContext,
} from "./retrieval";

export interface TutorAnswer {
  text: string;
  sources: RetrievedContext[];
  matchedCaseId?: string;
  retrievalMode: "page-context" | "page-context-and-case";
}

export type TutorHistoryMessage = Pick<
  TutorMessage,
  "role" | "text" | "lessonId" | "lessonRevision" | "sourceChunkIds"
>;

interface QuestionCase {
  id: string;
  keywords: string[];
  priority: number;
  sourceLimit: number;
  frame: (sources: RetrievedContext[]) => string;
}

const questionCases: QuestionCase[] = [
  {
    id: "definition-question",
    keywords: ["what", "mean", "means", "define", "definition", "term"],
    priority: 1,
    sourceLimit: 1,
    frame: ([source]) =>
      `The page defines it here: ${source.excerpt}`,
  },
  {
    id: "causal-question",
    keywords: ["why", "how", "change", "affect", "cause", "because"],
    priority: 3,
    sourceLimit: 2,
    frame: ([first, second]) =>
      second
        ? `These are the closest relevant authored passages. ${first.excerpt} ${second.excerpt}`
        : `The page gives this causal account: ${first.excerpt}`,
  },
  {
    id: "contrast-question",
    keywords: ["difference", "different", "versus", "same", "compare", "distinguish"],
    priority: 5,
    sourceLimit: 2,
    frame: ([first, second]) =>
      second
        ? `These are the closest relevant authored passages. ${first.excerpt} ${second.excerpt}`
        : `The closest authored contrast is: ${first.excerpt}`,
  },
  {
    id: "boundary-question",
    keywords: ["prove", "guarantee", "always", "conclude", "claim", "limit"],
    priority: 4,
    sourceLimit: 1,
    frame: ([source]) =>
      `The page supports this limited claim: ${source.excerpt} It does not establish a broader guarantee.`,
  },
  {
    id: "explanation-question",
    keywords: ["explain", "clarify", "restate", "simplify", "simpler"],
    priority: 2,
    sourceLimit: 1,
    frame: ([source]) =>
      `Here is the exact page passage to focus on: ${source.excerpt}`,
  },
];

const helperBoundaryPatterns = [
  /\bteach\b/,
  /\b(?:tutor|coach|remediate|remediation)\b/,
  /\b(?:give|offer|provide|show)\b.{0,20}\b(?:a\s+)?hint\b/,
  /\bhint\b.{0,20}\b(?:me|please)\b/,
  /\b(?:choose|select|pick|recommend|arrange|reorder|sequence|order|plan|skip|replace)\b.{0,50}\b(?:lessons?|modules?|topics?|courses?|curriculum|materials?)\b/,
  /\b(?:lessons?|modules?|topics?|courses?|curriculum|materials?)\b.{0,50}\b(?:choose|select|pick|recommend|arrange|reorder|sequence|order|plan|skip|replace)\b/,
  /\b(?:choose|select|pick|recommend|decide|plan|arrange)\b.{0,40}\b(?:what|where|when|how)\b.{0,30}\b(?:study|learn|continue|start|do|go)\b/,
  /\b(?:what|which)\b.{0,30}\b(?:lessons?|modules?|topics?)\b.{0,30}\b(?:next|study|learn|take|do)\b/,
  /\b(?:what|which|where)\s+should\s+i\s+(?:study|learn|go|start|continue|do)\b/,
  /\b(?:what|where)\s+(?:do|can)\s+i\s+(?:study|learn|go|start|continue|do)\b/,
  /\bshould\s+i\s+(?:study|learn|take|do)\b.{0,20}\bnext\b/,
  /\bdecide\b.{0,30}\b(?:study|learn|lessons?|modules?|topics?|next)\b/,
  /\bput\b.{0,40}\b(?:lessons?|modules?|topics?|courses?|curriculum|materials?)\b.{0,30}\b(?:order|before|after)\b/,
  /\b(?:create|generate|write|design|make|invent)\b.{0,40}\b(?:lessons?|courses?|curriculum|syllabus|quiz(?:zes)?|tests?|assessments?|exercises?|assignments?|activities|activity|examples?|analogies|analogy|problems?)\b/,
  /\b(?:build|give|make|write|create|generate|design|invent)\b.{0,40}\b(?:practice\s+)?(?:problems?|exercises?|examples?|quiz(?:zes)?|tests?|questions?|assignments?|activities?)\b/,
  /\b(?:another|new)\b.{0,20}\b(?:examples?|analogies|analogy|exercises?|assignments?|activities|activity|problems?|quiz(?:zes)?|assessments?)\b/,
  /\b(?:quiz|test)\s+me\b/,
  /\b(?:grade|score|rate|assess|evaluate)\b.{0,30}\b(?:me|my|answer|response|work|mastery|understanding|progress|this)\b/,
  /\b(?:is|was)\s+my\s+(?:answer|response|work|reasoning|understanding)\b.{0,20}\b(?:correct|right|good|wrong)\b/,
  /\b(?:did|have)\s+i\b.{0,15}\b(?:master|understand|pass)\b/,
  /\b(?:have|did|do)\s+i\s+(?:learn(?:ed|t)?|know|understand)\b.{0,40}\b(?:enough|well|correctly)\b/,
  /\bunlock\b/,
  /\bmark\b.{0,20}\b(?:complete|completed|done|progress)\b/,
  /\badvance\s+me\b/,
  /\bchange\s+my\s+progress\b/,
];

const contextualReferences = new Set([
  "it",
  "that",
  "this",
  "they",
  "them",
  "these",
  "those",
  "same",
  "former",
  "latter",
]);
const contextOnlyTokens = new Set([
  "again",
  "and",
  "but",
  "can",
  "clarify",
  "could",
  "does",
  "explain",
  "happen",
  "how",
  "it",
  "more",
  "not",
  "please",
  "restate",
  "simplify",
  "so",
  "that",
  "this",
  "why",
  "would",
  "you",
]);

function normalizedTokens(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function crossesHelperBoundary(query: string) {
  const normalized = normalizedTokens(query).join(" ");
  return helperBoundaryPatterns.some((pattern) => pattern.test(normalized));
}

function isContextualFollowUp(query: string) {
  const queryTokens = normalizedTokens(query);
  if (queryTokens.length === 0) return false;

  if (
    queryTokens.length <= 12 &&
    queryTokens.some((token) => contextualReferences.has(token))
  ) {
    return true;
  }

  if (
    queryTokens.length <= 3 &&
    ["and", "but", "how", "so", "why"].includes(queryTokens[0])
  ) {
    return true;
  }

  return /^(?:can|could|would) you (?:explain|clarify|restate|simplify) (?:again|more)\b/.test(
    queryTokens.join(" "),
  );
}

function hasStandaloneSubject(query: string) {
  return normalizedTokens(query).some(
    (token) => !contextOnlyTokens.has(token),
  );
}

function latestGroundedExchange(
  history: readonly TutorHistoryMessage[],
  lesson: Lesson,
) {
  const lessonRevision = lesson.revision ?? "unversioned";
  const lessonHistory = history.filter(
    (message) =>
      message.lessonId === lesson.id &&
      message.lessonRevision === lessonRevision,
  );
  const tutorIndex = lessonHistory.findLastIndex(
    (message) => message.role === "tutor",
  );
  if (tutorIndex < 0) return undefined;

  const tutorMessage = lessonHistory[tutorIndex];
  const sources = retrieveLessonContextByChunkIds(
    lesson,
    tutorMessage.sourceChunkIds,
  );
  if (sources.length === 0) return undefined;

  const learnerMessage = lessonHistory
    .slice(0, tutorIndex)
    .findLast((message) => message.role === "learner");
  if (!learnerMessage) return undefined;

  return { question: learnerMessage.text, sources };
}

function mergeSources(...groups: RetrievedContext[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((source) => {
      if (seen.has(source.chunkId)) return false;
      seen.add(source.chunkId);
      return true;
    })
    .slice(0, 3);
}

function retrieveQuestionCase(query: string) {
  const queryTokens = new Set(normalizedTokens(query));
  return questionCases
    .map((item) => ({
      item,
      score: item.keywords.filter((keyword) => queryTokens.has(keyword)).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.item.priority - left.item.priority,
    )[0]?.item;
}

export function answerFromLesson(
  query: string,
  lesson: Lesson,
  activeBlockId?: string,
  history: readonly TutorHistoryMessage[] = [],
): TutorAnswer {
  if (crossesHelperBoundary(query)) {
    return {
      text:
        "I can explain or answer questions from this page, but I cannot teach lessons, choose or arrange course material, create course content or assessments, grade work, or unlock progress. Ask me about a term or mechanism visible here.",
      sources: [],
      retrievalMode: "page-context",
    };
  }

  const isFollowUp = isContextualFollowUp(query);
  const exchange = isFollowUp
    ? latestGroundedExchange(history, lesson)
    : undefined;
  if (isFollowUp && !exchange && !hasStandaloneSubject(query)) {
    return {
      text:
        "Which term or mechanism on this page do you mean? Name it, and I will answer from the exact authored paragraphs.",
      sources: [],
      retrievalMode: "page-context",
    };
  }
  const directSources = retrieveLessonContext(query, lesson, activeBlockId);
  const expandedSources = exchange
    ? retrieveLessonContext(
        `${exchange.question} ${query}`,
        lesson,
        activeBlockId,
      )
    : [];
  const sources = exchange
    ? mergeSources(directSources, exchange.sources, expandedSources)
    : directSources;

  if (sources.length === 0) {
    return {
      text:
        isFollowUp
          ? "Which term or mechanism on this page do you mean? Name it, and I will answer from the exact authored paragraphs."
          : "This page does not contain enough information to answer that question. Ask about one of the terms or mechanisms visible in this lesson.",
      sources: [],
      retrievalMode: "page-context",
    };
  }

  const matchedCase = retrieveQuestionCase(query);
  if (matchedCase) {
    const usedSources = sources.slice(0, matchedCase.sourceLimit);
    return {
      text: matchedCase.frame(usedSources),
      sources: usedSources,
      matchedCaseId: matchedCase.id,
      retrievalMode: "page-context-and-case",
    };
  }

  return {
    text: `The closest authored passage is: ${sources[0].excerpt}`,
    sources: sources.slice(0, 1),
    retrievalMode: "page-context",
  };
}
