import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CircleAlert, X } from "lucide-react";
import type { ChannelId, GenerationResult, InputTarget, OverlayStatus } from "./shared/types";
import { contextCueApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";

type OverlayPayload = GenerationResult & { channel: ChannelId; contact: string; target?: InputTarget };

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [status, setStatus] = useState<OverlayStatus>({ state: "loading", message: "Waiting for an input field…" });
  const windowDrag = useRef<{ pointerId: number; screenX: number; screenY: number } | null>(null);

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
    <main className={`overlay-root ${!payload ? `overlay-root--${status.state}` : ""}`}>
      <button
        className="overlay-hover-close"
        onClick={() => void contextCueApi.hideOverlay()}
        aria-label="Close suggestions"
        title="Close"
      >
        <X size={17} />
      </button>
      {payload ? (
        <CandidateCarousel
          candidates={payload.candidates}
          channel={payload.channel}
          contact={payload.contact}
          scenario={payload.scenario}
          taskLabel={payload.taskLabel}
          target={payload.target}
          compact
        />
      ) : (
        status.state === "loading" ? (
          <div
            className="overlay-processing"
            role="status"
            aria-label={`${status.message} Model: ${status.modelName || "Configured model"}`}
            onPointerDown={beginWindowDrag}
            onPointerMove={continueWindowDrag}
            onPointerUp={endWindowDrag}
            onPointerCancel={endWindowDrag}
          >
            <div>
              <strong>Generating suggestions…</strong>
              <span>Model · {status.modelName || "Configured model"}</span>
            </div>
          </div>
        ) : (
          <div className="overlay-empty overlay-empty--error">
            <span className="overlay-state-icon"><CircleAlert size={24}/></span>
            <strong>Couldn’t open suggestions</strong>
            <p>{status.message}</p>
            <button onClick={() => void contextCueApi.hideOverlay()}>Close</button>
          </div>
        )
      )}
    </main>
  );
}
