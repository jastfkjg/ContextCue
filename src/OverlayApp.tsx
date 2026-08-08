import { useEffect, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import type { ChannelId, GenerationResult } from "./shared/types";
import { hiplyApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";

type OverlayPayload = GenerationResult & { channel: ChannelId; contact: string };

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);

  useEffect(() => hiplyApi.onOverlayResult(setPayload), []);

  return (
    <main className="overlay-root">
      <header className="overlay-header">
        <span className="overlay-brand"><i /> Hiply</span>
        <GripHorizontal size={18} className="drag-handle" />
        <button className="overlay-close" onClick={() => void hiplyApi.hideOverlay()} aria-label="Close"><X size={17} /></button>
      </header>
      {payload ? (
        <>
          <div className="overlay-context">
            <span>{payload.contact || "Current conversation"}</span>
            <span>{payload.detectedLanguage}</span>
          </div>
          <CandidateCarousel candidates={payload.candidates} channel={payload.channel} contact={payload.contact} compact />
        </>
      ) : (
        <div className="overlay-empty"><span className="spinner" /> Waiting for a draft…</div>
      )}
    </main>
  );
}
