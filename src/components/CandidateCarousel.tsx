import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronUp, Copy, CornerDownLeft, PencilLine, RotateCcw, Sparkles, Square } from "lucide-react";
import type { AssistScenario, CandidateReply, ChannelId, InputTarget } from "../shared/types";
import { contextCueApi } from "../lib/api";
import { candidateRevisionReducer, createCandidateRevisionState, visibleCandidates } from "../lib/candidate-revision";
import { consumeHorizontalSwipe, createHorizontalSwipeTracker } from "../lib/horizontal-swipe";

interface Props {
  candidates: CandidateReply[];
  channel: ChannelId;
  contact: string;
  scenario?: AssistScenario;
  target?: InputTarget;
  compact?: boolean;
  onAsk?: () => void | Promise<void>;
  onHeightChange?: (height: number, newCandidate: boolean, expanded?: boolean) => void;
  sessionId?: string;
  contextError?: string;
  practice?: boolean;
  active?: boolean;
}

export function CandidateCarousel({ candidates: originalCandidates, channel, contact, scenario = "reply", target, compact = false, onAsk, onHeightChange, sessionId, contextError, practice = false, active = true }: Props) {
  const reduceMotion = useReducedMotion();
  const [selection, dispatch] = useReducer(candidateRevisionReducer, originalCandidates, createCandidateRevisionState);
  const candidates = visibleCandidates(selection);
  const { index } = selection;
  const candidate = candidates[index];
  const candidateText = candidate.text;
  const [direction, setDirection] = useState(1);
  const [status, setStatus] = useState<"idle" | "copied" | "pasted">("idle");
  const [feedback, setFeedback] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [applying, setApplying] = useState(false);
  const revising = Boolean(selection.pending);
  const activeRequest = useRef<string | null>(null);
  const reviseButton = useRef<HTMLButtonElement>(null);
  const instructionField = useRef<HTMLTextAreaElement>(null);
  const pointerStart = useRef<number | null>(null);
  const horizontalSwipe = useRef(createHorizontalSwipeTracker());
  const shell = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const composer = useRef<HTMLFormElement | null>(null);
  const measurementKey = `${selection.group}-${index}-${composerOpen}-${candidateText}`;
  const lastMeasurement = useRef("");

  useEffect(() => {
    const unsubscribe = contextCueApi.onRevisionCandidate((event) => {
      if (event.sessionId === sessionId && event.requestId === activeRequest.current) {
        dispatch({ type: "candidate", id: event.requestId, candidate: event.candidate });
      }
    });
    return () => {
      unsubscribe();
      if (activeRequest.current) contextCueApi.cancelRevision(activeRequest.current);
      activeRequest.current = null;
    };
  }, [sessionId]);
  useEffect(() => {
    if (!contextError || !activeRequest.current) return;
    const id = activeRequest.current;
    activeRequest.current = null;
    contextCueApi.cancelRevision(id);
    dispatch({ type: "fail", id });
  }, [contextError]);
  useEffect(() => {
    if (active || !activeRequest.current) return;
    const id = activeRequest.current;
    activeRequest.current = null;
    contextCueApi.cancelRevision(id);
    dispatch({ type: "stop", id });
  }, [active]);

  useLayoutEffect(() => {
    if (!compact || !active || !onHeightChange || !content.current || !shell.current) return;
    const node = content.current;
    const newCandidate = measurementKey !== lastMeasurement.current;
    lastMeasurement.current = measurementKey;
    if (newCandidate && stage.current) stage.current.scrollTop = 0;
    const measure = (reset = false) => {
      if (!shell.current) return;
      const padding = Number.parseFloat(getComputedStyle(shell.current).paddingTop) || 0;
      const actions = shell.current.querySelector<HTMLElement>(".candidate-actions")?.offsetHeight ?? 0;
      const note = shell.current.querySelector<HTMLElement>(".candidate-feedback")?.offsetHeight ?? 0;
      const revisionHeight = composer.current ? composer.current.offsetHeight + 14 : 0;
      onHeightChange(Math.ceil(padding + node.offsetHeight + revisionHeight + actions + note + 2), reset, composerOpen);
    };
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    if (composer.current) observer.observe(composer.current);
    const note = shell.current.querySelector(".candidate-feedback");
    if (note) observer.observe(note);
    measure(newCandidate);
    return () => observer.disconnect();
  }, [compact, active, onHeightChange, measurementKey, candidateText, composerOpen, feedback, contextError]);

  useEffect(() => {
    if (!composerOpen || !active) return;
    instructionField.current?.focus({ preventScroll: true });
    // The composer has its own scroll area. Focusing it must never scroll the
    // selected suggestion out of view or move controls beneath the window close.
  }, [composerOpen, active]);

  const move = (next: number) => {
    if (applying) return;
    const wrapped = (next + candidates.length) % candidates.length;
    setDirection(next > index || (index === candidates.length - 1 && wrapped === 0) ? 1 : -1);
    dispatch({ type: "select", index: wrapped });
    setStatus("idle");
    setFeedback("");
  };

  const useCandidate = async (paste: boolean) => {
    if (applying) return;
    const text = candidateText;
    stopRevision();
    setApplying(true);
    setFeedback("");
    try {
      if (practice || contextError) {
        await contextCueApi.copyText(text);
        setStatus("copied");
      } else {
        const result = await contextCueApi.useSuggestion({
          text, sessionId, channel, contact,
          paste: paste && Boolean(target),
          action: candidate.action ?? (target?.selectedText ? "replace-selection" : "insert"),
          scenario, target
        });
        setStatus(result.pasted ? "pasted" : "copied");
        setFeedback(result.error ?? "");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally { setApplying(false); }
  };

  const stopRevision = () => {
    const id = activeRequest.current;
    if (!id) return;
    activeRequest.current = null;
    contextCueApi.cancelRevision(id);
    dispatch({ type: "stop", id });
    setFeedback("Stopped. Completed suggestions are kept.");
  };
  const closeComposer = () => {
    stopRevision();
    setComposerOpen(false);
    window.requestAnimationFrame(() => reviseButton.current?.focus());
  };
  const revise = async () => {
    if (!sessionId || contextError || !instruction.trim() || !candidateText.trim() || activeRequest.current) return;
    const id = crypto.randomUUID();
    activeRequest.current = id;
    dispatch({ type: "start", id });
    setStatus("idle");
    setFeedback("");
    try {
      const revised = await contextCueApi.reviseSuggestion({ sessionId, requestId: id, text: candidateText, instruction });
      if (activeRequest.current !== id) return;
      if (!revised.length) throw new Error("No revised suggestions were returned. Try again.");
      dispatch({ type: "complete", id, candidates: revised });
      setComposerOpen(false);
      setInstruction("");
      window.requestAnimationFrame(() => reviseButton.current?.focus());
    } catch (error) {
      if (activeRequest.current !== id) return;
      dispatch({ type: "fail", id });
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      if (activeRequest.current === id) activeRequest.current = null;
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !active || applying
        || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]"))) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
      if (event.key === "Enter" && !composerOpen && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        void useCandidate(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleTrackpadSwipe = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 1) return;
    event.preventDefault();
    const direction = consumeHorizontalSwipe(
      horizontalSwipe.current,
      event.deltaX,
      event.deltaY,
      event.timeStamp
    );
    if (direction) move(index + direction);
  };

  const dots = <div className="candidate-dots" role="group" aria-label="Choose a suggestion">
    {candidates.map((_, dot) => <button key={dot} type="button" className={dot === index ? "active" : ""}
      aria-label={`Show suggestion ${dot + 1} of ${candidates.length}`} aria-pressed={dot === index}
      disabled={applying} onClick={() => move(dot)}><span aria-hidden="true"/></button>)}
  </div>;
  const action = candidate.action ?? (target?.selectedText ? "replace-selection" : "insert");
  const canInsert = Boolean(target) && !contextError;
  const insertLabel = !canInsert ? (status === "copied" ? "Copied" : "Copy") : action === "replace-selection" ? "Replace selection" : action === "replace-all" ? "Replace field" : "Insert";
  return (
    <section ref={shell} hidden={!active} className={`candidate-shell ${compact ? "candidate-shell--compact" : ""}`}
      onKeyDown={(event) => {
        if (composerOpen && event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault(); event.stopPropagation(); closeComposer();
        }
      }}>
      {compact && (
        <div className="candidate-topbar">
          <div className="candidate-navigation"><span>{selection.group === "revised" ? "Revised · " : ""}{index + 1}/{candidates.length}</span>{candidates.length > 1 && dots}</div>
          <div
            className="candidate-drag-handle"
            aria-hidden="true"
          >
            <span/>
          </div>
        </div>
      )}
      {!compact && (
        <div className="candidate-meta">
          <span>{candidate.strategy}</span>
          <span>{index + 1} / {candidates.length}</span>
        </div>
      )}
      <div className={`candidate-body ${composerOpen ? "candidate-body--revising" : ""}`}>
        <div
          ref={stage}
          className="candidate-stage"
          tabIndex={compact ? 0 : undefined}
          role={compact ? "region" : undefined}
          aria-label={compact ? `Suggestion ${index + 1} of ${candidates.length}` : undefined}
          onWheel={handleTrackpadSwipe}
          onPointerDown={(event) => {
            if (compact) return;
            pointerStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (compact) return;
            if (pointerStart.current === null) return;
            const delta = event.clientX - pointerStart.current;
            if (Math.abs(delta) > 48) move(index + (delta < 0 ? 1 : -1));
            pointerStart.current = null;
          }}
          onPointerCancel={(event) => {
            if (compact) return;
            pointerStart.current = null;
          }}
        >
          <div ref={content} className="candidate-content">
            {composerOpen && <div className="revision-source-label">Current suggestion</div>}
            <motion.div
              key={`${selection.group}-${index}-${candidateText}`}
              initial={reduceMotion ? false : { opacity: 0, x: direction * 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.14 }}
              className="candidate-copy"
            >
              <p>{candidateText}</p>
              {!compact && <span className="tone-label">{candidate.tone}</span>}
            </motion.div>
            {selection.revised && <div className="revision-group-switch">
              <button type="button" disabled={revising || applying} onClick={() => {
                dispatch({ type: "group", group: selection.group === "revised" ? "original" : "revised" });
                setStatus("idle"); setFeedback("");
              }}><RotateCcw size={12}/>{selection.group === "revised" ? "Back to original suggestions" : "Show revised suggestions"}</button>
            </div>}
          </div>
        </div>
        {composerOpen && <div className="revision-pane"><form ref={composer} className="revision-composer" aria-label="Revise suggestion" aria-busy={revising}
          onSubmit={(event) => { event.preventDefault(); void revise(); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void revise(); }
          }}>
          <div className="revision-label-row">
            <label htmlFor="revision-instruction">How should this change?</label>
            <button type="button" className="revision-dismiss" aria-label="Collapse revision instructions" onClick={closeComposer}><ChevronUp size={13} aria-hidden="true"/><span>Collapse</span></button>
          </div>
          <textarea ref={instructionField} id="revision-instruction" rows={2} value={instruction} maxLength={2_000}
            readOnly={revising} onChange={(event) => setInstruction(event.target.value)} placeholder="e.g. More casual, and mention I’m free on Friday…"/>
          <div className="revision-presets">{[["Shorter", "Make it shorter"], ["Warmer", "Make it warmer"], ["More direct", "Be more direct"]].map(([label, text]) => {
            const nextInstruction = instruction.trim() ? `${instruction.trimEnd()}\n${text}` : text;
            return <button key={text} type="button" disabled={revising || Boolean(contextError) || nextInstruction.length > 2_000} onClick={() => { setInstruction(nextInstruction); instructionField.current?.focus(); }}>{label}</button>;
          })}</div>
          <div className="revision-submit-row">
            <span className="revision-progress" role="status">{revising ? <><span className="spinner spinner--dark" aria-hidden="true"/>{selection.pending?.received ? `${selection.pending.received} ready · generating more…` : "Revising this suggestion…"}</> : "⌘ / Ctrl + Enter to revise"}</span>
            <button type={revising ? "button" : "submit"} className={`button ${revising ? "button--quiet" : "button--primary"}`}
              disabled={!revising && (Boolean(contextError) || !instruction.trim())}
              onClick={(event) => { if (revising) { event.preventDefault(); stopRevision(); } }}>
              {revising ? <><Square size={12}/> Stop</> : <><PencilLine size={14} aria-hidden="true"/> Revise</>}
            </button>
          </div>
        </form></div>}
      </div>
      {!compact && dots}
      <div className="candidate-actions">
        {compact ? (
          <>
            <button className="compact-text-action" onClick={() => move(index + 1)} aria-label="Show next suggestion">
              <ArrowLeftRight size={16} />
              <span>Next</span>
            </button>
            <button className="compact-text-action" disabled={applying} onClick={() => void useCandidate(true)} aria-label={status === "pasted" ? "Applied" : insertLabel}>
              {status === "pasted" || (!canInsert && status === "copied") ? <Check size={16} /> : !canInsert ? <Copy size={16} /> : <CornerDownLeft size={16} />}
              <span>{status === "pasted" ? "Applied" : insertLabel}</span>
            </button>
            <button ref={reviseButton} className={`compact-text-action ${composerOpen ? "is-active" : ""}`} disabled={applying || !sessionId} aria-expanded={composerOpen} aria-label="Revise suggestion" onClick={() => { if (composerOpen) closeComposer(); else { setFeedback(""); setComposerOpen(true); } }}><PencilLine size={15} aria-hidden="true"/><span>Revise</span></button>
            {onAsk && (
              <button className="compact-text-action" onClick={async () => {
                stopRevision();
                setFeedback("");
                try { await onAsk(); }
                catch (error) { setFeedback(error instanceof Error ? error.message : String(error)); }
              }} aria-label="Ask AI about this page">
                <Sparkles size={15} aria-hidden="true"/>
                <span>Ask AI</span>
              </button>
            )}
          </>
        ) : (
          <div className="arrow-pair">
            <button className="icon-button" onClick={() => move(index - 1)} aria-label="Previous candidate"><ArrowLeft size={17} /></button>
            <button className="icon-button" onClick={() => move(index + 1)} aria-label="Next candidate"><ArrowRight size={17} /></button>
          </div>
        )}
        {!compact && (
          <>
            <button
              className="button button--quiet"
              onClick={() => void useCandidate(false)}
              aria-label={status === "copied" ? "Copied" : "Copy suggestion"}
              title={status === "copied" ? "Copied" : "Copy suggestion"}
            >
              {status === "copied" ? <Check size={16} /> : <Copy size={16} />}
              {status === "copied" ? "Copied" : "Copy"}
            </button>
            {target && <button
              className="button button--primary"
              onClick={() => void useCandidate(true)}
              aria-label={status === "pasted" ? "Inserted" : insertLabel}
              title={status === "pasted" ? "Inserted" : insertLabel}
            >
              {status === "pasted" ? <Check size={16} /> : <CornerDownLeft size={16} />}
              {status === "pasted" ? "Inserted" : insertLabel}
            </button>}
          </>
        )}
      </div>
      {(contextError || feedback) && <p className="candidate-feedback" role="status">{contextError || feedback}</p>}
    </section>
  );
}
