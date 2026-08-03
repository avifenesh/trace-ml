import {
  ArrowUp,
  BookOpenText,
  History,
  MessageSquareText,
  Plus,
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
  const questionRef = useRef<HTMLTextAreaElement>(null);

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
  }, [lesson.id, tutor.activeThread.id]);

  useEffect(() => {
    if (!mobileOpen || showHistory) return;
    const frame = requestAnimationFrame(() => questionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mobileOpen, showHistory, tutor.activeThread.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
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

  const pageChunks = pageChunksForLesson(lesson);
  const sourceFromChunk = (chunkId: string) => {
    const chunk = pageChunks.find((item) => item.id === chunkId);
    if (!chunk) return null;
    const paragraph = chunk.id.split(":p")[1];
    return {
      id: chunk.id,
      blockId: chunk.blockId,
      label: `${chunk.heading} · paragraph ${paragraph}`,
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
            <strong id="lesson-helper-title">Lesson Q&amp;A</strong>
            <span><i /> grounded in Lesson {lesson.number}</span>
          </div>
        </div>
        <div className="tutor-actions">
          <button
            type="button"
            className="icon-button"
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

      {showHistory ? (
        <div className="thread-history">
          <div className="thread-history-heading">
            <div>
              <span>CONVERSATIONS</span>
              <strong>Resume a thread</strong>
            </div>
            <button
              type="button"
              onClick={startNewThread}
            >
              <Plus size={15} />
              New
            </button>
          </div>
          <ol>
            {tutor.threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  className={
                    thread.id === tutor.activeThread.id ? "active" : ""
                  }
                  aria-current={
                    thread.id === tutor.activeThread.id ? "true" : undefined
                  }
                  onClick={() => selectThread(thread.id)}
                >
                  <MessageSquareText size={15} />
                  <span>
                    <strong>{thread.title}</strong>
                    <small>
                      {thread.id === tutor.activeThread.id && (
                        <span className="current-thread">Current · </span>
                      )}
                      {thread.messages.length - 1} messages ·{" "}
                      {new Date(thread.updatedAt).toLocaleDateString()}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <div className="thread-context">
            <BookOpenText size={15} />
            <span>
              Current context
              <strong>{lesson.title}</strong>
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
              return (
                <article
                  className={`tutor-message ${message.role}`}
                  key={message.id}
                >
                  <span>{message.role === "tutor" ? "HELPER" : "YOU"}</span>
                  <p>{message.text}</p>
                  {sources.length > 0 && (
                    <div className="message-sources">
                      {sources.map((source) => (
                        <a
                          href={`#${source.blockId}`}
                          key={source.id}
                          onClick={(event) => {
                            event.preventDefault();
                            onNavigateToBlock(source.blockId);
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
          </div>

          {tutor.activeThread.messages.length === 1 && (
            <div className="starter-questions">
              <span>ASK FROM THIS PAGE</span>
              {(lesson.starterQuestions ?? []).map((question) => (
                <button
                  type="button"
                  key={question}
                  onClick={() => tutor.send(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form className="tutor-composer" onSubmit={submit}>
            <label htmlFor="tutor-question">Ask about this lesson</label>
            <div>
              <textarea
                id="tutor-question"
                ref={questionRef}
                rows={2}
                value={draft}
                maxLength={2_000}
                placeholder="Ask about a term or mechanism…"
                aria-describedby="tutor-composer-note"
                data-drawer-initial-focus
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
                disabled={!draft.trim()}
                title="Send question"
                aria-label="Send question"
              >
                <ArrowUp size={17} />
              </button>
            </div>
            <small id="tutor-composer-note">
              {tutor.persistenceStatus === "persistent"
                ? "Answers are limited to this authored page and saved thread."
                : "Answers are limited to this authored page. This thread lasts for this session only."}
            </small>
          </form>
        </>
      )}
    </aside>
  );
}
