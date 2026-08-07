/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLearnerRecord,
} from "../learning/evidence";
import {
  activityEvidenceConceptIds,
  lessonState,
} from "../learning/progression";
import type {
  ConceptId,
  EvidenceKind,
} from "../learning/types";
import {
  courseModules,
  getLesson,
  lessons,
} from "./course";
import { CAPSTONE_INCIDENT } from "./capstone-incident";
import {
  COURSE_REVISION,
  lessonRevision,
  PYODIDE_ENVIRONMENT,
} from "./lesson-helpers";
import {
  lessonContextForAssessment,
  pageChunksForLesson,
  teachingBlockIdForLesson,
  teachingChunksForLesson,
  type LessonActivity,
} from "./types";

const EXPECTED_MODULES = [
  {
    id: "foundations",
    number: "I",
    lessonIds: [
      "prerequisite-trace",
      "data-and-baseline",
      "linear-model",
      "loss-landscape",
    ],
  },
  {
    id: "learning",
    number: "II",
    lessonIds: [
      "gradient-descent",
      "split-and-leakage",
      "capacity-curves",
    ],
  },
  {
    id: "models",
    number: "III",
    lessonIds: [
      "logistic-link",
      "decision-costs",
      "feature-pipeline",
    ],
  },
  {
    id: "classical",
    number: "IV",
    lessonIds: [
      "knn-versus-tree",
      "regularization-path",
      "ensemble-votes",
    ],
  },
  {
    id: "neural",
    number: "V",
    lessonIds: [
      "xor-hidden-space",
      "backprop-graph",
      "optimizer-traces",
    ],
  },
  {
    id: "representation",
    number: "VI",
    lessonIds: [
      "cluster-project",
      "convolution-field",
      "attention-routing",
    ],
  },
  {
    id: "systems",
    number: "VII",
    lessonIds: [
      "q-learning",
      "shift-monitor",
    ],
  },
] as const;

const EXPECTED_LESSON_IDS = EXPECTED_MODULES.flatMap(
  (module) => module.lessonIds,
);
const EXPECTED_SOURCE_IDS = Array.from(
  { length: 110 },
  (_, index) => `S${String(index + 1).padStart(2, "0")}`,
);
const CODE_LAB_LESSON_IDS = [
  "prerequisite-trace",
  ...EXPECTED_LESSON_IDS.slice(3),
];
const SCIENTIFIC_PACKAGE_LABS = new Map([
  ["00-python-numpy-plot", ["numpy"]],
  ["pipeline-python-lab", ["scikit-learn"]],
  ["regularization-python-lab", ["scikit-learn"]],
  ["backprop-python-lab", ["autograd"]],
  ["optimizer-python-lab", ["numpy"]],
]);
const RESEARCH_ONLY_SOURCE_IDS = [
  "S01",
  "S07",
  "S09",
  "S10",
  "S12",
  "S54",
  "S64",
  "S105",
  "S106",
  "S107",
  "S108",
  "S109",
];
const RUNTIME_MATCHED_SOURCE_URLS = new Map([
  ["S58", "https://numpy.org/doc/2.4/user/whatisnumpy.html"],
  [
    "S72",
    "https://scikit-learn.org/1.8/auto_examples/model_selection/plot_learning_curve.html",
  ],
  [
    "S77",
    "https://scikit-learn.org/1.8/modules/compose.html#pipeline-chaining-estimators",
  ],
  [
    "S79",
    "https://scikit-learn.org/1.8/auto_examples/classification/plot_classifier_comparison.html",
  ],
  [
    "S81",
    "https://scikit-learn.org/1.8/auto_examples/linear_model/plot_lasso_model_selection.html",
  ],
]);

const LEGACY_CONCEPT_IDS = new Set<string>([
  "input-versus-parameter",
  "target-versus-prediction",
  "model-versus-learning-algorithm",
  "linear-rule",
  "prediction-error",
  "examples-as-evidence",
  "train-test-split",
  "python-model",
  "evaluation-metrics",
  "model-selection",
  "end-to-end-project",
]);

const FORBIDDEN_METADATA_KEYS = new Set([
  "availableAfterLessonId",
  "availableAfterLessonIds",
  "generated",
  "generatedAt",
  "generatedBy",
  "generationModel",
  "generationPrompt",
  "generator",
  "isGenerated",
  "isLocked",
  "isUnlocked",
  "lock",
  "locked",
  "lockReason",
  "prerequisiteLessonId",
  "prerequisiteLessonIds",
  "unlockCondition",
  "unlockConditions",
  "unlockCriteria",
  "unlocked",
]);

interface ResearchSource {
  id: string;
  url: string;
  title: string;
  publisher: string;
  verifiedAt: string;
  media?: {
    platform: string;
    videoId: string;
    title: string;
    channel: string;
    durationSeconds: number;
    durationLabel: string;
    verifiedAt: string;
  };
}

interface ResearchRegistry {
  generated: string;
  totalSources: number;
  sources: ResearchSource[];
}

const researchRegistry = JSON.parse(
  readFileSync(
    new URL(
      "../../agent-knowledge/resources/ml-course-research-sources.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as ResearchRegistry;

const proseAssessmentManifest = JSON.parse(
  readFileSync(
    new URL(
      "../../src-tauri/prose-assessment-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown[];

const lessonHelperManifest = JSON.parse(
  readFileSync(
    new URL(
      "../../src-tauri/lesson-helper-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown[];

const allOutcomes = lessons.flatMap((lesson) => lesson.outcomes);
const allBlocks = lessons.flatMap((lesson) => lesson.blocks);
const allActivities = lessons.flatMap((lesson) => lesson.activities);
const allResources = lessons.flatMap((lesson) => lesson.resources);
const predictionActivities = allActivities.filter(
  (activity) => activity.kind === "prediction",
);
const visualLabs = allActivities.filter(
  (activity) => activity.kind === "visual-lab",
);
const textResponses = allActivities.filter(
  (activity) => activity.kind === "text-response",
);
const codeLabs = allActivities.filter(
  (activity) => activity.kind === "code-lab",
);
const allCodeChecks = codeLabs.flatMap((activity) => activity.spec.checks);

function expectUnique(values: string[]) {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );
  expect([...new Set(duplicates)]).toEqual([]);
}

function expectNonBlank(value: string) {
  expect(value.trim()).not.toBe("");
}

function wordCount(values: string[]) {
  return values
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeProse(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function helperActivityContext(activity: LessonActivity) {
  switch (activity.kind) {
    case "prediction":
      return [];
    case "text-response":
      return [
        `Explanation prompt: ${activity.prompt}`,
        `Explanation guidance: ${activity.guidance}`,
      ];
    case "visual-lab":
      return [
        `Visual lab: ${activity.title}`,
        activity.prompt,
        activity.invariant ? `Fixed quantities: ${activity.invariant}` : "",
        activity.intervention
          ? `Learner-controlled change: ${activity.intervention}`
          : "",
        activity.control
          ? `Control: ${activity.control.label}, from ${activity.control.lowLabel} to ${activity.control.highLabel}`
          : "",
      ].filter(Boolean);
    case "code-lab":
      return [
        `Code lab instructions: ${activity.spec.instructions}`,
        ...activity.spec.starterFiles.map(
          (file) => `Authored starter file ${file.path}:\n${file.contents}`,
        ),
      ];
  }
}

function forbiddenMetadataPaths(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      forbiddenMetadataPaths(item, `${path}[${index}]`)
    );
  }
  if (value === null || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, nestedValue]) => [
    ...(FORBIDDEN_METADATA_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenMetadataPaths(nestedValue, `${path}.${key}`),
  ]);
}

function lessonConcepts(lessonIndex: number): Set<ConceptId> {
  const lesson = lessons[lessonIndex];
  if (!lesson) throw new Error(`Missing lesson at index ${lessonIndex}`);

  return new Set([
    ...lesson.outcomes.map((outcome) => outcome.conceptId),
    ...lesson.blocks.flatMap((block) => block.conceptIds),
    ...lesson.activities.flatMap((activity) => activity.conceptIds),
  ]);
}

function supportsEvidence(
  lessonIndex: number,
  conceptId: ConceptId,
  kind: EvidenceKind,
) {
  const lesson = lessons[lessonIndex];
  if (!lesson) return false;
  return lesson.activities.some(
    (activity) => {
      const conceptIds =
        activity.kind === "code-lab"
          ? activity.conceptIds
          : activityEvidenceConceptIds(activity);
      return (
        activity.evidenceKind === kind &&
        conceptIds.includes(conceptId)
      );
    },
  );
}

describe("fixed authored course integrity", () => {
  it("keeps the compiled lesson-helper authority synchronized", () => {
    const expected = lessons.map((lesson) => ({
      lessonId: lesson.id,
      lessonRevision: lesson.revision ?? "unversioned",
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      lessonQuestion: lesson.question,
      lessonSummary: lesson.summary,
      mechanism: lesson.mechanism ?? null,
      chunks: pageChunksForLesson(lesson).map((chunk) => ({
        id: chunk.id,
        blockId: chunk.blockId,
        heading: chunk.heading,
        text: chunk.text,
        tags: chunk.tags,
      })),
      activityContext: lesson.activities.flatMap(helperActivityContext),
    }));

    expect(lessonHelperManifest).toEqual(expected);
  });

  it("keeps the compiled prose-assessment authority synchronized", () => {
    const expected = lessons.flatMap((lesson) => {
      const lessonContext = lessonContextForAssessment(lesson);
      return lesson.activities
        .filter((activity) => activity.kind === "text-response")
        .map((activity) => ({
          lessonId: lesson.id,
          lessonRevision: lesson.revision ?? "unversioned",
          lessonTitle: lesson.title,
          lessonContext,
          activityId: activity.id,
          activityPrompt: activity.prompt,
          activityGuidance: activity.guidance,
          criteria: activity.rubric.criteria.map(({ id, label }) => ({
            id,
            label,
          })),
          demonstratedFeedback: activity.rubric.demonstratedFeedback,
          unsupportedFeedback: activity.rubric.unsupportedFeedback,
        }));
    });

    expect(proseAssessmentManifest).toEqual(expected);
  });

  it("preserves the exact 21-lesson spine and module ordering", () => {
    expect(lessons).toHaveLength(21);
    expect(lessons.map((lesson) => lesson.id)).toEqual(EXPECTED_LESSON_IDS);
    expect(lessons.map((lesson) => lesson.number)).toEqual(
      EXPECTED_LESSON_IDS.map((_, index) =>
        String(index).padStart(2, "0")
      ),
    );
    expectUnique(lessons.map((lesson) => lesson.id));
    EXPECTED_MODULES.forEach((module) => {
      module.lessonIds.forEach((lessonId) => {
        expect(getLesson(lessonId)?.moduleId, lessonId).toBe(module.id);
      });
    });
    expectUnique(lessons.map((lesson) => lesson.number));

    expect(
      courseModules.map(({ id, number, lessonIds }) => ({
        id,
        number,
        lessonIds,
      })),
    ).toEqual(EXPECTED_MODULES);
    expect(courseModules.flatMap((module) => module.lessonIds)).toEqual(
      EXPECTED_LESSON_IDS,
    );
    expectUnique(courseModules.map((module) => module.id));
    expectUnique(courseModules.flatMap((module) => module.lessonIds));

    courseModules.forEach((module) => {
      expectNonBlank(module.title);
      expectNonBlank(module.purpose);
    });
  });

  it("keeps every lesson published, immediately accessible, and authored", () => {
    const emptyRecord = createLearnerRecord();

    lessons.forEach((lesson) => {
      expect(lesson.published, lesson.id).toBe(true);
      expect(lesson.revision, lesson.id).toBe(lessonRevision(lesson.id));
      expect(
        lessonState(lesson, "__no-active-lesson__", emptyRecord),
        lesson.id,
      ).toBe("available");
      expect(lesson, lesson.id).not.toHaveProperty("checkpoint");
    });

    expect(
      forbiddenMetadataPaths({
        courseModules,
        lessons,
      }),
    ).toEqual([]);
  });

  it("protects authored content counts, IDs, and page chunks", () => {
    expect(allOutcomes).toHaveLength(64);
    expect(allBlocks).toHaveLength(98);
    expect(allActivities).toHaveLength(104);
    expect(predictionActivities).toHaveLength(21);
    expect(visualLabs).toHaveLength(21);
    expect(textResponses).toHaveLength(43);
    expect(codeLabs).toHaveLength(19);
    expect(allResources).toHaveLength(41);
    expect(
      allResources.filter((resource) => resource.kind === "reading"),
    ).toHaveLength(23);
    expect(
      allResources.filter((resource) => resource.kind === "interactive"),
    ).toHaveLength(12);
    expect(
      allResources.filter((resource) => resource.kind === "video"),
    ).toHaveLength(2);
    expect(
      allResources.filter(
        (resource) => resource.kind === "video-and-reading",
      ),
    ).toHaveLength(4);
    expect(allCodeChecks).toHaveLength(93);

    expectUnique(allOutcomes.map((outcome) => outcome.id));
    expectUnique(allBlocks.map((block) => block.id));
    expectUnique(allActivities.map((activity) => activity.id));
    expectUnique(allResources.map((resource) => resource.id));
    expectUnique(allCodeChecks.map((check) => check.id));

    const allPageChunkIds: string[] = [];

    lessons.forEach((lesson, index) => {
      expectNonBlank(lesson.title);
      expectNonBlank(lesson.question);
      expectNonBlank(lesson.summary);
      expect(lesson.durationMinutes).toBeGreaterThan(0);
      expect(lesson.starterQuestions).toHaveLength(3);
      lesson.starterQuestions?.forEach(expectNonBlank);

      expect(lesson.mechanism, lesson.id).toBeDefined();
      if (!lesson.mechanism) throw new Error(`Missing mechanism: ${lesson.id}`);
      expectNonBlank(lesson.mechanism.input);
      expectNonBlank(lesson.mechanism.process);
      expectNonBlank(lesson.mechanism.output);

      const teaching = lesson.teaching;
      expectNonBlank(teaching.title);
      expect(teaching.introduction.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(teaching.introduction.length, lesson.id).toBeLessThanOrEqual(5);
      teaching.introduction.forEach((paragraph) => {
        expectNonBlank(paragraph);
        expect(wordCount([paragraph]), lesson.id).toBeGreaterThanOrEqual(25);
      });
      expect(teaching.vocabulary.length, lesson.id).toBeGreaterThanOrEqual(4);
      expect(teaching.vocabulary.length, lesson.id).toBeLessThanOrEqual(8);
      expectUnique(
        teaching.vocabulary.map(({ term }) => term.toLocaleLowerCase()),
      );
      teaching.vocabulary.forEach(({ term, definition }) => {
        expectNonBlank(term);
        expectNonBlank(definition);
        expect(wordCount([definition]), `${lesson.id}:${term}`).toBeGreaterThan(
          5,
        );
      });
      expectNonBlank(teaching.workedExample.title);
      expectNonBlank(teaching.workedExample.setup);
      expect(
        teaching.workedExample.steps.length,
        lesson.id,
      ).toBeGreaterThanOrEqual(4);
      expect(
        teaching.workedExample.steps.length,
        lesson.id,
      ).toBeLessThanOrEqual(6);
      expectUnique(
        teaching.workedExample.steps.map(({ label }) =>
          label.toLocaleLowerCase()
        ),
      );
      teaching.workedExample.steps.forEach(({ label, explanation }) => {
        expectNonBlank(label);
        expectNonBlank(explanation);
      });
      expectNonBlank(teaching.workedExample.takeaway);
      expect(
        teaching.misconceptions.length,
        lesson.id,
      ).toBeGreaterThanOrEqual(2);
      expect(
        teaching.misconceptions.length,
        lesson.id,
      ).toBeLessThanOrEqual(3);
      teaching.misconceptions.forEach(({ misconception, correction }) => {
        expectNonBlank(misconception);
        expectNonBlank(correction);
      });
      expect(teaching.summary.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(teaching.summary.length, lesson.id).toBeLessThanOrEqual(5);
      teaching.summary.forEach(expectNonBlank);
      expect(teaching.sourceIds.length, lesson.id).toBeGreaterThan(0);
      expectUnique(teaching.sourceIds);
      teaching.sourceIds.forEach((sourceId) => {
        expect(lesson.sourceIds, `${lesson.id}:${sourceId}`).toContain(sourceId);
      });
      const teachingProse = [
        ...teaching.introduction,
        ...teaching.vocabulary.map(({ definition }) => definition),
        teaching.workedExample.setup,
        ...teaching.workedExample.steps.map(({ explanation }) => explanation),
        teaching.workedExample.takeaway,
        ...teaching.misconceptions.map(({ correction }) => correction),
        ...teaching.summary,
      ];
      expectUnique(teachingProse.map(normalizeProse));
      const readingProse = new Set(
        lesson.blocks.flatMap((block) => block.body).map(normalizeProse),
      );
      teachingProse.forEach((paragraph) => {
        expect(
          readingProse.has(normalizeProse(paragraph)),
          `${lesson.id} duplicates teaching prose in the reading`,
        ).toBe(false);
      });
      expect(lesson.durationMinutes, lesson.id).toBeGreaterThanOrEqual(45);

      expect(lesson.blocks, lesson.id).toHaveLength(index < 7 ? 4 : 5);
      expect(lesson.blocks[0]?.kind, lesson.id).toBe("opening");
      expect(
        lesson.blocks.filter((block) => block.kind === "opening"),
        lesson.id,
      ).toHaveLength(1);
      expect(lesson.outcomes, lesson.id).toHaveLength(
        lesson.id === "linear-model"
          ? 2
          : lesson.id === "prerequisite-trace" ||
              lesson.id === "shift-monitor"
            ? 4
            : 3,
      );
      expect(lesson.resources, lesson.id).toHaveLength(
        lesson.id === "data-and-baseline" ? 1 : 2,
      );
      lesson.outcomes.forEach((outcome) => {
        expectNonBlank(outcome.id);
        expectNonBlank(outcome.text);
        expect(outcome.requiredEvidenceKinds.length).toBeGreaterThan(0);
        expectUnique(outcome.requiredEvidenceKinds);
      });

      lesson.blocks.forEach((block) => {
        expectNonBlank(block.id);
        expectNonBlank(block.heading);
        expect(block.body.length).toBeGreaterThan(0);
        block.body.forEach(expectNonBlank);
        expect(block.conceptIds.length).toBeGreaterThan(0);
        expect(block.tags.length).toBeGreaterThan(0);
        block.tags.forEach(expectNonBlank);
        expect(block.sourceIds.length).toBeGreaterThan(0);
        expectUnique(block.sourceIds);
      });

      const chunks = pageChunksForLesson(lesson);
      expect(chunks).toHaveLength(
        teachingChunksForLesson(lesson).length +
          lesson.blocks.reduce((total, block) => total + block.body.length, 0),
      );
      chunks.forEach((chunk) => {
        if (chunk.blockId === teachingBlockIdForLesson(lesson)) {
          expect(chunk.id).toMatch(
            new RegExp(
              `^${chunk.blockId}:(?:introduction|term|example-step|misconception|summary)-\\d+$|^${chunk.blockId}:example-(?:setup|takeaway)$`,
            ),
          );
        } else {
          expect(chunk.id).toMatch(new RegExp(`^${chunk.blockId}:p\\d+$`));
        }
        expectNonBlank(chunk.heading);
        expectNonBlank(chunk.text);
      });
      expectUnique(chunks.map((chunk) => chunk.id));
      allPageChunkIds.push(...chunks.map((chunk) => chunk.id));
    });

    expect(allPageChunkIds.length).toBeGreaterThan(500);
    expectUnique(allPageChunkIds);
  });

  it("keeps concepts ordered and every required evidence contract satisfiable", () => {
    const previouslyIntroduced = new Set<ConceptId>();
    const referencedConcepts: ConceptId[] = [];

    lessons.forEach((lesson, lessonIndex) => {
      lesson.prerequisiteConceptIds.forEach((conceptId) => {
        expect(
          previouslyIntroduced.has(conceptId),
          `${lesson.id} uses prerequisite ${conceptId} before introduction`,
        ).toBe(true);
      });

      const concepts = lessonConcepts(lessonIndex);
      lesson.outcomes.forEach((outcome) => {
        expect(concepts.has(outcome.conceptId)).toBe(true);
        outcome.requiredEvidenceKinds.forEach((kind) => {
          expect(
            supportsEvidence(lessonIndex, outcome.conceptId, kind),
            `${lesson.id} cannot produce ${kind} evidence for ${outcome.conceptId}`,
          ).toBe(true);
        });
      });

      const lessonReferences = [
        ...lesson.prerequisiteConceptIds,
        ...lesson.outcomes.map((outcome) => outcome.conceptId),
        ...lesson.blocks.flatMap((block) => block.conceptIds),
        ...lesson.activities.flatMap((activity) => activity.conceptIds),
        ...lesson.activities.flatMap((activity) =>
          activity.kind === "code-lab"
            ? activity.spec.checks.flatMap((check) => check.conceptIds)
            : []
        ),
      ];
      referencedConcepts.push(...lessonReferences);

      lesson.outcomes.forEach((outcome) =>
        previouslyIntroduced.add(outcome.conceptId)
      );
      lesson.blocks.forEach((block) =>
        block.conceptIds.forEach((conceptId) =>
          previouslyIntroduced.add(conceptId)
        )
      );
    });

    expect(
      [...new Set(referencedConcepts)].filter((conceptId) =>
        LEGACY_CONCEPT_IDS.has(conceptId)
      ),
    ).toEqual([]);
  });

  it("requires a complete prediction, intervention, and explanation loop", () => {
    lessons.forEach((lesson) => {
      const predictions = lesson.activities.filter(
        (activity) => activity.kind === "prediction",
      );
      const lessonVisualLabs = lesson.activities.filter(
        (activity) => activity.kind === "visual-lab",
      );
      const responses = lesson.activities.filter(
        (activity) => activity.kind === "text-response",
      );

      expect(predictions, lesson.id).toHaveLength(1);
      expect(lessonVisualLabs, lesson.id).toHaveLength(1);
      expect(responses, lesson.id).toHaveLength(
        lesson.id === "shift-monitor" ? 3 : 2,
      );
      expect(
        responses.map((response) => response.evidenceKind).sort(),
        lesson.id,
      ).toEqual(
        lesson.id === "shift-monitor"
          ? ["explanation", "explanation", "transfer"]
          : ["explanation", "transfer"],
      );

      const prediction = predictions[0];
      if (!prediction) throw new Error(`Missing prediction: ${lesson.id}`);
      expect(prediction.evidenceKind).toBe("prediction");
      expect(prediction.renderer).toBe("choice");
      expect(prediction.checkpoint.id).toBe(prediction.id);
      expectNonBlank(prediction.checkpoint.prompt);
      expect(prediction.checkpoint.options.length).toBeGreaterThanOrEqual(3);
      expectUnique(
        prediction.checkpoint.options.map((option) => option.id),
      );
      prediction.checkpoint.options.forEach((option) =>
        expectNonBlank(option.label)
      );
      expect(
        prediction.checkpoint.options.some(
          (option) =>
            option.id === prediction.checkpoint.correctOptionId,
        ),
      ).toBe(true);
      expectNonBlank(prediction.checkpoint.supportedExplanation);
      expectNonBlank(prediction.checkpoint.revisitExplanation);

      const visualLab = lessonVisualLabs[0];
      if (!visualLab) throw new Error(`Missing visual lab: ${lesson.id}`);
      expect(visualLab.labId).toBe(lesson.id);
      expect(visualLab.evidenceKind).toBe("manipulation");
      expectNonBlank(visualLab.title);
      expectNonBlank(visualLab.prompt);
      expectNonBlank(visualLab.invariant ?? "");
      expectNonBlank(visualLab.intervention ?? "");
      expect(visualLab.control, lesson.id).toBeDefined();
      if (!visualLab.control) {
        throw new Error(`Missing visual control: ${lesson.id}`);
      }
      expectNonBlank(visualLab.control.label);
      expectNonBlank(visualLab.control.lowLabel);
      expectNonBlank(visualLab.control.highLabel);
      expect(visualLab.control.min).toBeLessThan(visualLab.control.max);
      expect(visualLab.control.step).toBeGreaterThan(0);
      expect(visualLab.control.initial).toBeGreaterThanOrEqual(
        visualLab.control.min,
      );
      expect(visualLab.control.initial).toBeLessThanOrEqual(
        visualLab.control.max,
      );

      responses.forEach((response) => {
        expectNonBlank(response.prompt);
        expectNonBlank(response.guidance);
        expect(response.rubric.criteria.length).toBeGreaterThan(0);
        expectUnique(
          response.rubric.criteria.map((criterion) => criterion.id),
        );
        response.rubric.criteria.forEach((criterion) => {
          expectNonBlank(criterion.label);
          expect(criterion.keywordGroups.length).toBeGreaterThan(0);
          criterion.keywordGroups.forEach((group) => {
            expect(group.length).toBeGreaterThan(0);
            group.forEach(expectNonBlank);
          });
        });
        expectNonBlank(response.rubric.demonstratedFeedback);
        expectNonBlank(response.rubric.unsupportedFeedback);
      });

      lesson.activities.forEach((activity) => {
        const evidenceConceptIds =
          activityEvidenceConceptIds(activity);
        expect(evidenceConceptIds.length, activity.id).toBeGreaterThan(0);
        expectUnique(evidenceConceptIds);
        evidenceConceptIds.forEach((conceptId) => {
          expect(activity.conceptIds, activity.id).toContain(conceptId);
        });
      });
    });
  });

  it("pins an explicit near-transfer identity for every prediction case", () => {
    const expectedMarkers = new Map<string, string[]>([
      ["prerequisite-trace", ["3x - 2", "x = 2"]],
      ["data-and-baseline", ["18, 24, and 30", "kilowatts"]],
      ["linear-model", ["w increases from 3 to 4", "x = 5"]],
      ["loss-landscape", ["residual grows from 2 to 10"]],
      ["gradient-descent", ["w = 2", "gradient is +4", "0.25"]],
      ["split-and-leakage", ["missing-value rule", "evaluates again"]],
      ["capacity-curves", ["high-degree polynomial", "validation loss"]],
      ["logistic-link", ["bias raises the logit from 0 to 2"]],
      ["decision-costs", ["threshold falls from 0.7 to 0.4"]],
      ["feature-pipeline", ["held-out temperature is 100"]],
      ["knn-versus-tree", ["x=3.6", "k=3"]],
      ["regularization-path", ["lambda increases from 0 to 5"]],
      ["ensemble-votes", ["6, 9, and 15", "bagged average"]],
      ["xor-hidden-space", ["x1 = 2 and x2 = 0", "score s"]],
      ["backprop-graph", ["x = 3, w = 2", "dL/dw"]],
      ["optimizer-traces", ["eta = 0.75"]],
      ["cluster-project", ["1, 4, and 7", "7 to 10"]],
      ["convolution-field", ["stride 1", "two samples left"]],
      ["attention-routing", ["three allowed keys"]],
      ["q-learning", ["reward -3"]],
      ["shift-monitor", ["accelerometer", "0.8 to 7.6"]],
    ]);

    expect(expectedMarkers.size).toBe(lessons.length);
    lessons.forEach((lesson) => {
      const prediction = lesson.activities.find(
        (activity) => activity.kind === "prediction",
      );
      const markers = expectedMarkers.get(lesson.id);
      if (!prediction || !markers) {
        throw new Error(`Missing prediction novelty contract: ${lesson.id}`);
      }
      markers.forEach((marker) => {
        expect(prediction.checkpoint.prompt, `${lesson.id}:${marker}`).toContain(
          marker,
        );
      });
      expect(normalizeProse(prediction.checkpoint.prompt)).not.toBe(
        normalizeProse(lesson.teaching.workedExample.setup),
      );
    });

    [
      "gradient-descent",
      "ensemble-votes",
      "xor-hidden-space",
      "backprop-graph",
    ].forEach((lessonId) => {
      const prediction = getLesson(lessonId)?.activities.find(
        (activity) => activity.kind === "prediction",
      );
      if (!prediction || prediction.kind !== "prediction") {
        throw new Error(`Missing bare-option prediction: ${lessonId}`);
      }
      prediction.checkpoint.options.forEach((option) => {
        expect(option.label, `${lessonId}:${option.id}`).not.toMatch(/[:;]/);
      });
    });
  });

  it("pins narrowed Module VII activity evidence mappings", () => {
    const qPrediction = getLesson("q-learning")?.activities.find(
      (activity) => activity.id === "q-terminal-prediction",
    );
    const shiftVisual = getLesson("shift-monitor")?.activities.find(
      (activity) => activity.id === "shift-monitor-lab",
    );
    if (!qPrediction || !shiftVisual) {
      throw new Error("Missing Module VII evidence activities.");
    }

    expect(activityEvidenceConceptIds(qPrediction)).toEqual([
      "bellman-update",
    ]);
    expect(activityEvidenceConceptIds(shiftVisual)).toEqual([
      "distribution-shift",
      "monitoring",
    ]);
  });

  it("pins all 19 staged Python labs and their 93 executable checks", () => {
    expect(
      lessons
        .filter((lesson) =>
          lesson.activities.some((activity) => activity.kind === "code-lab")
        )
        .map((lesson) => lesson.id),
    ).toEqual(CODE_LAB_LESSON_IDS);

    expectUnique(codeLabs.map((activity) => String(activity.spec.seed)));

    codeLabs.forEach((activity) => {
      const lesson = lessons.find((candidate) =>
        candidate.activities.includes(activity)
      );
      if (!lesson) throw new Error(`Orphan code lab: ${activity.id}`);
      const lessonIndex = lessons.indexOf(lesson);
      const introducedConcepts = new Set(
        lessons.slice(0, lessonIndex + 1).flatMap((candidate) => [
          ...candidate.outcomes.map((outcome) => outcome.conceptId),
          ...candidate.blocks.flatMap((block) => block.conceptIds),
        ]),
      );

      expect(activity.evidenceKind).toBe("code-check");
      expect(activity.spec.runtimeId).toBe("pyodide-314.0.3");
      expect(activity.spec.environmentDigest).toBe(PYODIDE_ENVIRONMENT);
      expect(activity.spec.seed).toBeGreaterThan(0);
      expect(Number.isInteger(activity.spec.seed)).toBe(true);
      expect(activity.spec.timeoutMs).toBe(7_500);
      expect(activity.spec.maxOutputBytes).toBe(65_536);
      expect(activity.spec.maxOutputLines).toBe(500);
      expect(activity.spec.allowedPackages).toEqual(
        SCIENTIFIC_PACKAGE_LABS.get(activity.id) ?? [],
      );
      expectNonBlank(activity.spec.instructions);
      expect(activity.spec.starterFiles).toHaveLength(1);

      const starterFile = activity.spec.starterFiles[0];
      if (!starterFile) throw new Error(`Missing starter file: ${activity.id}`);
      expect(starterFile.path).toMatch(/^[a-z0-9_]+\.py$/);
      expect(starterFile.language).toBe("python");
      expectNonBlank(starterFile.contents);

      const expectedCheckCount = new Map([
        ["00-python-numpy-plot", 5],
        ["xor-python-lab", 3],
        ["logistic-python-lab", 5],
        ["regularization-python-lab", 6],
        ["ensemble-python-lab", 5],
        ["backprop-python-lab", 7],
        ["optimizer-python-lab", 9],
        ["cluster-python-lab", 5],
        ["q-learning-python-lab", 6],
        ["shift-monitor-python-lab", 6],
      ]).get(activity.id) ?? 4;
      expect(activity.spec.checks, lesson.id).toHaveLength(
        expectedCheckCount,
      );
      activity.spec.checks.forEach((check) => {
        expectNonBlank(check.id);
        expectNonBlank(check.label);
        expectNonBlank(check.expression);
        expect(["string", "number", "boolean"]).toContain(
          typeof check.expected,
        );
        expect(check.conceptIds.length).toBeGreaterThan(0);
        check.conceptIds.forEach((conceptId) => {
          expect(introducedConcepts).toContain(conceptId);
        });
      });
    });

    expect(
      codeLabs
        .filter((activity) => activity.spec.allowedPackages.length > 0)
        .map((activity) => [
          activity.id,
          activity.spec.allowedPackages,
      ]),
    ).toEqual([...SCIENTIFIC_PACKAGE_LABS]);

    expect(
      new Map(
        codeLabs
          .filter((activity) => activity.evidenceConceptIds)
          .map((activity) => [
            activity.id,
            activity.evidenceConceptIds,
          ]),
      ),
    ).toEqual(
      new Map([
        ["06-python-capacity", ["model-capacity", "generalization"]],
        ["ensemble-python-lab", ["bagging", "boosting"]],
        ["cluster-python-lab", ["k-means", "pca"]],
        [
          "attention-python-lab",
          ["attention", "qkv", "training-versus-inference"],
        ],
        [
          "shift-monitor-python-lab",
          ["distribution-shift", "monitoring", "system-diagnosis"],
        ],
      ]),
    );

    expect(
      new Map(
        visualLabs
          .filter((activity) =>
            [
              "prerequisite-trace",
              "data-and-baseline",
              "linear-model",
              "loss-landscape",
            ].includes(activity.id)
          )
          .map((activity) => [
            activity.id,
            activity.evidenceConceptIds,
          ]),
      ),
    ).toEqual(
      new Map([
        ["prerequisite-trace", ["slope-chain-rule"]],
        ["data-and-baseline", ["parameter-update", "baseline"]],
        ["linear-model", ["linear-parameters"]],
        ["loss-landscape", ["residual", "loss", "loss-landscape"]],
      ]),
    );
  });

  it("pins the reviewed curriculum repairs in authored page content", () => {
    const capacityLesson = getLesson("capacity-curves");
    const capacityVisual = capacityLesson?.activities.find(
      (activity) => activity.id === "capacity-curves",
    );
    if (!capacityVisual || capacityVisual.kind !== "visual-lab") {
      throw new Error("Missing capacity visual lab");
    }
    const capacityImplementationCopy = [
      capacityVisual.prompt,
      capacityVisual.invariant ?? "",
    ].join(" ");
    expect(capacityImplementationCopy).toContain(
      "polynomial inputs [1, x, x squared, and so on]",
    );
    expect(capacityImplementationCopy).toContain(
      "0.000001 times the sum of squared coefficients",
    );
    expect(capacityImplementationCopy).toContain(
      "slightly changes the objective",
    );
    expect(capacityImplementationCopy).not.toContain(
      "only inside the coefficient-fitting arithmetic",
    );
    expect(capacityImplementationCopy).not.toMatch(
      /\b(?:ridge|lambda|partial-pivot|monomial basis)\b/i,
    );

    const regularizationLesson = getLesson("regularization-path");
    const ridgeObjective = regularizationLesson?.blocks.find(
      (block) => block.id === "regularization-objective",
    )?.body.join(" ");
    expect(ridgeObjective).toContain(
      "J_SSE(w) = sum_i (y_i - w * x_i)^2 + lambda_SSE * w^2",
    );
    expect(ridgeObjective).toContain(
      "J_MSE(w) = (1/n) * sum_i (y_i - w * x_i)^2 + lambda_MSE * w^2",
    );
    expect(ridgeObjective).toContain(
      "sum_i x_i^2 + n * lambda_MSE",
    );
    expect(ridgeObjective).toContain(
      "lambda_SSE = n * lambda_MSE",
    );

    const optimizerLesson = getLesson("optimizer-traces");
    const adamUpdate = optimizerLesson?.blocks.find(
      (block) => block.id === "optimizer-state",
    )?.body.join(" ");
    expect(adamUpdate).toContain(
      "m_t = beta1 * m_(t-1) + (1 - beta1) * g_t",
    );
    expect(adamUpdate).toContain(
      "v_t = beta2 * v_(t-1) + (1 - beta2) * g_t^2",
    );
    expect(adamUpdate).toContain(
      "m_hat_t = m_t / (1 - beta1^t)",
    );
    expect(adamUpdate).toContain(
      "v_hat_t = v_t / (1 - beta2^t)",
    );
    expect(adamUpdate).toContain(
      "theta_t = theta_(t-1) - eta * m_hat_t / (sqrt(v_hat_t) + epsilon)",
    );
    expect(adamUpdate).toContain(
      "the denominator is sqrt(v_hat_t) + epsilon, not sqrt(v_hat_t + epsilon)",
    );
    expect(adamUpdate).toContain(
      "m_1 = 0.2 and v_1 = 0.004",
    );
    expect(adamUpdate).toContain(
      "m_hat_1 = 0.2 / 0.1 = 2 and v_hat_1 = 0.004 / 0.001 = 4",
    );
    expect(adamUpdate).toContain("approximately 3.9");
    expect(
      optimizerLesson?.teaching.vocabulary.find(
        ({ term }) => term === "Epsilon",
      )?.definition,
    ).toContain("after the square root");

    const fairnessLesson = getLesson("shift-monitor");
    expect(
      fairnessLesson?.outcomes.find(
        (outcome) => outcome.id === "shift-fairness-outcome",
      ),
    ).toEqual(
      expect.objectContaining({
        conceptId: "fairness",
        requiredEvidenceKinds: ["explanation"],
      }),
    );
    const fairnessBlock = fairnessLesson?.blocks.find(
      (block) => block.id === "shift-fairness",
    )?.body.join(" ");
    expect(fairnessBlock).toContain(
      "Group A has TP = 40, FN = 10, FP = 10, and TN = 40",
    );
    expect(fairnessBlock).toContain(
      "selection rate is (40 + 10) / 100 = 50%",
    );
    expect(fairnessBlock).toContain(
      "true-positive rate is 40 / (40 + 10) = 80%",
    );
    expect(fairnessBlock).toContain(
      "Group B has TP = 20, FN = 20, FP = 0, and TN = 60",
    );
    expect(fairnessBlock).toContain(
      "30-point selection-rate gap violates demographic parity",
    );
    expect(fairnessBlock).toContain(
      "30-point true-positive-rate gap violates equality of opportunity",
    );
    expect(fairnessBlock).toContain(
      "matching the first two metrics would leave a 10-point false-positive-rate gap",
    );
    expect(
      fairnessLesson?.teaching.vocabulary.map(({ term }) => term),
    ).toEqual(
      expect.arrayContaining([
        "Demographic parity",
        "Equality of opportunity",
      ]),
    );

    const fairnessActivity = fairnessLesson?.activities.find(
      (activity) => activity.id === "shift-clinic-fairness-explanation",
    );
    if (!fairnessActivity || fairnessActivity.kind !== "text-response") {
      throw new Error("Missing authored clinic fairness activity");
    }
    expect(fairnessActivity.evidenceKind).toBe("explanation");
    expect(fairnessActivity.prompt).toContain(
      "Group East: TP = 27, FN = 3, FP = 15, TN = 55",
    );
    expect(fairnessActivity.prompt).toContain(
      "Group West: TP = 36, FN = 24, FP = 4, TN = 36",
    );
    expect(
      fairnessActivity.rubric.criteria.map(({ label }) => label),
    ).toEqual(
      expect.arrayContaining([
        "compute East and West selection rates as 42% and 40%",
        "compute East and West true-positive rates as 90% and 60%",
      ]),
    );
    expect(
      fairnessLesson?.resources.find(
        (resource) => resource.id === "shift-google-fairness",
      )?.afterActivityId,
    ).toBe("shift-clinic-fairness-explanation");
  });

  it("keeps the authored capstone fixture coherent across prose and code", () => {
    const mean = (values: readonly number[]) =>
      values.reduce((total, value) => total + value, 0) /
      values.length;
    const slices = Object.values(CAPSTONE_INCIDENT.live.slices);
    const totalRecords = slices.reduce(
      (total, slice) =>
        total +
        slice.truePositives +
        slice.falseNegatives +
        slice.trueNegatives +
        slice.falsePositives,
      0,
    );
    const correctRecords = slices.reduce(
      (total, slice) =>
        total + slice.truePositives + slice.trueNegatives,
      0,
    );
    const falseNegativeRate = (
      slice: (typeof slices)[number],
    ) =>
      slice.falseNegatives /
      (slice.truePositives + slice.falseNegatives);
    const dayRate = falseNegativeRate(
      CAPSTONE_INCIDENT.live.slices.day,
    );
    const nightRate = falseNegativeRate(
      CAPSTONE_INCIDENT.live.slices.night,
    );
    const totalActualPositiveSupport = slices.reduce(
      (total, slice) =>
        total + slice.truePositives + slice.falseNegatives,
      0,
    );

    expect(
      mean(CAPSTONE_INCIDENT.reference.brightnessSamples),
    ).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.referenceBrightnessMean,
      12,
    );
    expect(mean(CAPSTONE_INCIDENT.live.brightnessSamples)).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.liveBrightnessMean,
      12,
    );
    expect(
      Math.abs(
        mean(CAPSTONE_INCIDENT.reference.brightnessSamples) -
          mean(CAPSTONE_INCIDENT.live.brightnessSamples),
      ),
    ).toBeCloseTo(CAPSTONE_INCIDENT.metrics.brightnessMeanShift, 12);
    expect(correctRecords / totalRecords).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.liveAccuracy,
      12,
    );
    expect(dayRate).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.dayFalseNegativeRate,
      12,
    );
    expect(nightRate).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate,
      12,
    );
    expect(nightRate - dayRate).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.falseNegativeRateGap,
      12,
    );
    const totalFalseNegatives = slices.reduce(
      (total, slice) => total + slice.falseNegatives,
      0,
    );
    expect(totalFalseNegatives / totalActualPositiveSupport).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.overallFalseNegativeRate,
      12,
    );
    expect(CAPSTONE_INCIDENT.metrics.overallFalseNegativeRate).toBeGreaterThan(
      CAPSTONE_INCIDENT.releaseGates.overallFalseNegativeRate,
    );
    expect(CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate).toBeGreaterThan(
      CAPSTONE_INCIDENT.releaseGates.nightFalseNegativeRate,
    );
    expect(totalActualPositiveSupport).toBe(
      CAPSTONE_INCIDENT.metrics.totalActualPositiveSupport,
    );
    expect(
      (CAPSTONE_INCIDENT.live.slices.night.truePositives +
        CAPSTONE_INCIDENT.live.slices.night.falseNegatives) /
        totalActualPositiveSupport,
    ).toBeCloseTo(
      CAPSTONE_INCIDENT.metrics.nightShareAmongActualPositives,
      12,
    );

    const lesson = getLesson("shift-monitor");
    if (!lesson) throw new Error("Missing shift-monitor lesson");
    const observations = lesson.blocks.find(
      (block) => block.id === "shift-observations",
    );
    expect(observations?.body.join(" ")).toContain(
      `brightness mean moves from ${CAPSTONE_INCIDENT.metrics.referenceBrightnessMean.toFixed(2)} to ${CAPSTONE_INCIDENT.metrics.liveBrightnessMean.toFixed(2)}`,
    );
    const fixedCapstone = lesson.blocks.find(
      (block) => block.id === "shift-fixed-capstone",
    );
    const firstDiagnosis = lesson.activities.find(
      (activity) => activity.id === "shift-first-diagnosis-prediction",
    );
    const monitorLab = lesson.activities.find(
      (activity) => activity.id === "shift-monitor-lab",
    );
    const visibleIdentityCopy = [
      ...(fixedCapstone?.body ?? []),
      ...(observations?.body ?? []),
      firstDiagnosis?.kind === "prediction"
        ? firstDiagnosis.checkpoint.prompt
        : "",
      monitorLab?.kind === "visual-lab"
        ? monitorLab.invariant ?? ""
        : "",
    ].join(" ");
    const artifactDisplayId =
      `${CAPSTONE_INCIDENT.model.artifactDigest.slice(0, 19)}...`;
    const trainingDisplayId =
      `${CAPSTONE_INCIDENT.model.trainingTraceDigest.slice(0, 19)}...`;
    expect(visibleIdentityCopy).toContain(artifactDisplayId);
    expect(visibleIdentityCopy).toContain(trainingDisplayId);
    expect(visibleIdentityCopy).not.toContain(
      CAPSTONE_INCIDENT.model.artifactDigest,
    );
    expect(visibleIdentityCopy).not.toContain(
      CAPSTONE_INCIDENT.model.trainingTraceDigest,
    );
    const codeLab = lesson.activities.find(
      (activity) =>
        activity.kind === "code-lab" &&
        activity.id === "shift-monitor-python-lab",
    );
    if (!codeLab || codeLab.kind !== "code-lab") {
      throw new Error("Missing shift-monitor Python lab");
    }
    const source = codeLab.spec.starterFiles[0]?.contents ?? "";
    expect(source).toContain(
      `[("day", 1, 1)] * ${CAPSTONE_INCIDENT.live.slices.day.truePositives}`,
    );
    expect(source).toContain(
      `[("night", 1, 0)] * ${CAPSTONE_INCIDENT.live.slices.night.falseNegatives}`,
    );
    expect(source).toContain(
      `MODEL_ARTIFACT_DIGEST = ${JSON.stringify(CAPSTONE_INCIDENT.model.artifactDigest)}`,
    );
    expect(source).toContain(
      `TRAINING_TRACE_DIGEST = ${JSON.stringify(CAPSTONE_INCIDENT.model.trainingTraceDigest)}`,
    );
    const expectedByCheck = new Map(
      codeLab.spec.checks.map((check) => [check.id, check.expected]),
    );
    expect(expectedByCheck.get("shift-input-monitor")).toBe(
      CAPSTONE_INCIDENT.metrics.brightnessMeanShift,
    );
    expect(expectedByCheck.get("shift-overall-accuracy")).toBe(
      CAPSTONE_INCIDENT.metrics.liveAccuracy,
    );
    expect(expectedByCheck.get("shift-fnr-gap")).toBe(
      CAPSTONE_INCIDENT.metrics.falseNegativeRateGap,
    );
    expect(expectedByCheck.get("shift-release-gates")).toBe(
      `(${CAPSTONE_INCIDENT.metrics.overallFalseNegativeRate}, ${CAPSTONE_INCIDENT.metrics.nightFalseNegativeRate}, False)`,
    );
    expect(expectedByCheck.get("shift-fixed-diagnosis")).toContain(
      CAPSTONE_INCIDENT.model.artifactDigest,
    );
    expect(expectedByCheck.get("shift-fixed-diagnosis")).toContain(
      CAPSTONE_INCIDENT.model.trainingTraceDigest,
    );
  });

  it("keeps bounded lesson scope and duration statements explicit", () => {
    const capacityLesson = getLesson("capacity-curves");
    expect(capacityLesson?.summary).toContain(
      "distinct from a learning curve",
    );
    expect(
      capacityLesson?.blocks.find(
        (block) => block.id === "06-data-limit",
      )?.body.join(" "),
    ).toContain("not a learning curve");

    const attentionLesson = getLesson("attention-routing");
    expect(
      attentionLesson?.blocks.find(
        (block) => block.id === "attention-inference-scope",
      )?.body.join(" "),
    ).toContain("no inherent token-order signal");

    const xorLesson = getLesson("xor-hidden-space");
    expect(xorLesson?.summary).not.toContain("ReLU");
    expect(
      xorLesson?.blocks.find(
        (block) => block.id === "xor-hidden-features",
      )?.body[0],
    ).toMatch(/^ReLU\(a\) = max\(0, a\)/);

    const decisionLesson = getLesson("decision-costs");
    expect(decisionLesson?.summary).toContain(
      "empirical total validation cost",
    );
    const decisionCode = decisionLesson?.activities.find(
      (activity) =>
        activity.kind === "code-lab" &&
        activity.id === "decision-python-lab",
    );
    expect(
      decisionCode?.kind === "code-lab"
        ? decisionCode.spec.starterFiles[0]?.contents
        : "",
    ).toContain("def empirical_total_cost");

    lessons.forEach((lesson) => {
      expect(lesson.durationMinutes, lesson.id).toBeGreaterThanOrEqual(45);
    });
  });

  it("keeps the documented reading and teaching chunk totals exact", () => {
    const readingChunks = lessons.flatMap((lesson) =>
      lesson.blocks.flatMap((block) => block.body)
    );
    const teachingChunks = lessons.flatMap(teachingChunksForLesson);

    expect(readingChunks).toHaveLength(204);
    expect(teachingChunks).toHaveLength(489);
    expect(readingChunks.length + teachingChunks.length).toBe(693);
  });

  it("teaches odds, log-odds, and sigmoid as reversible representations", () => {
    const logistic = getLesson("logistic-link");
    if (!logistic) throw new Error("Missing logistic-link lesson");
    const authoredText = [
      ...logistic.teaching.introduction,
      ...logistic.teaching.vocabulary.flatMap(({ term, definition }) => [
        term,
        definition,
      ]),
      ...logistic.teaching.workedExample.steps.map(
        ({ explanation }) => explanation,
      ),
      ...logistic.blocks.flatMap((block) => block.body),
    ].join(" ");

    expect(logistic.revision).toBe("2026-08-04-r2");
    expect(authoredText).toContain("p / (1 - p)");
    expect(authoredText).toContain("z = ln(p / (1 - p))");
    expect(authoredText).toContain("The two transformations are inverses");
    expect(authoredText).toContain(
      "p / (1 - p) = 0.75 / 0.25 = 3",
    );
  });

  it("resolves every block and direct resource against 110 audited sources", () => {
    expect(researchRegistry.generated).toBe("2026-08-07");
    expect(researchRegistry.totalSources).toBe(110);
    expect(researchRegistry.sources).toHaveLength(110);
    expect(researchRegistry.sources.map((source) => source.id)).toEqual(
      EXPECTED_SOURCE_IDS,
    );
    expectUnique(researchRegistry.sources.map((source) => source.id));
    expectUnique(researchRegistry.sources.map((source) => source.url));

    const sourceById = new Map(
      researchRegistry.sources.map((source) => [source.id, source]),
    );

    researchRegistry.sources.forEach((source) => {
      expectNonBlank(source.title);
      expectNonBlank(source.publisher);
      expect(source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.verifiedAt <= COURSE_REVISION.slice(0, 10)).toBe(true);
      expect(["http:", "https:"]).toContain(new URL(source.url).protocol);
    });

    lessons.forEach((lesson) => {
      expect(lesson.sourceIds?.length, lesson.id).toBeGreaterThan(0);
      const sourceIds = lesson.sourceIds ?? [];
      expectUnique(sourceIds);
      sourceIds.forEach((sourceId) => {
        expect(sourceById.has(sourceId), `${lesson.id}:${sourceId}`).toBe(true);
      });

      lesson.blocks.forEach((block) => {
        expect(block.sourceIds.length, block.id).toBeGreaterThan(0);
        expectUnique(block.sourceIds);
        block.sourceIds.forEach((sourceId) => {
          expect(
            sourceById.has(sourceId),
            `${block.id}:${sourceId}`,
          ).toBe(true);
          expect(sourceIds, block.id).toContain(sourceId);
        });
      });

      lesson.teaching.sourceIds.forEach((sourceId) => {
        expect(sourceById.has(sourceId), `${lesson.id}:${sourceId}`).toBe(true);
        expect(sourceIds, `${lesson.id}:${sourceId}`).toContain(sourceId);
      });

      pageChunksForLesson(lesson).forEach((chunk) => {
        if (chunk.blockId === teachingBlockIdForLesson(lesson)) {
          expect(chunk.sourceIds, chunk.id).toEqual(lesson.teaching.sourceIds);
          return;
        }
        const block = lesson.blocks.find(
          (candidate) => candidate.id === chunk.blockId,
        );
        expect(block, chunk.id).toBeDefined();
        expect(chunk.sourceIds, chunk.id).toEqual(block?.sourceIds);
      });

      lesson.resources.forEach((resource) => {
        expectNonBlank(resource.id);
        expectNonBlank(resource.title);
        expectNonBlank(resource.publisher);
        expectNonBlank(resource.placement);
        expect(resource.durationMinutes).toBeGreaterThan(0);
        expect(lesson.activities.map((activity) => activity.id)).toContain(
          resource.afterActivityId,
        );

        if (!resource.sourceId) {
          throw new Error(`Resource ${resource.id} has no source ID`);
        }
        const source = sourceById.get(resource.sourceId);
        expect(source, resource.id).toBeDefined();
        if (!source) {
          throw new Error(
            `Resource ${resource.id} has unknown source ${resource.sourceId}`,
          );
        }
        expect(resource.url).toBe(
          RUNTIME_MATCHED_SOURCE_URLS.get(resource.sourceId) ??
            source.url,
        );
        expect(resource.title).toBe(source.title);
        expect(resource.publisher).toBe(source.publisher);
        expect(resource.verifiedAt).toBe(source.verifiedAt);

        if (
          resource.kind === "video" ||
          resource.kind === "video-and-reading"
        ) {
          expect(source.media, resource.id).toBeDefined();
          if (!source.media) {
            throw new Error(
              `Video resource ${resource.id} has no verified media metadata`,
            );
          }
          expect(source.media.platform).toBe("YouTube");
          expectNonBlank(source.media.videoId);
          expectNonBlank(source.media.title);
          expectNonBlank(source.media.channel);
          expect(source.media.durationSeconds).toBeGreaterThan(0);
          expect(source.media.durationLabel).toMatch(/^\d+:\d{2}$/);
          expect(source.media.verifiedAt).toMatch(/^2026-08-0[23]$/);
          expect(source.media.verifiedAt <= COURSE_REVISION).toBe(true);
          const videoMinutes = Math.ceil(source.media.durationSeconds / 60);
          if (resource.kind === "video") {
            expect(resource.durationMinutes).toBe(videoMinutes);
          } else {
            expect(resource.durationMinutes).toBeGreaterThanOrEqual(
              videoMinutes,
            );
          }
        }
      });
    });

    RUNTIME_MATCHED_SOURCE_URLS.forEach((url, sourceId) => {
      const matchingResources = allResources.filter(
        (resource) => resource.sourceId === sourceId,
      );
      expect(matchingResources, sourceId).toHaveLength(1);
      expect(matchingResources[0]?.url).toBe(url);
      expect(url).not.toContain("/stable/");
    });

    const researchOnlyUrls = RESEARCH_ONLY_SOURCE_IDS.map((sourceId) => {
      const source = sourceById.get(sourceId);
      if (!source) throw new Error(`Missing research-only source ${sourceId}`);
      return source.url;
    });
    allResources.forEach((resource) => {
      expect(
        researchOnlyUrls,
        `${resource.id} exposes a broad research page as a learner resource`,
      ).not.toContain(resource.url);
    });
  });
});
