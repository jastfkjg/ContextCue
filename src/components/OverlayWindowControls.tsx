import { useRef, type PointerEvent } from "react";
import { contextCueApi } from "../lib/api";
import type { OverlayResizeEdge } from "../shared/types";

const EDGES: OverlayResizeEdge[] = ["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"];

export function OverlayWindowControls() {
  const drag = useRef<{ id: number; edge: OverlayResizeEdge; x: number; y: number } | null>(null);

  const begin = (event: PointerEvent<HTMLDivElement>, edge: OverlayResizeEdge) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, edge, x: event.screenX, y: event.screenY };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.id) return;
    contextCueApi.resizeOverlayBy(start.edge, event.screenX - start.x, event.screenY - start.y);
    start.x = event.screenX;
    start.y = event.screenY;
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return <>
    {EDGES.map((edge) => <div key={edge} className="overlay-resize-edge" data-edge={edge}
      role={edge === "bottom-right" ? "button" : undefined}
      tabIndex={edge === "bottom-right" ? 0 : undefined}
      aria-label={edge === "bottom-right" ? "Resize window" : undefined}
      aria-hidden={edge === "bottom-right" ? undefined : true}
      title={edge === "bottom-right" ? "Drag to resize · Arrow keys to adjust" : undefined}
      onPointerDown={(event) => begin(event, edge)} onPointerMove={move}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 64 : 16;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (delta) {
          event.preventDefault();
          event.stopPropagation();
          contextCueApi.resizeOverlayBy("bottom-right", delta[0], delta[1]);
        }
      }}>
      {edge === "bottom-right" && <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 13h3a6 6 0 0 0 6-6V4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
    </div>)}
  </>;
}
