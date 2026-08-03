import {
  CircleStop,
  CornerDownLeft,
  LoaderCircle,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  Lesson,
  TextResponseActivity,
} from "../content/types";
import {
  assessProseSemantically,
  cancelProseAssessment,
  proseAssessmentError,
  proseAssessmentReady,
  restoredExplanationAssessment,
  semanticProseAssessmentAvailable,
} from "../learning/prose-assessment";
import { assessTextResponse } from "../learning/text-rubric";
import type { ExplanationAssessment } from "../learning/types";
import type { ActivityState } from "../learning/useActivityStateStore";

type TextResponseState = Extract<
  ActivityState,
  { kind: "text-response" }
>;

interface SelfExplanationGateProps {
  activity: TextResponseActivity;
  lesson: Lesson;
  initialState?: TextResponseState;
  onStateChange: (state: TextResponseState) => void;
}

interface PendingReview {
  requestId: string;
  response: string;
  cancelling: boolean;
}

type ReviewMode = "checking" | "semantic" | "local";

export function SelfExplanationGate({
  activity,
  lesson,
  initialState,
  onStateChange,
}: SelfExplanationGateProps) {
  const semanticAssessment = semanticProseAssessmentAvailable();
  const initialResponse = (initialState?.response ?? "").slice(0, 8_000);
  const restoredAssessment = initialState?.submittedResponse
    ? restoredExplanationAssessment(activity, initialState.assessment)
    : null;
  const restoredResponse = restoredAssessment
    ? initialState?.submittedResponse?.slice(0, 8_000)
    : undefined;
  const [response, setResponse] = useState(initialResponse);
  const responseRef = useRef(initialResponse);
  const [assessment, setAssessment] = useState<ExplanationAssessment | null>(
    restoredAssessment,
  );
  const [reviewedResponse, setReviewedResponse] = useState(restoredResponse);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(
    semanticAssessment ? "checking" : "local",
  );
  const [pending, setPending] = useState<PendingReview | null>(null);
  const pendingRequestRef = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!semanticAssessment) return;
    let current = true;
    void proseAssessmentReady().then((ready) => {
      if (current) setReviewMode(ready ? "semantic" : "local");
    });
    return () => {
      current = false;
    };
  }, [semanticAssessment]);

  useEffect(
    () => () => {
      const requestId = pendingRequestRef.current;
      pendingRequestRef.current = null;
      if (requestId) void cancelProseAssessment(requestId);
    },
    [],
  );

  const stateWithReview = (
    currentResponse: string,
    currentAssessment = assessment,
    submittedResponse = reviewedResponse,
  ): TextResponseState => ({
    kind: "text-response",
    response: currentResponse,
    ...(currentAssessment && submittedResponse
      ? {
          submittedResponse,
          assessment: currentAssessment,
        }
      : {}),
  });

  const applyAssessment = (
    nextAssessment: ExplanationAssessment,
    submittedResponse: string,
  ) => {
    setAssessment(nextAssessment);
    setReviewedResponse(submittedResponse);
    onStateChange(
      stateWithReview(
        responseRef.current,
        nextAssessment,
        submittedResponse,
      ),
    );
  };

  const checkStructureLocally = () => {
    const trimmed = response.trim();
    if (!trimmed || pending) return;
    setError(null);
    setNotice(null);
    applyAssessment(assessTextResponse(activity, trimmed), trimmed);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = response.trim();
    if (!trimmed || pending || reviewMode === "checking") return;

    const currentRequest = [
      activity.id,
      Date.now().toString(36),
      String(++requestSequence.current),
    ].join("-");
    pendingRequestRef.current = currentRequest;
    setPending({
      requestId: currentRequest,
      response: trimmed,
      cancelling: false,
    });
    setError(null);
    setNotice(null);
    onStateChange(stateWithReview(trimmed));

    try {
      const nextAssessment = reviewMode === "semantic"
        ? await assessProseSemantically(
          lesson,
          activity,
          trimmed,
          currentRequest,
        )
        : assessTextResponse(activity, trimmed);
      if (pendingRequestRef.current !== currentRequest) return;
      applyAssessment(nextAssessment, trimmed);
    } catch (assessmentError) {
      if (pendingRequestRef.current !== currentRequest) return;
      const message = proseAssessmentError(assessmentError);
      if (message.toLocaleLowerCase().includes("cancel")) {
        setNotice(message);
      } else {
        setError(message);
      }
    } finally {
      if (pendingRequestRef.current === currentRequest) {
        pendingRequestRef.current = null;
        setPending(null);
      }
    }
  };

  const cancelReview = () => {
    if (!pending || pending.cancelling) return;
    pendingRequestRef.current = null;
    setPending(null);
    setNotice("Prose review cancelled. Your draft is saved.");
    setError(null);
    void cancelProseAssessment(pending.requestId).catch((cancelError) => {
      setError(proseAssessmentError(cancelError));
    });
  };

  const criterionIds = activity.rubric.criteria.map(
    (criterion) => criterion.id,
  );
  const matchedCriteria = new Set(assessment?.matchedCriteria ?? []);
  const uncertainCriteria = new Set(assessment?.uncertainCriteria ?? []);
  const structureComplete = Boolean(
    assessment &&
      matchedCriteria.size === criterionIds.length &&
      criterionIds.every((id) => matchedCriteria.has(id)) &&
      assessment.missingCriteria.length === 0 &&
      assessment.uncertainCriteria.length === 0,
  );
  const assessmentIsForPreviousDraft = Boolean(
    assessment &&
      reviewedResponse &&
      reviewedResponse !== response.trim(),
  );
  const pendingDraftChanged = Boolean(
    pending && pending.response !== response.trim(),
  );

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
      <form onSubmit={submit} aria-busy={pending !== null}>
        <label htmlFor={`${activity.id}-response`}>
          Your causal explanation
        </label>
        <textarea
          id={`${activity.id}-response`}
          rows={4}
          maxLength={8_000}
          value={response}
          placeholder="Explain the mechanism in your own words…"
          onChange={(event) => {
            const nextResponse = event.target.value;
            responseRef.current = nextResponse;
            setResponse(nextResponse);
            setError(null);
            setNotice(null);
            onStateChange(stateWithReview(nextResponse));
          }}
        />
        <div className="explanation-actions">
          <small>
            {reviewMode === "semantic"
              ? "Bedrock receives the authored lesson text, prompt, guidance, rubric labels and feedback, plus your draft. Store=false is not a zero-retention guarantee; AWS may retain classifier-flagged model traffic for up to 30 days. This never changes course access."
              : reviewMode === "checking"
                ? "Checking whether Bedrock review is available. Your draft remains editable."
                : "The local check does not send your draft and finds rubric structure only; it cannot judge causal correctness."}
          </small>
          <div className="explanation-action-buttons">
            {error && reviewMode === "semantic" && (
              <button
                type="button"
                className="local-review"
                disabled={!response.trim() || pending !== null}
                onClick={checkStructureLocally}
              >
                <CornerDownLeft size={15} />
                Check structure locally
              </button>
            )}
            {pending && reviewMode === "semantic" && (
              <button
                type="button"
                className="cancel-review"
                disabled={pending.cancelling}
                onClick={cancelReview}
              >
                <CircleStop size={15} />
                {pending.cancelling ? "Cancelling..." : "Cancel"}
              </button>
            )}
            <button
              type="submit"
              disabled={
                !response.trim() ||
                pending !== null ||
                reviewMode === "checking"
              }
            >
              {pending
                ? "Reviewing..."
                : reviewMode === "semantic"
                  ? "Review explanation"
                  : reviewMode === "checking"
                    ? "Preparing review..."
                    : "Check structure locally"}
              {pending ? (
                <LoaderCircle className="assessment-spinner" size={15} />
              ) : (
                <CornerDownLeft size={15} />
              )}
            </button>
          </div>
        </div>
      </form>
      {pending && (
        <p
          className="explanation-review-status"
          role="status"
          aria-live="polite"
        >
          {pending.cancelling
            ? "Cancelling the Bedrock review. Your draft is saved."
            : pendingDraftChanged
              ? "Reviewing the submitted snapshot. Your newer edits remain separate."
              : "Reviewing the submitted snapshot. You can keep editing while it runs."}
        </p>
      )}
      {notice && (
        <p
          className="explanation-notice"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
      )}
      {error && (
        <p className="explanation-error" role="alert">
          {error}
        </p>
      )}
      {assessment && (
        <div
          className={`explanation-feedback ${assessment.level}`}
          role="status"
        >
          <div aria-hidden="true"><span /></div>
          <div>
            <strong className="remediation-label">
              {assessment.assessmentMode === "semantic"
                ? assessment.level === "demonstrated"
                  ? "FORMATIVE REVIEW · AUTHORED CRITERIA SUPPORTED"
                  : assessment.level === "partial"
                    ? "FORMATIVE REVIEW · REVISE ONE CAUSAL LINK"
                    : "FORMATIVE REVIEW · REBUILD THE EXPLANATION"
                : "FORMATIVE STRUCTURE CHECK · NOT SEMANTIC GRADING"}
            </strong>
            {assessmentIsForPreviousDraft && (
              <small className="assessment-draft-note">
                This feedback belongs to your previous submitted draft.
              </small>
            )}
            <p>{assessment.feedback}</p>
            <ul className="structure-criteria">
              {activity.rubric.criteria.map((criterion) => (
                <li
                  aria-label={`${
                    matchedCriteria.has(criterion.id)
                      ? "Supported"
                      : uncertainCriteria.has(criterion.id)
                        ? "Needs clarification"
                        : "Needs revision"
                  }: ${criterion.label}`}
                  className={
                    matchedCriteria.has(criterion.id)
                      ? "mentioned"
                      : uncertainCriteria.has(criterion.id)
                        ? "uncertain"
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
