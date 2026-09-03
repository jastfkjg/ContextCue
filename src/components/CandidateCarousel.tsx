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
  practice?: boolean;
  onEditCandidate?: (index: number, text: string) => void;
}

export function CandidateCarousel({ candidates, channel, contact, scenario = "reply", target, compact = false, onAsk, onHeightChange, sessionId, practice = false, onEditCandidate }: Props) {
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
  useEffect(() => () => { revisionRun.current += 1; }, []);
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
      const navigation = shell.current.querySelector<HTMLElement>(".candidate-navigation")?.offsetHeight ?? 0;
      onHeightChange(Math.ceil(padding + navigation + node.offsetHeight + actions + note + 2), resetHeight, editing);
    };
    copyObserver.current = new ResizeObserver(() => measure());
    copyObserver.current.observe(node);
    const note = shell.current?.querySelector(".candidate-feedback");
    if (note) copyObserver.current.observe(note);
    measure(newCandidate);
  }, [compact, onHeightChange, feedback, editing]);

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
      if (practice) {
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
    if (!sessionId || !instruction.trim() || !draft.trim() || revising) return;
    const run = ++revisionRun.current;
    setRevising(true);
    setFeedback("");
    try {
      const text = await contextCueApi.reviseSuggestion({ sessionId, text: draft, instruction });
      if (run === revisionRun.current) { setDraft(text); setInstruction(""); }
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
  const insertLabel = !target ? (status === "copied" ? "Copied" : "Copy") : action === "replace-selection" ? "Replace selection" : action === "replace-all" ? "Replace field" : "Insert";
  return (
    <section ref={shell} className={`candidate-shell ${compact ? "candidate-shell--compact" : ""}`}>
      {compact && (
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
      )}
      {!compact && (
        <div className="candidate-meta">
          <span>{candidate.strategy}</span>
          <span>{index + 1} / {candidates.length}</span>
        </div>
      )}
      {compact && <div className="candidate-navigation"><span>{index + 1} / {candidates.length} · This page only</span>{dots}</div>}
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
          <label> Edit suggestion<textarea autoFocus aria-label="Edit suggestion" value={draft} maxLength={16_000} disabled={revising} onChange={(event) => setDraft(event.target.value)}/></label>
          {sessionId && <form onSubmit={(event) => { event.preventDefault(); void revise(); }}>
            <label htmlFor="revision-instruction">Change it in one sentence</label>
            <div className="revision-presets">{["Make it shorter", "Make it warmer", "Be more direct"].map((text) => <button key={text} type="button" disabled={revising} onClick={() => setInstruction(text)}>{text}</button>)}</div>
            <input id="revision-instruction" value={instruction} maxLength={2_000} disabled={revising} onChange={(event) => setInstruction(event.target.value)} placeholder="e.g. Decline politely and suggest Friday"/>
            {revising ? <button type="button" className="button button--quiet" onClick={stopRevision}><Square size={13}/> Stop</button>
              : <button className="button button--quiet" type="submit" disabled={!draft.trim() || !instruction.trim()}><Sparkles size={14}/> Revise with AI</button>}
            <small role="status">{revising ? "Revising with this page only…" : "Uses only this page and this draft. Nothing is sent or inserted automatically."}</small>
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
              {status === "pasted" || (!target && status === "copied") ? <Check size={16} /> : !target ? <Copy size={16} /> : <CornerDownLeft size={16} />}
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
      {feedback && <p className="candidate-feedback" role="status">{feedback}</p>}
    </section>
  );
}
