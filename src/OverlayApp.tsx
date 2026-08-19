import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CircleAlert, X } from "lucide-react";
import type { AskOverlayContext, ChannelId, GenerationResult, InputTarget, OverlayStatus } from "./shared/types";
import { contextCueApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";
import { AskPanel } from "./components/AskPanel";

type OverlayPayload = GenerationResult & { channel: ChannelId; contact: string; target?: InputTarget };

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [status, setStatus] = useState<OverlayStatus>({ state: "loading", message: "Waiting for an input field…" });
  const [askContext, setAskContext] = useState<AskOverlayContext | null>(null);
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
      setAskContext(null);
      setPayload(result);
    });
    const stopStatus = contextCueApi.onOverlayStatus((next) => {
      setAskContext(null);
      setPayload(null);
      setStatus(next);
    });
    const stopAskOpen = contextCueApi.onAskOpen(setAskContext);
    return () => {
      stopResult();
      stopStatus();
      stopAskOpen();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (!askContext) {
        void contextCueApi.hideOverlay();
        return;
      }
      const returnToSuggestions = Boolean(payload && askContext.canReturnToSuggestions);
      void contextCueApi.exitAsk(returnToSuggestions).then(() => setAskContext(null));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [askContext, payload]);

  const enterAsk = () => {
    void contextCueApi.openAsk().then(setAskContext).catch((error) => {
      setPayload(null);
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
    });
  };

  const exitAsk = () => {
    const returnToSuggestions = Boolean(payload && askContext?.canReturnToSuggestions);
    void contextCueApi.exitAsk(returnToSuggestions).then(() => setAskContext(null));
  };

  return (
    <main className={`overlay-root ${askContext ? "overlay-root--ask" : !payload ? `overlay-root--${status.state}` : ""}`}>
      <button
        className="overlay-hover-close"
        onClick={() => void contextCueApi.hideOverlay()}
        aria-label={askContext ? "Close Ask AI" : "Close suggestions"}
        title="Close"
      >
        <X size={17} />
      </button>
      {askContext ? (
        <AskPanel context={askContext} onExit={exitAsk}/>
      ) : payload ? (
        <CandidateCarousel
          candidates={payload.candidates}
          channel={payload.channel}
          contact={payload.contact}
          scenario={payload.scenario}
          target={payload.target}
          compact
          onAsk={enterAsk}
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
              <strong>{status.message}</strong>
              {status.modelName && <span>Model · {status.modelName}</span>}
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
