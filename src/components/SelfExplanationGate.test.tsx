// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../content/course";
import type { BedrockReadiness } from "../bedrock-readiness";
import type { TextResponseActivity } from "../content/types";
import type { ExplanationAssessment } from "../learning/types";
import { SelfExplanationGate } from "./SelfExplanationGate";

const { invokeMock, isTauriMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  isTauriMock: vi.fn(),
}));

const verifiedReadiness = {
  available: true,
  model: "openai.gpt-5.6-sol",
  retentionMode: "provider_data_share",
  retentionSource: "account",
  allowedRetentionModes: ["default", "provider_data_share"],
} satisfies BedrockReadiness;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

function fixture() {
  const lesson = lessons[0];
  const activity = lesson?.activities.find(
    (candidate): candidate is TextResponseActivity =>
      candidate.kind === "text-response",
  );
  if (!lesson || !activity) throw new Error("Missing explanation fixture.");
  return { activity, lesson };
}

function semanticAssessment(
  activity: TextResponseActivity,
  feedback = "The authored causal links are supported.",
): Omit<ExplanationAssessment, "assessmentMode"> {
  return {
    level: "demonstrated",
    matchedCriteria: activity.rubric.criteria.map((criterion) => criterion.id),
    missingCriteria: [],
    uncertainCriteria: [],
    feedback,
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  isTauriMock.mockReset();
  isTauriMock.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
});

describe("SelfExplanationGate semantic review", () => {
  it("falls back to local structure checks when policy is not verified", async () => {
    const { activity, lesson } = fixture();
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        onStateChange={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Check structure locally" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Your causal explanation"),
    ).toHaveAccessibleDescription(/your draft stays on this device/i);
  });

  it("reviews an immutable snapshot while leaving the draft editable", async () => {
    const { activity, lesson } = fixture();
    let resolveAssessment: (value: unknown) => void = () => {};
    const assessment = new Promise((resolve) => {
      resolveAssessment = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "assess_prose") return assessment;
      if (command === "cancel_prose_assessment") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const onStateChange = vi.fn();

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        onStateChange={onStateChange}
      />,
    );
    const textarea = screen.getByLabelText("Your causal explanation");
    fireEvent.change(textarea, {
      target: { value: "The batch axis stays while features combine." },
    });
    const submit = await screen.findByRole("button", {
      name: "Review explanation",
    });
    expect(textarea).toHaveAccessibleDescription(
      /your draft, this lesson page, and its authored rubric labels are sent to AWS Bedrock/i,
    );
    expect(
      screen.getByText(/classifier-flagged GPT-5\.6 Sol traffic/i),
    ).not.toBeVisible();
    expect(textarea).toHaveAccessibleDescription(
      /effective policy: provider data sharing permitted \(account setting\)/i,
    );
    fireEvent.click(submit);

    expect(textarea).not.toBeDisabled();
    expect(textarea.closest("form")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText(
        "Reviewing the submitted snapshot. You can keep editing while it runs.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(textarea, {
      target: {
        value:
          "The batch axis stays while features combine. I am still editing.",
      },
    });
    expect(
      screen.getByText(
        "Reviewing the submitted snapshot. Your newer edits remain separate.",
      ),
    ).toBeInTheDocument();

    resolveAssessment(semanticAssessment(activity));
    await screen.findByText("The authored causal links are supported.");
    expect(
      screen.getByText(
        "This feedback belongs to your previous submitted draft.",
      ),
    ).toBeInTheDocument();
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "text-response",
        response:
          "The batch axis stays while features combine. I am still editing.",
        submittedResponse:
          "The batch axis stays while features combine.",
      }),
    );
  });

  it("keeps the last successful review when a retry fails", async () => {
    const { activity, lesson } = fixture();
    const priorFeedback = "The earlier draft supported every authored link.";
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "assess_prose") {
        return Promise.reject(
          "Prose review is unavailable. Your draft is saved; try again later.",
        );
      }
      return Promise.resolve(false);
    });

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        initialState={{
          kind: "text-response",
          response: "A revised draft.",
          submittedResponse: "The earlier submitted draft.",
          assessment: {
            assessmentMode: "semantic",
            ...semanticAssessment(activity, priorFeedback),
          },
        }}
        onStateChange={vi.fn()}
      />,
    );

    expect(screen.getByText(priorFeedback)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your causal explanation"), {
      target: { value: "A revised draft with another causal link." },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review explanation" }),
    );

    await screen.findByRole("alert");
    expect(screen.getByText(priorFeedback)).toBeInTheDocument();
  });

  it("ignores a late review result after the activity unmounts", async () => {
    const { activity, lesson } = fixture();
    let resolveAssessment: (value: unknown) => void = () => {};
    const assessment = new Promise((resolve) => {
      resolveAssessment = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "assess_prose") return assessment;
      if (command === "cancel_prose_assessment") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const onStateChange = vi.fn();
    const view = render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        onStateChange={onStateChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Your causal explanation"), {
      target: { value: "The batch axis stays while features combine." },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review explanation" }),
    );
    const callCountBeforeUnmount = onStateChange.mock.calls.length;

    view.unmount();
    expect(invokeMock).toHaveBeenCalledWith(
      "cancel_prose_assessment",
      expect.objectContaining({ requestId: expect.any(String) }),
    );

    await act(async () => {
      resolveAssessment(semanticAssessment(activity));
      await assessment;
    });
    expect(onStateChange).toHaveBeenCalledTimes(callCountBeforeUnmount);
  });

  it("keeps the request pending until native cancellation settles", async () => {
    const { activity, lesson } = fixture();
    let resolveAssessment: (value: unknown) => void = () => {};
    const assessment = new Promise((resolve) => {
      resolveAssessment = resolve;
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "assess_prose") return assessment;
      if (command === "cancel_prose_assessment") return Promise.resolve(true);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const onStateChange = vi.fn();

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        onStateChange={onStateChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Your causal explanation"), {
      target: { value: "The batch axis stays while features combine." },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review explanation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Cancelling..." }))
      .toBeDisabled();
    expect(
      screen.getByLabelText("Your causal explanation").closest("form"),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByText("Prose review cancelled. Your draft is saved."),
    ).not.toBeInTheDocument();
    const callCount = onStateChange.mock.calls.length;

    await act(async () => {
      resolveAssessment(semanticAssessment(activity, "Late feedback."));
      await assessment;
    });
    expect(
      screen.getByText("Prose review cancelled. Your draft is saved."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Your causal explanation").closest("form"),
    ).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText("Late feedback.")).not.toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledTimes(callCount);
  });

  it("offers a local structure check after remote review fails", async () => {
    const { activity, lesson } = fixture();
    invokeMock.mockImplementation((command: string) => {
      if (command === "prose_assessment_ready") {
        return Promise.resolve(verifiedReadiness);
      }
      if (command === "assess_prose") {
        return Promise.reject(
          "Prose review is unavailable. Your draft is saved; try again later.",
        );
      }
      return Promise.resolve(false);
    });
    const onStateChange = vi.fn();

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        onStateChange={onStateChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Your causal explanation"), {
      target: { value: "The batch axis stays while features combine." },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review explanation" }),
    );

    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "Check structure locally" }),
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText("FORMATIVE STRUCTURE CHECK · NOT SEMANTIC GRADING"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText(/^Wording not recognized:/i),
    ).not.toHaveLength(0);
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "text-response",
        assessment: expect.objectContaining({
          assessmentMode: "structure",
        }),
      }),
    );
  });

  it("does not render a restored assessment that mismatches the rubric", async () => {
    const { activity, lesson } = fixture();
    invokeMock.mockResolvedValue(false);

    render(
      <SelfExplanationGate
        activity={activity}
        lesson={lesson}
        initialState={{
          kind: "text-response",
          response: "A stored draft.",
          submittedResponse: "A stored draft.",
          assessment: {
            assessmentMode: "semantic",
            level: "demonstrated",
            matchedCriteria: ["invented-criterion"],
            missingCriteria: [],
            uncertainCriteria: [],
            feedback: "Corrupted persisted feedback.",
          },
        }}
        onStateChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Check structure locally" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Corrupted persisted feedback."),
    ).not.toBeInTheDocument();
  });
});
