import { Brain } from "lucide-react";
import type { MemoryUsage } from "../shared/types";

export function MemoryDetails({ usage, onRegenerate, disabled }: {
  usage?: MemoryUsage;
  onRegenerate?: () => void;
  disabled?: boolean;
}) {
  if (!usage) return null;
  const sources = usage.sources;
  const inherited = usage.inheritedSources ?? [];
  const count = new Set([...sources, ...inherited].map((source) => source.id)).size;
  return <details className="session-memory">
    <summary><Brain size={13} aria-hidden="true"/><span>{count ? `Memory · ${count} ${count === 1 ? "note" : "notes"}` : usage.enabled ? "Memory · no notes shared" : "Memory off"}</span></summary>
    <div className="session-memory-body">
      <p>{count ? "Notes shared with your model for this result." : usage.enabled ? "No relevant notes were selected for this request." : "No saved notes were added to this request."}</p>
      {count > 0 && onRegenerate && <>
        <button type="button" disabled={disabled} onClick={onRegenerate}>Regenerate original request without Memory</button>
        <p>Uses the original page or question. Earlier answers, drafts and revisions are left out.</p>
      </>}
      {sources.map((source) => <details key={source.id} className="session-memory-source">
        <summary>{source.filename}</summary><pre>{source.content}</pre>
      </details>)}
      {inherited.length > 0 && <><p>Earlier answers or drafts in this conversation may also contain information from:</p>
        {inherited.map((source) => <details key={`${source.id}-${source.updatedAt}`} className="session-memory-source">
          <summary>{source.filename}</summary><pre>{source.content}</pre>
        </details>)}
      </>}

    </div>
  </details>;
}
