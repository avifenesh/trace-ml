import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import type { Lesson } from "../content/types";
import {
  teachingBlockIdForLesson,
  teachingChunkIdForLesson,
} from "../content/types";
import { researchSourcesForIds } from "../content/research-sources";
import { openExternalLink } from "../open-external";

interface LessonTeachingGuideProps {
  lesson: Lesson;
  onActive: (blockId: string) => void;
}

export function LessonTeachingGuide({
  lesson,
  onActive,
}: LessonTeachingGuideProps) {
  const guide = lesson.teaching;
  const blockId = teachingBlockIdForLesson(lesson);
  const sources = researchSourcesForIds(guide.sourceIds);

  return (
    <section
      className="lesson-teaching"
      id={blockId}
      aria-labelledby={`${blockId}-title`}
      tabIndex={-1}
      onMouseEnter={() => onActive(blockId)}
      onFocus={() => onActive(blockId)}
    >
      <header className="teaching-introduction">
        <div>
          <span className="eyebrow">LEARN · BUILD THE IDEA</span>
          <h2 id={`${blockId}-title`}>{guide.title}</h2>
        </div>
        <div className="teaching-prose">
          {guide.introduction.map((paragraph, index) => (
            <p
              id={teachingChunkIdForLesson(lesson, "introduction", index)}
              key={paragraph}
              tabIndex={-1}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </header>

      <aside className="lesson-outcomes" aria-label="Lesson outcomes">
        <span>BY THE END OF THIS LESSON</span>
        <ul>
          {lesson.outcomes.map((outcome) => (
            <li key={outcome.id}>
              <ArrowRight size={12} aria-hidden="true" />
              <span>{outcome.text}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section
        className="teaching-vocabulary"
        aria-labelledby={`${blockId}-terms`}
      >
        <h3 id={`${blockId}-terms`}>Terms you need</h3>
        <dl>
          {guide.vocabulary.map(({ term, definition }, index) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd
                id={teachingChunkIdForLesson(lesson, "term", index)}
                tabIndex={-1}
              >
                {definition}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        className="teaching-example"
        aria-labelledby={`${blockId}-example`}
      >
        <header>
          <span className="eyebrow">FOLLOW ONE COMPLETE EXAMPLE</span>
          <h3 id={`${blockId}-example`}>{guide.workedExample.title}</h3>
          <p
            id={teachingChunkIdForLesson(lesson, "example-setup")}
            tabIndex={-1}
          >
            <strong className="teaching-field-label">Given</strong>
            {guide.workedExample.setup}
          </p>
        </header>
        <ol>
          {guide.workedExample.steps.map(({ label, explanation }, index) => (
            <li key={`${label}:${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{label}</strong>
                <p
                  id={teachingChunkIdForLesson(
                    lesson,
                    "example-step",
                    index,
                  )}
                  tabIndex={-1}
                >
                  {explanation}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p
          className="teaching-takeaway"
          id={teachingChunkIdForLesson(lesson, "example-takeaway")}
          tabIndex={-1}
        >
          <strong>What this shows</strong>
          {guide.workedExample.takeaway}
        </p>
      </section>

      <section
        className="teaching-misconceptions"
        aria-labelledby={`${blockId}-confusions`}
      >
        <h3 id={`${blockId}-confusions`}>Common confusions</h3>
        <ul>
          {guide.misconceptions.map(
            ({ misconception, correction }, index) => (
            <li key={misconception}>
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <span className="teaching-field-label">Mistaken idea</span>
                <strong>{misconception}</strong>
                <p
                  id={teachingChunkIdForLesson(
                    lesson,
                    "misconception",
                    index,
                  )}
                  tabIndex={-1}
                >
                  <span className="teaching-field-label">Correction</span>
                  {correction}
                </p>
              </div>
            </li>
            ),
          )}
        </ul>
      </section>

      <section
        className="teaching-summary"
        aria-labelledby={`${blockId}-summary`}
      >
        <h3 id={`${blockId}-summary`}>Before you predict</h3>
        <ul>
          {guide.summary.map((item, index) => (
            <li key={item}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span
                id={teachingChunkIdForLesson(lesson, "summary", index)}
                tabIndex={-1}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer
        className="block-sources teaching-sources"
        aria-label={`Editorial sources for ${guide.title}`}
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
    </section>
  );
}
