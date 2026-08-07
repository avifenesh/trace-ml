import { expect, test, type Locator, type Page } from "@playwright/test";

const LESSONS = [
  ["00", "Trace the tools before the model", "prerequisite-trace"],
  ["01", "Data gives each quantity a role", "data-and-baseline"],
  ["02", "Two parameters draw one line", "linear-model"],
  ["03", "Loss turns many residuals into a surface", "loss-landscape"],
  ["04", "Gradient descent follows repeated local measurements", "gradient-descent"],
  ["05", "Three splits protect three decisions", "split-and-leakage"],
  ["06", "Capacity changes what a model can fit", "capacity-curves"],
  ["07", "A linear score becomes a probability", "logistic-link"],
  ["08", "A probability becomes a decision", "decision-costs"],
  ["09", "Features need a reproducible path", "feature-pipeline"],
  ["10", "Two models draw different neighborhoods", "knn-versus-tree"],
  ["11", "Control flexibility without touching the test set", "regularization-path"],
  ["12", "Many weak views can form one stronger model", "ensemble-votes"],
  ["13", "Hidden units can rebuild the space", "xor-hidden-space"],
  ["14", "Trace credit through a graph", "backprop-graph"],
  ["15", "Read the optimizer's trace", "optimizer-traces"],
  ["16", "Three objectives, three geometries", "cluster-project"],
  ["17", "Reuse one detector across space", "convolution-field"],
  ["18", "Route information with attention", "attention-routing"],
  ["19", "Learn from delayed consequences", "q-learning"],
  ["20", "Diagnose the deployed system", "shift-monitor"],
] as const;

const ACTIVE_LESSON_KEY = "trace-ml:active-lesson:v1";
const LEARNER_RECORD_LOCK = "trace-ml:learner-record:v1:write";
const PREREQUISITE_PREDICTION =
  "For y = (3x - 2)^2, what is dy/dx at x = 2?";
const RESPONSIVE_VIEWPORTS = [
  ["phone", 390, 844],
  ["landscape phone", 844, 390],
  ["compact breakpoint", 720, 900],
  ["desktop minimum", 1024, 680],
  ["helper drawer edge", 1399, 800],
  ["helper dock edge", 1400, 800],
  ["wide desktop", 1440, 1000],
] as const;

interface StoredLearnerRecord {
  events: Array<{
    activityId?: string;
    evidenceKind?: string;
    type: string;
  }>;
  evidence: Array<{ kind: string; level: string }>;
}

interface LayoutBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

function courseMap(page: Page) {
  return page.locator("#course-map-panel");
}

function lessonButton(map: Locator, number: string, title: string) {
  return map.getByRole("button", {
    name: new RegExp(
      `^${number}\\s+${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    ),
  });
}

async function learnerRecord(page: Page) {
  return page.evaluate(() => {
    const stored = localStorage.getItem("trace-ml:learner-record:v1");
    return stored
      ? JSON.parse(stored) as StoredLearnerRecord
      : { events: [], evidence: [] };
  });
}

async function layoutSnapshot(page: Page) {
  return page.evaluate(() => {
    const boxFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing layout element: ${selector}`);
      const box = element.getBoundingClientRect();
      return {
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        top: box.top,
      };
    };
    const lessonScroll = document.querySelector(".lesson-scroll");
    const helper = document.querySelector("#lesson-helper-panel");
    if (!lessonScroll || !helper) throw new Error("Missing scroll or helper.");

    const toolbarItems = [...document.querySelectorAll(".workspace-bar > *")]
      .map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          box,
          label: element.getAttribute("class") ?? element.tagName,
          visible:
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            box.width > 0 &&
            box.height > 0,
        };
      })
      .filter((item) => item.visible);
    const toolbarOverlaps: string[] = [];
    for (let leftIndex = 0; leftIndex < toolbarItems.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < toolbarItems.length;
        rightIndex += 1
      ) {
        const left = toolbarItems[leftIndex];
        const right = toolbarItems[rightIndex];
        if (!left || !right) continue;
        const horizontalOverlap =
          left.box.left < right.box.right - 1 &&
          left.box.right > right.box.left + 1;
        const verticalOverlap =
          left.box.top < right.box.bottom - 1 &&
          left.box.bottom > right.box.top + 1;
        if (horizontalOverlap && verticalOverlap) {
          toolbarOverlaps.push(`${left.label} overlaps ${right.label}`);
        }
      }
    }

    return {
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      courseMap: boxFor("#course-map-panel"),
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      helper: boxFor("#lesson-helper-panel"),
      helperClientWidth: helper.clientWidth,
      helperScrollWidth: helper.scrollWidth,
      lessonClientWidth: lessonScroll.clientWidth,
      lessonScrollWidth: lessonScroll.scrollWidth,
      toolbarOverlaps,
      viewportWidth: globalThis.innerWidth,
      workspace: boxFor(".lesson-workspace"),
    };
  });
}

function expectInsideViewport(box: LayoutBox, viewportWidth: number) {
  expect(box.left).toBeGreaterThanOrEqual(-0.5);
  expect(box.right).toBeLessThanOrEqual(viewportWidth + 0.5);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("the fixed course exposes every authored lesson before any Q&A", async ({
  page,
}) => {
  const map = courseMap(page);
  const navigation = map.getByRole("navigation");

  await expect(map.getByText("21 fixed lessons · 19 executable Python labs")).toBeVisible();
  await expect(navigation.getByRole("button")).toHaveCount(LESSONS.length);

  for (const [number, title] of LESSONS) {
    await expect(lessonButton(map, number, title)).toBeEnabled();
  }

  const teachingSources = page.getByLabel(
    "Editorial sources for Start with the notation; no Python or calculus is assumed",
  );
  await expect(teachingSources.getByRole("link")).toHaveCount(8);
  await expect(
    teachingSources.getByRole("link", {
      name: /^\[S109\] Python Software Foundation/,
    }),
  ).toHaveAttribute(
    "href",
    "https://docs.python.org/3/tutorial/introduction.html",
  );
  await expect(
    teachingSources.getByRole("link", {
      name: /^\[S110\] NumPy/,
    }),
  ).toHaveAttribute(
    "href",
    "https://numpy.org/doc/stable/reference/generated/numpy.ndarray.shape.html",
  );
  await expect(
    page.getByLabel(
      "Editorial sources for Start here: this lesson supplies the prerequisites",
    ).getByRole("link"),
  ).toHaveCount(5);

  await lessonButton(map, "20", "Diagnose the deployed system").click();
  await expect(
    page.getByRole("heading", {
      name: "Diagnose the deployed system",
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator("#lesson-helper-panel")).not.toBeVisible();
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("grounded in Lesson 20", { exact: true })).toBeVisible();

  const record = await learnerRecord(page);
  expect(record.events).toEqual([]);
  expect(record.evidence).toEqual([]);
});

test("prediction choices form one keyboard-operable radio group", async ({
  page,
}) => {
  const prediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  const group = prediction.getByRole("radiogroup", {
    name: PREREQUISITE_PREDICTION,
  });
  const options = group.getByRole("radio");

  await expect(options).toHaveCount(4);
  await options.nth(0).click();
  await expect(options.nth(0)).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toBeChecked();
  await expect(options.nth(0)).not.toBeChecked();
  await expect(
    prediction.getByRole("button", { name: "Commit prediction" }),
  ).toBeEnabled();
});

test("Python source preserves Tab indentation and supports Escape then Tab", async ({
  page,
}) => {
  const source = page.getByRole("textbox", { name: "Python source" });
  await source.focus();
  await source.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 0);
  });

  await page.keyboard.press("Tab");
  await expect(source).toBeFocused();
  await expect(source).toHaveValue(/^ {4}/);

  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Reset starter code" }),
  ).toBeFocused();
  await expect(source).toHaveAttribute(
    "aria-describedby",
    "00-python-numpy-plot-editor-instructions",
  );
});

test("lesson evidence has one authoritative progress live region", async ({
  page,
}) => {
  await expect(
    page.locator('main > .sr-only[role="status"][aria-live="polite"]'),
  ).toHaveCount(1);
  await expect(page.locator(".course-nav [aria-live]")).toHaveCount(0);
  await expect(page.locator(".workspace-bar [aria-live]")).toHaveCount(0);
  await expect(page.locator(".lesson-footer [aria-live]")).toHaveCount(0);
});

test("Next lesson resets scroll and persists the active lesson across reload", async ({
  page,
}) => {
  const lessonScroll = page.locator(".lesson-scroll");
  const previousScrollTop = await lessonScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(previousScrollTop).toBeGreaterThan(0);

  await page
    .getByRole("button", {
      name: "Next lesson: Data gives each quantity a role",
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Data gives each quantity a role",
      level: 1,
    }),
  ).toBeVisible();
  await expect
    .poll(() => lessonScroll.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), ACTIVE_LESSON_KEY)
    )
    .toBe("data-and-baseline");

  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Data gives each quantity a role",
      level: 1,
    }),
  ).toBeVisible();
});

test("an invalid stored lesson falls back to the authored first lesson", async ({
  page,
}) => {
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [ACTIVE_LESSON_KEY, "not-an-authored-lesson"],
  );
  await page.reload();

  await expect(
    page.getByRole("heading", {
      name: "Trace the tools before the model",
      level: 1,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => localStorage.getItem(key), ACTIVE_LESSON_KEY)
    )
    .toBe("prerequisite-trace");
});

test("the final lesson has no Next lesson command", async ({ page }) => {
  const map = courseMap(page);
  await lessonButton(map, "20", "Diagnose the deployed system").click();

  await expect(
    page.getByRole("heading", {
      name: "Diagnose the deployed system",
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Next lesson:/ }),
  ).toHaveCount(0);
  await expect(page.locator(".lesson-footer")).toContainText("Course synthesis");
});

test("verified short videos render in their authored lesson context", async ({
  page,
}) => {
  const map = courseMap(page);

  await lessonButton(
    map,
    "04",
    "Gradient descent follows repeated local measurements",
  ).click();
  const gradientVideo = page.getByRole("link", {
    name: /Google for Developers · 3 min Gradient Descent/,
  });
  await expect(gradientVideo).toContainText("watch the 2:12 embedded video");
  await expect(gradientVideo).toHaveAttribute(
    "href",
    "https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent?hl=en",
  );

  await lessonButton(map, "13", "Hidden units can rebuild the space").click();
  const neuralVideo = page.getByRole("link", {
    name: /3Blue1Brown · 19 min But what is a neural network/,
  });
  await expect(neuralVideo).toContainText("watch the 18:40 visual lesson");
  await expect(neuralVideo).toHaveAttribute(
    "href",
    "https://www.3blue1brown.com/lessons/neural-networks/",
  );

  await lessonButton(
    map,
    "12",
    "Many weak views can form one stronger model",
  ).click();
  const baggingVideo = page.getByRole("link", {
    name: /Inria Learning Lab · 13 min Intuitions on ensemble models: bagging/,
  });
  const boostingVideo = page.getByRole("link", {
    name: /Inria Learning Lab · 15 min Intuitions on ensemble models: boosting/,
  });
  await expect(baggingVideo).toContainText("watch the 12:43 explanation");
  await expect(boostingVideo).toContainText("watch the 14:22 explanation");

  await lessonButton(map, "14", "Trace credit through a graph").click();
  const backpropVideo = page.getByRole("link", {
    name: /Google for Developers · 10 min Neural Networks: Training using backpropagation/,
  });
  await expect(backpropVideo).toContainText("watch the 2:28 conceptual video");

  await lessonButton(map, "17", "Reuse one detector across space").click();
  const resnetVideo = page.getByRole("link", {
    name: /DeepLearningAI · 10 min C4W2L04 Why ResNets Work/,
  });
  await expect(resnetVideo).toContainText(
    "watch the 9:12 residual-path explanation",
  );
});

test("a recorded comparison remains activity state rather than comprehension evidence", async ({
  page,
}) => {
  const prediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  const visualLab = page.getByRole("region", {
    name: "Keep three traces synchronized",
  });
  const codeLab = page.getByRole("region", {
    name: "Rebuild the mechanism in Python.",
  });
  const lessonChecks = page.locator(".lesson-footer .evidence-status");
  await expect(
    page.getByRole("heading", {
      name: "Start with the notation; no Python or calculus is assumed",
    }),
  ).toBeVisible();
  await expect(
    visualLab.getByRole("button", { name: "Capture baseline" }),
  ).toBeDisabled();
  await expect(codeLab.getByRole("button", { name: "Run", exact: true }))
    .toBeDisabled();
  await expect(codeLab.getByRole("button", { name: "Check work" }))
    .toBeDisabled();
  await expect(lessonChecks).toContainText("0 of 2 required checks recorded");
  expect(
    await page.evaluate(() => {
      const teaching = document.querySelector(".lesson-teaching");
      const predictionElement = document.querySelector(".choice-prediction");
      const reading = document.querySelector(".reading-column");
      if (!teaching || !predictionElement || !reading) return false;
      return Boolean(
        teaching.compareDocumentPosition(predictionElement) &
          Node.DOCUMENT_POSITION_FOLLOWING &&
          predictionElement.compareDocumentPosition(reading) &
            Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);

  const resource = page.getByRole("link", {
    name: /Seeing Theory: Basic Probability/,
  });
  await resource.evaluate((link) => {
    link.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
  });
  await resource.click();

  await expect(
    resource.getByText("opened · understanding still assessed separately"),
  ).toBeVisible();
  const exposureOnly = await learnerRecord(page);
  expect(exposureOnly.events).toHaveLength(1);
  expect(exposureOnly.evidence).toEqual([]);

  await prediction.getByRole("radio", { name: "24", exact: true }).click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();
  await expect(prediction.getByRole("status")).toContainText(
    "The inner value is 3(2) - 2 = 4, the outer slope is 2(4) = 8",
  );
  await expect(lessonChecks).toContainText("1 of 2 required checks recorded");

  await expect(
    visualLab.getByRole("button", { name: "Capture baseline" }),
  ).toBeEnabled();
  await expect(codeLab.getByRole("button", { name: "Run", exact: true }))
    .toBeEnabled();
  const slider = visualLab.getByRole("slider");
  const compare = visualLab.getByRole("button", { name: "Compare state" });

  await expect(slider).toBeDisabled();
  await expect(compare).toBeDisabled();
  await visualLab.getByRole("button", { name: "Capture baseline" }).click();
  await slider.fill("-2");
  await expect(compare).toBeEnabled();

  const beforeComparison = await learnerRecord(page);
  expect(
    beforeComparison.evidence.some((item) => item.kind === "manipulation"),
  ).toBe(false);

  await compare.click();
  await expect(visualLab.getByText("BASELINE", { exact: true })).toBeVisible();
  await expect(
    visualLab.getByText("COUNTERFACTUAL", { exact: true }),
  ).toBeVisible();
  await expect(visualLab).toContainText(
    "Controlled comparison saved on this device. Understanding is checked separately.",
  );
  await expect(lessonChecks).toContainText("1 of 2 required checks recorded");

  const afterComparison = await learnerRecord(page);
  expect(
    afterComparison.evidence.some(
      (item) =>
        item.kind === "prediction" && item.level === "demonstrated",
    ),
  ).toBe(true);
  expect(
    afterComparison.evidence.some((item) => item.kind === "manipulation"),
  ).toBe(false);

  await page.reload();
  await expect(
    page.getByRole("link", { name: /Seeing Theory: Basic Probability/ }).getByText(
      "opened · understanding still assessed separately",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Keep three traces synchronized" }),
  ).toContainText(
    "Controlled comparison saved on this device. Understanding is checked separately.",
  );
  await expect(slider).toHaveValue("-2");
  await expect(visualLab.getByText("BASELINE", { exact: true })).toBeVisible();
  await expect(
    visualLab.getByText("COUNTERFACTUAL", { exact: true }),
  ).toBeVisible();
  await expect(lessonChecks).toContainText("1 of 2 required checks recorded");
});

test("concurrent windows merge durable evidence before either reloads", async ({
  context,
  page,
}) => {
  const second = await context.newPage();
  await second.goto("/");
  await second.locator('[data-lesson-id="loss-landscape"]').click();

  await page.evaluate((lockName) => {
    let releaseLock = () => undefined;
    const held = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const state = globalThis as typeof globalThis & {
      __traceLockHeld?: boolean;
      __traceReleaseLock?: () => void;
    };
    state.__traceReleaseLock = releaseLock;
    void navigator.locks.request(lockName, async () => {
      state.__traceLockHeld = true;
      await held;
    });
  }, LEARNER_RECORD_LOCK);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (globalThis as typeof globalThis & {
            __traceLockHeld?: boolean;
          }).__traceLockHeld,
        ),
      ),
    )
    .toBe(true);

  const chainPrediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  const lossPrediction = second.getByRole("region", {
    name: "One residual grows from 2 to 10 while all others stay fixed. By what factor does that row's squared-error contribution grow?",
  });
  await Promise.all([
    chainPrediction.getByRole("radio", { name: "24", exact: true }).click(),
    lossPrediction
      .getByRole("radio", { name: "25 times", exact: true })
      .click(),
  ]);
  await Promise.all([
    chainPrediction
      .getByRole("button", { name: "Commit prediction" })
      .click(),
    lossPrediction
      .getByRole("button", { name: "Commit prediction" })
      .click(),
  ]);
  const pendingLearnerWrites = () =>
    page.evaluate(async (lockName) => {
      const snapshot = await navigator.locks.query();
      return snapshot.pending?.filter((lock) => lock.name === lockName)
        .length ?? 0;
    }, LEARNER_RECORD_LOCK);
  await expect.poll(pendingLearnerWrites).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(500);
  const settledPendingWrites = await pendingLearnerWrites();
  expect(settledPendingWrites).toBeGreaterThanOrEqual(2);
  // Two direct commits can each schedule one cross-window reconciliation.
  expect(settledPendingWrites).toBeLessThanOrEqual(4);
  await page.waitForTimeout(250);
  expect(await pendingLearnerWrites()).toBe(settledPendingWrites);

  await page.evaluate(() => {
    const state = globalThis as typeof globalThis & {
      __traceReleaseLock?: () => void;
    };
    state.__traceReleaseLock?.();
  });

  const expectedActivityIds = [
    "00-chain-prediction",
    "03-outlier-prediction",
  ];
  await expect
    .poll(async () => {
      const stored = await learnerRecord(page);
      return stored.events
        .map((event) => event.activityId)
        .filter((activityId): activityId is string =>
          expectedActivityIds.includes(activityId),
        )
        .sort();
    })
    .toEqual([...expectedActivityIds].sort());

  await Promise.all([page.reload(), second.reload()]);
  for (const activePage of [page, second]) {
    const stored = await learnerRecord(activePage);
    expect(stored.events.map((event) => event.activityId)).toEqual(
      expect.arrayContaining(expectedActivityIds),
    );
  }
  await second.close();
});

test("authored remediation supports prediction, explanation, and code retries", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const prediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  await prediction.getByRole("radio", { name: "8", exact: true }).click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();
  await expect(prediction.getByRole("status")).toContainText(
    "AUTHORED REMEDIATION · REVIEW THE FEEDBACK AND RETRY",
  );
  await expect(prediction.getByRole("status")).toContainText(
    "Compute u = 3x - 2 first",
  );
  await prediction
    .getByRole("button", { name: "Retry prediction" })
    .click();
  await prediction.getByRole("radio", { name: "24", exact: true }).click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();
  await expect(prediction.getByRole("status")).toContainText("Correct.");

  const explanation = page.getByRole("region", {
    name: "Explain why a 4 by 3 batch times three weights produces four scores, why the derivative at x = 1 is 12, and why 80 percent is the relevant baseline.",
  });
  const response = explanation.getByRole("textbox", {
    name: "Your causal explanation",
  });
  await response.fill(
    "The batch axis keeps four examples because multiplying three features by the weights combines only the feature axis.",
  );
  await explanation
    .getByRole("button", { name: "Check structure" })
    .click();
  await expect(explanation.getByRole("status")).toContainText(
    "recognized wording for 1 of 3 authored criteria",
  );
  await expect(explanation.getByRole("status")).toContainText(
    "FORMATIVE STRUCTURE CHECK · NOT SEMANTIC GRADING",
  );

  await response.fill(
    "Four examples remain because the feature axis combines three inputs with three weights. The outer derivative factor 6 multiplies the inner derivative factor 2, producing 12. The baseline equals 80 percent because the negative majority contains 80 out of 100 cases.",
  );
  await explanation
    .getByRole("button", { name: "Check structure" })
    .click();
  await expect(explanation.getByRole("status")).toContainText(
    "All 3 authored elements were found",
  );

  const codeLab = page.getByRole("region", {
    name: "Rebuild the mechanism in Python.",
  });
  const source = codeLab.getByRole("textbox", { name: "Python source" });
  const check = codeLab.getByRole("button", { name: "Check work" });
  await check.click();
  await expect(codeLab).toContainText("2 passed, 3 failed", {
    timeout: 30_000,
  });
  await expect(codeLab).toContainText(
    "AUTHORED REMEDIATION · FIX EACH FAILED CHECK, THEN RUN CLEAN CHECKS AGAIN",
  );

  await source.fill(
    (await source.inputValue()).replace(
      "np.vstack((x, prediction))",
      "np.column_stack((x, prediction))",
    ),
  );
  await check.click();
  await expect(codeLab).toContainText("5 passed, 0 failed", {
    timeout: 30_000,
  });
  await expect(codeLab).not.toContainText(
    "AUTHORED REMEDIATION · FIX EACH FAILED CHECK, THEN RUN CLEAN CHECKS AGAIN",
  );
});

test("text submissions and Python drafts restore from the authored activity snapshot", async ({
  page,
}) => {
  const prediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  await prediction.getByRole("radio", { name: "24", exact: true }).click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();

  const explanation = page.getByRole("region", {
    name: "Explain why a 4 by 3 batch times three weights produces four scores, why the derivative at x = 1 is 12, and why 80 percent is the relevant baseline.",
  });
  const response = explanation.getByRole("textbox", {
    name: "Your causal explanation",
  });
  const submitted =
    "Four examples remain because the feature axis combines three inputs with three weights. The outer derivative factor 6 multiplies the inner derivative factor 2, producing 12. The baseline equals 80 percent because the negative majority contains 80 out of 100 cases.";
  await response.fill(submitted);
  await explanation
    .getByRole("button", { name: "Check structure" })
    .click();
  await expect(explanation.getByRole("status")).toContainText(
    "All 3 authored elements were found",
  );

  const codeLab = page.getByRole("region", {
    name: "Rebuild the mechanism in Python.",
  });
  const source = codeLab.getByRole("textbox", { name: "Python source" });
  const savedSource = "print('restored authored-lab draft')";
  await source.fill(savedSource);

  await page.reload();

  await expect(response).toHaveValue(submitted);
  await expect(explanation.getByRole("status")).toContainText(
    "All 3 authored elements were found",
  );
  await expect(source).toHaveValue(savedSource);
  await expect(
    prediction.getByRole("button", { name: "Commit prediction" }),
  ).toBeDisabled();
});

test("Q&A stays page-grounded, refuses unrelated teaching, and resumes threads", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const helper = page.locator("#lesson-helper-panel");
  const groundedQuestion = "Which dimensions survive a matrix operation?";

  await expect(helper).toContainText("Nothing is sent to Bedrock.");
  await helper
    .getByRole("textbox", { name: "Ask about this lesson" })
    .fill(groundedQuestion);
  await helper.getByRole("button", { name: "Send question" }).click();

  const tutorMessages = helper.locator("article.tutor-message.tutor");
  await expect(tutorMessages.last()).toContainText(
    "The closest authored passage is: The operation is valid because the three feature positions align with the three weights.",
  );
  await expect(
    tutorMessages.last().getByRole("link", {
      name: "Shapes describe which axes can interact · paragraph 2",
    }),
  ).toBeVisible();

  await helper.getByRole("button", { name: "New conversation" }).click();
  await expect(helper).toContainText(
    "Ask me about this page. I will answer from its authored paragraphs",
  );

  await helper
    .getByRole("textbox", { name: "Ask about this lesson" })
    .fill(
      "How should I fine tune a language model on private legal documents?",
    );
  await helper.getByRole("button", { name: "Send question" }).click();
  await expect(tutorMessages.last()).toContainText(
    "This page does not contain enough information to answer that question.",
  );
  await expect(tutorMessages.last().getByRole("link")).toHaveCount(0);

  await expect(
    page.getByRole("heading", {
      name: "Trace the tools before the model",
      level: 1,
    }),
  ).toBeVisible();
  const record = await learnerRecord(page);
  expect(record.events).toEqual([]);
  expect(record.evidence).toEqual([]);

  await page.reload();
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const restoredHelper = page.locator("#lesson-helper-panel");
  await restoredHelper
    .getByRole("button", { name: "Conversation history" })
    .click();
  await expect(restoredHelper.getByText("Resume a thread")).toBeVisible();
  await expect(
    restoredHelper.getByRole("button", {
      name: /Which dimensions survive.*1 question/,
    }),
  ).toBeVisible();
  await expect(
    restoredHelper.getByRole("button", {
      name: /How should I fine tune.*1 question/,
    }),
  ).toBeVisible();

  await restoredHelper
    .getByRole("button", {
      name: /Which dimensions survive.*1 question/,
    })
    .click();
  await expect(
    restoredHelper.locator("article.tutor-message.tutor").last(),
  ).toContainText("The batch axis is not summed away.");
});

test("mobile course map and Q&A are mutually exclusive drawers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  const map = courseMap(page);
  const helper = page.locator("#lesson-helper-panel");
  const openDrawers = page.locator(
    ".course-nav.mobile-open, .tutor-panel.mobile-open",
  );

  await page.getByRole("button", { name: "Open course map" }).click();
  await expect(map).toHaveClass(/mobile-open/);
  await expect(helper).not.toHaveClass(/mobile-open/);
  await expect(openDrawers).toHaveCount(1);
  await expect
    .poll(() =>
      map.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      }),
    )
    .toEqual({ left: 0, right: 390, width: 390 });
  await expect(map.getByRole("button", { name: "Close course map" }))
    .toBeFocused();

  await lessonButton(map, "20", "Diagnose the deployed system").click();
  await expect(map).not.toHaveClass(/mobile-open/);
  await expect(
    page.getByRole("heading", {
      name: "Diagnose the deployed system",
      level: 1,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(helper).toHaveClass(/mobile-open/);
  await expect(map).not.toHaveClass(/mobile-open/);
  await expect(openDrawers).toHaveCount(1);
  await expect
    .poll(() =>
      helper.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      }),
    )
    .toEqual({ left: 0, right: 390, width: 390 });
  await expect(helper.getByText("grounded in Lesson 20")).toBeVisible();
  await expect(helper).toContainText("Diagnose the deployed system");
  await expect(helper.locator("#lesson-helper-title")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  const wrappedFocus = await helper.evaluate((panel) => {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[contenteditable='true']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusable = [...panel.querySelectorAll<HTMLElement>(selector)].filter(
      (element) =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );
    return {
      activeInside: panel.contains(document.activeElement),
      wrappedToLast: document.activeElement === focusable.at(-1),
    };
  });
  expect(wrappedFocus).toEqual({
    activeInside: true,
    wrappedToLast: true,
  });
  await expect
    .poll(() =>
      helper
        .getByRole("textbox", { name: "Ask about this lesson" })
        .evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize),
        ),
    )
    .toBeGreaterThanOrEqual(16);

  await helper.getByRole("button", { name: "Close tutor" }).click();
  await expect(openDrawers).toHaveCount(0);
  const editableFontSizes = await page
    .locator(".self-explanation textarea, .code-editor textarea")
    .evaluateAll((elements) =>
      elements.map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    );
  expect(editableFontSizes.length).toBeGreaterThan(0);
  expect(editableFontSizes.every((fontSize) => fontSize >= 16)).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.visual-lab-control input[type="range"]')
        .first()
        .evaluate((element) => element.getBoundingClientRect().height)
    )
    .toBeGreaterThanOrEqual(44);
});

test("phone install metadata uses the maskable Trace icon", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  const metadata = await page.evaluate(async () => {
    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const manifestLink = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (!manifestLink) throw new Error("Missing web app manifest link.");
    const manifest = await fetch(manifestLink.href, { cache: "reload" }).then(
      (response) => response.json(),
    );
    const icons = await Promise.all(
      manifest.icons.map(
        async (icon: { sizes: string; src: string; type: string }) => {
          const response = await fetch(icon.src, { cache: "reload" });
          const bytes = await response.arrayBuffer();
          const view = new DataView(bytes);
          return {
            declaredSizes: icon.sizes,
            height: view.getUint32(20),
            src: icon.src,
            status: response.status,
            type: response.headers.get("content-type"),
            width: view.getUint32(16),
          };
        },
      ),
    );
    return {
      icons,
      manifestHref: manifestLink.getAttribute("href"),
      manifestId: manifest.id,
      maskableIcons: manifest.icons.filter(
        (icon: { purpose?: string }) => icon.purpose === "maskable",
      ),
      viewport: viewport?.content,
    };
  });

  expect(metadata.manifestHref).toBe("/manifest.webmanifest?v=2");
  expect(metadata.manifestId).toBe("/");
  expect(metadata.maskableIcons).toEqual([
    expect.objectContaining({
      sizes: "512x512",
      src: "/trace-ml-maskable-512.png",
      type: "image/png",
    }),
  ]);
  expect(metadata.icons).toEqual([
    {
      declaredSizes: "192x192",
      height: 192,
      src: "/trace-ml-192.png",
      status: 200,
      type: "image/png",
      width: 192,
    },
    {
      declaredSizes: "512x512",
      height: 512,
      src: "/trace-ml-512.png",
      status: 200,
      type: "image/png",
      width: 512,
    },
    {
      declaredSizes: "512x512",
      height: 512,
      src: "/trace-ml-maskable-512.png",
      status: 200,
      type: "image/png",
      width: 512,
    },
  ]);
  expect(metadata.viewport).toContain("interactive-widget=resizes-content");
});

test("landscape phone keeps the helper composer inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const helper = page.locator("#lesson-helper-panel");
  const layout = await helper.evaluate((panel) => {
    const box = (selector: string) => {
      const element = panel.querySelector(selector);
      if (!element) throw new Error(`Missing helper element: ${selector}`);
      return element.getBoundingClientRect();
    };
    const header = box(".tutor-header");
    const context = box(".thread-context");
    const conversation = box(".tutor-conversation");
    const composer = box(".tutor-composer");
    const textarea = panel.querySelector("textarea");
    if (!textarea) throw new Error("Missing helper textarea.");
    return {
      composerBottom: composer.bottom,
      contextAfterHeader: context.top >= header.bottom - 0.5,
      conversationAfterContext: conversation.top >= context.bottom - 0.5,
      conversationBeforeComposer:
        conversation.bottom <= composer.top + 0.5,
      conversationHeight: conversation.height,
      panelClientHeight: panel.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      textareaFontSize: Number.parseFloat(
        getComputedStyle(textarea).fontSize,
      ),
    };
  });

  expect(layout.composerBottom).toBeLessThanOrEqual(390.5);
  expect(layout.contextAfterHeader).toBe(true);
  expect(layout.conversationAfterContext).toBe(true);
  expect(layout.conversationBeforeComposer).toBe(true);
  expect(layout.conversationHeight).toBeGreaterThan(0);
  expect(layout.panelScrollHeight).toBeLessThanOrEqual(
    layout.panelClientHeight + 1,
  );
  expect(layout.textareaFontSize).toBeGreaterThanOrEqual(16);

  await helper.getByRole("button", { name: "Close tutor" }).click();
  await expect
    .poll(() =>
      page
        .locator('.visual-lab-control input[type="range"]')
        .first()
        .evaluate((element) => element.getBoundingClientRect().height)
    )
    .toBeGreaterThanOrEqual(44);
});

for (const [viewportName, width, height] of [
  ["minimum phone", 320, 680],
  ["full-screen drawer breakpoint", 480, 800],
] as const) {
  test(`mobile drawers fill the ${viewportName} viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.reload();

    const drawerBounds = async (drawer: Locator) =>
      drawer.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      });

    const map = courseMap(page);
    await page.getByRole("button", { name: "Open course map" }).click();
    await expect(map).toHaveClass(/mobile-open/);
    await expect.poll(() => drawerBounds(map)).toEqual({
      left: 0,
      right: width,
      width,
    });
    await map.getByRole("button", { name: "Close course map" }).click();

    const helper = page.locator("#lesson-helper-panel");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(helper).toHaveClass(/mobile-open/);
    await expect.poll(() => drawerBounds(helper)).toEqual({
      left: 0,
      right: width,
      width,
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("a restored deep lesson is visible when the mobile map opens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [ACTIVE_LESSON_KEY, "shift-monitor"],
  );
  await page.reload();

  await page.getByRole("button", { name: "Open course map" }).click();
  const map = courseMap(page);
  const closeButton = map.getByRole("button", { name: "Close course map" });
  const activeLesson = map.locator('[data-lesson-id="shift-monitor"]');

  await expect(activeLesson).toHaveAttribute("aria-current", "page");
  await expect(activeLesson).toBeInViewport();
  await expect(closeButton).toBeFocused();
  expect(
    await map.locator(".module-list").evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
});

for (const [viewportName, width, height] of [
  ["minimum phone", 320, 680],
  ["phone", 390, 844],
  ["desktop", 1024, 680],
] as const) {
  test(`every lesson fits its ${viewportName} reading surface`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height });
    await page.reload();

    for (const [, title, lessonId] of LESSONS) {
      await page
        .locator(`[data-lesson-id="${lessonId}"]`)
        .evaluate((button) => (button as HTMLButtonElement).click());
      await expect(
        page.getByRole("heading", { name: title, level: 1 }),
      ).toBeVisible();

      const fit = await page.evaluate(() => {
        const lesson = document.querySelector(".lesson-scroll");
        if (!lesson) throw new Error("Missing lesson reading surface.");
        const clippedText = [
          ...document.querySelectorAll(
            ".reading-column h1, .reading-column h2, .reading-column p, .reading-column button, .lesson-titlebar h1",
          ),
        ]
          .filter((element) => {
            const htmlElement = element as HTMLElement;
            const box = htmlElement.getBoundingClientRect();
            const style = getComputedStyle(htmlElement);
            return (
              box.width > 0 &&
              box.height > 0 &&
              style.visibility !== "hidden" &&
              htmlElement.scrollWidth > htmlElement.clientWidth + 1 &&
              style.overflowX === "hidden"
            );
          })
          .map((element) => element.textContent?.trim().slice(0, 80));
        return {
          clippedText,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          lessonClientWidth: lesson.clientWidth,
          lessonScrollWidth: lesson.scrollWidth,
        };
      });
      expect(fit.documentScrollWidth).toBeLessThanOrEqual(
        fit.documentClientWidth,
      );
      expect(fit.lessonScrollWidth).toBeLessThanOrEqual(
        fit.lessonClientWidth + 2,
      );
      expect(fit.clippedText).toEqual([]);
    }
  });
}

for (const [name, width, height] of RESPONSIVE_VIEWPORTS) {
  test(`lesson and helper avoid overflow or incoherent overlap at ${name}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height });
    await page.reload();

    await page.getByRole("button", { name: "Ask", exact: true }).click();
    const helper = page.locator("#lesson-helper-panel");
    await expect(helper).toBeVisible();
    await expect
      .poll(() =>
        helper.evaluate((element) =>
          Math.round(element.getBoundingClientRect().right)
        )
      )
      .toBe(width);

    const layout = await layoutSnapshot(page);
    expect(layout.viewportWidth).toBe(width);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(
      layout.documentClientWidth,
    );
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.bodyClientWidth);
    expect(layout.lessonScrollWidth).toBeLessThanOrEqual(
      layout.lessonClientWidth,
    );
    expect(layout.helperScrollWidth).toBeLessThanOrEqual(
      layout.helperClientWidth,
    );
    expect(layout.toolbarOverlaps).toEqual([]);
    expectInsideViewport(layout.workspace, width);
    expectInsideViewport(layout.helper, width);

    if (width <= 720) {
      await helper.getByRole("button", { name: "Close tutor" }).click();
      await expect(helper).not.toBeVisible();
      const mobileMechanism = await page.locator(".visual-lab-stage").evaluate(
        (stage) => {
          const diagram = stage.querySelector(".diagram-panel");
          const diagramViewport = stage.querySelector(".diagram-scroll");
          const control = stage.querySelector(".visual-lab-control");
          if (!diagram || !diagramViewport || !control) {
            throw new Error("Missing mobile mechanism elements.");
          }
          const diagramStyle = getComputedStyle(diagram);
          return {
            clientWidth: diagramViewport.clientWidth,
            diagramOrder: Number(diagramStyle.order),
            controlOrder: Number(getComputedStyle(control).order),
            position: diagramStyle.position,
            scrollWidth: diagramViewport.scrollWidth,
            svgWidth:
              diagram.querySelector("svg")?.getBoundingClientRect().width ?? 0,
            top: diagramStyle.top,
          };
        },
      );
      expect(mobileMechanism.position).toBe("sticky");
      expect(mobileMechanism.diagramOrder).toBeLessThan(
        mobileMechanism.controlOrder,
      );
      if (width < 560) {
        expect(mobileMechanism.scrollWidth).toBeGreaterThan(
          mobileMechanism.clientWidth,
        );
      }
      expect(mobileMechanism.svgWidth).toBeGreaterThanOrEqual(559);
      expect(mobileMechanism.top).toBe("62px");
      await expect(
        page.getByRole("button", { name: "Pan diagram left" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Pan diagram right" }),
      ).toBeVisible();
      if (width < 560) {
        const panLeft = page.getByRole("button", {
          name: "Pan diagram left",
        });
        const panRight = page.getByRole("button", {
          name: "Pan diagram right",
        });
        const panPosition = page.locator(".diagram-panel-footer output");
        await expect(panLeft).toBeDisabled();
        await expect(panRight).toBeEnabled();
        await expect(panPosition).toHaveText("Diagram view: start");
        await panRight.click();
        await expect(panPosition).toHaveText(
          /Diagram view: \d+% across/,
        );
        await panRight.click();
        await expect(panRight).toBeDisabled();
        await expect(panLeft).toBeEnabled();
        await expect(panPosition).toHaveText("Diagram view: end");
        await panLeft.click();
        await expect(panPosition).toHaveText(
          /Diagram view: \d+% across/,
        );
        await panLeft.click();
        await expect(panLeft).toBeDisabled();
        await expect(panPosition).toHaveText("Diagram view: start");
      }
    }

    if (width >= 1400) {
      expectInsideViewport(layout.courseMap, width);
      expect(layout.courseMap.right).toBeLessThanOrEqual(
        layout.workspace.left + 1,
      );
      expect(layout.workspace.right).toBeLessThanOrEqual(
        layout.helper.left + 1,
      );
    }
  });
}

test("storage failure remains visible in the compact toolbar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();

  const prediction = page.getByRole("region", {
    name: PREREQUISITE_PREDICTION,
  });
  await prediction.getByRole("radio", { name: "24", exact: true }).click();
  await prediction
    .getByRole("button", { name: "Commit prediction" })
    .click();

  await expect(
    page.locator(".mobile-workspace-actions").getByText("Session only"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.locator("#tutor-composer-note")).toContainText(
    "This conversation is kept only until you close the app.",
  );
});
