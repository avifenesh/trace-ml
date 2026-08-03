import {
  pageChunksForLesson,
  type Lesson,
  type PageChunk,
} from "../content/types";

export interface RetrievedContext {
  chunkId: string;
  blockId: string;
  heading: string;
  excerpt: string;
  conceptIds: PageChunk["conceptIds"];
  score: number;
}

const ACTIVE_BLOCK_BOOST = 0.25;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "about",
  "are",
  "can",
  "clarify",
  "difference",
  "does",
  "do",
  "explain",
  "for",
  "how",
  "i",
  "in",
  "is",
  "it",
  "model",
  "much",
  "of",
  "on",
  "or",
  "please",
  "simplify",
  "that",
  "the",
  "them",
  "these",
  "they",
  "this",
  "those",
  "tell",
  "to",
  "what",
  "we",
  "why",
]);

function stem(token: string) {
  if (token.length > 7 && token.endsWith("tion")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokens(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .map(stem);
}

function normalizedText(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchChunk(queryTokens: string[], chunk: PageChunk) {
  const headingTokens = new Set(tokens(chunk.heading));
  const tagTokens = new Set(chunk.tags.flatMap(tokens));
  const textTokens = new Set(tokens(chunk.text));
  let matchedTokens = 0;

  const score = queryTokens.reduce((total, token) => {
    const tokenScore =
      (headingTokens.has(token) ? 5 : 0) +
      (tagTokens.has(token) ? 4 : 0) +
      (textTokens.has(token) ? 1 : 0);
    if (tokenScore > 0) matchedTokens += 1;
    return total + tokenScore;
  }, 0);
  return { score, matchedTokens };
}

function hasEnoughGrounding(
  queryTokenCount: number,
  matchedTokens: number,
) {
  if (queryTokenCount === 0) return false;
  if (queryTokenCount === 1) return matchedTokens === 1;
  if (queryTokenCount === 2) return matchedTokens === 2;
  return matchedTokens >= 2 && matchedTokens / queryTokenCount >= 0.6;
}

function contextFromChunk(chunk: PageChunk, score: number): RetrievedContext {
  return {
    chunkId: chunk.id,
    blockId: chunk.blockId,
    heading: chunk.heading,
    excerpt: chunk.text,
    conceptIds: chunk.conceptIds,
    score,
  };
}

export function retrieveLessonContext(
  query: string,
  lesson: Lesson,
  activeBlockId?: string,
  limit = 3,
): RetrievedContext[] {
  const queryTokens = [...new Set(tokens(query))];
  const authoredStarter = lesson.starterQuestions?.some(
    (question) => normalizedText(question) === normalizedText(query),
  ) ?? false;
  return pageChunksForLesson(lesson)
    .map((chunk, index) => {
      const match = matchChunk(queryTokens, chunk);
      return {
        context: contextFromChunk(
          chunk,
          match.score +
            (chunk.blockId === activeBlockId ? ACTIVE_BLOCK_BOOST : 0),
        ),
        index,
        relevanceScore: match.score,
        matchedTokens: match.matchedTokens,
      };
    })
    .filter((result) =>
      authoredStarter
        ? result.relevanceScore > 0
        : hasEnoughGrounding(queryTokens.length, result.matchedTokens)
    )
    .sort(
      (a, b) => b.context.score - a.context.score || a.index - b.index,
    )
    .slice(0, limit)
    .map((result) => result.context);
}

export function retrieveLessonContextByChunkIds(
  lesson: Lesson,
  chunkIds: readonly string[],
  limit = 3,
): RetrievedContext[] {
  const chunksById = new Map(
    pageChunksForLesson(lesson).map((chunk) => [chunk.id, chunk]),
  );
  const seen = new Set<string>();
  const contexts: RetrievedContext[] = [];

  for (const chunkId of chunkIds) {
    const chunk = chunksById.get(chunkId);
    if (!chunk || seen.has(chunkId)) continue;
    seen.add(chunkId);
    contexts.push(contextFromChunk(chunk, 0));
    if (contexts.length === limit) break;
  }

  return contexts;
}
