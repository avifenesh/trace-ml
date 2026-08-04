import { RotateCcw } from "lucide-react";
import { useState } from "react";
import type { PredictionActivity } from "../content/types";
import type { ActivityState } from "../learning/useActivityStateStore";

type PredictionState = Extract<ActivityState, { kind: "prediction" }>;

interface ChoicePredictionGateProps {
  activity: PredictionActivity;
  initialState?: PredictionState;
  previouslyDemonstrated: boolean;
  onEvidence: (supported: boolean, response: string) => void;
  onStateChange: (state: PredictionState) => void;
}

export function ChoicePredictionGate({
  activity,
  initialState,
  previouslyDemonstrated,
  onEvidence,
  onStateChange,
}: ChoicePredictionGateProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(
    initialState?.selectedOptionId ??
      initialState?.committedOptionId ??
      null,
  );
  const [answer, setAnswer] = useState<string | null>(
    initialState?.committedOptionId ?? null,
  );
  const currentSupported = answer === activity.checkpoint.correctOptionId;
  const supported = answer === null ? previouslyDemonstrated : currentSupported;

  return (
    <section
      id={activity.id}
      className={`choice-prediction lesson-activity ${supported ? "supported" : ""}`}
      aria-labelledby={`${activity.id}-title`}
      tabIndex={-1}
    >
      <div>
        <span className="eyebrow">PREDICT · COMMIT BEFORE FEEDBACK</span>
        <h2 id={`${activity.id}-title`}>{activity.checkpoint.prompt}</h2>
        <p id={`${activity.id}-instructions`}>
          Select an answer, then commit it before feedback is shown.
        </p>
      </div>
      <div className="choice-prediction-controls">
        <fieldset
          className="choice-prediction-options"
          role="radiogroup"
          aria-describedby={`${activity.id}-instructions`}
          disabled={answer !== null}
        >
          <legend className="sr-only">{activity.checkpoint.prompt}</legend>
          {activity.checkpoint.options.map((option) => {
            const selected = selectedAnswer === option.id;
            return (
              <label
                className={`prediction-option ${selected ? "selected" : ""}`}
                key={option.id}
              >
                <input
                  type="radio"
                  name={`${activity.id}-answer`}
                  value={option.id}
                  checked={selected}
                  onChange={() => {
                    setSelectedAnswer(option.id);
                    onStateChange({
                      kind: "prediction",
                      selectedOptionId: option.id,
                    });
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </fieldset>
        <button
          type="button"
          className="commit-prediction"
          disabled={!selectedAnswer || answer !== null}
          onClick={() => {
            if (!selectedAnswer) return;
            setAnswer(selectedAnswer);
            onStateChange({
              kind: "prediction",
              selectedOptionId: selectedAnswer,
              committedOptionId: selectedAnswer,
            });
            onEvidence(
              selectedAnswer === activity.checkpoint.correctOptionId,
              selectedAnswer,
            );
          }}
        >
          Commit prediction
        </button>
      </div>
      {(answer || previouslyDemonstrated) && (
        <div className="choice-prediction-feedback" role="status">
          {answer && !currentSupported && (
            <strong className="remediation-label">
              AUTHORED REMEDIATION · REVIEW THE FEEDBACK AND RETRY
            </strong>
          )}
          <p>
            {answer
              ? currentSupported
                ? activity.checkpoint.supportedExplanation
                : previouslyDemonstrated
                  ? `This retry is not supported. A supported earlier attempt remains in your objective record. ${activity.checkpoint.revisitExplanation}`
                  : activity.checkpoint.revisitExplanation
              : "A supported prediction was recorded earlier for this activity."}
          </p>
          {answer && (
            <button
              type="button"
              onClick={() => {
                setAnswer(null);
                setSelectedAnswer(null);
                onStateChange({ kind: "prediction" });
              }}
            >
              <RotateCcw size={14} />
              Retry prediction
            </button>
          )}
        </div>
      )}
    </section>
  );
}
