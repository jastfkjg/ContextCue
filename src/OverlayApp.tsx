import { useEffect, useState } from "react";
import { CircleAlert, ScanLine } from "lucide-react";
import type { ChannelId, GenerationResult, OverlayStatus } from "./shared/types";
import { contextCueApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";

type OverlayPayload = GenerationResult & { channel: ChannelId; contact: string };

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [status, setStatus] = useState<OverlayStatus>({ state: "loading", message: "Waiting for a conversation…" });

  useEffect(() => {
    const stopResult = contextCueApi.onOverlayResult((result) => {
      setPayload(result);
    });
    const stopStatus = contextCueApi.onOverlayStatus((next) => {
      setPayload(null);
      setStatus(next);
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void contextCueApi.hideOverlay();
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
      {payload ? (
        <CandidateCarousel
          candidates={payload.candidates}
          channel={payload.channel}
          contact={payload.contact}
          compact
          onClose={() => void contextCueApi.hideOverlay()}
        />
      ) : (
        <div className={`overlay-empty overlay-empty--${status.state}`}>
          <span className="overlay-state-icon">{status.state === "loading" ? <ScanLine size={24}/> : <CircleAlert size={24}/>}</span>
          <strong>{status.state === "loading" ? "Drafting beside your chat" : "Couldn’t open quick reply"}</strong>
          <p>{status.message}</p>
          {status.state === "error" && <button onClick={() => void contextCueApi.hideOverlay()}>Close</button>}
        </div>
      )}
    </main>
  );
}
