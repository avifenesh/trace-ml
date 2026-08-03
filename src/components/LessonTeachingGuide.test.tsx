// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { lessons } from "../content/course";
import { foundationLessons } from "../content/lessons-foundations";
import {
  teachingBlockIdForLesson,
  teachingChunksForLesson,
} from "../content/types";
import { LessonTeachingGuide } from "./LessonTeachingGuide";

vi.mock("../open-external", () => ({
  openExternalLink: vi.fn(),
}));

describe("LessonTeachingGuide", () => {
  it("renders the authored beginner explanation before prediction", () => {
    const lesson = foundationLessons[0];
    const onActive = vi.fn();
    if (!lesson) throw new Error("Missing prerequisite lesson");

    const { container } = render(
      <LessonTeachingGuide lesson={lesson} onActive={onActive} />,
    );

    const guide = container.querySelector(".lesson-teaching");
    expect(guide).toHaveAttribute("id", teachingBlockIdForLesson(lesson));
    const outcomes = screen.getByLabelText("Lesson outcomes");
    expect(
      screen.getByRole("heading", { name: lesson.teaching.title }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Terms you need" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        name: lesson.teaching.workedExample.title,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Common confusions" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Before you predict" }),
    ).toBeVisible();

    const terms = container.querySelector<HTMLElement>(
      ".teaching-vocabulary dl",
    );
    const steps = container.querySelector<HTMLElement>(".teaching-example ol");
    const misconceptions = container.querySelector<HTMLElement>(
      ".teaching-misconceptions ul",
    );
    const summary = container.querySelector<HTMLElement>(
      ".teaching-summary ul",
    );
    expect(terms && within(terms).getAllByRole("term")).toHaveLength(
      lesson.teaching.vocabulary.length,
    );
    expect(steps && within(steps).getAllByRole("listitem")).toHaveLength(
      lesson.teaching.workedExample.steps.length,
    );
    expect(
      misconceptions && within(misconceptions).getAllByRole("listitem"),
    ).toHaveLength(lesson.teaching.misconceptions.length);
    expect(summary && within(summary).getAllByRole("listitem")).toHaveLength(
      lesson.teaching.summary.length,
    );
    expect(
      outcomes.compareDocumentPosition(
        screen.getByRole("heading", { name: lesson.teaching.title }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("renders every teaching chunk at an exact quote anchor", () => {
    for (const lesson of lessons) {
      const { unmount } = render(
        <LessonTeachingGuide lesson={lesson} onActive={vi.fn()} />,
      );

      for (const chunk of teachingChunksForLesson(lesson)) {
        const anchor = document.getElementById(chunk.anchorId);
        expect(anchor, chunk.id).not.toBeNull();
        expect(anchor?.textContent, chunk.id).toContain(chunk.text);
      }
      unmount();
    }
  });
});
