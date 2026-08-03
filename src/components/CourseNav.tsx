import {
  Check,
  ChevronRight,
  Circle,
  LockKeyhole,
  Route,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import { courseModules, lessons } from "../content/course";
import {
  lessonState,
  objectiveCheckpointActivities,
  objectiveCheckpointComplete,
} from "../learning/progression";
import type { LearnerRecord } from "../learning/types";

interface CourseNavProps {
  activeLessonId: string;
  inert: boolean;
  isModal: boolean;
  learnerRecord: LearnerRecord;
  mobileOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onCloseMobile: () => void;
  onSelectLesson: (lessonId: string) => void;
}

export function CourseNav({
  activeLessonId,
  inert,
  isModal,
  learnerRecord,
  mobileOpen,
  panelRef,
  onCloseMobile,
  onSelectLesson,
}: CourseNavProps) {
  const activeLesson = lessons.find((item) => item.id === activeLessonId);
  const checkpointActivities = activeLesson
    ? objectiveCheckpointActivities(activeLesson)
    : [];
  const demonstratedEvidence = activeLesson
    ? checkpointActivities.filter((activity) =>
        objectiveCheckpointComplete(
          activeLesson,
          activity,
          learnerRecord,
        )
      ).length
    : 0;
  return (
    <aside
      id="course-map-panel"
      ref={panelRef}
      className={`course-nav ${mobileOpen ? "mobile-open" : ""}`}
      role={isModal && mobileOpen ? "dialog" : undefined}
      aria-modal={isModal && mobileOpen ? true : undefined}
      aria-labelledby="course-map-title"
      aria-hidden={isModal && !mobileOpen ? true : undefined}
      inert={inert ? true : undefined}
      tabIndex={isModal && mobileOpen ? -1 : undefined}
    >
      <h2 className="sr-only" id="course-map-title">Course map</h2>
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <strong>TRACE</strong>
          <span>machine learning, made inspectable</span>
        </div>
        <button
          type="button"
          className="icon-button course-mobile-close"
          onClick={onCloseMobile}
          title="Close course map"
          aria-label="Close course map"
          data-drawer-initial-focus
        >
          <X size={18} />
        </button>
      </div>

      <div className="course-meta">
        <span>GLASSBOX COURSE</span>
        <strong>From a number to a learning system</strong>
        <p>21 fixed lessons · 19 executable Python labs</p>
      </div>

      <nav className="module-list" aria-label="Course lessons">
        {courseModules.map((module) => (
          <section className="module" key={module.id}>
            <header>
              <span>{module.number}</span>
              <div>
                <strong>{module.title}</strong>
                <small>{module.purpose}</small>
              </div>
            </header>
            <ol>
              {module.lessonIds.map((lessonId) => {
                const lesson = lessons.find((item) => item.id === lessonId);
                if (!lesson) return null;
                const state = lessonState(
                  lesson,
                  activeLessonId,
                  learnerRecord,
                );
                const active = state === "current";
                const locked = state === "locked";
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      data-lesson-id={lesson.id}
                      className={active ? "active" : ""}
                      aria-current={active ? "page" : undefined}
                      disabled={locked}
                      onClick={() => {
                        onSelectLesson(lesson.id);
                      }}
                    >
                      <span className="lesson-state" aria-hidden="true">
                        {active ? (
                          <Route size={14} />
                        ) : state === "evidenced" ? (
                          <Check size={13} />
                        ) : state === "available" ? (
                          <Circle size={11} />
                        ) : locked ? (
                          <LockKeyhole size={12} />
                        ) : (
                          <Circle size={11} />
                        )}
                      </span>
                      <span className="lesson-label">
                        <small>{lesson.number}</small>
                        <strong>{lesson.title}</strong>
                        <span className="sr-only">
                          {active
                            ? "Current lesson"
                            : state === "evidenced"
                              ? "Objective checks complete"
                              : locked
                                ? "Locked"
                                : "Available"}
                        </span>
                      </span>
                      {!locked && <ChevronRight size={14} aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </nav>

      <footer className="nav-footer">
        <div>
          <span>Objective lesson checks</span>
          <strong>
            {demonstratedEvidence > 0
              ? `${demonstratedEvidence} checks passed`
              : "Checks pending"}
          </strong>
        </div>
        <div
          className="evidence-markers"
          aria-label="Current lesson objective checks"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={checkpointActivities.length}
          aria-valuenow={demonstratedEvidence}
          aria-valuetext={`${demonstratedEvidence} of ${checkpointActivities.length} objective checks passed`}
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, checkpointActivities.length)}, minmax(0, 1fr))`,
          }}
        >
          {checkpointActivities.map((activity) => (
            <i
              aria-hidden="true"
              className={
                activeLesson &&
                objectiveCheckpointComplete(
                  activeLesson,
                  activity,
                  learnerRecord,
                )
                  ? "supported"
                  : ""
              }
              key={activity.id}
            />
          ))}
        </div>
        <small>
          Required: supported prediction + controlled comparison
          {checkpointActivities.some((activity) => activity.kind === "code-lab")
            ? " + executable checks"
            : ""}. Every lesson is already authored.
        </small>
      </footer>
    </aside>
  );
}
