/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createLearnerRecord,
} from "../learning/evidence";
import {
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
  PYODIDE_ENVIRONMENT,
} from "./lesson-helpers";
import {
  pageChunksForLesson,
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
  { length: 103 },
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
    (activity) =>
      activity.evidenceKind === kind &&
      activity.conceptIds.includes(conceptId),
  );
}

describe("fixed authored course integrity", () => {
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
      expect(lesson.revision, lesson.id).toBe(COURSE_REVISION);
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
    expect(allOutcomes).toHaveLength(63);
    expect(allBlocks).toHaveLength(98);
    expect(allActivities).toHaveLength(103);
    expect(predictionActivities).toHaveLength(21);
    expect(visualLabs).toHaveLength(21);
    expect(textResponses).toHaveLength(42);
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
    expect(allCodeChecks).toHaveLength(92);

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

      expect(lesson.blocks, lesson.id).toHaveLength(index < 7 ? 4 : 5);
      expect(lesson.blocks[0]?.kind, lesson.id).toBe("opening");
      expect(
        lesson.blocks.filter((block) => block.kind === "opening"),
        lesson.id,
      ).toHaveLength(1);
      expect(lesson.outcomes, lesson.id).toHaveLength(
        lesson.id === "linear-model"
          ? 2
          : lesson.id === "prerequisite-trace"
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
        lesson.blocks.reduce((total, block) => total + block.body.length, 0),
      );
      chunks.forEach((chunk) => {
        expect(chunk.id).toMatch(new RegExp(`^${chunk.blockId}:p\\d+$`));
        expectNonBlank(chunk.heading);
        expectNonBlank(chunk.text);
      });
      expectUnique(chunks.map((chunk) => chunk.id));
      allPageChunkIds.push(...chunks.map((chunk) => chunk.id));
    });

    expect(allPageChunkIds).toHaveLength(194);
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
      expect(responses, lesson.id).toHaveLength(2);
      expect(
        responses.map((response) => response.evidenceKind).sort(),
        lesson.id,
      ).toEqual(["explanation", "transfer"]);

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
          activity.evidenceConceptIds ?? activity.conceptIds;
        expect(evidenceConceptIds.length, activity.id).toBeGreaterThan(0);
        expectUnique(evidenceConceptIds);
        evidenceConceptIds.forEach((conceptId) => {
          expect(activity.conceptIds, activity.id).toContain(conceptId);
        });
      });
    });
  });

  it("pins all 19 staged Python labs and their 92 executable checks", () => {
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

    new Map([
      ["optimizer-traces", 55],
      ["cluster-project", 50],
      ["attention-routing", 50],
      ["q-learning", 48],
    ]).forEach((duration, lessonId) => {
      expect(getLesson(lessonId)?.durationMinutes, lessonId).toBe(
        duration,
      );
    });
  });

  it("resolves every block and direct resource against 103 audited sources", () => {
    expect(researchRegistry.generated).toBe("2026-08-03");
    expect(researchRegistry.totalSources).toBe(103);
    expect(researchRegistry.sources).toHaveLength(103);
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
      expect(source.verifiedAt).toMatch(/^2026-08-0[23]$/);
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

      pageChunksForLesson(lesson).forEach((chunk) => {
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
        expect(resource.verifiedAt).toBe(COURSE_REVISION);
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
