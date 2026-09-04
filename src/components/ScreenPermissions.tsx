import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, ExternalLink, RefreshCw, ScanLine, X } from "lucide-react";
import { contextCueApi, isBrowserDemo } from "../lib/api";
import type { CapturePreview, CaptureSource, PermissionStatus } from "../shared/types";

const screenLabels: Record<PermissionStatus["screen"], string> = {
  granted: "Allowed", denied: "Access needed", restricted: "Restricted",
  "not-determined": "Not yet allowed", unknown: "Test to verify"
};

export function ScreenPermissions({ permissions, onPermissions }: {
  permissions: PermissionStatus | null;
  onPermissions: (status: PermissionStatus) => void;
}) {
  const [preview, setPreview] = useState<CapturePreview | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [sources, setSources] = useState<CaptureSource[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scannedAt, setScannedAt] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [checking, setChecking] = useState(false);
  const run = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; run.current += 1; };
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    const id = run.current;
    const timer = window.setTimeout(() => {
      if (countdown > 1) { setCountdown(countdown - 1); return; }
      setCountdown(null);
      setTesting(true);
      void Promise.resolve().then(() => {
        // During development the renderer may reload before the desktop bridge.
        if (typeof contextCueApi.testWindowCapture !== "function") throw new Error("Restart ContextCue to use window capture diagnostics.");
        return contextCueApi.testWindowCapture();
      }).then((result) => {
        if (id === run.current && mounted.current) setPreview(result);
      }).catch((error) => {
        if (id === run.current && mounted.current) setTestError(String(error instanceof Error ? error.message : error));
      }).finally(() => {
        if (id === run.current && mounted.current) setTesting(false);
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const checkPermissions = async () => {
    setChecking(true); setPermissionError("");
    try { onPermissions(await contextCueApi.getPermissions()); }
    catch { if (mounted.current) setPermissionError("Could not check permissions. Try again."); }
    finally { if (mounted.current) setChecking(false); }
  };

  const openPermission = async (kind: "screen" | "accessibility") => {
    setPermissionError("");
    try { await (kind === "screen" ? contextCueApi.openScreenSettings() : contextCueApi.openAccessibilitySettings()); }
    catch { if (mounted.current) setPermissionError("Could not open System Settings. Open Privacy & Security manually."); }
  };

  const scan = async () => {
    setScanning(true); setScanError(""); setSources(null); setScannedAt("");
    try {
      const status = await contextCueApi.getPermissions();
      if (!mounted.current) return;
      onPermissions(status);
      if (status.screen === "denied" || status.screen === "restricted") {
        throw new Error("Allow Screen Recording in System Settings, then restart ContextCue and scan again.");
      }
      const next = await contextCueApi.getCaptureSources();
      if (!mounted.current) return;
      setSources(next); setScannedAt(new Date().toLocaleTimeString());
    } catch (error) {
      if (mounted.current) setScanError(String(error instanceof Error ? error.message : error));
    } finally { if (mounted.current) setScanning(false); }
  };

  const busy = countdown !== null || testing;
  const isMac = /Mac/.test(navigator.platform);
  return <section id="screen-permissions" className="screen-permissions" tabIndex={-1} aria-labelledby="screen-permissions-title">
    <div className="screen-section-heading">
      <div className="settings-heading"><div><h2 id="screen-permissions-title">Screen access</h2></div></div>
      <button className="text-button" onClick={() => void checkPermissions()} disabled={checking}><RefreshCw size={14}/>{checking ? "Checking…" : "Recheck"}</button>
    </div>
    <div className="screen-permission-row">
      <div><strong>Screen recording</strong>{permissions?.screen !== "granted" && <p>Required to read the current window.</p>}</div>
      <span className="permission-status">{isBrowserDemo ? "Preview mode" : permissions ? screenLabels[permissions.screen] : "Not checked"}</span>
      {isMac && !isBrowserDemo && <button className="text-button" onClick={() => void openPermission("screen")}>Manage<ExternalLink size={13}/></button>}
    </div>
    <div className="screen-permission-row">
      <div><strong>Accessibility <small>Optional</small></strong>{!permissions?.accessibility && <p>For direct insertion. Copying works without it.</p>}</div>
      <span className="permission-status">{isBrowserDemo ? "Preview mode" : !isMac ? "Not required" : !permissions ? "Not checked" : permissions.accessibility ? "Allowed" : "Not allowed"}</span>
      {isMac && !isBrowserDemo && <button className="text-button" onClick={() => void openPermission("accessibility")}>Manage<ExternalLink size={13}/></button>}
    </div>
    {permissionError && <p className="screen-error" role="alert">{permissionError}</p>}
    <details className="screen-test-disclosure" onToggle={(event) => {
      if (!event.currentTarget.open && countdown !== null) { run.current += 1; setCountdown(null); }
    }}><summary><ChevronRight size={15}/>Test window capture<span>Local preview</span></summary>
    <div className="screen-capture-test">
      <div><p>{isBrowserDemo ? "Try a sample preview. Desktop capture is available in the installed app." : "Start the test, then switch to the window you want to check within 3 seconds."}</p><small>No model request.</small></div>
      <div className="screen-test-actions"><button className="button button--quiet" disabled={busy} onClick={() => {
        run.current += 1; setPreview(null); setTestError(""); setCountdown(3);
      }}><Camera size={15}/>{countdown !== null ? `Switch windows · ${countdown}s` : testing ? "Capturing…" : isBrowserDemo ? "Preview sample" : "Start test"}</button>
      {countdown !== null && <button className="text-button" onClick={() => { run.current += 1; setCountdown(null); }}>Cancel</button>}</div>
    </div>
    <span className="visually-hidden" role="status">{countdown !== null ? `Switch to your target window. Capturing in ${countdown} seconds.` : testing ? "Capturing the current window." : ""}</span>
    {testError && <p className="screen-error" role="alert">{testError}</p>}
    {preview && <figure className="screen-preview">
      <figcaption><CheckCircle2 size={16}/><span><strong>{isBrowserDemo ? "Sample preview" : "Capture successful"} · {preview.name}</strong><small>{new Date(preview.capturedAt).toLocaleTimeString()} · local preview</small></span><button className="icon-button" aria-label="Clear capture preview" onClick={() => setPreview(null)}><X size={16}/></button></figcaption>
      <img src={preview.imageDataUrl} alt={`Captured preview of ${preview.name}`} />
    </figure>}
    </details>
    <details className="screen-diagnostics" onToggle={(event) => {
      setDiagnosticsOpen(event.currentTarget.open);
    }}>
      <summary><ChevronRight size={15}/>Window diagnostics<span>For troubleshooting</span></summary>
      {diagnosticsOpen && <div className="screen-diagnostics-body">
        <div className="screen-scan-heading"><p>Available windows and displays.</p><button className="text-button" disabled={scanning} onClick={() => void scan()}><RefreshCw size={14}/>{scanning ? "Scanning…" : "Scan sources"}</button></div>
        {scanError && <p className="screen-error" role="alert">{scanError}</p>}
        <p className="screen-scan-status" role="status">{scanning ? "Scanning windows and displays…" : sources ? `${sources.length} sources · scanned at ${scannedAt}` : !scanError ? "Run a scan to check available capture sources." : ""}</p>
        {sources?.length === 0 && <p className="screen-scan-empty">No capturable sources found. Open a visible window and scan again. If it is still missing, check screen recording permission and restart ContextCue.</p>}
        {Boolean(sources?.length) && <ul className="screen-source-list">{sources!.map((source) => <li key={source.id}><img src={source.thumbnail} alt="" loading="lazy"/><span><strong>{source.name}</strong><small>{source.id.startsWith("screen:") ? "Display" : "Window"}</small></span></li>)}</ul>}
      </div>}
    </details>
  </section>;
}
