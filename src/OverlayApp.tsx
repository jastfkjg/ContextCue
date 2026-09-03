import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CircleAlert, X } from "lucide-react";
import type { AskOverlayContext, OverlayResult, OverlayStatus } from "./shared/types";
import { contextCueApi } from "./lib/api";
import { CandidateCarousel } from "./components/CandidateCarousel";
import { AskPanel } from "./components/AskPanel";
import { OverlayWindowControls } from "./components/OverlayWindowControls";

type OverlayPayload = OverlayResult;

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [status, setStatus] = useState<OverlayStatus>({ state: "loading", message: "Reading the current window…" });
  const [askContext, setAskContext] = useState<AskOverlayContext | null>(null);
  const [expired, setExpired] = useState<{ sessionId: string; message: string } | null>(null);
  const eventRevision = useRef(0);
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
    const stopReset = contextCueApi.onOverlayReset(() => {
      eventRevision.current += 1;
      setAskContext(null);
      setPayload(null);
      setExpired(null);
      setStatus({ state: "loading", message: "Reading the current window…" });
    });
    const stopResult = contextCueApi.onOverlayResult((result) => {
      eventRevision.current += 1;
      setAskContext(null);
      setPayload(result);
      setExpired(null);
    });
    const stopStatus = contextCueApi.onOverlayStatus((next) => {
      eventRevision.current += 1;
      setAskContext(null);
      setPayload(null);
      setStatus(next);
    });
    const stopAskOpen = contextCueApi.onAskOpen((context) => {
      eventRevision.current += 1;
      setPayload((current) => current?.sessionId === context.sessionId ? current : null);
      setAskContext(context);
    });
    const stopExpired = contextCueApi.onOverlayExpired((event) => {
      eventRevision.current += 1;
      setExpired(event);
    });
    return () => {
      stopResult();
      stopStatus();
      stopAskOpen();
      stopReset();
      stopExpired();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      if (!askContext) {
        void contextCueApi.hideOverlay();
        return;
      }
      const returnToSuggestions = Boolean(payload && askContext.canReturnToSuggestions);
      void contextCueApi.exitAsk(returnToSuggestions).then(() => setAskContext((current) => current?.sessionId === askContext.sessionId ? null : current));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [askContext, payload]);

  const enterAsk = () => {
    const revision = eventRevision.current;
    void contextCueApi.openAsk().then((context) => { if (revision === eventRevision.current) setAskContext(context); }).catch((error) => {
      if (revision !== eventRevision.current) return;
      setPayload(null);
      setStatus({ state: "error", message: error instanceof Error ? error.message : String(error) });
    });
  };

  const exitAsk = () => {
    const returnToSuggestions = Boolean(payload && askContext?.canReturnToSuggestions);
    void contextCueApi.exitAsk(returnToSuggestions).then(() => setAskContext((current) => current?.sessionId === askContext?.sessionId ? null : current));
  };

  return (
    <main className={`overlay-root ${askContext ? "overlay-root--ask" : !payload ? `overlay-root--${status.state}` : ""}`}>
      {(askContext || payload) && <OverlayWindowControls/>}
      <button
        className="overlay-hover-close"
        onClick={() => void contextCueApi.hideOverlay()}
        aria-label={askContext ? "Close Ask AI" : "Close suggestions"}
        title="Close"
      >
        <X size={17} />
      </button>
      {askContext ? (
        <AskPanel key={askContext.sessionId} context={askContext} onExit={exitAsk}/>
      ) : payload ? (
        <CandidateCarousel
          key={payload.sessionId ?? payload.generatedAt}
          sessionId={payload.sessionId}
          contextError={expired?.sessionId === payload.sessionId ? expired?.message : undefined}
          onEditCandidate={(index, text) => setPayload((current) => current ? { ...current, candidates: current.candidates.map((candidate, i) => i === index ? { ...candidate, text } : candidate) } : null)}
          candidates={payload.candidates}
          channel={payload.channel}
          contact={payload.contact}
          scenario={payload.scenario}
          target={payload.target}
          compact
          onAsk={expired?.sessionId === payload.sessionId ? undefined : enterAsk}
          onHeightChange={contextCueApi.resizeOverlay}
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
