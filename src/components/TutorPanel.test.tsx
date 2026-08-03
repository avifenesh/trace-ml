// @vitest-environment jsdom

import { createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { requireLesson } from "../content/course";
import { pageChunksForLesson } from "../content/types";
import {
  createConversationThread,
  type TutorMessage,
} from "../tutor/conversations";
import type { ReturnTypeUseTutorThreads } from "./types";
import { TutorPanel } from "./TutorPanel";

const lesson = requireLesson("linear-model");
const lessonRevision = lesson.revision ?? "unversioned";

function renderPanel(message: TutorMessage) {
  const thread = {
    ...createConversationThread(lesson, message.createdAt),
    messages: [message],
  };
  const tutor = {
    threads: [thread],
    activeThread: thread,
    persistenceStatus: "persistent" as const,
    newThread: vi.fn(),
    selectThread: vi.fn(),
    send: vi.fn(),
  } satisfies ReturnTypeUseTutorThreads;

  return render(
    <TutorPanel
      inert={false}
      isModal={false}
      lesson={lesson}
      tutor={tutor}
      mobileOpen={false}
      panelRef={createRef<HTMLElement>()}
      onCloseMobile={vi.fn()}
      onNavigateToBlock={vi.fn()}
    />,
  );
}

function tutorMessage(
  sourceBlockIds: string[],
  sourceChunkIds: string[],
): TutorMessage {
  return {
    id: "tutor-message",
    role: "tutor",
    text: "A page-grounded response.",
    createdAt: "2026-08-03T08:00:00.000Z",
    lessonId: lesson.id,
    lessonRevision,
    sourceBlockIds,
    sourceChunkIds,
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("TutorPanel citations", () => {
  it("does not present legacy block-only metadata as an exact citation", () => {
    renderPanel(tutorMessage(["02-weight"], []));

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("presents an exact current-page chunk citation", () => {
    const chunk = pageChunksForLesson(lesson).find(
      (candidate) => candidate.blockId === "02-weight",
    );
    if (!chunk) throw new Error("Missing authored weight chunk");

    renderPanel(tutorMessage([chunk.blockId], [chunk.id]));

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(`#${chunk.blockId}`);
    expect(link.textContent).toContain(`${chunk.heading} · paragraph`);
  });
});
