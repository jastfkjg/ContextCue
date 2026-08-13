import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, Check, Copy, Eye, EyeOff, RefreshCw, Send, Sparkles, Square } from "lucide-react";
import type { AskHistoryMessage, AskOverlayContext } from "../shared/types";
import { contextCueApi } from "../lib/api";

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
  onExit: () => void;
}

export function AskPanel({ context, onExit }: Props) {
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

  const sourceLabel = useMemo(() => {
    const label = context.windowTitle.trim() || context.applicationName.trim() || "Current page";
    return label.length > 28 ? `${label.slice(0, 27)}…` : label;
  }, [context.applicationName, context.windowTitle]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [context.sessionId]);

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
    if (!nextQuestion || activeRequest.current) return;
    const requestId = crypto.randomUUID();
    const history: AskHistoryMessage[] = turns
      .filter((turn) => turn.status === "complete" && turn.answer.trim())
      .slice(-3)
      .flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer }
      ]);
    activeRequest.current = requestId;
    followOutput.current = true;
    setTurns((current) => [...current, { id: requestId, question: nextQuestion, answer: "", status: "streaming" }]);
    setQuestion("");
    contextCueApi.startAsk({
      sessionId: context.sessionId,
      requestId,
      question: nextQuestion,
      includeContext,
      history
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
            <ArrowLeft size={15}/>
          </button>
        ) : <span className="ask-mark"><Sparkles size={14}/></span>}
        <div className="ask-heading"><strong>Ask AI</strong><span>Answers stay in this panel</span></div>
        {context.hasPageContext && (
          <button
            className={`ask-context-chip ${includeContext ? "ask-context-chip--active" : ""}`}
            onClick={() => setIncludeContext((current) => !current)}
            aria-pressed={includeContext}
            title={includeContext ? "Current-page context is included" : "Current-page context is excluded"}
          >
            {includeContext ? <Eye size={13}/> : <EyeOff size={13}/>}
            <span>{sourceLabel}</span>
          </button>
        )}
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
            <Sparkles size={18}/>
            <strong>What would you like to know?</strong>
            <span>{includeContext ? "Ask about the visible page or anything else." : "Ask a quick question without page context."}</span>
          </div>
        ) : turns.map((turn) => (
          <article className="ask-turn" key={turn.id}>
            <p className="ask-question">{turn.question}</p>
            <div className={`ask-answer ask-answer--${turn.status}`}>
              {turn.answer
                ? <p>{turn.answer}</p>
                : turn.status === "streaming"
                  ? <span className="ask-thinking"><i/><i/><i/> Thinking</span>
                  : null}
              {turn.status === "stopped" && <small>Stopped</small>}
              {turn.status === "error" && (
                <div className="ask-error" role="alert">
                  <span>{turn.error}</span>
                  <button onClick={() => submit(turn.question)}><RefreshCw size={12}/> Retry</button>
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
        <label className="visually-hidden" htmlFor="ask-question">Ask AI a question</label>
        <textarea
          id="ask-question"
          ref={inputRef}
          value={question}
          rows={2}
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
          disabled={!streaming && !question.trim()}
          aria-label={streaming ? "Stop answering" : "Send question"}
          title={streaming ? "Stop" : "Send · Enter"}
        >
          {streaming ? <Square size={13} fill="currentColor"/> : <Send size={15}/>} 
        </button>
      </div>
    </section>
  );
}
