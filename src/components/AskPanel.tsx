import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowUp, Check, Copy, Eye, EyeOff, RefreshCw, Sparkles, Square } from "lucide-react";
import type { AskOverlayContext } from "../shared/types";
import { contextCueApi } from "../lib/api";
import { MarkdownContent } from "./MarkdownContent";

const ASK_INPUT_MIN_HEIGHT = 44;
const ASK_INPUT_MAX_HEIGHT = 96;

type TurnStatus = "streaming" | "complete" | "stopped" | "error";

interface AskTurn {
  id: string;
  question: string;
  answer: string;
  status: TurnStatus;
  error?: string;
}

interface Props {
  context: AskOverlayContext;
  contextError?: string;
  onExit: () => void;
}

export function AskPanel({ context, contextError, onExit }: Props) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [includeContext, setIncludeContext] = useState(context.hasPageContext);
  const [copiedTurn, setCopiedTurn] = useState("");
  const activeRequest = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const windowDrag = useRef<{ pointerId: number; screenX: number; screenY: number } | null>(null);
  const streaming = Boolean(activeRequest.current);

  const sourceLabel = context.windowTitle.trim() || context.applicationName.trim() || "Current page";
  const contextTitle = contextError || (!context.hasPageContext
    ? context.contextUnavailableReason || "No page snapshot available"
    : `${includeContext ? "Using" : "Not using"} captured page: ${sourceLabel}. Click to ${includeContext ? "exclude" : "include"} it.`);

  useEffect(() => {
    inputRef.current?.focus();
  }, [context.sessionId]);

  useEffect(() => {
    if (!contextError) return;
    activeRequest.current = null;
    setTurns((current) => current.map((turn) => turn.status === "streaming" ? { ...turn, status: "stopped" } : turn));
  }, [contextError]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const fit = () => {
      input.style.height = "0px";
      const nextHeight = Math.min(ASK_INPUT_MAX_HEIGHT, Math.max(ASK_INPUT_MIN_HEIGHT, input.scrollHeight));
      input.style.height = `${nextHeight}px`;
      input.style.overflowY = input.scrollHeight > ASK_INPUT_MAX_HEIGHT ? "auto" : "hidden";
    };
    fit();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      fit();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [question]);

  useEffect(() => contextCueApi.onAskEvent((event) => {
    if (event.sessionId !== context.sessionId || event.requestId !== activeRequest.current) return;
    if (event.type === "delta") {
      setTurns((current) => current.map((turn) => turn.id === event.requestId
        ? { ...turn, answer: turn.answer + event.delta }
        : turn));
      return;
    }
    activeRequest.current = null;
    if (event.type === "complete") {
      setTurns((current) => current.map((turn) => turn.id === event.requestId
        ? { ...turn, answer: event.answer || turn.answer, status: "complete" }
        : turn));
    } else if (event.type === "cancelled") {
      setTurns((current) => current.map((turn) => turn.id === event.requestId
        ? { ...turn, status: "stopped" }
        : turn));
    } else {
      setTurns((current) => current.map((turn) => turn.id === event.requestId
        ? { ...turn, status: "error", error: event.message }
        : turn));
    }
    inputRef.current?.focus();
  }), [context.sessionId]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !followOutput.current) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [turns]);

  const submit = (override?: string) => {
    const nextQuestion = (override ?? question).trim();
    if (!nextQuestion || activeRequest.current || contextError) return;
    const requestId = crypto.randomUUID();
    activeRequest.current = requestId;
    followOutput.current = true;
    setTurns((current) => [...current, { id: requestId, question: nextQuestion, answer: "", status: "streaming" }]);
    setQuestion("");
    contextCueApi.startAsk({
      sessionId: context.sessionId,
      requestId,
      question: nextQuestion,
      includeContext
    });
  };

  const stop = () => {
    if (activeRequest.current) contextCueApi.cancelAsk(activeRequest.current);
  };

  const copyAnswer = async (turn: AskTurn) => {
    await contextCueApi.copyText(turn.answer);
    setCopiedTurn(turn.id);
    window.setTimeout(() => setCopiedTurn((current) => current === turn.id ? "" : current), 1_500);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    windowDrag.current = { pointerId: event.pointerId, screenX: event.screenX, screenY: event.screenY };
  };

  const continueDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = windowDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.screenX - drag.screenX;
    const deltaY = event.screenY - drag.screenY;
    if (deltaX || deltaY) {
      contextCueApi.moveOverlay(deltaX, deltaY);
      drag.screenX = event.screenX;
      drag.screenY = event.screenY;
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (windowDrag.current?.pointerId === event.pointerId) windowDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="ask-panel" aria-label="Ask AI">
      <header
        className="ask-header"
        onPointerDown={beginDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {context.canReturnToSuggestions ? (
          <button className="ask-back" onClick={onExit} aria-label="Back to suggestions" title="Back to suggestions">
            <ArrowLeft size={16} aria-hidden="true"/>
          </button>
        ) : <span className="ask-mark"><Sparkles size={16} aria-hidden="true"/></span>}
        <div className="ask-heading"><strong>Ask AI</strong></div>
          <button
            className={`ask-context-chip ${includeContext && !contextError ? "ask-context-chip--active" : ""}`}
            onClick={() => setIncludeContext((current) => !current)}
            aria-pressed={includeContext}
            aria-label="Include captured page context"
            disabled={!context.hasPageContext || Boolean(contextError)}
            title={contextTitle}
          >
            {includeContext ? <Eye size={13} aria-hidden="true"/> : <EyeOff size={13} aria-hidden="true"/>}
            <span>{contextError ? "Page expired" : includeContext ? sourceLabel : context.hasPageContext ? "Page off" : "No page"}</span>
          </button>
      </header>

      <div
        className={`ask-transcript ${turns.length ? "" : "ask-transcript--empty"}`}
        ref={transcriptRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          followOutput.current = element.scrollHeight - element.scrollTop - element.clientHeight < 28;
        }}
        aria-live="polite"
        aria-busy={streaming}
      >
        {turns.length === 0 ? (
          <div className="ask-empty">
            <strong>{includeContext ? "Ask about this page" : "Ask anything"}</strong>
            <p>{includeContext ? "Get a summary, an explanation, or help with a reply." : "Ask a question or describe what you’re working on."}</p>
            {includeContext && <div className="ask-starters" aria-label="Question starters">
              {[
                ["Summarize", "Summarize the key points on this page."],
                ["Explain", "Help me understand what is happening on this page."],
                ["Draft a reply", "Help me draft a reply based on this page."]
              ].map(([label, prompt]) => <button key={label} type="button" onClick={() => {
                setQuestion(prompt);
                inputRef.current?.focus();
              }}>{label}</button>)}
            </div>}
            {!context.hasPageContext && context.contextUnavailableReason && <small>{context.contextUnavailableReason}</small>}
          </div>
        ) : turns.map((turn) => (
          <article className="ask-turn" key={turn.id}>
            <p className="ask-question">{turn.question}</p>
            <div className={`ask-answer ask-answer--${turn.status}`}>
              <div className="ask-answer-label"><Sparkles size={12} aria-hidden="true"/><span>ContextCue</span></div>
              {turn.answer
                ? <MarkdownContent content={turn.answer} className="ask-markdown"/>
                : turn.status === "streaming"
                  ? <span className="ask-thinking"><i/><i/><i/> Thinking</span>
                  : null}
              {turn.status === "stopped" && <small>Stopped</small>}
              {turn.status === "error" && (
                <div className="ask-error" role="alert">
                  <span>{turn.error}</span>
                  <button disabled={streaming || Boolean(contextError)} onClick={() => submit(turn.question)}><RefreshCw size={12}/> Retry</button>
                </div>
              )}
              {turn.answer && turn.status !== "streaming" && (
                <button className="ask-copy" onClick={() => void copyAnswer(turn)}>
                  {copiedTurn === turn.id ? <Check size={13}/> : <Copy size={13}/>}
                  {copiedTurn === turn.id ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="ask-composer">
        {contextError && <p className="ask-context-notice" role="status">{contextError}</p>}
        <label className="visually-hidden" htmlFor="ask-question">Ask AI a question</label>
        <div className="ask-input-frame">
          <textarea
            id="ask-question"
            ref={inputRef}
            value={question}
            rows={1}
            maxLength={2_000}
            placeholder={includeContext ? "Ask about this page…" : "Ask a quick question…"}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              submit();
            }}
          />
          <button
            className={`ask-submit ${streaming ? "ask-submit--stop" : ""}`}
            onClick={streaming ? stop : () => submit()}
            disabled={Boolean(contextError) || (!streaming && !question.trim())}
            aria-label={streaming ? "Stop answering" : "Send question"}
            title={streaming ? "Stop" : "Send · Enter"}
          >
            {streaming ? <Square size={12} fill="currentColor" aria-hidden="true"/> : <ArrowUp size={17} aria-hidden="true"/>}
          </button>
        </div>
        <div className="ask-composer-hint"><span>Enter to send</span><span>Shift + Enter for a new line</span></div>
      </div>
    </section>
  );
}
