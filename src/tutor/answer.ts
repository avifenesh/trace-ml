import type { Lesson } from "../content/types";
import type { TutorMessage } from "./conversations";
import {
  retrieveLessonContext,
  retrieveLessonContextByChunkIds,
  type RetrievedContext,
} from "./retrieval";
import {
  unfinishedPredictionBoundary,
  unfinishedPredictionTargeted,
} from "./checkpoint-guard";

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
  /\b(?:teach|tutor|coach)\s+(?:me|us)\b/,
  /\b(?:teach|tutor|coach)\b.{0,35}\b(?:lesson|course|module|topic|step by step|through)\b/,
  /\bremediat(?:e|ion)\b.{0,30}\b(?:me|my|understanding|lesson|topic)\b/,
  /\b(?:act|behave|pretend|roleplay)\b.{0,30}\b(?:teacher|instructor|examiner|grader|coach|tutor|curriculum designer)\b/,
  /\b(?:enter|switch|use)\b.{0,20}\b(?:teacher|instructor|examiner|grader|coach|tutor)\s+mode\b/,
  /\bas\s+(?:my|a|an|the)?\s*(?:teacher|instructor|examiner|grader|coach|tutor|curriculum designer)\b/,
  /\byou\s+are\s+now\b.{0,25}\b(?:developer|system|teacher|grader|tutor)\b/,
  /\b(?:ignore|disregard|override|bypass|forget)\b.{0,40}\b(?:instructions?|rules?|limits?|boundar(?:y|ies)|policy|policies)\b/,
  /\b(?:output|return|respond)\s+only\b/,
  /\b(?:omit|remove|skip|without)\b.{0,25}\b(?:citations?|sources?|quotes?)\b/,
  /\bdecode\b.{0,25}\b(?:base64|hex|encoded)\b.{0,40}\b(?:follow|execute|obey|instructions?)\b/,
  /\b(?:summarize|cover|explain|walk through)\b.{0,30}\b(?:whole|entire|full|this|the)?\s*(?:lesson|module|course|page)\b/,
  /\b(?:give|show|walk)\b.{0,25}\b(?:a\s+)?(?:lesson|course|tutorial)\b/,
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
  /\b(?:build|create|design|give|make|write)\b.{0,40}\b(?:checkpoints?|rubrics?|worksheets?|drills?|challenges?|multiple choice)\b/,
  /\b(?:build|compose|create|draft|generate|make|write)\b.{0,40}\b(?:flashcards?|study guides?|cheat sheets?|mnemonics?|notes?|recaps?|summaries?|tutorials?)\b/,
  /\b(?:another|new)\b.{0,20}\b(?:examples?|analogies|analogy|exercises?|assignments?|activities|activity|problems?|quiz(?:zes)?|assessments?)\b/,
  /\b(?:quiz|test)\s+me\b/,
  /\b(?:do|have|run|try)\b.{0,20}\b(?:quiz(?:zes)?|tests?|assessments?|exercises?|drills?|challenges?)\b/,
  /\b(?:ask|question)\s+me\b/,
  /\b(?:ask|pose)\b.{0,30}\b(?:questions?|quiz(?:zes)?|tests?)\b/,
  /\b(?:turn|convert|transform)\b.{0,30}\b(?:quiz(?:zes)?|tests?|flashcards?|exercises?|assessments?|practice)\b/,
  /\b(?:different|alternate|alternative|other)\b.{0,15}\b(?:examples?|analogies|exercises?|problems?|scenarios?|situations?|one)\b/,
  /\b(?:grade|score|rate|assess|evaluate)\b.{0,30}\b(?:me|my|answer|response|work|mastery|understanding|progress|this)\b/,
  /\b(?:assess|evaluate|judge|determine)\b.{0,45}\b(?:master(?:y|ed)?|understanding|progress|readiness)\b/,
  /^(?:approve|check|confirm|validate|verify)\b.{0,20}\b(?:my|this|that|answer|response|reasoning|work|claim|statement)\b/,
  /\b(?:is|was)\s+my\s+(?:answer|response|work|reasoning|understanding)\b.{0,20}\b(?:correct|right|good|wrong)\b/,
  /\bmy\s+(?:answer|response|work|reasoning|understanding|claim|statement)\b.{0,40}\b(?:correct|right|wrong|good|strong|weak|hold|work|stand|make sense)\b/,
  /\b(?:does|is|was|would)\s+my\s+(?:answer|response|work|reasoning|understanding|claim|statement)\b.{0,30}\b(?:hold|work|stand|check out|make sense|pass|correct|right|good|wrong)\b/,
  /\b(?:prove|show|mean)\b.{0,20}\bi\b.{0,20}\b(?:understand|master|know)\b/,
  /^(?:is|was|would|does)\b.{0,50}\b(?:the\s+)?(?:correct|right|wrong)\s+(?:answer|response)\b/,
  /\b(?:earn|receive|deserve|get)\b.{0,15}\b(?:full|partial)?\s*credit\b/,
  /\b(?:would|did|does|should|can)\b.{0,30}\b(?:pass|count as correct|be accepted)\b/,
  /\b(?:did|have)\s+i\b.{0,15}\b(?:master|understand|pass)\b/,
  /\b(?:have|did|do)\s+i\s+(?:learn(?:ed|t)?|know|understand)\b.{0,40}\b(?:enough|well|correctly)\b/,
  /\bunlock\b.{0,25}\b(?:lesson|module|progress|activity|next)\b/,
  /\b(?:lesson|module|activity)\b.{0,20}\bunlock\b/,
  /\bmark\b.{0,20}\b(?:complete|completed|done|progress)\b/,
  /\b(?:call|count|consider|treat)\b.{0,20}\b(?:this|it|me|my)\b.{0,15}\b(?:complete|completed|done|passed)\b/,
  /\b(?:move|send|take)\s+me\s+(?:on|forward|ahead|to)\b/,
  /\badvance\s+me\b/,
  /\bchange\s+my\s+progress\b/,
  /\b(?:give|show|tell)\b.{0,45}\b(?:answer|solution|correct option)\b.{0,30}\b(?:activity|exercise|quiz|checkpoint|problem|question)\b/,
  /\b(?:solve|complete|do)\b.{0,30}\b(?:activity|exercise|quiz|checkpoint|assignment)\b/,
  /\bwhich\b.{0,20}\boption\b.{0,20}\b(?:choose|pick|select|correct)\b/,
  /\b(?:correct|right)\b.{0,15}\boption\b/,
  /\b(?:reveal|repeat|show|print)\b.{0,40}\b(?:system|developer|hidden)\b.{0,20}\b(?:prompt|instructions?)\b/,
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
  "its",
  "latter",
  "their",
]);
const contextOnlyTokens = new Set([
  "again",
  "and",
  "another",
  "are",
  "but",
  "can",
  "clarify",
  "clearly",
  "could",
  "does",
  "explain",
  "further",
  "happen",
  "how",
  "it",
  "its",
  "is",
  "mean",
  "more",
  "not",
  "plain",
  "please",
  "repeat",
  "restate",
  "role",
  "say",
  "simply",
  "simplify",
  "so",
  "that",
  "their",
  "this",
  "terms",
  "unpack",
  "way",
  "what",
  "which",
  "why",
  "words",
  "would",
  "was",
  "were",
  "you",
]);
const lessonNumberWords = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const privilegedTerms = [
  "ignore",
  "bypass",
  "override",
  "reveal",
  "system",
  "prompt",
  "instructions",
  "developer",
  "citations",
];

function isTypoglycemicMatch(candidate: string, expected: string) {
  const candidateCharacters = Array.from(candidate);
  const expectedCharacters = Array.from(expected);
  if (candidate === expected) return true;
  if (
    candidateCharacters.length !== expectedCharacters.length ||
    candidateCharacters.length < 5 ||
    candidateCharacters[0] !== expectedCharacters[0] ||
    candidateCharacters.at(-1) !== expectedCharacters.at(-1)
  ) {
    return false;
  }
  return candidateCharacters.slice(1, -1).sort().join("") ===
    expectedCharacters.slice(1, -1).sort().join("");
}

function canonicalPrivilegedToken(token: string) {
  return privilegedTerms.find((term) => isTypoglycemicMatch(token, term)) ??
    token;
}

function isIgnoredFormattingCharacter(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint === 0x00ad ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2060 && codePoint <= 0x206f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    codePoint === 0xfeff ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef);
}

function normalizedTokens(value: string) {
  return Array.from(value.normalize("NFKC"))
    .filter((character) => !isIgnoredFormattingCharacter(character))
    .join("")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalPrivilegedToken);
}

function crossesHelperBoundary(query: string) {
  const normalized = normalizedTokens(query).join(" ");
  return helperBoundaryPatterns.some((pattern) => pattern.test(normalized));
}

function referencesAnotherPage(query: string, lesson: Lesson) {
  const normalized = normalizedTokens(query).join(" ");
  if (
    /\b(?:another|other|previous|prior|earlier|next|later|following)\s+(?:lesson|module|page)\b/.test(
      normalized,
    ) ||
    /\b(?:lesson|module|page)\s+(?:before|after)\b/.test(normalized)
  ) {
    return true;
  }

  if (/\bmodule\s+(?:\d+|[ivxlcdm]+)\b/.test(normalized)) return true;
  if (/\blesson\s+[ivxlcdm]+\b/.test(normalized)) return true;
  if (
    /\b(?:in|from|according to)\s+(?!(?:this|current|the current|the lesson)\b).{1,40}\blesson\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  const currentNumber = lesson.number.replace(/^0+/, "") || "0";
  const hasOtherNumericLesson = [
    ...normalized.matchAll(/\blesson\s+(\d+)\b/g),
  ].some(
    ([, number]) => (number.replace(/^0+/, "") || "0") !== currentNumber,
  );
  if (hasOtherNumericLesson) return true;

  return [
    ...normalized.matchAll(
      new RegExp(`\\blesson\\s+(${lessonNumberWords.join("|")})\\b`, "g"),
    ),
  ].some(([, word]) => String(lessonNumberWords.indexOf(word)) !== currentNumber);
}

export function helperRequestCrossesBoundary(query: string, lesson: Lesson) {
  return crossesHelperBoundary(query) || referencesAnotherPage(query, lesson);
}

function withoutCurrentPageReference(query: string, lesson: Lesson) {
  const numericLesson = Number.parseInt(lesson.number, 10);
  const lessonNumberPattern = numericLesson === 0
    ? "0+"
    : `0*${numericLesson}`;
  const lessonWord = lessonNumberWords[numericLesson];
  return query
    .replace(
      new RegExp(`\\blesson\\s+${lessonNumberPattern}\\b\\s*[:,-]?`, "gi"),
      " ",
    )
    .replace(
      new RegExp(`\\blesson\\s+${lessonWord}\\b\\s*[:,-]?`, "gi"),
      " ",
    )
    .replace(
      /\b(?:in|from|according to)\s+(?:this|current|the current|the)\s+(?:lesson|page)\b\s*[:,-]?/gi,
      " ",
    );
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
  committedActivityIds: ReadonlySet<string> = new Set(),
): TutorAnswer {
  if (crossesHelperBoundary(query)) {
    return {
      text:
        "I can explain or answer questions from this page, but I cannot teach lessons, choose or arrange course material, create course content or assessments, grade work, or unlock progress. Ask me about a term or mechanism visible here.",
      sources: [],
      retrievalMode: "page-context",
    };
  }

  if (unfinishedPredictionTargeted(query, lesson, committedActivityIds)) {
    return {
      text: unfinishedPredictionBoundary,
      sources: [],
      retrievalMode: "page-context",
    };
  }

  if (referencesAnotherPage(query, lesson)) {
    return {
      text:
        "I can only answer from the current page and its exact authored paragraphs. Ask the question again while viewing the page you mean.",
      sources: [],
      retrievalMode: "page-context",
    };
  }

  const pageQuery = withoutCurrentPageReference(query, lesson);
  const isFollowUp = isContextualFollowUp(pageQuery);
  const exchange = isFollowUp
    ? latestGroundedExchange(history, lesson)
    : undefined;
  if (isFollowUp && !exchange && !hasStandaloneSubject(pageQuery)) {
    return {
      text:
        "Which term or mechanism on this page do you mean? Name it, and I will answer from the exact authored paragraphs.",
      sources: [],
      retrievalMode: "page-context",
    };
  }
  const directSources = retrieveLessonContext(
    pageQuery,
    lesson,
    activeBlockId,
  );
  const hasNewSubject = hasStandaloneSubject(pageQuery);
  if (
    exchange &&
    hasNewSubject &&
    directSources.length === 0
  ) {
    return {
      text:
        "This page does not contain enough information to answer that follow-up. Ask about a term or mechanism stated on the current page.",
      sources: [],
      retrievalMode: "page-context",
    };
  }
  const expandedSources = exchange
    ? retrieveLessonContext(
        `${exchange.question} ${pageQuery}`,
        lesson,
        activeBlockId,
      )
    : [];
  const sources = exchange
    ? hasNewSubject
      ? mergeSources(directSources, exchange.sources, expandedSources)
      : exchange.sources
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

  const matchedCase = retrieveQuestionCase(pageQuery);
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
