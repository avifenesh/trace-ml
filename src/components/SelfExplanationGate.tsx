import { CornerDownLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { TextResponseActivity } from "../content/types";
import { assessTextResponse } from "../learning/text-rubric";
import type { ExplanationAssessment } from "../learning/types";
import type { ActivityState } from "../learning/useActivityStateStore";

type TextResponseState = Extract<
  ActivityState,
  { kind: "text-response" }
>;

interface SelfExplanationGateProps {
  activity: TextResponseActivity;
  initialState?: TextResponseState;
  onAssess: (response: string, assessment: ExplanationAssessment) => void;
  onStateChange: (state: TextResponseState) => void;
}

export function SelfExplanationGate({
  activity,
  initialState,
  onAssess,
  onStateChange,
}: SelfExplanationGateProps) {
  const initialResponse = initialState?.response ?? "";
  const [response, setResponse] = useState(initialResponse);
  const [assessment, setAssessment] = useState<ExplanationAssessment | null>(
    () =>
      initialState?.submittedResponse === initialResponse && initialResponse
        ? assessTextResponse(activity, initialResponse)
        : null,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = response.trim();
    if (!trimmed) return;
    const nextAssessment = assessTextResponse(activity, trimmed);
    setAssessment(nextAssessment);
    onStateChange({
      kind: "text-response",
      response: trimmed,
      submittedResponse: trimmed,
    });
    onAssess(trimmed, nextAssessment);
  };

  const structureComplete =
    assessment?.matchedCriteria.length === activity.rubric.criteria.length;
  const matchedCriteria = new Set(assessment?.matchedCriteria ?? []);

  return (
    <section
      id={activity.id}
      className={`self-explanation lesson-activity ${structureComplete ? "structure-complete" : ""}`}
      aria-labelledby={`${activity.id}-title`}
      tabIndex={-1}
    >
      <div className="explanation-brief">
        <span className="eyebrow">
          {activity.evidenceKind === "transfer"
            ? "TRANSFER · FORMATIVE DRAFT"
            : "RETRIEVE · FORMATIVE DRAFT"}
        </span>
        <h2 id={`${activity.id}-title`}>{activity.prompt}</h2>
        <p>{activity.guidance}</p>
      </div>
      <form onSubmit={submit}>
        <label htmlFor={`${activity.id}-response`}>
          Your causal explanation
        </label>
        <textarea
          id={`${activity.id}-response`}
          rows={4}
          value={response}
          placeholder="Explain the mechanism in your own words…"
          onChange={(event) => {
            const nextResponse = event.target.value;
            setResponse(nextResponse);
            setAssessment(null);
            onStateChange({
              kind: "text-response",
              response: nextResponse,
            });
          }}
        />
        <div className="explanation-actions">
          <small>
            The local checker can find named elements, not judge whether your
            causal claims are true. Prose does not count as an objective check.
          </small>
          <button type="submit" disabled={!response.trim()}>
            Check structure
            <CornerDownLeft size={15} />
          </button>
        </div>
      </form>
      {assessment && (
        <div
          className={`explanation-feedback ${assessment.level}`}
          role="status"
        >
          <div aria-hidden="true"><span /></div>
          <div>
            <strong className="remediation-label">
              FORMATIVE STRUCTURE CHECK · NOT SEMANTIC GRADING
            </strong>
            <p>{assessment.feedback}</p>
            <ul className="structure-criteria">
              {activity.rubric.criteria.map((criterion) => (
                <li
                  className={
                    matchedCriteria.has(criterion.id)
                      ? "mentioned"
                      : "missing"
                  }
                  key={criterion.id}
                >
                  <span aria-hidden="true" />
                  {criterion.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
