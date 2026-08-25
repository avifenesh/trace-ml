import {
  Check,
  CircleStop,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { CodeLabActivity } from "../content/types";
import type { ActivityState } from "../learning/useActivityStateStore";
import { PyodideRunner } from "../runtime/PyodideRunner";
import type {
  AssessmentCheckResult,
  RunResult,
} from "../runtime/protocol";

interface PythonCodeLabProps {
  activity: CodeLabActivity;
  enabled: boolean;
  initialState?: Extract<ActivityState, { kind: "code-lab" }>;
  previouslyDemonstrated: boolean;
  onEvidence: (
    response: string,
    rubricSignals: string[],
    summary: string,
  ) => void;
  onStateChange: (
    state: Extract<ActivityState, { kind: "code-lab" }>,
  ) => void;
}

type CodeView = "editor" | "output";
type RunMode = "run" | "check";

function useCompactCodeLab() {
  const query = "(max-width: 720px)";
  const [compact, setCompact] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? false
      : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(query);
    const update = () => setCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return compact;
}

export function PythonCodeLab({
  activity,
  enabled,
  initialState,
  previouslyDemonstrated,
  onEvidence,
  onStateChange,
}: PythonCodeLabProps) {
  const starter = activity.spec.starterFiles[0]?.contents ?? "";
  const restoredSource = initialState?.source ?? starter;
  const [source, setSource] = useState(restoredSource);
  const [status, setStatus] = useState<
    "idle" | "loading" | "running" | "checking"
  >("idle");
  const [runMode, setRunMode] = useState<RunMode>("run");
  const [result, setResult] = useState<RunResult | null>(null);
  const [checks, setChecks] = useState<AssessmentCheckResult[]>([]);
  const [demonstrated, setDemonstrated] = useState(previouslyDemonstrated);
  const [activeView, setActiveView] = useState<CodeView>("editor");
  const compact = useCompactCodeLab();
  const runner = useRef<PyodideRunner | null>(null);
  const runSequence = useRef(0);
  const runInFlight = useRef(false);
  const pendingOutputFocus = useRef(false);
  const stopButtonRef = useRef<HTMLButtonElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const editorTabRef = useRef<HTMLButtonElement>(null);
  const outputTabRef = useRef<HTMLButtonElement>(null);
  const exitEditorOnNextTab = useRef(false);

  useEffect(
    () => () => {
      runSequence.current += 1;
      runInFlight.current = false;
      runner.current?.dispose();
    },
    [],
  );

  useEffect(() => {
    setDemonstrated(previouslyDemonstrated);
  }, [activity.id, previouslyDemonstrated]);

  const busy = status !== "idle";

  useEffect(() => {
    if (!busy) return;
    const frame = requestAnimationFrame(() => stopButtonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [busy]);

  useEffect(() => {
    if (status !== "idle" || !pendingOutputFocus.current) return;
    pendingOutputFocus.current = false;
    const frame = requestAnimationFrame(() => outputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [checks, result, status]);

  const getRunner = () => {
    runner.current ??= new PyodideRunner({
      allowedPackages: activity.spec.allowedPackages,
    });
    return runner.current;
  };

  const execute = async (assessment: boolean) => {
    if (!enabled || runInFlight.current) return;
    runInFlight.current = true;
    const sequence = ++runSequence.current;
    const mode: RunMode = assessment ? "check" : "run";
    setRunMode(mode);
    setActiveView("editor");
    setStatus("loading");
    setResult(null);
    setChecks([]);
    const currentRunner = getRunner();
    try {
      let nextResult: RunResult;
      if (assessment) {
        nextResult = await currentRunner.runClean(
          {
            code: source,
            checks: activity.spec.checks,
            filename: activity.spec.starterFiles[0]?.path,
            seed: activity.spec.seed,
            timeoutMs: activity.spec.timeoutMs,
            maxOutputBytes: activity.spec.maxOutputBytes,
            maxOutputLines: activity.spec.maxOutputLines,
          },
          () => {
            if (sequence === runSequence.current) setStatus("checking");
          },
        );
      } else {
        await currentRunner.initialize();
        if (sequence !== runSequence.current) return;
        setStatus("running");
        nextResult = await currentRunner.run({
            code: source,
            filename: activity.spec.starterFiles[0]?.path,
            seed: activity.spec.seed,
            timeoutMs: activity.spec.timeoutMs,
            maxOutputBytes: activity.spec.maxOutputBytes,
            maxOutputLines: activity.spec.maxOutputLines,
          });
      }
      if (sequence !== runSequence.current) return;

      setResult(nextResult);
      if (assessment) {
        setChecks(nextResult.checks);
        const allPassed =
          nextResult.status === "completed" &&
          nextResult.checks.length === activity.spec.checks.length &&
          nextResult.checks.every((check) => check.passed);
        if (allPassed && !demonstrated) {
          setDemonstrated(true);
          onEvidence(
            source,
            nextResult.checks.map((check) => check.id),
            `Passed ${nextResult.checks.length} authored checks in ${nextResult.environment.pyodideVersion} (${nextResult.environment.digest.slice(0, 12)}).`,
          );
        }
      }
    } catch (error) {
      if (sequence !== runSequence.current) return;
      setResult(null);
      setChecks([
        {
          id: "runtime",
          label: "Python runtime starts",
          passed: false,
          actual: "error",
          expected: "ready",
          error: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      if (!assessment) currentRunner.restart();
      if (sequence === runSequence.current) {
        runInFlight.current = false;
        pendingOutputFocus.current = true;
        setActiveView("output");
        setStatus("idle");
      }
    }
  };

  const packageLabel =
    activity.spec.allowedPackages.length > 0
      ? activity.spec.allowedPackages.join(" + ")
      : "standard library";
  const passedChecks = checks.filter((check) => check.passed).length;
  const failedChecks = checks.length - passedChecks;
  const runProgress =
    !enabled
      ? "Commit the prediction before running code"
      : status === "loading"
      ? runMode === "check"
        ? "Loading Python for clean checks"
        : "Loading Python"
      : status === "checking"
        ? "Checking work in a clean worker"
        : status === "running"
          ? "Running Python"
          : checks.length > 0
            ? `${passedChecks} passed, ${failedChecks} failed`
            : result
              ? result.status === "completed"
                ? "Run completed"
                : `Run ${result.status}`
              : "Not run";
  const outputText = result
    ? [
        result.output.map((chunk) => chunk.text).join(""),
        result.error,
        result.outputTruncated
          ? "\n[output truncated at authored quota]"
          : "",
      ]
        .filter(Boolean)
        .join("")
    : checks.find((check) => check.error)?.error ??
      (busy
        ? "Starting isolated runtime…"
        : enabled
          ? "Run the file to inspect its output."
          : "Commit the prediction above to enable this authored code lab.");

  const selectTabFromKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    view: CodeView,
  ) => {
    let nextView: CodeView | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextView = view === "editor" ? "output" : "editor";
    } else if (event.key === "Home") {
      nextView = "editor";
    } else if (event.key === "End") {
      nextView = "output";
    }
    if (!nextView) return;
    event.preventDefault();
    setActiveView(nextView);
    const nextTab = nextView === "editor" ? editorTabRef : outputTabRef;
    requestAnimationFrame(() => nextTab.current?.focus());
  };

  const updateSource = (
    nextSource: string,
    selectionStart?: number,
    selectionEnd?: number,
  ) => {
    if (nextSource === source) return;
    runSequence.current += 1;
    runInFlight.current = false;
    pendingOutputFocus.current = false;
    runner.current?.dispose();
    runner.current = null;
    setStatus("idle");
    setResult(null);
    setChecks([]);
    setActiveView("editor");
    setSource(nextSource);
    onStateChange({ kind: "code-lab", source: nextSource });
    if (selectionStart === undefined) return;
    requestAnimationFrame(() => {
      sourceRef.current?.setSelectionRange(
        selectionStart,
        selectionEnd ?? selectionStart,
      );
    });
  };

  const handleSourceKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key === "Escape" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      exitEditorOnNextTab.current = true;
      return;
    }
    if (event.key === "Tab" && exitEditorOnNextTab.current) {
      exitEditorOnNextTab.current = false;
      return;
    }
    exitEditorOnNextTab.current = false;
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if (!event.shiftKey) {
      const indentation = "    ";
      updateSource(
        source.slice(0, start) + indentation + source.slice(end),
        start + indentation.length,
      );
      return;
    }

    const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const indentation = source
      .slice(lineStart, start)
      .match(/^ {1,4}/)?.[0] ?? "";
    if (!indentation) return;
    updateSource(
      source.slice(0, lineStart) +
        source.slice(lineStart + indentation.length),
      Math.max(lineStart, start - indentation.length),
      Math.max(lineStart, end - indentation.length),
    );
  };

  const editorTabId = `${activity.id}-editor-tab`;
  const outputTabId = `${activity.id}-output-tab`;
  const editorPanelId = `${activity.id}-editor-panel`;
  const outputPanelId = `${activity.id}-output-panel`;
  const editorInstructionsId = `${activity.id}-editor-instructions`;

  return (
    <section
      id={activity.id}
      className={`python-code-lab lesson-activity ${demonstrated ? "demonstrated" : ""}`}
      aria-labelledby={`${activity.id}-title`}
      aria-busy={busy}
      tabIndex={-1}
    >
      <header>
        <div>
          <span className="eyebrow">CODE · ISOLATED PYTHON WORKER</span>
          <h2 id={`${activity.id}-title`}>Rebuild the mechanism in Python.</h2>
          <p>{activity.spec.instructions}</p>
          <small
            className="code-editor-keyboard-help"
            id={editorInstructionsId}
          >
            Tab indents. Press Escape, then Tab to leave the editor.
          </small>
        </div>
        <div className="runtime-contract">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            <strong>Pyodide 314.0.4</strong>
            {packageLabel} · clean checks
          </span>
        </div>
      </header>

      <div
        className="code-mobile-tabs"
        role="tablist"
        aria-label="Code lab view"
        hidden={!compact}
      >
        <button
          ref={editorTabRef}
          id={editorTabId}
          type="button"
          role="tab"
          aria-controls={editorPanelId}
          aria-selected={activeView === "editor"}
          tabIndex={activeView === "editor" ? 0 : -1}
          onClick={() => setActiveView("editor")}
          onKeyDown={(event) => selectTabFromKeyboard(event, "editor")}
        >
          Editor
        </button>
        <button
          ref={outputTabRef}
          id={outputTabId}
          type="button"
          role="tab"
          aria-controls={outputPanelId}
          aria-selected={activeView === "output"}
          tabIndex={activeView === "output" ? 0 : -1}
          onClick={() => setActiveView("output")}
          onKeyDown={(event) => selectTabFromKeyboard(event, "output")}
        >
          Output
          {checks.length > 0 && (
            <span aria-label={`${failedChecks} failed checks`}>
              {failedChecks > 0 ? failedChecks : "✓"}
            </span>
          )}
        </button>
      </div>

      <div className="code-workspace">
        <div
          id={editorPanelId}
          className="code-editor"
          role={compact ? "tabpanel" : undefined}
          aria-labelledby={compact ? editorTabId : undefined}
          hidden={compact && activeView !== "editor"}
        >
          <div>
            <span>{activity.spec.starterFiles[0]?.path ?? "lesson.py"}</span>
            <small>Python 3.14</small>
          </div>
          <textarea
            ref={sourceRef}
            aria-label="Python source"
            aria-describedby={editorInstructionsId}
            spellCheck={false}
            value={source}
            onChange={(event) => updateSource(event.target.value)}
            onBlur={() => {
              exitEditorOnNextTab.current = false;
            }}
            onKeyDown={handleSourceKeyDown}
          />
          <footer>
            <button
              type="button"
              className="icon-button"
              title="Reset starter code"
              aria-label="Reset starter code"
              disabled={busy}
              onClick={() => {
                if (
                  source !== starter &&
                  !globalThis.confirm(
                    "Reset this editor to the authored starter code?",
                  )
                ) {
                  return;
                }
                updateSource(starter);
                setResult(null);
                setChecks([]);
                setActiveView("editor");
              }}
            >
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            <span
              className="code-run-progress"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {runProgress}
            </span>
            <div>
              {busy && (
                <button
                  ref={stopButtonRef}
                  type="button"
                  className="stop-code"
                  onClick={() => runner.current?.interrupt()}
                >
                  <CircleStop size={15} aria-hidden="true" />
                  Stop
                </button>
              )}
              <button
                type="button"
                disabled={busy || !enabled}
                onClick={() => void execute(false)}
              >
                <Play size={15} aria-hidden="true" />
                Run
              </button>
              <button
                type="button"
                className="check-code"
                disabled={busy || !enabled}
                onClick={() => void execute(true)}
              >
                <FlaskConical size={15} aria-hidden="true" />
                Check work
              </button>
            </div>
          </footer>
        </div>
        <div
          ref={outputRef}
          id={outputPanelId}
          className="code-output"
          role={compact ? "tabpanel" : "region"}
          aria-labelledby={compact ? outputTabId : undefined}
          aria-label={compact ? undefined : "Python output"}
          tabIndex={-1}
          hidden={compact && activeView !== "output"}
        >
          <div>
            <span>OUTPUT</span>
            <small>
              {runProgress}
              {result && ` · env ${result.environment.digest.slice(0, 8)}`}
            </small>
          </div>
          <pre>{outputText}</pre>
          {checks.length > 0 && (
            <div className="code-check-results">
              {failedChecks > 0 && (
                <p className="code-remediation">
                  AUTHORED REMEDIATION · FIX EACH FAILED CHECK, THEN RUN CLEAN
                  CHECKS AGAIN
                </p>
              )}
              <ul className="code-checks" aria-label="Authored check results">
                {checks.map((check) => (
                  <li className={check.passed ? "passed" : ""} key={check.id}>
                    <span className="code-check-state">
                      {check.passed ? (
                        <Check size={14} aria-hidden="true" />
                      ) : (
                        <CircleStop size={14} aria-hidden="true" />
                      )}
                      {check.passed ? "Passed" : "Failed"}
                    </span>
                    <span>
                      <strong>{check.label}</strong>
                      <small>
                        {check.passed
                          ? `actual ${check.actual} · expected ${check.expected}`
                          : `Fix "${check.label}": expected ${check.expected}, but the run produced ${check.actual}.${check.error ? ` Runtime error: ${check.error}.` : ""} Edit the source, then run Check work again.`}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <footer className="code-contract-note">
        Every practice run and “Check work” attempt starts a fresh worker,
        records Python and pinned package versions in its environment digest,
        and destroys the worker afterward.
      </footer>
    </section>
  );
}
