// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lessons } from "../content/course";
import type { PredictionActivity } from "../content/types";
import { ChoicePredictionGate } from "./ChoicePredictionGate";

afterEach(cleanup);

describe("ChoicePredictionGate attempt state", () => {
  it("distinguishes an unsupported retry from an earlier supported attempt", () => {
    const activity = lessons
      .flatMap((lesson) => lesson.activities)
      .find(
        (candidate): candidate is PredictionActivity =>
          candidate.kind === "prediction",
      );
    if (!activity) throw new Error("Missing prediction fixture.");
    const unsupportedOption = activity.checkpoint.options.find(
      (option) => option.id !== activity.checkpoint.correctOptionId,
    );
    if (!unsupportedOption) throw new Error("Missing unsupported option.");
    const onEvidence = vi.fn();

    render(
      <ChoicePredictionGate
        activity={activity}
        previouslyDemonstrated
        onEvidence={onEvidence}
        onStateChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: unsupportedOption.label }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Commit prediction" }),
    );

    expect(
      screen.getByText(/this retry is not supported/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a supported earlier attempt remains/i),
    ).toBeInTheDocument();
    expect(onEvidence).toHaveBeenCalledWith(false, unsupportedOption.id);
  });
});
