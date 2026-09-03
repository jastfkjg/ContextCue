import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, Copy, CornerDownLeft, Sparkles } from "lucide-react";
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
  onHeightChange?: (height: number, newCandidate: boolean) => void;
}

export function CandidateCarousel({ candidates, channel, contact, scenario = "reply", target, compact = false, onAsk, onHeightChange }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [status, setStatus] = useState<"idle" | "copied" | "pasted">("idle");
  const [feedback, setFeedback] = useState("");
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
      onHeightChange(Math.ceil(padding + node.offsetHeight + actions + note + 2), resetHeight);
    };
    copyObserver.current = new ResizeObserver(() => measure());
    copyObserver.current.observe(node);
    const note = shell.current?.querySelector(".candidate-feedback");
    if (note) copyObserver.current.observe(note);
    measure(newCandidate);
  }, [compact, onHeightChange, feedback]);

  const move = (next: number) => {
    const wrapped = (next + candidates.length) % candidates.length;
    setDirection(next > index || (index === candidates.length - 1 && wrapped === 0) ? 1 : -1);
    setIndex(wrapped);
    setStatus("idle");
    setFeedback("");
  };

  const useCandidate = async (paste: boolean) => {
    const candidate = candidates[index];
    const result = await contextCueApi.useSuggestion({
      text: candidate.text,
      channel,
      contact,
      paste: paste && Boolean(target),
      action: candidate.action ?? (target?.selectedText ? "replace-selection" : "insert"),
      scenario,
      target
    });
    setStatus(result.pasted ? "pasted" : "copied");
    setFeedback(result.error ?? "");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            ref={measureCopy}
            key={`${index}-${candidate.text}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -34 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="candidate-copy"
          >
            <p>{candidate.text}</p>
            {!compact && <span className="tone-label">{candidate.tone}</span>}
          </motion.div>
        </AnimatePresence>
      </div>
      {!compact && (
        <div className="candidate-dots" role="status" aria-label={`Suggestion ${index + 1} of ${candidates.length}`}>
          {candidates.map((_, dot) => (
            <span
              key={dot}
              className={dot === index ? "active" : ""}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      <div className="candidate-actions">
        {compact ? (
          <>
            <button className="compact-text-action" onClick={() => move(index + 1)} aria-label="Show next suggestion">
              <ArrowLeftRight size={16} />
              <span>Next</span>
            </button>
            <button className="compact-text-action" onClick={() => void useCandidate(true)} aria-label={status === "pasted" ? "Applied" : insertLabel}>
              {status === "pasted" || (!target && status === "copied") ? <Check size={16} /> : !target ? <Copy size={16} /> : <CornerDownLeft size={16} />}
              <span>{status === "pasted" ? "Applied" : insertLabel}</span>
            </button>
            {onAsk && (
              <button className="compact-text-action" onClick={onAsk} aria-label="Ask AI about this page">
                <Sparkles size={15}/>
                <span>Ask AI</span>
              </button>
            )}
            <div className="candidate-dots candidate-dots--inline" role="status" aria-label={`Suggestion ${index + 1} of ${candidates.length}`}>
              {candidates.map((_, dot) => (
                <span
                  key={dot}
                  className={dot === index ? "active" : ""}
                  aria-hidden="true"
                />
              ))}
            </div>
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
      {feedback && <p className="candidate-feedback" role="status">{feedback}</p>}
    </section>
  );
}
