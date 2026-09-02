import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { AppUpdateState } from "../shared/types";
import { contextCueApi } from "../lib/api";

export function AppUpdates({ state }: { state: AppUpdateState | null }) {
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = pending || !state || ["checking", "downloading", "installing"].includes(state.status);
  const run = async (action: () => Promise<AppUpdateState>) => {
    setActionError("");
    setPending(true);
    try { await action(); }
    catch { setActionError("Could not reach the update service. Try again."); }
    finally { setPending(false); }
  };
  return <section className="app-updates" id="app-updates" aria-labelledby="app-updates-title">
    <div className="settings-heading">
      <Download size={20} aria-hidden="true"/>
      <div><h2 id="app-updates-title">App updates</h2><p>{state ? `Installed version · ${state.currentVersion}` : "Loading update status…"}</p></div>
    </div>
    <div className="update-controls" aria-busy={busy}>
      <div className="update-copy">
        <p className={state?.status === "error" ? "update-error" : ""} role="status">{state?.message || "Connecting to the update service…"}</p>
        {state?.status === "downloading" && <div className="update-progress">
          <progress max={100} value={state.progress ?? 0} aria-label="Update download progress"/>
          <span>{state.progress ?? 0}%</span>
        </div>}
        {state?.mode === "installer" && state.status !== "downloaded" && <small>This build downloads the installer for you. You’ll replace the app in Applications to finish.</small>}
        {state?.mode === "automatic" && state.status !== "downloaded" && <small>Checks on launch and every 6 hours. Installation starts only when you choose to restart.</small>}
        {state?.checkedAt && <small>Last checked {new Date(state.checkedAt).toLocaleString()}</small>}
        {actionError && <p className="update-error" role="alert">{actionError}</p>}
      </div>
      <div className="update-actions">
        {state?.status === "available" && <button className="primary-button" disabled={busy} onClick={() => void run(contextCueApi.downloadUpdate)}><Download size={16} aria-hidden="true"/> Download update</button>}
        {state?.status === "downloaded" && <button className="primary-button" disabled={busy} onClick={() => void run(contextCueApi.installUpdate)}>{state.mode === "installer" ? "Open installer" : "Restart and update"}</button>}
        <button className="secondary-button" disabled={busy || state?.status === "disabled" || state?.status === "downloaded"} onClick={() => void run(contextCueApi.checkForUpdates)}>
          {state?.status === "checking" ? <span className="spinner spinner--dark" aria-hidden="true"/> : <RefreshCw size={15} aria-hidden="true"/>}
          {state?.status === "checking" ? "Checking…" : state?.status === "error" ? "Try again" : "Check for updates"}
        </button>
      </div>
    </div>
    {state?.releaseNotes && <details className="update-notes"><summary>What’s new in {state.availableVersion}</summary><p>{state.releaseNotes.replace(/<[^>]*>/g, "")}</p></details>}
  </section>;
}
