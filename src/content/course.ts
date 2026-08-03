import { foundationLessons } from "./lessons-foundations";
import { modelLessons } from "./lessons-models";
import { systemLessons } from "./lessons-systems";
import type {
  CourseModule,
  Lesson,
} from "./types";

export const lessons: Lesson[] = [
  ...foundationLessons,
  ...modelLessons,
  ...systemLessons,
];

export const courseModules: CourseModule[] = [
  {
    id: "foundations",
    number: "I",
    title: "Prediction and error",
    purpose: "Trace the quantities before fitting anything.",
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
    title: "Learning and evidence",
    purpose: "Update parameters, protect holdouts, and diagnose fit.",
    lessonIds: [
      "gradient-descent",
      "split-and-leakage",
      "capacity-curves",
    ],
  },
  {
    id: "models",
    number: "III",
    title: "Decisions and features",
    purpose: "Move from scores to decisions and reliable inputs.",
    lessonIds: [
      "logistic-link",
      "decision-costs",
      "feature-pipeline",
    ],
  },
  {
    id: "classical",
    number: "IV",
    title: "Model families",
    purpose: "Compare assumptions, selection, and ensembles.",
    lessonIds: [
      "knn-versus-tree",
      "regularization-path",
      "ensemble-votes",
    ],
  },
  {
    id: "neural",
    number: "V",
    title: "Neural mechanisms",
    purpose: "Build nonlinear features and trace credit.",
    lessonIds: [
      "xor-hidden-space",
      "backprop-graph",
      "optimizer-traces",
    ],
  },
  {
    id: "representation",
    number: "VI",
    title: "Representation and sequence",
    purpose: "Inspect clusters, filters, and attention.",
    lessonIds: [
      "cluster-project",
      "convolution-field",
      "attention-routing",
    ],
  },
  {
    id: "systems",
    number: "VII",
    title: "Acting and deployment",
    purpose: "Learn from reward and diagnose a live system.",
    lessonIds: ["q-learning", "shift-monitor"],
  },
];

export function getLesson(lessonId: string) {
  return lessons.find((lesson) => lesson.id === lessonId);
}

export function requireLesson(lessonId: string) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);
  return lesson;
}
