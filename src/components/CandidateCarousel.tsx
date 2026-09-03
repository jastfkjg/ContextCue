import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, Copy, CornerDownLeft, Pencil, Sparkles, Square } from "lucide-react";
import type { AssistScenario, CandidateReply, ChannelId, InputTarget } from "../shared/types";
import { contextCueApi } from "../lib/api";
import { consumeHorizontalSwipe, createHorizontalSwipeTracker } from "../lib/horizontal-swipe";

interface Props {
  candidates: CandidateReply[];
  channel: ChannelId;
  contact: string;
  scenario?: AssistScenario;
  target?: InputTarget;
  compact?: boolean;
  onAsk?: () => void;
  onHeightChange?: (height: number, newCandidate: boolean, editing?: boolean) => void;
  sessionId?: string;
  contextError?: string;
  practice?: boolean;
  onEditCandidate?: (index: number, text: string) => void;
}

export function CandidateCarousel({ candidates, channel, contact, scenario = "reply", target, compact = false, onAsk, onHeightChange, sessionId, contextError, practice = false, onEditCandidate }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [status, setStatus] = useState<"idle" | "copied" | "pasted">("idle");
  const [feedback, setFeedback] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [applying, setApplying] = useState(false);
  const revisionRun = useRef(0);
  const editButton = useRef<HTMLButtonElement>(null);
  const revisionButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { revisionRun.current += 1; }, []);
  useEffect(() => {
    if (!compact || !sessionId) return;
    contextCueApi.setOverlayEditing(sessionId, editing);
    return () => contextCueApi.setOverlayEditing(sessionId, false);
  }, [compact, sessionId, editing]);
  useEffect(() => {
    if (!contextError) return;
    revisionRun.current += 1;
    setRevising(false);
  }, [contextError]);
  const pointerStart = useRef<number | null>(null);
  const windowDrag = useRef<{ pointerId: number; screenX: number; screenY: number } | null>(null);
  const horizontalSwipe = useRef(createHorizontalSwipeTracker());
  const shell = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const copyObserver = useRef<ResizeObserver | null>(null);
  const measuredCopy = useRef<HTMLDivElement | null>(null);
  const measureCopy = useCallback((node: HTMLDivElement | null) => {
    copyObserver.current?.disconnect();
    if (!node || !compact) return;
    // A new candidate always starts at its first line, even after scrolling the last one.
    if (stage.current) stage.current.scrollTop = 0;
    if (!onHeightChange) return;
    // Feedback can reattach this ref to the same node. Only a new candidate
    // should release a manually chosen height, not resize-observer callbacks.
    const newCandidate = measuredCopy.current !== node;
    measuredCopy.current = node;
    const measure = (resetHeight = false) => {
      if (!shell.current) return;
      const padding = Number.parseFloat(getComputedStyle(shell.current).paddingTop) || 0;
      const actions = shell.current.querySelector<HTMLElement>(".candidate-actions")?.offsetHeight ?? 0;
      const note = shell.current.querySelector<HTMLElement>(".candidate-feedback")?.offsetHeight ?? 0;
      onHeightChange(Math.ceil(padding + node.offsetHeight + actions + note + 2), resetHeight, editing);
    };
    copyObserver.current = new ResizeObserver(() => measure());
    copyObserver.current.observe(node);
    const note = shell.current?.querySelector(".candidate-feedback");
    if (note) copyObserver.current.observe(note);
    measure(newCandidate);
  }, [compact, onHeightChange, feedback, editing, contextError]);

  const move = (next: number) => {
    if (editing || applying) return;
    const wrapped = (next + candidates.length) % candidates.length;
    setDirection(next > index || (index === candidates.length - 1 && wrapped === 0) ? 1 : -1);
    setIndex(wrapped);
    setStatus("idle");
    setFeedback("");
  };

  const useCandidate = async (paste: boolean) => {
    if (applying || editing) return;
    const candidate = candidates[index];
    const text = edits[index] ?? candidate.text;
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
    revisionRun.current += 1;
    contextCueApi.cancelRevision();
    setRevising(false);
  };
  const finishEdit = (save: boolean) => {
    stopRevision();
    if (save && draft.trim()) {
      setEdits((current) => ({ ...current, [index]: draft.trim() }));
      onEditCandidate?.(index, draft.trim());
      setStatus("idle");
    }
    setEditing(false);
    setFeedback("");
    window.requestAnimationFrame(() => editButton.current?.focus());
  };
  const revise = async () => {
    if (!sessionId || contextError || !instruction.trim() || !draft.trim() || revising) return;
    revisionButton.current?.focus();
    const run = ++revisionRun.current;
    setRevising(true);
    setFeedback("");
    try {
      const text = await contextCueApi.reviseSuggestion({ sessionId, text: draft, instruction });
      if (run === revisionRun.current) { setDraft(text); setFeedback("Draft updated. Review it, then save."); }
    } catch (error) {
      if (run === revisionRun.current) setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      if (run === revisionRun.current) setRevising(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || editing || applying
        || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]"))) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
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

  const beginWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    windowDrag.current = { pointerId: event.pointerId, screenX: event.screenX, screenY: event.screenY };
  };

  const continueWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = windowDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.screenX - drag.screenX;
    const deltaY = event.screenY - drag.screenY;
    if (!deltaX && !deltaY) return;
    contextCueApi.moveOverlay(deltaX, deltaY);
    drag.screenX = event.screenX;
    drag.screenY = event.screenY;
  };

  const endWindowDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (windowDrag.current?.pointerId === event.pointerId) windowDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const candidate = candidates[index];
  const candidateText = edits[index] ?? candidate.text;
  const dots = <div className="candidate-dots" role="group" aria-label="Choose a suggestion">
    {candidates.map((_, dot) => <button key={dot} type="button" className={dot === index ? "active" : ""}
      aria-label={`Show suggestion ${dot + 1} of ${candidates.length}`} aria-pressed={dot === index}
      disabled={editing || applying} onClick={() => move(dot)}><span aria-hidden="true"/></button>)}
  </div>;
  const action = candidate.action ?? (target?.selectedText ? "replace-selection" : "insert");
  const canInsert = Boolean(target) && !contextError;
  const insertLabel = !canInsert ? (status === "copied" ? "Copied" : "Copy") : action === "replace-selection" ? "Replace selection" : action === "replace-all" ? "Replace field" : "Insert";
  return (
    <section ref={shell} className={`candidate-shell ${compact ? "candidate-shell--compact" : ""}`}>
      {compact && (
        <div className="candidate-topbar">
          {!editing && candidates.length > 1 && <div className="candidate-navigation"><span>{index + 1}/{candidates.length}</span>{dots}</div>}
          <div
            className="candidate-drag-handle"
            aria-hidden="true"
            onPointerDown={beginWindowDrag}
            onPointerMove={continueWindowDrag}
            onPointerUp={endWindowDrag}
            onPointerCancel={endWindowDrag}
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
        {editing ? <div ref={measureCopy} className="candidate-editor" onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishEdit(false); }
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !revising) { event.preventDefault(); finishEdit(true); }
        }}>
          <div className="candidate-editor-heading"><strong>Edit draft</strong><span>Review before saving</span></div>
          <label><span className="visually-hidden">Edit suggestion</span><textarea autoFocus aria-label="Edit suggestion" rows={3} value={draft} maxLength={16_000} readOnly={revising} onChange={(event) => setDraft(event.target.value)}/></label>
          {sessionId && <form aria-busy={revising} onSubmit={(event) => { event.preventDefault(); void revise(); }}>
            <div className="revision-label-row"><label htmlFor="revision-instruction">Instructions or context</label>
              <span className="revision-progress" role="status">{revising && <><span className="spinner spinner--dark" aria-hidden="true"/> Revising draft…</>}</span>
            </div>
            <textarea id="revision-instruction" className="revision-instruction" rows={2} value={instruction} maxLength={2_000} readOnly={revising} onChange={(event) => setInstruction(event.target.value)} placeholder="What should change? Add any useful context…"/>
            <div className="revision-submit-row">
            <div className="revision-presets">{[["Shorter", "Make it shorter"], ["Warmer", "Make it warmer"], ["More direct", "Be more direct"]].map(([label, text]) => {
              const nextInstruction = instruction.trim() ? `${instruction.trimEnd()}\n${text}` : text;
              return <button key={text} type="button" disabled={revising || Boolean(contextError) || nextInstruction.length > 2_000} onClick={() => setInstruction(nextInstruction)}>{label}</button>;
            })}</div>
              <button ref={revisionButton} type={revising ? "button" : "submit"} className="button button--quiet"
                disabled={!revising && (Boolean(contextError) || !draft.trim() || !instruction.trim())}
                onClick={(event) => { if (revising) { event.preventDefault(); stopRevision(); } }}>
                {revising ? <><Square size={13}/> Stop revising</> : <><Sparkles size={14}/> Revise with AI</>}
              </button>
            </div>
          </form>}
        </div> : <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            ref={measureCopy}
            key={`${index}-${candidateText}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -34 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="candidate-copy"
          >
            <p>{candidateText}</p>
            {!compact && <span className="tone-label">{candidate.tone}</span>}
          </motion.div>
        </AnimatePresence>}
      </div>
      {!compact && dots}
      {editing ? <div className="candidate-actions candidate-edit-actions"><button className="button button--quiet" onClick={() => finishEdit(false)}>Cancel</button><button className="button button--primary" disabled={revising || !draft.trim()} onClick={() => finishEdit(true)}><Check size={14}/> Save draft</button></div> : <div className="candidate-actions">
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
            <button ref={editButton} className="compact-text-action" disabled={applying} onClick={() => { setDraft(candidateText); setInstruction(""); setFeedback(""); setEditing(true); }}><Pencil size={15}/><span>Edit</span></button>
            {onAsk && (
              <button className="compact-text-action" onClick={onAsk} aria-label="Ask AI about this page">
                <Sparkles size={15}/>
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
      </div>}
      {(contextError || feedback) && <p className="candidate-feedback" role="status">{contextError || feedback}</p>}
    </section>
  );
}
