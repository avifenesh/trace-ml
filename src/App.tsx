import {
  BookOpenText,
  Menu,
  MessageSquareText,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import "./App.css";
import { CourseNav } from "./components/CourseNav";
import { LessonArticle } from "./components/LessonArticle";
import { TutorPanel } from "./components/TutorPanel";
import { lessons, requireLesson } from "./content/course";
import type {
  LearningOutcome,
  LessonActivity,
} from "./content/types";
import {
  hasActivityAttempt,
  hasDemonstratedEvidence,
  hasResourceAttempt,
  type RecordActivityInput,
} from "./learning/evidence";
import {
  objectiveCheckpointActivities,
  objectiveCheckpointComplete,
} from "./learning/progression";
import { useLearnerRecord } from "./learning/useLearnerRecord";
import {
  useActivityStateStore,
  type ActivityState,
} from "./learning/useActivityStateStore";
import {
  readLocalStorage,
  writeLocalStorage,
} from "./storage";
import { useTutorThreads } from "./tutor/useTutorThreads";

const ACTIVE_LESSON_KEY = "trace-ml:active-lesson:v1";
const DRAWER_MEDIA_QUERY = "(max-width: 1399px)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? false
      : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function focusableElements(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      !element.closest("[inert]") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden",
  );
}

interface ModalDrawerOptions {
  active: boolean;
  initialFocusSelector?: string;
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}

function useModalDrawer({
  active,
  initialFocusSelector,
  panelRef,
  onDismiss,
}: ModalDrawerOptions) {
  useLayoutEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusInitial = () => {
      const requested = initialFocusSelector
        ? panel.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const target =
        requested ?? focusableElements(panel)[0] ?? panel;
      target.focus({ preventScroll: true });
      if (!panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    };
    focusInitial();
    const frame = requestAnimationFrame(focusInitial);
    const fallback = globalThis.setTimeout(focusInitial, 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableElements(panel);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable.at(-1);
      const current = document.activeElement;
      if (
        !panel.contains(current) ||
        (event.shiftKey && current === first) ||
        (!event.shiftKey && current === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!panel.contains(event.target as Node)) {
        focusInitial();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      globalThis.clearTimeout(fallback);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [active, initialFocusSelector, onDismiss, panelRef]);
}

function initialLessonId() {
  const saved = readLocalStorage(ACTIVE_LESSON_KEY);
  return lessons.some((lesson) => lesson.id === saved && lesson.published)
    ? saved as string
    : "prerequisite-trace";
}

function App() {
  const [activeLessonId, setActiveLessonId] = useState(initialLessonId);
  const lesson = requireLesson(activeLessonId);
  const evidenceScope = {
    lessonId: lesson.id,
    lessonRevision: lesson.revision ?? "unversioned",
  };
  const [activeBlockId, setActiveBlockId] = useState(lesson.blocks[0]?.id ?? "");
  const [navOpen, setNavOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const isDrawerMode = useMediaQuery(DRAWER_MEDIA_QUERY);
  const lessonScrollRef = useRef<HTMLDivElement>(null);
  const courseNavRef = useRef<HTMLElement>(null);
  const tutorPanelRef = useRef<HTMLElement>(null);
  const navTriggerRef = useRef<HTMLButtonElement>(null);
  const tutorTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerReturnFocusRef = useRef<HTMLElement | null>(null);
  const pendingLessonFocusRef = useRef(false);
  const learner = useLearnerRecord();
  const activityStates = useActivityStateStore();
  const tutor = useTutorThreads(lesson, activeBlockId);
  const persistenceStatus =
    learner.persistenceStatus === "memory-only" ||
      activityStates.persistenceStatus === "memory-only" ||
      tutor.persistenceStatus === "memory-only"
      ? "memory-only"
      : "persistent";
  const drawerOpen = navOpen || tutorOpen;

  const openedResourceIds = useMemo(
    () =>
      new Set(
        lesson.resources
          .filter((resource) =>
            hasResourceAttempt(learner.record, resource.id, lesson.id),
          )
          .map((resource) => resource.id),
      ),
    [learner.record, lesson.id, lesson.resources],
  );
  const checkpointActivities = objectiveCheckpointActivities(lesson);
  const gateRequirements = checkpointActivities.map((activity) =>
    objectiveCheckpointComplete(
      lesson,
      activity,
      learner.record,
    ),
  );
  const evidenceCount = gateRequirements.filter(Boolean).length;
  const gateComplete =
    gateRequirements.length > 0 && gateRequirements.every(Boolean);
  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id);
  const nextLesson = lessons
    .slice(lessonIndex + 1)
    .find((item) => item.published);

  useEffect(() => {
    writeLocalStorage(ACTIVE_LESSON_KEY, lesson.id);
  }, [lesson.id]);

  useEffect(() => {
    document.title = `${lesson.title} · Trace`;
  }, [lesson.title]);

  const closeDrawers = useCallback((restoreFocus = true) => {
    const restoreTarget = drawerReturnFocusRef.current;
    drawerReturnFocusRef.current = null;
    setNavOpen(false);
    setTutorOpen(false);
    if (restoreFocus && restoreTarget) {
      requestAnimationFrame(() => {
        if (restoreTarget.isConnected) restoreTarget.focus();
      });
    }
  }, []);

  const dismissDrawers = useCallback(() => closeDrawers(true), [closeDrawers]);

  useModalDrawer({
    active: isDrawerMode && navOpen,
    initialFocusSelector: "[data-drawer-initial-focus]",
    panelRef: courseNavRef,
    onDismiss: dismissDrawers,
  });
  useModalDrawer({
    active: isDrawerMode && tutorOpen,
    initialFocusSelector: "#tutor-question",
    panelRef: tutorPanelRef,
    onDismiss: dismissDrawers,
  });

  useEffect(() => {
    if (!isDrawerMode && navOpen) {
      drawerReturnFocusRef.current = null;
      setNavOpen(false);
    }
  }, [isDrawerMode, navOpen]);

  const focusLessonHeading = useCallback(() => {
    lessonScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("lesson-title")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!pendingLessonFocusRef.current) return;
    pendingLessonFocusRef.current = false;
    const frame = requestAnimationFrame(focusLessonHeading);
    return () => cancelAnimationFrame(frame);
  }, [focusLessonHeading, lesson.id]);

  const recordActivityEvidence = (
    input: Omit<RecordActivityInput, "lessonId" | "lessonRevision">,
  ) => {
    learner.addActivityAttempt({
      ...input,
      lessonId: lesson.id,
      lessonRevision: evidenceScope.lessonRevision,
    });
  };

  const recordResourceOpen = (resourceId: string) => {
    learner.addResourceAttempt({
      lessonId: lesson.id,
      resourceId,
      status: "opened",
    });
  };

  const selectLesson = (lessonId: string) => {
    const selectedLesson = requireLesson(lessonId);
    if (!selectedLesson.published) return;
    closeDrawers(false);
    setActiveBlockId(selectedLesson.blocks[0]?.id ?? "");
    if (selectedLesson.id === lesson.id) {
      requestAnimationFrame(focusLessonHeading);
      return;
    }
    pendingLessonFocusRef.current = true;
    setActiveLessonId(lessonId);
  };

  const openCourseMap = (trigger: HTMLElement) => {
    drawerReturnFocusRef.current = trigger;
    setTutorOpen(false);
    setNavOpen(true);
  };

  const openTutor = (trigger: HTMLElement) => {
    drawerReturnFocusRef.current = trigger;
    setNavOpen(false);
    setTutorOpen(true);
  };

  const focusReadingBlock = (blockId: string) => {
    closeDrawers(false);
    requestAnimationFrame(() => {
      const target = document.getElementById(blockId);
      target?.scrollIntoView({ block: "start" });
      target?.focus({ preventScroll: true });
    });
  };

  const outcomeEvidenced = (outcome: LearningOutcome) =>
    outcome.requiredEvidenceKinds.every((kind) =>
      hasDemonstratedEvidence(
        learner.record,
        outcome.conceptId,
        kind,
        evidenceScope,
      ),
    );

  const activityDemonstrated = (activity: LessonActivity) =>
    activity.kind !== "text-response" &&
    objectiveCheckpointComplete(
      lesson,
      activity,
      learner.record,
    );

  const activityAttempted = (activity: LessonActivity) =>
    hasActivityAttempt(
      learner.record,
      lesson.id,
      evidenceScope.lessonRevision,
      activity.id,
    );

  const activityStateFor = (activity: LessonActivity) =>
    activityStates.getActivityState({
      lessonId: lesson.id,
      lessonRevision: evidenceScope.lessonRevision,
      activityId: activity.id,
    });

  const saveActivityState = (
    activity: LessonActivity,
    state: ActivityState,
  ) => {
    activityStates.saveActivityState(
      {
        lessonId: lesson.id,
        lessonRevision: evidenceScope.lessonRevision,
        activityId: activity.id,
      },
      state,
    );
  };

  return (
    <div className={`app-shell ${tutorOpen ? "tutor-open" : ""}`}>
      <a
        className="skip-link"
        href="#lesson-title"
        inert={isDrawerMode && drawerOpen ? true : undefined}
        onClick={(event) => {
          event.preventDefault();
          focusLessonHeading();
        }}
      >
        Skip to lesson
      </a>
      <CourseNav
        activeLessonId={lesson.id}
        inert={isDrawerMode && !navOpen}
        isModal={isDrawerMode}
        learnerRecord={learner.record}
        mobileOpen={navOpen}
        panelRef={courseNavRef}
        onCloseMobile={dismissDrawers}
        onSelectLesson={selectLesson}
      />

      <main
        className="lesson-workspace"
        inert={isDrawerMode && drawerOpen ? true : undefined}
      >
        <header className="workspace-bar">
          <div className="mobile-workspace-actions">
            <button
              type="button"
              className="icon-button"
              ref={navTriggerRef}
              title="Open course map"
              aria-label="Open course map"
              aria-controls="course-map-panel"
              aria-expanded={navOpen}
              onClick={(event) => openCourseMap(event.currentTarget)}
            >
              <Menu size={19} />
            </button>
            <strong>TRACE</strong>
            <div
              className="compact-progress"
              role="progressbar"
              aria-label="Objective lesson checks"
              aria-valuemin={0}
              aria-valuemax={checkpointActivities.length}
              aria-valuenow={evidenceCount}
              aria-valuetext={`${evidenceCount} of ${checkpointActivities.length} objective checks passed`}
            >
              {gateRequirements.map((supported, index) => (
                <i
                  aria-hidden="true"
                  className={supported ? "supported" : ""}
                  key={`compact-${checkpointActivities[index]?.id}`}
                />
              ))}
            </div>
            {persistenceStatus === "memory-only" && (
              <span
                className="memory-only-warning mobile-memory-warning"
                role="status"
                title="Browser storage is unavailable. New work lasts only for this session."
              >
                <TriangleAlert size={14} aria-hidden="true" />
                Session only
              </span>
            )}
          </div>
          <div className="breadcrumb">
            <BookOpenText size={15} />
            <span>Glassbox course</span>
            <i>/</i>
            <strong>Lesson {lesson.number}</strong>
          </div>
          <div className="workspace-progress">
            {persistenceStatus === "memory-only" && (
              <span
                className="memory-only-warning"
                role="status"
                title="Browser storage is unavailable. New work lasts only for this session."
              >
                <TriangleAlert size={14} aria-hidden="true" />
                Session only
              </span>
            )}
            <div
              className="workspace-evidence-markers"
              role="progressbar"
              aria-label="Objective lesson checks"
              aria-valuemin={0}
              aria-valuemax={checkpointActivities.length}
              aria-valuenow={evidenceCount}
              aria-valuetext={`${evidenceCount} of ${checkpointActivities.length} objective checks passed`}
            >
              {gateRequirements.map((supported, index) => (
                <i
                  aria-hidden="true"
                  className={supported ? "supported" : ""}
                  key={checkpointActivities[index]?.id}
                />
              ))}
            </div>
            <small>
              {gateComplete
                ? `All ${checkpointActivities.length} objective checks passed`
                : `${evidenceCount} of ${checkpointActivities.length} objective checks passed`}
            </small>
          </div>
          <button
            type="button"
            className="mobile-tutor-button"
            ref={tutorTriggerRef}
            aria-controls="lesson-helper-panel"
            aria-expanded={tutorOpen}
            onClick={(event) => {
              if (tutorOpen) {
                dismissDrawers();
              } else {
                openTutor(event.currentTarget);
              }
            }}
          >
            <MessageSquareText size={16} />
            Ask
          </button>
        </header>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {gateComplete
            ? `Lesson ${lesson.number}: all ${checkpointActivities.length} objective checks passed`
            : `Lesson ${lesson.number}: ${evidenceCount} of ${checkpointActivities.length} objective checks passed`}
        </p>

        <div className="lesson-scroll" ref={lessonScrollRef}>
          <LessonArticle
            lesson={lesson}
            openedResourceIds={openedResourceIds}
            persistenceStatus={persistenceStatus}
            gateComplete={gateComplete}
            gateEvidenceCount={evidenceCount}
            activityAttempted={activityAttempted}
            activityDemonstrated={activityDemonstrated}
            activityStateFor={activityStateFor}
            outcomeEvidenced={outcomeEvidenced}
            nextLessonTitle={nextLesson?.title}
            onNextLesson={
              nextLesson ? () => selectLesson(nextLesson.id) : undefined
            }
            onBlockActive={setActiveBlockId}
            onResourceOpen={recordResourceOpen}
            onActivityEvidence={recordActivityEvidence}
            onActivityStateChange={saveActivityState}
            onOpenTutor={openTutor}
          />
        </div>
      </main>

      <TutorPanel
        inert={isDrawerMode && !tutorOpen}
        isModal={isDrawerMode}
        lesson={lesson}
        tutor={tutor}
        mobileOpen={tutorOpen}
        panelRef={tutorPanelRef}
        onCloseMobile={dismissDrawers}
        onNavigateToBlock={focusReadingBlock}
      />

      {isDrawerMode && drawerOpen && (
        <button
          type="button"
          className="mobile-scrim"
          aria-label="Close open panel"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={dismissDrawers}
        />
      )}
    </div>
  );
}

export default App;
