import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Check,
  GitCompareArrows,
  SlidersHorizontal,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VisualLabActivity } from "../content/types";
import {
  visualMechanismObservation,
  type VisualMechanismObservation,
} from "../labs/visual-mechanism";
import type { ActivityState } from "../learning/useActivityStateStore";
import { MechanismDiagram } from "./MechanismDiagram";

type VisualLabState = Extract<ActivityState, { kind: "visual-lab" }>;

interface VisualMechanismLabProps {
  activity: VisualLabActivity;
  enabled: boolean;
  initialState?: VisualLabState;
  persistenceStatus: "persistent" | "memory-only";
  onStateChange: (state: VisualLabState) => void;
}

const FALLBACK_CONTROL = {
  label: "Intervention strength",
  min: 0,
  max: 1,
  step: 0.05,
  initial: 0,
  lowLabel: "baseline",
  highLabel: "strong intervention",
};

interface DiagramPanState {
  canPanLeft: boolean;
  canPanRight: boolean;
  position: number;
}

const INITIAL_DIAGRAM_PAN_STATE: DiagramPanState = {
  canPanLeft: false,
  canPanRight: false,
  position: 0,
};

export function VisualMechanismLab({
  activity,
  enabled,
  initialState,
  persistenceStatus,
  onStateChange,
}: VisualMechanismLabProps) {
  const control = activity.control ?? FALLBACK_CONTROL;
  const inRange = (candidate: number | undefined) =>
    candidate !== undefined &&
    Number.isFinite(candidate) &&
    candidate >= control.min &&
    candidate <= control.max;
  const restoredValue = inRange(initialState?.value)
    ? initialState?.value ?? control.initial
    : control.initial;
  const restoredBaseline = inRange(initialState?.baselineValue)
    ? visualMechanismObservation(
        activity.labId,
        initialState?.baselineValue ?? control.initial,
        control,
      )
    : null;
  const restoredComparison = inRange(initialState?.comparisonValue)
    ? visualMechanismObservation(
        activity.labId,
        initialState?.comparisonValue ?? control.initial,
        control,
      )
    : null;
  const [value, setValue] = useState(restoredValue);
  const [baseline, setBaseline] =
    useState<VisualMechanismObservation | null>(restoredBaseline);
  const [comparison, setComparison] =
    useState<VisualMechanismObservation | null>(restoredComparison);
  const recorded = baseline !== null && comparison !== null;
  const sliderRef = useRef<HTMLInputElement>(null);
  const diagramScrollRef = useRef<HTMLDivElement>(null);
  const [diagramPanState, setDiagramPanState] = useState(
    INITIAL_DIAGRAM_PAN_STATE,
  );
  const current = useMemo(
    () =>
      visualMechanismObservation(
        activity.labId,
        value,
        control,
      ),
    [activity.labId, control, value],
  );
  const changed =
    baseline !== null &&
    Math.abs(current.normalized - baseline.normalized) >= 0.18;

  const updateDiagramPanState = useCallback(() => {
    const viewport = diagramScrollRef.current;
    if (!viewport) return;
    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const scrollLeft = Math.min(maximum, Math.max(0, viewport.scrollLeft));
    const nextState = {
      canPanLeft: scrollLeft > 1,
      canPanRight: scrollLeft < maximum - 1,
      position: maximum > 0 ? Math.round((scrollLeft / maximum) * 100) : 0,
    };
    setDiagramPanState((previous) =>
      previous.canPanLeft === nextState.canPanLeft &&
      previous.canPanRight === nextState.canPanRight &&
      previous.position === nextState.position
        ? previous
        : nextState,
    );
  }, []);

  useEffect(() => {
    const viewport = diagramScrollRef.current;
    if (!viewport) return;
    const frame = requestAnimationFrame(updateDiagramPanState);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateDiagramPanState);
    observer?.observe(viewport);
    const diagram = viewport.firstElementChild;
    if (diagram) observer?.observe(diagram);
    viewport.addEventListener("scroll", updateDiagramPanState, {
      passive: true,
    });
    globalThis.addEventListener("resize", updateDiagramPanState);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      viewport.removeEventListener("scroll", updateDiagramPanState);
      globalThis.removeEventListener("resize", updateDiagramPanState);
    };
  }, [activity.labId, updateDiagramPanState]);

  const recordComparison = () => {
    if (!enabled || !baseline || !changed) return;
    setComparison(current);
    onStateChange({
      kind: "visual-lab",
      value,
      baselineValue: baseline.value,
      comparisonValue: current.value,
    });
  };

  const panDiagram = (direction: -1 | 1) => {
    const viewport = diagramScrollRef.current;
    if (!viewport) return;
    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const step = Math.max(180, viewport.clientWidth * 0.72);
    const target = Math.min(
      maximum,
      Math.max(0, viewport.scrollLeft + direction * step),
    );
    viewport.scrollTo({
      left: target,
      behavior: "smooth",
    });
  };
  const diagramPositionLabel =
    !diagramPanState.canPanLeft && !diagramPanState.canPanRight
      ? "Full diagram visible"
      : !diagramPanState.canPanLeft
        ? "Diagram view: start"
        : !diagramPanState.canPanRight
          ? "Diagram view: end"
          : `Diagram view: ${diagramPanState.position}% across`;

  return (
    <section
      id={activity.id}
      className={`visual-mechanism-lab lesson-activity ${recorded ? "recorded" : ""}`}
      aria-labelledby={`${activity.id}-title`}
      tabIndex={-1}
    >
      <header>
        <div>
          <span className="eyebrow">MANIPULATE · CONTROLLED COMPARISON</span>
          <h2 id={`${activity.id}-title`}>{activity.title}</h2>
          <p>{activity.prompt}</p>
        </div>
        <SlidersHorizontal size={24} aria-hidden="true" />
      </header>

      <div className="experiment-contract">
        <div>
          <span>HOLD FIXED</span>
          <strong>{activity.invariant ?? "Every variable except the named control."}</strong>
        </div>
        <div>
          <span>INTERVENE</span>
          <strong>{activity.intervention ?? control.label}</strong>
        </div>
      </div>

      <div className="visual-lab-stage">
        <div className="visual-lab-control" aria-disabled={!enabled}>
          <label>
            <span>
              {control.label}
              <strong>{value}</strong>
            </span>
            <input
              ref={sliderRef}
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={value}
              disabled={baseline === null}
              aria-describedby={`${activity.id}-state`}
              aria-valuetext={`${value}. ${current.primary}. ${current.secondary}.`}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setValue(nextValue);
                setComparison(null);
                onStateChange({
                  kind: "visual-lab",
                  value: nextValue,
                  baselineValue: baseline?.value,
                });
              }}
            />
          </label>
          <div className="control-extents">
            <span>{control.lowLabel}</span>
            <span>{control.highLabel}</span>
          </div>
          <div className="visual-lab-actions">
            <button
              type="button"
              className={baseline ? "captured" : ""}
              disabled={!enabled}
              onClick={() => {
                setBaseline(current);
                setComparison(null);
                onStateChange({
                  kind: "visual-lab",
                  value,
                  baselineValue: current.value,
                });
                requestAnimationFrame(() => sliderRef.current?.focus());
              }}
            >
              <BookmarkPlus size={15} />
              {baseline ? "Replace baseline" : "Capture baseline"}
            </button>
            <button
              type="button"
              disabled={!enabled || !changed}
              onClick={recordComparison}
            >
              <GitCompareArrows size={15} />
              Compare state
            </button>
          </div>
          <p
            className="experiment-status"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {recorded
              ? persistenceStatus === "persistent"
                ? "Controlled comparison saved on this device. Understanding is checked separately."
                : "Controlled comparison recorded for this session only; browser storage is unavailable."
              : !enabled
              ? "Commit the prediction above before revealing the authored mechanism."
              : !baseline
              ? "Capture the authored starting state before changing the control."
              : changed
                ? "A valid counterfactual is ready to compare."
                : "Move far enough from the baseline to create a distinct state."}
          </p>
        </div>

        <div className="diagram-panel">
          <div
            id={`${activity.id}-diagram-viewport`}
            className="diagram-scroll"
            ref={diagramScrollRef}
            role="region"
            aria-label="Mechanism diagram viewport"
            aria-describedby={`${activity.id}-diagram-position`}
            tabIndex={0}
          >
            <MechanismDiagram
              labId={activity.labId}
              observation={current}
            />
          </div>
          <div className="diagram-panel-footer">
            <div>
              <span>fixed authored state · linked views</span>
              <output
                id={`${activity.id}-diagram-position`}
                aria-live="polite"
              >
                {diagramPositionLabel}
              </output>
            </div>
            <div className="diagram-pan-controls" aria-label="Pan diagram">
              <button
                type="button"
                title="Pan diagram left"
                aria-label="Pan diagram left"
                aria-controls={`${activity.id}-diagram-viewport`}
                disabled={!diagramPanState.canPanLeft}
                onClick={() => panDiagram(-1)}
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Pan diagram right"
                aria-label="Pan diagram right"
                aria-controls={`${activity.id}-diagram-viewport`}
                disabled={!diagramPanState.canPanRight}
                onClick={() => panDiagram(1)}
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div
          className="visual-lab-readouts"
          id={`${activity.id}-state`}
        >
          <div>
            <span>PRIMARY STATE</span>
            <strong>{current.primary}</strong>
          </div>
          <div>
            <span>SECONDARY STATE</span>
            <strong>{current.secondary}</strong>
          </div>
        </div>
        <p>{current.explanation}</p>

        {baseline && comparison && (
          <div className="snapshot-comparison">
            <div>
              <span>BASELINE</span>
              <strong>{baseline.primary}</strong>
              <small>{baseline.secondary}</small>
            </div>
            <GitCompareArrows size={18} />
            <div>
              <span>COUNTERFACTUAL</span>
              <strong>{comparison.primary}</strong>
              <small>{comparison.secondary}</small>
            </div>
          </div>
        )}
      </div>

      <footer>
        {recorded ? <Check size={15} /> : <i />}
        {recorded
          ? persistenceStatus === "persistent"
            ? "Controlled comparison saved on this device. Understanding is checked separately."
            : "Controlled comparison recorded for this session only; browser storage is unavailable."
          : enabled
            ? "Save a baseline and one counterfactual; slider travel alone records nothing."
            : "Authored remediation: commit a prediction, then capture and compare two states."}
      </footer>
    </section>
  );
}
