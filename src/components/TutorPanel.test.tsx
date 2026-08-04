// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { createRef, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
import type { BedrockReadiness } from "../bedrock-readiness";
import type { ReturnTypeUseTutorThreads } from "./types";
import { TutorPanel } from "./TutorPanel";

const lesson = requireLesson("linear-model");
const lessonRevision = lesson.revision ?? "unversioned";
const verifiedReadiness = {
  available: true,
  model: "openai.gpt-5.6-sol",
  retentionMode: "provider_data_share",
  retentionSource: "account",
  allowedRetentionModes: ["default", "provider_data_share"],
} satisfies BedrockReadiness;

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
    helperReadiness: helperMode === "semantic" ? verifiedReadiness : null,
    pendingAnswer: null,
    helperErrorMessage: null,
    helperNotice: null,
    newThread: vi.fn(),
    selectThread: vi.fn(),
    deleteThread: vi.fn(),
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it("gives the composer a plain-language privacy description", () => {
    renderPanel(tutorMessage([], []), "semantic");

    expect(screen.getByLabelText("Ask about this lesson")).toHaveAccessibleDescription(
      /your question, this page, and recent messages are sent to AWS Bedrock/i,
    );
    expect(
      screen.getByText(/classifier-flagged GPT-5\.6 Sol traffic/i),
    ).not.toBeVisible();
    expect(
      screen.getByLabelText("Ask about this lesson"),
    ).toHaveAccessibleDescription(
      /effective policy: provider data sharing permitted \(account setting\)/i,
    );
    expect(screen.getByText("Privacy details").closest("details")).not.toHaveAttribute(
      "open",
    );
  });
});

describe("TutorPanel conversation retention", () => {
  function panelFor(tutor: ReturnTypeUseTutorThreads) {
    return (
      <TutorPanel
        inert={false}
        isModal={false}
        lesson={lesson}
        tutor={tutor}
        mobileOpen={false}
        panelRef={createRef<HTMLElement>()}
        onCloseMobile={vi.fn()}
        onNavigateToBlock={vi.fn()}
      />
    );
  }

  function historyTutor() {
    const thread = createConversationThread(
      lesson,
      "2026-08-03T08:00:00.000Z",
    );
    return {
      threads: [thread],
      activeThread: thread,
      persistenceStatus: "persistent" as const,
      helperMode: "local" as const,
      helperReadiness: null,
      pendingAnswer: null,
      helperErrorMessage: null,
      helperNotice: null,
      newThread: vi.fn(),
      selectThread: vi.fn(),
      deleteThread: vi.fn(),
      send: vi.fn(),
      cancelAnswer: vi.fn(),
    } satisfies ReturnTypeUseTutorThreads;
  }

  it("confirms an accessible delete action before removing a thread", () => {
    const tutor = historyTutor();
    const confirm = vi
      .spyOn(globalThis, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(panelFor(tutor));
    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );

    const remove = screen.getByRole("button", {
      name: `Delete conversation: ${tutor.activeThread.title}`,
    });
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledWith(
      `Delete "${tutor.activeThread.title}"? This removes the conversation from this device.`,
    );
    expect(tutor.deleteThread).not.toHaveBeenCalled();

    fireEvent.click(remove);
    expect(tutor.deleteThread).toHaveBeenCalledWith(
      tutor.activeThread.id,
    );
    confirm.mockRestore();
  });

  it("disables thread deletion while an answer is pending", () => {
    const tutor = historyTutor();
    const rendered = render(panelFor(tutor));
    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );
    const pendingTutor = {
      ...tutor,
      pendingAnswer: {
        requestId: "pending-answer",
        threadId: tutor.activeThread.id,
        cancelling: false,
      },
    } satisfies ReturnTypeUseTutorThreads;

    rendered.rerender(panelFor(pendingTutor));

    expect(
      (
        screen.getByRole("button", {
          name: `Delete conversation: ${tutor.activeThread.title}`,
        }) as HTMLButtonElement
    ).disabled,
    ).toBe(true);
  });

  it("uses the conversation log as the only live region for a pending answer", () => {
    const tutor = historyTutor();
    render(panelFor({
      ...tutor,
      pendingAnswer: {
        requestId: "pending-answer",
        threadId: tutor.activeThread.id,
        cancelling: false,
      },
    }));

    const log = screen.getByRole("log", { name: "Conversation messages" });
    expect(within(log).queryByRole("status")).toBeNull();
    expect(within(log).getByText("Reading this page...")).toBeInTheDocument();
  });

  it("keeps similar clipped conversation titles distinct and recoverable", () => {
    const sharedPrefix =
      "Explain why this probability transformation changes ";
    const firstQuestion = `${sharedPrefix}odds into a linear score.`;
    const secondQuestion = `${sharedPrefix}a linear score into probability.`;
    const preview = `${sharedPrefix.slice(0, 42)}…`;
    const firstBase = createConversationThread(
      lesson,
      "2026-08-03T08:00:00.000Z",
    );
    const secondBase = createConversationThread(
      lesson,
      "2026-08-03T09:00:00.000Z",
    );
    const first = {
      ...firstBase,
      id: "similar-first",
      title: preview,
      messages: [
        ...firstBase.messages,
        {
          id: "similar-first-question",
          role: "learner" as const,
          text: firstQuestion,
          createdAt: "2026-08-03T08:01:00.000Z",
          lessonId: lesson.id,
          lessonRevision,
          sourceBlockIds: [],
          sourceChunkIds: [],
        },
      ],
    };
    const second = {
      ...secondBase,
      id: "similar-second",
      title: preview,
      messages: [
        ...secondBase.messages,
        {
          id: "similar-second-question",
          role: "learner" as const,
          text: secondQuestion,
          createdAt: "2026-08-03T09:01:00.000Z",
          lessonId: lesson.id,
          lessonRevision,
          sourceBlockIds: [],
          sourceChunkIds: [],
        },
      ],
    };
    const tutor = {
      ...historyTutor(),
      threads: [first, second],
      activeThread: first,
    } satisfies ReturnTypeUseTutorThreads;
    const { container } = render(panelFor(tutor));

    expect(screen.getByText(lesson.title)).toHaveAttribute("title", lesson.title);
    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );
    const conversationNames = [
      ...container.querySelectorAll<HTMLButtonElement>(
        ".thread-history-select",
      ),
    ].map((button) => button.getAttribute("aria-label"));
    expect(conversationNames.some((name) => name?.includes(firstQuestion)))
      .toBe(true);
    expect(conversationNames.some((name) => name?.includes(secondQuestion)))
      .toBe(true);
    expect(
      [...document.querySelectorAll(".thread-history-select strong")].map(
        (element) => element.getAttribute("title"),
      ),
    ).toEqual(
      expect.arrayContaining([firstQuestion, secondQuestion]),
    );
  });

  it("announces deletion and focuses the nearest surviving conversation", async () => {
    const first = {
      ...createConversationThread(lesson, "2026-08-03T08:00:00.000Z"),
      id: "first-thread",
      title: "First question",
    };
    const second = {
      ...createConversationThread(lesson, "2026-08-03T09:00:00.000Z"),
      id: "second-thread",
      title: "Second question",
    };

    function StatefulPanel() {
      const [threads, setThreads] = useState([first, second]);
      const [activeThreadId, setActiveThreadId] = useState(first.id);
      const [notice, setNotice] = useState<string | null>(null);
      const activeThread =
        threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
      if (!activeThread) throw new Error("Expected one conversation");
      const tutor = {
        threads,
        activeThread,
        persistenceStatus: "persistent" as const,
        helperMode: "local" as const,
        helperReadiness: null,
        pendingAnswer: null,
        helperErrorMessage: null,
        helperNotice: notice,
        newThread: vi.fn(),
        selectThread: setActiveThreadId,
        deleteThread(threadId: string) {
          const remaining = threads.filter((thread) => thread.id !== threadId);
          setThreads(remaining);
          if (threadId === activeThreadId) {
            setActiveThreadId(remaining[0]?.id ?? "");
          }
          setNotice("Conversation deleted.");
          return true;
        },
        send: vi.fn(),
        cancelAnswer: vi.fn(),
      } satisfies ReturnTypeUseTutorThreads;
      return panelFor(tutor);
    }

    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    render(<StatefulPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: "Conversation history" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Delete conversation: ${first.title}`,
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(second.title).closest("button")).toHaveFocus();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Conversation deleted.",
    );
  });
});
