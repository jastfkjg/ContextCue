import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ConfirmDialog({ title, description, onConfirm, onCancel }: {
  title: string; description: string; onConfirm: () => Promise<void>; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal(); cancel.current?.focus();
    return () => {
      element.close();
      const details = previous?.closest("details");
      const target = details && !details.open ? details.querySelector("summary") : previous;
      target?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="confirm-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p>
    {error && <p className="screen-error" role="alert">{error}</p>}
    <footer><button ref={cancel} className="button button--quiet" disabled={busy} onClick={onCancel}>Cancel</button>
      <button className="button button--danger" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await onConfirm(); onCancel(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
      }}>{busy ? "Deleting…" : "Delete"}</button></footer>
  </dialog>, document.body);
}
