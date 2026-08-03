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
  type TutorClaim,
  type TutorMessage,
} from "../tutor/conversations";
import type { ReturnTypeUseTutorThreads } from "./types";
import { TutorPanel } from "./TutorPanel";

const lesson = requireLesson("linear-model");
const lessonRevision = lesson.revision ?? "unversioned";

function renderPanel(
  message: TutorMessage,
  helperMode: "local" | "semantic" = "local",
) {
  const thread = {
    ...createConversationThread(lesson, message.createdAt),
    messages: [message],
  };
  const tutor = {
    threads: [thread],
    activeThread: thread,
    persistenceStatus: "persistent" as const,
    helperMode,
    pendingAnswer: null,
    helperErrorMessage: null,
    helperNotice: null,
    newThread: vi.fn(),
    selectThread: vi.fn(),
    send: vi.fn(),
    cancelAnswer: vi.fn(),
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
  claims?: TutorClaim[],
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
    ...(claims ? { claims } : {}),
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
    expect(link.getAttribute("href")).toBe(`#${chunk.anchorId}`);
    expect(link.textContent).toContain(chunk.citationLabel);
  });

  it("renders every semantic claim beside its exact citation", () => {
    const chunk = pageChunksForLesson(lesson).find(
      (candidate) => candidate.blockId === "02-weight",
    );
    if (!chunk) throw new Error("Missing authored weight chunk");
    const claim = {
      text: "The weight is the line's slope.",
      sourceChunkId: chunk.id,
      quote: "The weight is therefore the line's slope.",
    };

    renderPanel(tutorMessage([chunk.blockId], [chunk.id], [claim]));

    const claimText = screen.getByText(claim.text);
    const link = claimText.parentElement?.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(`#${chunk.anchorId}`);
    expect(link?.getAttribute("title")).toContain(claim.quote);
  });

  it("labels a teaching citation without an undefined paragraph", () => {
    const chunk = pageChunksForLesson(lesson).find(
      (candidate) => candidate.id.includes(":term-"),
    );
    if (!chunk) throw new Error("Missing authored teaching chunk");

    renderPanel(tutorMessage([chunk.blockId], [chunk.id]));

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(`#${chunk.anchorId}`);
    expect(link.textContent).toContain(chunk.citationLabel);
    expect(link.textContent).not.toContain("undefined");
  });

  it("discloses that store false is not a zero-retention guarantee", () => {
    renderPanel(tutorMessage([], []), "semantic");

    expect(
      screen.getByText(/store=false is not a zero-retention guarantee/i),
    ).toBeTruthy();
  });
});
