import { useEffect, useRef, useState } from "react";
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
  const [askVisible, setAskVisible] = useState(false);
  const [expired, setExpired] = useState<{ sessionId: string; message: string } | null>(null);
  const eventRevision = useRef(0);

  useEffect(() => {
    const stopReset = contextCueApi.onOverlayReset(() => {
      eventRevision.current += 1;
      setAskContext(null);
      setAskVisible(false);
      setPayload(null);
      setExpired(null);
      setStatus({ state: "loading", message: "Reading the current window…" });
    });
    const stopResult = contextCueApi.onOverlayResult((result) => {
      eventRevision.current += 1;
      setAskContext(null);
      setAskVisible(false);
      setPayload(result);
      setExpired(null);
    });
    const stopStatus = contextCueApi.onOverlayStatus((next) => {
      eventRevision.current += 1;
      setAskContext(null);
      setAskVisible(false);
      setPayload(null);
      setStatus(next);
    });
    const stopAskOpen = contextCueApi.onAskOpen((context) => {
      eventRevision.current += 1;
      setPayload((current) => current?.sessionId === context.sessionId ? current : null);
      setAskContext(context);
      setAskVisible(true);
    });
    const stopExpired = contextCueApi.onOverlayExpired((event) => {
      eventRevision.current += 1;
      setExpired(event);
      setStatus({ state: "error", message: event.message });
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
      if (!askVisible) {
        void contextCueApi.hideOverlay();
        return;
      }
      const returnToSuggestions = Boolean(payload && askContext?.canReturnToSuggestions);
      const revision = eventRevision.current;
      void contextCueApi.exitAsk(returnToSuggestions).then(() => { if (revision === eventRevision.current) setAskVisible(false); });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [askContext, askVisible, payload]);

  const enterAsk = () => {
    const revision = eventRevision.current;
    return contextCueApi.openAsk().then((context) => { if (revision === eventRevision.current) { setAskContext(context); setAskVisible(true); } }).catch((error) => {
      if (revision !== eventRevision.current) return;
      // A click can race with switching away. Surface the error in the existing
      // carousel rather than unmounting the user's selected draft and composer.
      throw error;
    });
  };

  const exitAsk = () => {
    const returnToSuggestions = Boolean(payload && askContext?.canReturnToSuggestions);
    const revision = eventRevision.current;
    void contextCueApi.exitAsk(returnToSuggestions).then(() => { if (revision === eventRevision.current) setAskVisible(false); });
  };

  const showDraft = async (draft: OverlayResult) => {
    const revision = eventRevision.current;
    await contextCueApi.showDraft(draft.sessionId!);
    if (revision !== eventRevision.current) return;
    setPayload(draft);
    setAskContext((current) => current ? { ...current, canReturnToSuggestions: true } : current);
    setAskVisible(false);
  };

  return (
    <main className={`overlay-root ${askVisible ? "overlay-root--ask" : !payload ? `overlay-root--${status.state}` : ""}`}>
      {(askContext || payload) && <OverlayWindowControls/>}
      <button
        className="overlay-hover-close"
        onClick={() => void contextCueApi.hideOverlay()}
        aria-label={askVisible ? "Close Ask AI" : "Close suggestions"}
        title="Close"
      >
        <X size={17} />
      </button>
      {askContext && <AskPanel key={`ask-${askContext.sessionId}`} context={askContext}
        active={askVisible} onDraft={showDraft}
        contextError={expired?.sessionId === askContext.sessionId ? expired.message : undefined} onExit={exitAsk}/>}
      {payload && (
        <CandidateCarousel
          key={`suggestions-${payload.sessionId}-${payload.generatedAt}`}
          sessionId={payload.sessionId}
          contextError={expired?.sessionId === payload.sessionId ? expired?.message : undefined}
          active={!askVisible}
          candidates={payload.candidates}
          channel={payload.channel}
          contact={payload.contact}
          scenario={payload.scenario}
          target={payload.target}
          compact
          onAsk={enterAsk}
          onHeightChange={contextCueApi.resizeOverlay}
        />
      )}
      {!askVisible && !payload && (
        status.state === "loading" ? (
          <div
            className="overlay-processing"
            role="status"
            aria-label={`${status.message} Model: ${status.modelName || "Configured model"}`}
          >
            <div>
              <strong>{status.message}</strong>
              {status.modelName && <span>Model · {status.modelName}</span>}
            </div>
          </div>
        ) : (
          <div className="overlay-empty overlay-empty--error">
            <span className="overlay-state-icon"><CircleAlert size={24}/></span>
            <strong>Couldn’t open ContextCue</strong>
            <p>{status.message}</p>
            <button onClick={() => void contextCueApi.hideOverlay()}>Close</button>
          </div>
        )
      )}
    </main>
  );
}
