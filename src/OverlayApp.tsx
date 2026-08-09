import { useEffect, useState } from "react";
import { CircleAlert, GripHorizontal, ScanLine, X } from "lucide-react";
import type { ChannelId, GenerationResult, OverlayStatus } from "./shared/types";
import { hiplyApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";

type OverlayPayload = GenerationResult & { channel: ChannelId; contact: string };

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [status, setStatus] = useState<OverlayStatus>({ state: "loading", message: "Waiting for a conversation…" });

  useEffect(() => {
    const stopResult = hiplyApi.onOverlayResult((result) => {
      setPayload(result);
    });
    const stopStatus = hiplyApi.onOverlayStatus((next) => {
      setPayload(null);
      setStatus(next);
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void hiplyApi.hideOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      stopResult();
      stopStatus();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
            <span>Swipe or use ← → · Enter to insert</span>
          </div>
          <CandidateCarousel candidates={payload.candidates} channel={payload.channel} contact={payload.contact} compact />
        </>
      ) : (
        <div className={`overlay-empty overlay-empty--${status.state}`}>
          <span className="overlay-state-icon">{status.state === "loading" ? <ScanLine size={24}/> : <CircleAlert size={24}/>}</span>
          <strong>{status.state === "loading" ? "Drafting beside your chat" : "Couldn’t open quick reply"}</strong>
          <p>{status.message}</p>
          {status.state === "error" && <button onClick={() => void hiplyApi.hideOverlay()}>Close</button>}
        </div>
      )}
    </main>
  );
}
