import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, CornerDownLeft } from "lucide-react";
import type { CandidateReply, ChannelId } from "../shared/types";
import { hiplyApi } from "../lib/api";

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
  const pointerStart = useRef<number | null>(null);

  const move = (next: number) => {
    const wrapped = (next + candidates.length) % candidates.length;
    setDirection(next > index || (index === candidates.length - 1 && wrapped === 0) ? 1 : -1);
    setIndex(wrapped);
    setStatus("idle");
  };

  const useReply = async (paste: boolean) => {
    const result = await hiplyApi.useReply({ text: candidates[index].text, channel, contact, paste });
    setStatus(result.pasted ? "pasted" : "copied");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") move(index - 1);
      if (event.key === "ArrowRight") move(index + 1);
      if (event.key === "Enter") void useReply(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const candidate = candidates[index];
  return (
    <section className={`candidate-shell ${compact ? "candidate-shell--compact" : ""}`}>
      <div className="candidate-meta">
        <span>{candidate.strategy}</span>
        <span>{index + 1} / {candidates.length}</span>
      </div>
      <div
        className="candidate-stage"
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
            <span className="tone-label">{candidate.tone}</span>
          </motion.div>
        </AnimatePresence>
      </div>
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
      <div className="candidate-actions">
        <div className="arrow-pair">
          <button className="icon-button" onClick={() => move(index - 1)} aria-label="Previous candidate"><ArrowLeft size={17} /></button>
          <button className="icon-button" onClick={() => move(index + 1)} aria-label="Next candidate"><ArrowRight size={17} /></button>
        </div>
        <button className="button button--quiet" onClick={() => void useReply(false)}>
          {status === "copied" ? <Check size={16} /> : <Copy size={16} />} {status === "copied" ? "Copied" : "Copy"}
        </button>
        <button className="button button--primary" onClick={() => void useReply(true)}>
          {status === "pasted" ? <Check size={16} /> : <CornerDownLeft size={16} />} {status === "pasted" ? "Inserted" : "Insert"}
        </button>
      </div>
    </section>
  );
}
