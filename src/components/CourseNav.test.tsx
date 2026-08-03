// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLearnerRecord } from "../learning/evidence";
import { CourseNav } from "./CourseNav";

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
});

afterEach(() => {
  cleanup();
  if (scrollIntoViewDescriptor) {
    Object.defineProperty(
      Element.prototype,
      "scrollIntoView",
      scrollIntoViewDescriptor,
    );
  } else {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

function courseNav(
  overrides: Partial<{
    inert: boolean;
    isModal: boolean;
    mobileOpen: boolean;
  }> = {},
) {
  return (
    <CourseNav
      activeLessonId="shift-monitor"
      inert={overrides.inert ?? false}
      isModal={overrides.isModal ?? false}
      learnerRecord={createLearnerRecord()}
      mobileOpen={overrides.mobileOpen ?? false}
      panelRef={createRef<HTMLElement>()}
      onCloseMobile={vi.fn()}
      onSelectLesson={vi.fn()}
    />
  );
}

describe("CourseNav active lesson visibility", () => {
  it("scrolls a restored desktop lesson into view", async () => {
    render(courseNav());

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });
  });

  it("waits for the mobile map to open and does not steal focus", async () => {
    const rendered = render(
      courseNav({ inert: true, isModal: true, mobileOpen: false }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();

    const closeButton = screen.getByLabelText("Close course map");
    closeButton.focus();

    rendered.rerender(
      courseNav({ inert: false, isModal: true, mobileOpen: true }),
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    });
    expect(document.activeElement).toBe(closeButton);
  });
});
