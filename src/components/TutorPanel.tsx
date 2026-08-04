import {
  ArrowUp,
  BookOpenText,
  CircleStop,
  History,
  LoaderCircle,
  MessageSquareText,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  pageChunksForLesson,
  type Lesson,
} from "../content/types";
import {
  bedrockPolicyDetails,
  bedrockPolicySummary,
} from "../bedrock-readiness";
import type { ReturnTypeUseTutorThreads } from "./types";

interface TutorPanelProps {
  inert: boolean;
  isModal: boolean;
  lesson: Lesson;
  tutor: ReturnTypeUseTutorThreads;
  mobileOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onCloseMobile: () => void;
  onNavigateToBlock: (blockId: string) => void;
}

export function TutorPanel({
  inert,
  isModal,
  lesson,
  tutor,
  mobileOpen,
  panelRef,
  onCloseMobile,
  onNavigateToBlock,
}: TutorPanelProps) {
  const [draft, setDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const threadButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfterDeleteRef = useRef<string | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [tutor.activeThread.messages]);

  useEffect(() => {
    if (mobileOpen) return;
    setDraft("");
    setShowHistory(false);
  }, [mobileOpen]);

  useEffect(() => {
    setDraft("");
    setShowHistory(false);
  }, [lesson.id]);

  useEffect(() => {
    setDraft("");
    if (!focusAfterDeleteRef.current) {
      setShowHistory(false);
    }
  }, [tutor.activeThread.id]);

  useEffect(() => {
    const preferredThreadId = focusAfterDeleteRef.current;
    if (!preferredThreadId) return;
    const targetId = tutor.threads.some(
        (thread) => thread.id === preferredThreadId,
      )
      ? preferredThreadId
      : tutor.activeThread.id;
    const frame = requestAnimationFrame(() => {
      threadButtonRefs.current.get(targetId)?.focus();
      focusAfterDeleteRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [tutor.activeThread.id, tutor.threads]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !draft.trim() ||
      tutor.pendingAnswer ||
      tutor.helperMode === "checking"
    ) {
      return;
    }
    tutor.send(draft);
    setDraft("");
  };

  const startNewThread = () => {
    setDraft("");
    setShowHistory(false);
    tutor.newThread();
  };

  const selectThread = (threadId: string) => {
    setDraft("");
    setShowHistory(false);
    tutor.selectThread(threadId);
  };

  const deleteThread = (threadId: string, title: string) => {
    const confirmed = globalThis.confirm(
      `Delete "${title}"? This removes the conversation from this device.`,
    );
    if (!confirmed) return;
    const deletedIndex = tutor.threads.findIndex(
      (thread) => thread.id === threadId,
    );
    const remaining = tutor.threads.filter(
      (thread) => thread.id !== threadId,
    );
    const focusTarget =
      remaining[Math.min(Math.max(deletedIndex, 0), remaining.length - 1)]
        ?.id ?? tutor.activeThread.id;
    if (tutor.deleteThread(threadId)) {
      focusAfterDeleteRef.current = focusTarget;
    }
  };

  const pageChunks = pageChunksForLesson(lesson);
  const localThreadDisclosure =
    tutor.persistenceStatus === "persistent"
      ? "This conversation is saved only on this device."
      : "This conversation is kept only until you close the app.";
  const helperDisclosure =
    tutor.helperMode === "semantic"
      ? `Your question, this page, and recent messages are sent to AWS Bedrock. ${tutor.helperReadiness ? bedrockPolicySummary(tutor.helperReadiness) : ""} ${localThreadDisclosure}`
      : tutor.helperMode === "checking"
        ? `Checking whether the page helper is available. Nothing is sent until you submit a question. ${localThreadDisclosure}`
        : `Nothing is sent to Bedrock. Answers use exact text from this page on this device. ${localThreadDisclosure}`;
  const sourceFromChunk = (chunkId: string) => {
    const chunk = pageChunks.find((item) => item.id === chunkId);
    if (!chunk) return null;
    return {
      id: chunk.id,
      anchorId: chunk.anchorId,
      label: chunk.citationLabel,
    };
  };
  return (
    <aside
      id="lesson-helper-panel"
      ref={panelRef}
      className={`tutor-panel ${mobileOpen ? "mobile-open" : ""}`}
      role={isModal && mobileOpen ? "dialog" : undefined}
      aria-modal={isModal && mobileOpen ? true : undefined}
      aria-labelledby="lesson-helper-title"
      aria-hidden={isModal && !mobileOpen ? true : undefined}
      inert={inert ? true : undefined}
      tabIndex={isModal && mobileOpen ? -1 : undefined}
    >
      <header className="tutor-header">
        <div className="tutor-title">
          <div className="tutor-avatar" aria-hidden="true">
            <MessageSquareText size={17} />
          </div>
          <div>
            <strong id="lesson-helper-title" tabIndex={-1}>
              Lesson Q&amp;A
            </strong>
            <span><i /> grounded in Lesson {lesson.number}</span>
          </div>
        </div>
        <div className="tutor-actions">
          <button
            type="button"
            className="icon-button"
            disabled={tutor.pendingAnswer !== null}
            onClick={() => setShowHistory((value) => !value)}
            title="Conversation history"
            aria-label="Conversation history"
            aria-pressed={showHistory}
          >
            <History size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={tutor.pendingAnswer !== null}
            onClick={startNewThread}
            title="New conversation"
            aria-label="New conversation"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className="icon-button tutor-mobile-close"
            onClick={onCloseMobile}
            title="Close tutor"
            aria-label="Close tutor"
          >
            <X size={18} />
          </button>
        </div>
      </header>
      {showHistory && tutor.helperNotice && (
        <p className="sr-only" role="status" aria-live="polite">
          {tutor.helperNotice}
        </p>
      )}

      {showHistory ? (
        <div className="thread-history">
          <div className="thread-history-heading">
            <div>
              <span>CONVERSATIONS</span>
              <strong>Resume a thread</strong>
            </div>
            <button
              type="button"
              disabled={tutor.pendingAnswer !== null}
              onClick={startNewThread}
            >
              <Plus size={15} />
              New
            </button>
          </div>
          <ol>
            {tutor.threads.map((thread) => {
              const learnerMessages = thread.messages.filter(
                (message) => message.role === "learner",
              );
              const fullQuestion = learnerMessages[0]?.text ?? thread.title;
              const questionCount = learnerMessages.length;
              const date = new Date(thread.updatedAt).toLocaleDateString();
              const questionSeparator = /[.!?]$/.test(fullQuestion) ? " " : ". ";
              return (
                <li key={thread.id}>
                  <div className="thread-history-item">
                    <button
                      type="button"
                      className={`thread-history-select ${
                        thread.id === tutor.activeThread.id ? "active" : ""
                      }`}
                      aria-label={`${thread.id === tutor.activeThread.id ? "Current conversation. " : ""}${fullQuestion}${questionSeparator}${questionCount} ${questionCount === 1 ? "question" : "questions"}. Updated ${date}.`}
                      aria-current={
                        thread.id === tutor.activeThread.id ? "true" : undefined
                      }
                      disabled={tutor.pendingAnswer !== null}
                      onClick={() => selectThread(thread.id)}
                      ref={(node) => {
                        if (node) {
                          threadButtonRefs.current.set(thread.id, node);
                        } else {
                          threadButtonRefs.current.delete(thread.id);
                        }
                      }}
                    >
                      <MessageSquareText size={15} />
                      <span>
                        <strong title={fullQuestion}>{thread.title}</strong>
                        <small>
                          {thread.id === tutor.activeThread.id && (
                            <span className="current-thread">Current · </span>
                          )}
                          {questionCount}{" "}
                          {questionCount === 1 ? "question" : "questions"} ·{" "}
                          {date}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="thread-history-delete"
                      disabled={tutor.pendingAnswer !== null}
                      onClick={() => deleteThread(thread.id, fullQuestion)}
                      title={`Delete conversation: ${fullQuestion}`}
                      aria-label={`Delete conversation: ${fullQuestion}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <>
          <div className="thread-context">
            <BookOpenText size={15} />
            <span>
              Current context
              <strong title={lesson.title}>{lesson.title}</strong>
            </span>
          </div>

          <div
            className="tutor-transcript"
            ref={transcriptRef}
            role="log"
            aria-label="Conversation messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {tutor.activeThread.messages.map((message) => {
              const sources = message.sourceChunkIds
                .map(sourceFromChunk)
                .filter((source) => source !== null);
              const claims = message.claims ?? [];
              return (
                <article
                  className={`tutor-message ${message.role}`}
                  key={message.id}
                >
                  <span>{message.role === "tutor" ? "HELPER" : "YOU"}</span>
                  {claims.length > 0 ? (
                    <div className="message-claims">
                      {claims.map((claim, index) => {
                        const source = sourceFromChunk(claim.sourceChunkId);
                        return (
                          <div key={`${claim.sourceChunkId}:${index}`}>
                            <p>{claim.text}</p>
                            {source && (
                              <a
                                href={`#${source.anchorId}`}
                                title={`Exact support: ${claim.quote}`}
                                aria-label={`${source.label}. Exact support: ${claim.quote}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  onNavigateToBlock(source.anchorId);
                                }}
                              >
                                <BookOpenText size={12} aria-hidden="true" />
                                {source.label}
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}
                  {claims.length === 0 && sources.length > 0 && (
                    <div className="message-sources">
                      {sources.map((source) => (
                        <a
                          href={`#${source.anchorId}`}
                          key={source.id}
                          onClick={(event) => {
                            event.preventDefault();
                            onNavigateToBlock(source.anchorId);
                          }}
                        >
                          <BookOpenText size={12} aria-hidden="true" />
                          {source.label}
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {tutor.pendingAnswer && (
              <article className="tutor-message tutor pending">
                <span>HELPER</span>
                <div>
                  <LoaderCircle
                    className="assessment-spinner"
                    size={15}
                    aria-hidden="true"
                  />
                  <p>
                    {tutor.pendingAnswer.cancelling
                      ? "Cancelling..."
                      : "Reading this page..."}
                  </p>
                  <button
                    type="button"
                    className="cancel-helper"
                    disabled={tutor.pendingAnswer.cancelling}
                    onClick={tutor.cancelAnswer}
                    title="Cancel answer"
                    aria-label="Cancel answer"
                  >
                    <CircleStop size={16} />
                  </button>
                </div>
              </article>
            )}
          </div>

          {tutor.activeThread.messages.length === 1 && (
            <div className="starter-questions">
              <span>ASK FROM THIS PAGE</span>
              {(lesson.starterQuestions ?? []).map((question) => (
                <button
                  type="button"
                  key={question}
                  disabled={
                    tutor.pendingAnswer !== null ||
                    tutor.helperMode === "checking"
                  }
                  onClick={() => tutor.send(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="tutor-composer"
            onSubmit={submit}
            aria-busy={tutor.pendingAnswer !== null}
          >
            {tutor.helperErrorMessage && (
              <p className="tutor-helper-alert error" role="alert">
                {tutor.helperErrorMessage}
              </p>
            )}
            {tutor.helperNotice && (
              <p
                className="tutor-helper-alert notice"
                role="status"
                aria-live="polite"
              >
                {tutor.helperNotice}
              </p>
            )}
            <label htmlFor="tutor-question">Ask about this lesson</label>
            <div>
              <textarea
                id="tutor-question"
                rows={2}
                value={draft}
                maxLength={2_000}
                placeholder="Ask about a term or mechanism…"
                aria-describedby="tutor-composer-note"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button
                type="submit"
                className="send-button"
                disabled={
                  !draft.trim() ||
                  tutor.pendingAnswer !== null ||
                  tutor.helperMode === "checking"
                }
                title="Send question"
                aria-label="Send question"
              >
                <ArrowUp size={17} />
              </button>
            </div>
            <div
              id="tutor-composer-note"
              className="tutor-composer-note"
            >
              <p>{helperDisclosure}</p>
              {tutor.helperMode === "semantic" && (
                <details>
                  <summary>Privacy details</summary>
                  <p>
                    {tutor.helperReadiness
                      ? bedrockPolicyDetails(tutor.helperReadiness)
                      : "The Bedrock policy could not be verified, so remote answers are disabled."}
                  </p>
                </details>
              )}
            </div>
          </form>
        </>
      )}
    </aside>
  );
}
