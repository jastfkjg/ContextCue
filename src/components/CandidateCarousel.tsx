import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, CornerDownLeft } from "lucide-react";
import type { CandidateReply, ChannelId } from "../shared/types";
import { contextCueApi } from "../lib/api";
import { consumeHorizontalSwipe, createHorizontalSwipeTracker } from "../lib/horizontal-swipe";

interface Props {
  candidates: CandidateReply[];
  channel: ChannelId;
  contact: string;
  compact?: boolean;
}

export function CandidateCarousel({ candidates, channel, contact, compact = false }: Props) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [status, setStatus] = useState<"idle" | "copied" | "pasted">("idle");
  const [feedback, setFeedback] = useState("");
  const pointerStart = useRef<number | null>(null);
  const horizontalSwipe = useRef(createHorizontalSwipeTracker());

  const move = (next: number) => {
    const wrapped = (next + candidates.length) % candidates.length;
    setDirection(next > index || (index === candidates.length - 1 && wrapped === 0) ? 1 : -1);
    setIndex(wrapped);
    setStatus("idle");
    setFeedback("");
  };

  const useReply = async (paste: boolean) => {
    const result = await contextCueApi.useReply({ text: candidates[index].text, channel, contact, paste });
    setStatus(result.pasted ? "pasted" : "copied");
    setFeedback(result.error ?? "");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(index - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(index + 1); }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        void useReply(true);
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

  const candidate = candidates[index];
  const insertLabel = channel === "wechat" ? "Insert into WeChat" : "Insert";
  return (
    <section className={`candidate-shell ${compact ? "candidate-shell--compact" : ""}`}>
      {!compact && (
        <div className="candidate-meta">
          <span>{candidate.strategy}</span>
          <span>{index + 1} / {candidates.length}</span>
        </div>
      )}
      <div
        className="candidate-stage"
        onWheel={handleTrackpadSwipe}
        onPointerDown={(event) => { pointerStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (pointerStart.current === null) return;
          const delta = event.clientX - pointerStart.current;
          if (Math.abs(delta) > 48) move(index + (delta < 0 ? 1 : -1));
          pointerStart.current = null;
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
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
        <div className="candidate-dots" aria-label="Candidate selector">
          {candidates.map((_, dot) => (
            <button
              key={dot}
              className={dot === index ? "active" : ""}
              onClick={() => move(dot)}
              aria-label={`Show candidate ${dot + 1}`}
            />
          ))}
        </div>
      )}
      <div className="candidate-actions">
        {compact ? (
          <div className="candidate-dots candidate-dots--inline" aria-label="Candidate selector">
            {candidates.map((_, dot) => (
              <button
                key={dot}
                className={dot === index ? "active" : ""}
                onClick={() => move(dot)}
                aria-label={`Show candidate ${dot + 1}`}
              />
            ))}
          </div>
        ) : (
          <div className="arrow-pair">
            <button className="icon-button" onClick={() => move(index - 1)} aria-label="Previous candidate"><ArrowLeft size={17} /></button>
            <button className="icon-button" onClick={() => move(index + 1)} aria-label="Next candidate"><ArrowRight size={17} /></button>
          </div>
        )}
        <button
          className={`button button--quiet ${compact ? "compact-action" : ""}`}
          onClick={() => void useReply(false)}
          aria-label={status === "copied" ? "Copied" : "Copy reply"}
          title={status === "copied" ? "Copied" : "Copy reply"}
        >
          {status === "copied" ? <Check size={compact ? 15 : 16} /> : <Copy size={compact ? 15 : 16} />}
          {!compact && (status === "copied" ? "Copied" : "Copy")}
        </button>
        <button
          className={`button button--primary ${compact ? "compact-action" : ""}`}
          onClick={() => void useReply(true)}
          aria-label={status === "pasted" ? "Inserted" : insertLabel}
          title={status === "pasted" ? "Inserted" : insertLabel}
        >
          {status === "pasted" ? <Check size={compact ? 15 : 16} /> : <CornerDownLeft size={compact ? 15 : 16} />}
          {!compact && (status === "pasted" ? "Inserted" : insertLabel)}
        </button>
      </div>
      {feedback && <p className="candidate-feedback" role="status">{feedback}</p>}
    </section>
  );
}
