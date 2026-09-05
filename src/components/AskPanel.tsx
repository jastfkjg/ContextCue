import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Brain, Check, Copy, Eye, EyeOff, RefreshCw, Sparkles, Square } from "lucide-react";
import type { AskOverlayContext, OverlayResult, MemoryUsage } from "../shared/types";
import { contextCueApi } from "../lib/api";
import { errorMessage } from "../lib/error-message";
import { MemoryDetails } from "./MemoryDetails";
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
  draft?: OverlayResult;
  memoryUsage?: MemoryUsage;
  includeContext: boolean;
}

interface Props {
  context: AskOverlayContext;
  contextError?: string;
  onExit: () => void;
  active?: boolean;
  onDraft?: (draft: OverlayResult) => Promise<void>;
}

export function AskPanel({ context, contextError, onExit, active = true, onDraft }: Props) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [includeContext, setIncludeContext] = useState(context.hasPageContext);
  const [includeMemory, setIncludeMemory] = useState(context.includeMemory !== false);
  const [memoryNotice, setMemoryNotice] = useState("");
  const [changingMemory, setChangingMemory] = useState(false);
  useEffect(() => {
    setIncludeMemory(context.includeMemory !== false);
  }, [context.includeMemory]);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState("");
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const [copiedTurn, setCopiedTurn] = useState("");
  const activeRequest = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const followOutput = useRef(true);
  const streaming = Boolean(activeRequest.current);

  const sourceLabel = context.windowTitle.trim() || context.applicationName.trim() || "Current page";
  const capturedTime = context.capturedAt ? new Date(context.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const contextTitle = contextError || (!context.hasPageContext
    ? context.contextUnavailableReason || "No page snapshot available"
    : `${includeContext ? "Using" : "Not using"} captured page: ${sourceLabel}${capturedTime ? ` at ${capturedTime}` : ""}. Screenshot stays fixed until refreshed. Click to ${includeContext ? "exclude" : "include"} it.`);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [context.sessionId, active]);

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
        ? { ...turn, answer: event.answer || turn.answer, draft: event.draft, memoryUsage: event.memoryUsage, status: "complete" }
        : event.draft ? { ...turn, draft: undefined } : turn));
      if (event.draft) void onDraftRef.current?.(event.draft).catch((error) => setLocalError(String(error)));
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

  const submit = (override?: string, withoutMemory = false, originalContext = includeContext) => {
    const nextQuestion = (override ?? question).trim();
    if (!active || refreshing || changingMemory || !nextQuestion || activeRequest.current || contextError) return;
    const requestId = crypto.randomUUID();
    activeRequest.current = requestId;
    followOutput.current = true;
    setTurns((current) => [...current, { id: requestId, question: nextQuestion, answer: "", status: "streaming", includeContext: originalContext }]);
    setQuestion("");
    setLocalError("");
    if (withoutMemory) { setIncludeMemory(false); setMemoryNotice("Memory off. This retry starts without earlier answers."); }
    contextCueApi.startAsk({
      sessionId: context.sessionId,
      requestId,
      question: nextQuestion,
      includeContext: originalContext,
      includeMemory: withoutMemory ? false : includeMemory,
      resetConversation: withoutMemory
    });
  };

  const stop = () => {
    if (!activeRequest.current) return;
    contextCueApi.cancelAsk(activeRequest.current);
    // Cancellation can finish without a stream event (e.g. during a refresh).
    // Release the composer immediately and ignore any late result for this turn.
    activeRequest.current = null;
    setTurns((current) => current.map((turn) => turn.status === "streaming" ? { ...turn, status: "stopped" } : turn));
  };

  const copyAnswer = async (turn: AskTurn) => {
    await contextCueApi.copyText(turn.answer);
    setCopiedTurn(turn.id);
    window.setTimeout(() => setCopiedTurn((current) => current === turn.id ? "" : current), 1_500);
  };

  const refresh = async () => {
    if (refreshing) return;
    stop();
    setRefreshing(true);
    setLocalError("");
    try { await contextCueApi.refreshAsk(context.sessionId); }
    catch (error) { setLocalError(`${errorMessage(error)} Your conversation has been kept.`); }
    finally { setRefreshing(false); }
  };

  return (
    <section className="ask-panel" aria-label="Ask AI" hidden={!active}>
      <header
        className="ask-header"
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
          <button className="ask-refresh" disabled={refreshing} onClick={() => void refresh()}
            aria-label="Refresh screenshot and start a new conversation"
            title="Refresh screenshot · starts a new conversation">
            <RefreshCw size={14} className={refreshing ? "icon-spinning" : ""} aria-hidden="true"/>
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
            <strong>{includeContext ? "What can I help with?" : "Ask or write anything"}</strong>
            <p>{includeContext ? "Ask about this screen, or tell me what to write." : "Ask a question or describe what you’re working on."}</p>
            {includeContext && <div className="ask-starters" aria-label="Question starters">
              {[
                ["Summarize", "Summarize the key points on this page."],
                ["Explain", "Help me understand what is happening on this page."],
                ["Draft a reply", "Help me draft a reply. My intent: "],
                ["Rewrite", "Rewrite the text on this page. Make it "]
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
              {turn.status === "complete" && <MemoryDetails usage={turn.memoryUsage} disabled={streaming || Boolean(contextError)} onRegenerate={() => submit(turn.question, true, turn.includeContext)}/>}
              {turn.draft && onDraft && <button className="ask-copy" onClick={() => void onDraft(turn.draft!).catch((error) => setLocalError(String(error)))}>Open draft →</button>}
              {turn.answer && !turn.draft && turn.status !== "streaming" && (
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
        <div className="ask-memory-control">
          <button type="button" aria-pressed={includeMemory} disabled={streaming || refreshing || changingMemory || Boolean(contextError)} onClick={async () => {
            const nextEnabled = !includeMemory;
            setChangingMemory(true);
            try {
              await contextCueApi.setSessionMemory(context.sessionId, nextEnabled);
              setIncludeMemory(nextEnabled);
              setMemoryNotice("Memory changed. Your next question starts fresh context. Earlier answers stay visible here.");
            } catch (error) { setLocalError(errorMessage(error)); }
            finally { setChangingMemory(false); }
          }} title="Use relevant enabled notes independently of the page screenshot">
            <Brain size={14} aria-hidden="true"/>Memory {includeMemory ? "on" : "off"}
          </button>
          <span>{includeMemory ? "Relevant notes are shared with your model." : "Saved notes won’t be added."}</span>
        </div>
        {memoryNotice && <p className="ask-context-notice" role="status">{memoryNotice}</p>}
        {contextError && <p className="ask-context-notice" role="status">Screenshot expired. Refresh above to continue. Your text is still available.</p>}
        {localError && <p className="ask-context-notice" role="alert">{localError}</p>}
        {refreshing && <p className="ask-context-notice" role="status">Refreshing screenshot…</p>}
        <label className="visually-hidden" htmlFor="ask-question">Ask AI a question</label>
        <div className="ask-input-frame">
          <textarea
            id="ask-question"
            ref={inputRef}
            value={question}
            rows={1}
            maxLength={2_000}
            placeholder={includeContext ? "Ask a question or describe a draft…" : "Ask or describe what to write…"}
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
            disabled={refreshing || changingMemory || Boolean(contextError) || (!streaming && !question.trim())}
            aria-label={streaming ? "Stop answering" : "Send question"}
            title={streaming ? "Stop" : "Send · Enter"}
          >
            {streaming ? <Square size={12} fill="currentColor" aria-hidden="true"/> : <ArrowUp size={17} aria-hidden="true"/>}
          </button>
        </div>
      </div>
    </section>
  );
}
