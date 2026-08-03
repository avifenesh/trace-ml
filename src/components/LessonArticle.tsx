import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  Eye,
  MousePointer2,
  PlayCircle,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import type {
  Lesson,
  LessonActivity,
  LessonResource,
} from "../content/types";
import { researchSourcesForIds } from "../content/research-sources";
import type { RecordActivityInput } from "../learning/evidence";
import {
  activityEvidenceConceptIds,
  objectiveCheckpointActivities,
} from "../learning/progression";
import type { ActivityState } from "../learning/useActivityStateStore";
import { openExternalLink } from "../open-external";
import { ChoicePredictionGate } from "./ChoicePredictionGate";
import { PythonCodeLab } from "./PythonCodeLab";
import { SelfExplanationGate } from "./SelfExplanationGate";
import { VisualMechanismLab } from "./VisualMechanismLab";

interface LessonArticleProps {
  lesson: Lesson;
  openedResourceIds: Set<string>;
  persistenceStatus: "persistent" | "memory-only";
  gateComplete: boolean;
  gateEvidenceCount: number;
  activityAttempted: (activity: LessonActivity) => boolean;
  activityDemonstrated: (activity: LessonActivity) => boolean;
  activityStateFor: (activity: LessonActivity) => ActivityState | null;
  nextLessonTitle?: string;
  onNextLesson?: () => void;
  onBlockActive: (blockId: string) => void;
  onResourceOpen: (resourceId: string) => void;
  onActivityEvidence: (
    input: Omit<RecordActivityInput, "lessonId" | "lessonRevision">,
  ) => void;
  onActivityStateChange: (
    activity: LessonActivity,
    state: ActivityState,
  ) => void;
  onOpenTutor: (trigger: HTMLButtonElement) => void;
}

const blockLabels: Record<string, string> = {
  opening: "ORIENT",
  reading: "READ",
  "worked-example": "WORKED EXAMPLE",
  definition: "KEEP",
  checkpoint: "CHECK",
};

export function LessonArticle({
  lesson,
  openedResourceIds,
  persistenceStatus,
  gateComplete,
  gateEvidenceCount,
  activityAttempted,
  activityDemonstrated,
  activityStateFor,
  nextLessonTitle,
  onNextLesson,
  onBlockActive,
  onResourceOpen,
  onActivityEvidence,
  onActivityStateChange,
  onOpenTutor,
}: LessonArticleProps) {
  const articleRef = useRef<HTMLElement>(null);
  const predictionActivity = lesson.activities.find(
    (activity) => activity.kind === "prediction",
  );
  const visualActivity = lesson.activities.find(
    (activity) => activity.kind === "visual-lab",
  );
  const explanationActivity = lesson.activities.find(
    (activity) =>
      activity.kind === "text-response" &&
      activity.evidenceKind === "explanation",
  );
  const transferActivity = lesson.activities.find(
    (activity) =>
      activity.kind === "text-response" &&
      activity.evidenceKind === "transfer",
  );
  const codeActivity = lesson.activities.find(
    (activity) => activity.kind === "code-lab",
  );
  const objectiveCheckpointCount =
    objectiveCheckpointActivities(lesson).length;
  const sequence = [
    predictionActivity && {
      label: "PREDICT",
      targetId: predictionActivity.id,
    },
    lesson.blocks[0] && {
      label: "READ",
      targetId: lesson.blocks[0].id,
    },
    visualActivity && {
      label: "MANIPULATE",
      targetId: visualActivity.id,
    },
    explanationActivity && {
      label: "EXPLAIN",
      targetId: explanationActivity.id,
    },
    transferActivity && {
      label: "TRANSFER",
      targetId: transferActivity.id,
    },
    codeActivity && {
      label: "CODE",
      targetId: codeActivity.id,
    },
  ].filter((stage): stage is { label: string; targetId: string } =>
    Boolean(stage)
  );
  const firstSequenceTarget = sequence[0]?.targetId ?? "";
  const [activeSequenceTarget, setActiveSequenceTarget] = useState(
    firstSequenceTarget,
  );
  const predictionCommitted =
    predictionActivity === undefined || activityAttempted(predictionActivity);
  const remainingActivities = lesson.activities.filter(
    (activity) => activity !== predictionActivity,
  );

  useEffect(() => {
    const article = articleRef.current;
    const scrollRoot = article?.closest(".lesson-scroll");
    const firstBlockId = lesson.blocks[0]?.id;
    if (!article || !(scrollRoot instanceof HTMLElement)) return;
    if (firstBlockId) onBlockActive(firstBlockId);
    if (typeof IntersectionObserver === "undefined") return;

    const visibleBlocks = new Map<Element, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleBlocks.set(entry.target, entry);
          } else {
            visibleBlocks.delete(entry.target);
          }
        }

        const rootTop = scrollRoot.getBoundingClientRect().top;
        const readingAnchor =
          rootTop + Math.min(scrollRoot.clientHeight * 0.28, 220);
        const nearest = [...visibleBlocks.values()].sort(
          (left, right) =>
            Math.abs(left.boundingClientRect.top - readingAnchor) -
              Math.abs(right.boundingClientRect.top - readingAnchor) ||
            right.intersectionRatio - left.intersectionRatio,
        )[0];
        if (nearest?.target instanceof HTMLElement) {
          const nearestTarget = nearest.target;
          const sequenceTarget = nearestTarget.classList.contains(
            "reading-block",
          )
            ? lesson.blocks[0]?.id
            : nearestTarget.id;
          if (sequenceTarget) setActiveSequenceTarget(sequenceTarget);
          if (nearestTarget.classList.contains("reading-block")) {
            onBlockActive(nearestTarget.id);
          }
        }
      },
      {
        root: scrollRoot,
        rootMargin: "-8% 0px -56% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    const sections = article.querySelectorAll<HTMLElement>(
      ".reading-block, .lesson-activity",
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [lesson.id, lesson.blocks, onBlockActive]);

  useEffect(() => {
    setActiveSequenceTarget(firstSequenceTarget);
  }, [firstSequenceTarget, lesson.id]);

  const submitPrediction = (
    activity: Extract<LessonActivity, { kind: "prediction" }>,
    supported: boolean,
    response: string,
  ) => {
    onActivityEvidence({
      activityId: activity.id,
      conceptIds: activityEvidenceConceptIds(activity),
      evidenceKind: activity.evidenceKind,
      response,
      rubricSignals: supported ? ["prediction-supported"] : [],
      level: supported ? "demonstrated" : "unsupported",
      summary: supported
        ? activity.checkpoint.supportedExplanation
        : activity.checkpoint.revisitExplanation,
    });
  };

  const renderActivity = (activity: LessonActivity) => {
    const demonstrated = activityDemonstrated(activity);
    const savedState = activityStateFor(activity);
    if (activity.kind === "prediction") {
      return (
        <ChoicePredictionGate
          activity={activity}
          initialState={
            savedState?.kind === "prediction" ? savedState : undefined
          }
          previouslyDemonstrated={demonstrated}
          onStateChange={(state) =>
            onActivityStateChange(activity, state)
          }
          onEvidence={(supported, response) =>
            submitPrediction(activity, supported, response)
          }
        />
      );
    }
    if (activity.kind === "text-response") {
      return (
        <SelfExplanationGate
          activity={activity}
          lesson={lesson}
          initialState={
            savedState?.kind === "text-response" ? savedState : undefined
          }
          onStateChange={(state) =>
            onActivityStateChange(activity, state)
          }
        />
      );
    }
    if (activity.kind === "visual-lab") {
      return (
        <VisualMechanismLab
          activity={activity}
          enabled={predictionCommitted}
          initialState={
            savedState?.kind === "visual-lab" ? savedState : undefined
          }
          persistenceStatus={persistenceStatus}
          previouslyDemonstrated={demonstrated}
          onStateChange={(state) =>
            onActivityStateChange(activity, state)
          }
          onEvidence={(response) =>
            onActivityEvidence({
              activityId: activity.id,
              conceptIds: activityEvidenceConceptIds(activity),
              evidenceKind: activity.evidenceKind,
              response,
              rubricSignals: ["compared-distinct-states"],
              level: "demonstrated",
              summary: "Compared how the mechanism behaves in distinct states.",
            })
          }
        />
      );
    }
    return (
      <PythonCodeLab
        activity={activity}
        enabled={predictionCommitted}
        initialState={
          savedState?.kind === "code-lab" ? savedState : undefined
        }
        previouslyDemonstrated={demonstrated}
        onStateChange={(state) =>
          onActivityStateChange(activity, state)
        }
        onEvidence={(response, rubricSignals, summary) =>
          onActivityEvidence({
            activityId: activity.id,
            conceptIds: activityEvidenceConceptIds(activity),
            evidenceKind: activity.evidenceKind,
            response,
            rubricSignals,
            level: "demonstrated",
            summary,
          })
        }
      />
    );
  };

  const renderResources = (
    resources: LessonResource[],
    afterActivityId: string,
  ) => {
    if (resources.length === 0) return null;
    const headingId = `resources-after-${afterActivityId}`;
    return (
      <section className="lesson-resources" aria-labelledby={headingId}>
        <header>
          <div>
            <span className="eyebrow">OPTIONAL EXTERNAL PERSPECTIVE</span>
            <h2 id={headingId}>Compare from this checkpoint.</h2>
          </div>
          <p>
            Opening a resource records exposure, not understanding. The
            authored activity above carries the evidence.
          </p>
        </header>
        <div className="resource-list">
          {resources.map((resource) => {
            const opened = openedResourceIds.has(resource.id);
            return (
              <a
                href={resource.url}
                key={resource.id}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  void openExternalLink(event, resource.url).then((opened) => {
                    if (opened) onResourceOpen(resource.id);
                  });
                }}
              >
                <div className="resource-icon" aria-hidden="true">
                  {resource.kind === "reading" ? (
                    <BookOpen size={19} />
                  ) : resource.kind === "interactive" ? (
                    <MousePointer2 size={19} />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                </div>
                <div className="resource-copy">
                  <span>
                    {resource.publisher} · {resource.durationMinutes} min
                  </span>
                  <strong>
                    {resource.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </strong>
                  <p>{resource.placement}</p>
                  <small>
                    {opened ? (
                      <>
                        <Eye size={12} /> opened · understanding still assessed
                        separately
                      </>
                    ) : (
                      <>verified {resource.verifiedAt}</>
                    )}
                  </small>
                </div>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>
    );
  };

  const renderBlock = (block: Lesson["blocks"][number], index: number) => {
    const sources = researchSourcesForIds(block.sourceIds);
    return (
      <section
        className={`reading-block ${block.kind}`}
        id={block.id}
        key={block.id}
        tabIndex={-1}
        onMouseEnter={() => onBlockActive(block.id)}
        onFocus={() => onBlockActive(block.id)}
      >
        <div className="block-index">
          <span>{blockLabels[block.kind]}</span>
          <small>{String(index + 1).padStart(2, "0")}</small>
        </div>
        <div>
          <h2>{block.heading}</h2>
          {block.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {block.id === "the-visible-rule" && (
            <div className="worked-equation">
              <span>5 km ride</span>
              <strong>
                4 <small>overhead</small> + 3 <small>pace</small> × 5{" "}
                <small>distance</small> = 19 minutes
              </strong>
            </div>
          )}
          {block.id === "language-to-keep" && (
            <div className="term-row">
              {["input", "target", "parameter", "prediction"].map((term) => (
                <span key={term}>{term}</span>
              ))}
            </div>
          )}
          <footer
            className="block-sources"
            aria-label={`Editorial sources for ${block.heading}`}
          >
            <span>EDITORIAL SOURCES</span>
            <div>
              {sources.map((source) => (
                <a
                  href={source.url}
                  key={source.id}
                  target="_blank"
                  rel="noreferrer"
                  title={source.title}
                  onClick={(event) => {
                    void openExternalLink(event, source.url);
                  }}
                >
                  [{source.id}] {source.publisher}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ))}
            </div>
          </footer>
        </div>
      </section>
    );
  };

  return (
    <article
      ref={articleRef}
      className="lesson-article"
      aria-labelledby="lesson-title"
    >
      <header className="lesson-opening">
        <ol className="lesson-sequence" aria-label="Lesson outline">
          {sequence.map((stage, index) => (
            <li key={stage.targetId}>
              <a
                href={`#${stage.targetId}`}
                aria-current={
                  activeSequenceTarget === stage.targetId ? "step" : undefined
                }
                onClick={(event) => {
                  event.preventDefault();
                  const target = document.getElementById(stage.targetId);
                  target?.scrollIntoView({ block: "start" });
                  target?.focus({ preventScroll: true });
                  setActiveSequenceTarget(stage.targetId);
                }}
              >
                {stage.label}
              </a>
              {index < sequence.length - 1 && <i aria-hidden="true" />}
            </li>
          ))}
        </ol>
        <div className="lesson-heading">
          <div>
            <span className="eyebrow">
              LESSON {lesson.number} · {lesson.phase.toLocaleUpperCase()}
            </span>
            <h1 id="lesson-title" tabIndex={-1}>{lesson.title}</h1>
            <p>{lesson.question}</p>
          </div>
          <aside className="lesson-duration">
            <Clock3 size={17} />
            <span>
              <strong>{lesson.durationMinutes} min</strong>
              reading + experiment
            </span>
          </aside>
        </div>
        {lesson.mechanism && predictionCommitted && (
          <div className="mechanism-strip" aria-label="Mechanism in this lesson">
            <div>
              <span>INPUT</span>
              <strong>{lesson.mechanism.input}</strong>
            </div>
            <ArrowRight size={18} />
            <div>
              <span>MECHANISM</span>
              <strong>{lesson.mechanism.process}</strong>
            </div>
            <ArrowRight size={18} />
            <div>
              <span>OUTPUT</span>
              <strong>{lesson.mechanism.output}</strong>
            </div>
          </div>
        )}
        {lesson.mechanism && !predictionCommitted && (
          <div className="mechanism-strip mechanism-locked">
            <div>
              <span>MECHANISM TRACE</span>
              <strong>Commit the prediction below to reveal the authored trace.</strong>
            </div>
          </div>
        )}
      </header>

      {predictionActivity && (
        <Fragment key={predictionActivity.id}>
          {renderActivity(predictionActivity)}
          {renderResources(
            lesson.resources.filter(
              (resource) =>
                resource.afterActivityId === predictionActivity.id,
            ),
            predictionActivity.id,
          )}
        </Fragment>
      )}

      <div className="reading-column">
        <aside className="lesson-outcomes" aria-label="Lesson outcomes">
          <span>LESSON OUTCOMES</span>
          <ul>
            {lesson.outcomes.map((outcome) => (
              <li key={outcome.id}>
                <ArrowRight size={12} aria-hidden="true" />
                <span>{outcome.text}</span>
              </li>
            ))}
          </ul>
        </aside>

        {lesson.blocks.map((block, index) => renderBlock(block, index))}
      </div>

      {remainingActivities.map((activity) => (
        <Fragment key={activity.id}>
          {renderActivity(activity)}
          {renderResources(
            lesson.resources.filter(
              (resource) => resource.afterActivityId === activity.id,
            ),
            activity.id,
          )}
        </Fragment>
      ))}

      <section className="lesson-close">
        <div>
          <span className="eyebrow">OPTIONAL PAGE Q&A</span>
          <h2>
            Ask about something on this page.
          </h2>
          <p>
            The helper answers from this authored lesson and cites the exact
            paragraphs it used. It does not grade or direct the course.
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => onOpenTutor(event.currentTarget)}
        >
          Ask a question
          <ArrowRight size={16} />
        </button>
      </section>

      <footer className="lesson-footer">
        <div>
          <span>{gateComplete ? "OBJECTIVE CHECKS COMPLETE" : "LESSON CHECKS"}</span>
          <strong>{nextLessonTitle ?? "Course synthesis"}</strong>
          <p>
            {gateComplete
              ? "The supported prediction, controlled comparison, and available code checks passed. Prose drafts remain formative."
              : "Complete the objective prediction, comparison, and available code checks when you are ready."}
          </p>
        </div>
        <div className="lesson-footer-actions">
          <div
            className={`evidence-status ${gateComplete ? "supported" : ""}`}
          >
            {gateComplete ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <span aria-hidden="true" />
            )}
            {gateComplete
              ? "Objective checks complete"
              : `${gateEvidenceCount} of ${objectiveCheckpointCount} objective checks passed`}
          </div>
          {onNextLesson && (
            <button type="button" onClick={onNextLesson}>
              Next lesson
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
