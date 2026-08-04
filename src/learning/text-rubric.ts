import type {
  TextResponseActivity,
  TextRubricCriterion,
} from "../content/types";
import type { ExplanationAssessment } from "./types";

const NEGATION_WORDS = new Set([
  "neither",
  "never",
  "no",
  "nor",
  "not",
  "without",
]);

const POLARITY_AUXILIARIES = new Set([
  "are",
  "be",
  "been",
  "being",
  "can",
  "could",
  "did",
  "do",
  "does",
  "is",
  "should",
  "was",
  "were",
  "will",
  "would",
]);

const STRUCTURE_WORDS = new Set([
  "a",
  "after",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "because",
  "before",
  "between",
  "by",
  "does",
  "for",
  "from",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "of",
  "on",
  "so",
  "than",
  "that",
  "the",
  "then",
  "therefore",
  "these",
  "this",
  "those",
  "through",
  "to",
  "toward",
  "was",
  "were",
  "when",
  "which",
  "while",
  "with",
]);

const RELATION_WORDS = [
  "affect",
  "become",
  "cause",
  "change",
  "compare",
  "compute",
  "decrease",
  "depend",
  "equal",
  "evaluate",
  "fit",
  "give",
  "grow",
  "improve",
  "increase",
  "keep",
  "lead",
  "learn",
  "lower",
  "make",
  "mean",
  "move",
  "multiply",
  "prevent",
  "produce",
  "raise",
  "reduce",
  "remain",
  "represent",
  "require",
  "select",
  "show",
  "shrink",
  "stop",
  "use",
  "vary",
  "yield",
];

interface Clause {
  raw: string;
  tokens: string[];
  keywordTokenIndices: Set<number>;
}

interface PhraseMatch {
  phrase: string;
  start: number;
  end: number;
  negationIndex?: number;
  explicitNegation: boolean;
}

interface CriterionSupport {
  matches: PhraseMatch[];
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/\bwon['’]t\b/g, "will not")
    .replace(/\bcan['’]t\b/g, "can not")
    .replace(/\bcannot\b/g, "can not")
    .replace(/n['’]t\b/g, " not")
    .replace(/[^a-z0-9+\-×ŷ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const normalized = normalize(value);
  return normalized ? normalized.split(" ") : [];
}

function hasGlobalRetraction(value: string) {
  const normalized = normalize(value);
  return [
    /\b(?:everything|all|the statements|the claims|the points)(?: i said)?(?: above| before| previously| preceding)? (?:is|are|was|were) (?:false|wrong|incorrect|untrue)\b/,
    /\bnone of (?:that|this|the above|what i said) (?:is|was) (?:true|correct)\b/,
    /\b(?:ignore|disregard|retract) (?:everything|all|the above|what i said)\b/,
  ].some((pattern) => pattern.test(normalized));
}

function tokenMatches(value: string, keyword: string) {
  if (value === keyword) return true;
  if (keyword.length < 3 || NEGATION_WORDS.has(keyword)) return false;
  if (value.startsWith(keyword)) return true;

  return (
    keyword.endsWith("e") &&
    value.startsWith(`${keyword.slice(0, -1)}ing`)
  );
}

function findTokenSequences(tokens: string[], phraseTokens: string[]) {
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) {
    return [];
  }

  const starts: number[] = [];
  for (
    let start = 0;
    start <= tokens.length - phraseTokens.length;
    start += 1
  ) {
    const matches = phraseTokens.every((keyword, offset) =>
      tokenMatches(tokens[start + offset] ?? "", keyword),
    );
    if (matches) starts.push(start);
  }
  return starts;
}

function localNegationIndex(tokens: string[], start: number) {
  const lowerBound = Math.max(0, start - 5);
  for (let index = start - 1; index >= lowerBound; index -= 1) {
    const token = tokens[index];
    if (!token || !NEGATION_WORDS.has(token)) continue;
    if (
      token === "not" &&
      ["just", "merely", "only"].includes(tokens[index + 1] ?? "")
    ) {
      continue;
    }
    return index;
  }
  return undefined;
}

function phraseMatches(clause: Clause, phrase: string): PhraseMatch[] {
  const phraseTokens = tokenize(phrase);
  const explicitNegationOffset = phraseTokens.findIndex((token) =>
    NEGATION_WORDS.has(token),
  );

  return findTokenSequences(clause.tokens, phraseTokens).map((start) => {
    const explicitNegation = explicitNegationOffset >= 0;
    return {
      phrase,
      start,
      end: start + phraseTokens.length,
      explicitNegation,
      negationIndex: explicitNegation
        ? start + explicitNegationOffset
        : localNegationIndex(clause.tokens, start),
    };
  });
}

function splitClauses(value: string): Clause[] {
  return value
    .replace(
      /\s*,?\s*\b(?:but|however|nevertheless|whereas|yet)\b\s*/gi,
      "\n",
    )
    .split(/(?:[!?;]+|\.(?!\d)|\n+)/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => ({
      raw,
      tokens: tokenize(raw),
      keywordTokenIndices: new Set<number>(),
    }));
}

function withAdjacentClauseWindows(clauses: Clause[]) {
  return clauses.flatMap((clause, index) => {
    const next = clauses[index + 1];
    if (!next) return [clause];
    return [
      clause,
      {
        raw: `${clause.raw}. ${next.raw}`,
        tokens: [...clause.tokens, ...next.tokens],
        keywordTokenIndices: new Set<number>(),
      },
    ];
  });
}

function authoredVocabulary(activity: TextResponseActivity) {
  return new Set(
    tokenize(
      [
        activity.prompt,
        activity.guidance,
        ...activity.rubric.criteria.flatMap((criterion) => [
          criterion.label,
          ...criterion.keywordGroups.flat(),
        ]),
      ].join(" "),
    ),
  );
}

function isCoherentClause(
  clause: Clause,
  matches: PhraseMatch[],
  vocabulary: Set<string>,
) {
  const commaFragments = clause.raw
    .split(",")
    .map((fragment) => tokenize(fragment))
    .filter((tokens) => tokens.length > 0);
  const isShortCommaList =
    commaFragments.length >= 3 &&
    commaFragments.every((tokens) => tokens.length <= 3);
  if (isShortCommaList || clause.tokens.length < 3) return false;

  const relationIndices = clause.tokens
    .map((token, index) =>
      POLARITY_AUXILIARIES.has(token) ||
      RELATION_WORDS.some((relation) => tokenMatches(token, relation))
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  if (relationIndices.length === 0) return false;

  const contextualIndices = clause.tokens
    .map((token, index) =>
      !clause.keywordTokenIndices.has(index) &&
      vocabulary.has(token) &&
      !STRUCTURE_WORDS.has(token) &&
      !NEGATION_WORDS.has(token) &&
      !POLARITY_AUXILIARIES.has(token) &&
      !RELATION_WORDS.some((relation) => tokenMatches(token, relation))
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  if (contextualIndices.length === 0) return false;

  return relationIndices.some((relationIndex) => {
    const matchedBefore = matches.some(
      (match) => match.end <= relationIndex,
    );
    const matchedAfter = matches.some(
      (match) => match.start > relationIndex,
    );
    const relationIsMatched = matches.some(
      (match) =>
        match.start <= relationIndex && relationIndex < match.end,
    );
    const authoredBefore = contextualIndices.some(
      (index) => index < relationIndex,
    );
    const authoredAfter = contextualIndices.some(
      (index) => index > relationIndex,
    );

    if (matchedBefore && matchedAfter) return true;
    if (!relationIsMatched) return false;
    return (
      (matchedBefore && authoredAfter) ||
      (authoredBefore && matchedAfter) ||
      (authoredBefore && authoredAfter)
    );
  });
}

function markKeywordTokens(
  clauses: Clause[],
  criteria: TextRubricCriterion[],
) {
  const phrases = criteria.flatMap((criterion) =>
    criterion.keywordGroups.flat(),
  );

  for (const clause of clauses) {
    for (const phrase of phrases) {
      const phraseTokens = tokenize(phrase);
      for (const start of findTokenSequences(clause.tokens, phraseTokens)) {
        for (let offset = 0; offset < phraseTokens.length; offset += 1) {
          clause.keywordTokenIndices.add(start + offset);
        }
      }
    }
  }
}

function supportInClause(
  criterion: TextRubricCriterion,
  clause: Clause,
  vocabulary: Set<string>,
): CriterionSupport | undefined {
  const candidates = criterion.keywordGroups.map((group) =>
    group.flatMap((phrase) => phraseMatches(clause, phrase)),
  );
  const explicitNegationIndices = new Set(
    candidates
      .flat()
      .filter((match) => match.explicitNegation)
      .map((match) => match.negationIndex)
      .filter((index): index is number => index !== undefined),
  );

  const matches: PhraseMatch[] = [];
  for (const groupCandidates of candidates) {
    const allowed = groupCandidates.filter(
      (match) =>
        match.explicitNegation ||
        match.negationIndex === undefined ||
        explicitNegationIndices.has(match.negationIndex),
    );
    if (allowed.length === 0) return undefined;

    allowed.sort(
      (left, right) =>
        Number(right.explicitNegation) -
          Number(left.explicitNegation) ||
        left.start - right.start,
    );
    const selected = allowed[0];
    if (!selected) return undefined;
    matches.push(selected);
  }

  if (!isCoherentClause(clause, matches, vocabulary)) {
    return undefined;
  }

  return { matches };
}

function corePhraseTokens(phrase: string) {
  return tokenize(phrase).filter(
    (token) =>
      !NEGATION_WORDS.has(token) &&
      !POLARITY_AUXILIARIES.has(token),
  );
}

function corePolarities(clause: Clause, match: PhraseMatch) {
  const coreTokens = corePhraseTokens(match.phrase);
  return findTokenSequences(clause.tokens, coreTokens).map((start) =>
    localNegationIndex(clause.tokens, start) === undefined
      ? "positive"
      : "negative",
  );
}

function supportIsContradicted(
  support: CriterionSupport,
  clauses: Clause[],
) {
  const supportPolarities = support.matches.map((match) =>
    match.negationIndex === undefined ? "positive" : "negative",
  );

  return clauses.some((clause) => {
    const clausePolarities = support.matches.map((match) =>
      corePolarities(clause, match),
    );
    if (clausePolarities.some((polarities) => polarities.length === 0)) {
      return false;
    }

    return clausePolarities.some((polarities, index) =>
      polarities.some(
        (polarity) => polarity !== supportPolarities[index],
      ),
    );
  });
}

function matchesCriterion(
  criterion: TextRubricCriterion,
  clauses: Clause[],
  vocabulary: Set<string>,
) {
  const supports = clauses
    .map((clause) => supportInClause(criterion, clause, vocabulary))
    .filter((support): support is CriterionSupport => support !== undefined);

  return supports.some(
    (support) => !supportIsContradicted(support, clauses),
  );
}

export function assessTextResponse(
  activity: TextResponseActivity,
  response: string,
): ExplanationAssessment {
  if (hasGlobalRetraction(response)) {
    return {
      assessmentMode: "structure",
      level: "unsupported",
      matchedCriteria: [],
      missingCriteria: activity.rubric.criteria.map((criterion) => criterion.id),
      uncertainCriteria: [],
      feedback:
        "The response retracts its own claims. Submit one consistent explanation so the authored criteria can be checked.",
    };
  }

  const clauses = withAdjacentClauseWindows(splitClauses(response));
  markKeywordTokens(clauses, activity.rubric.criteria);
  const vocabulary = authoredVocabulary(activity);
  const matchedCriteria = activity.rubric.criteria
    .filter((criterion) =>
      matchesCriterion(criterion, clauses, vocabulary)
    )
    .map((criterion) => criterion.id);
  const missing = activity.rubric.criteria.filter(
    (criterion) => !matchedCriteria.includes(criterion.id),
  );

  if (matchedCriteria.length === activity.rubric.criteria.length) {
    return {
      assessmentMode: "structure",
      level: "partial",
      matchedCriteria,
      missingCriteria: [],
      uncertainCriteria: [],
      feedback: `All ${matchedCriteria.length} authored elements were found. This local structure check cannot verify causal meaning or correctness; compare the draft with the authored criteria and worked mechanism.`,
    };
  }

  if (matchedCriteria.length > 0) {
    return {
      assessmentMode: "structure",
      level: "partial",
      matchedCriteria,
      missingCriteria: missing.map((criterion) => criterion.id),
      uncertainCriteria: [],
      feedback: `${matchedCriteria.length} of ${activity.rubric.criteria.length} authored criteria matched. Now ${missing[0]?.label ?? "complete the causal link"}.`,
    };
  }

  return {
    assessmentMode: "structure",
    level: "unsupported",
    matchedCriteria,
    missingCriteria: missing.map((criterion) => criterion.id),
    uncertainCriteria: [],
    feedback: `No authored criteria matched yet. ${activity.rubric.unsupportedFeedback}`,
  };
}
