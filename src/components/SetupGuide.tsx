import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, KeyRound, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { contextCueApi, isBrowserDemo } from "../lib/api";
import type { AppSettings, GenerationResult, LlmConfig, PermissionStatus } from "../shared/types";
import { CandidateCarousel } from "./CandidateCarousel";

function exampleImage(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 960; canvas.height = 360;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f3ee"; ctx.fillRect(0, 0, 960, 360);
  ctx.fillStyle = "#181915"; ctx.font = "bold 28px sans-serif";
  ctx.fillText("Design team · fictional conversation", 44, 60);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(44, 100, 870, 200);
  ctx.fillStyle = "#61635a"; ctx.font = "22px sans-serif"; ctx.fillText("Sam", 70, 142);
  ctx.fillStyle = "#181915"; ctx.font = "26px sans-serif";
  ctx.fillText("Can we move the design review to Friday at 10 am?", 70, 196);
  ctx.fillText("Please let me know if that works for you.", 70, 244);
  return canvas.toDataURL("image/png");
}

export function SetupGuide({ settings, onChange, onFinish, onDismiss }: {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onFinish: (settings: AppSettings) => void;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const [model, setModel] = useState<LlmConfig>(() => settings.models.find((item) => item.id === settings.activeModelId) ?? settings.models[0]);
  const [provider, setProvider] = useState("existing");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const [screenChecked, setScreenChecked] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [imageDataUrl] = useState(exampleImage);
  const heading = useRef<HTMLHeadingElement>(null);
  const screenReady = permissions?.screen === "granted" || screenChecked;
  const labels = ["Connect a model", "Verify access", "Try a suggestion"];

  useEffect(() => {
    let live = true;
    const refresh = () => { void contextCueApi.getPermissions().then((value) => { if (live) setPermissions(value); }).catch(() => undefined); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => { live = false; window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const run = async (name: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(name); setError("");
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(""); }
  };
  const changeProvider = (value: string) => {
    setProvider(value); setApiKey(""); setVerified(false); setResult(null);
    if (value === "existing") {
      setModel(settings.models.find((item) => item.id === settings.activeModelId) ?? settings.models[0]);
    } else {
      // Add instead of overwriting an existing user's configured provider.
      setModel({ id: crypto.randomUUID(), name: value === "openai" ? "OpenAI" : value === "local" ? "Local model" : "Compatible provider",
        apiBaseUrl: value === "openai" ? "https://api.openai.com/v1" : value === "local" ? "http://localhost:11434/v1" : "",
        model: "", apiProtocol: value === "openai" ? "responses" : "chat-completions", supportsImageInput: true, apiKeyConfigured: false });
    }
  };
  const saveModel = () => run("save", async () => {
    const complete = model.name.trim() && model.apiBaseUrl.trim() && model.model.trim();
    if (!complete) throw new Error("Enter the model ID and API base URL supplied by your provider.");
    const key = apiKey.trim() || (provider === "local" ? "local" : "");
    if (!key && !model.apiKeyConfigured) throw new Error("Paste your provider's API key to continue.");
    const next = { ...model, supportsImageInput: true };
    const models = settings.models.some((item) => item.id === model.id)
      ? settings.models.map((item) => item.id === model.id ? next : item)
      : [...settings.models, next];
    const saved = await contextCueApi.saveSettings({ ...settings, models, activeModelId: model.id, apiKeys: key ? { [model.id]: key } : {} });
    setModel(saved.models.find((item) => item.id === model.id)!);
    setApiKey(""); setVerified(false); setResult(null); onChange(saved); setStep(1);
  });

  return <div className="workspace setup-workspace">
    <header className="setup-header"><span className="eyebrow">WELCOME TO CONTEXTCUE</span><button className="text-button" disabled={Boolean(busy)} onClick={onDismiss}>Set up later</button></header>
    <ol className="setup-progress" aria-label="Setup progress">{labels.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={index <= step ? "is-active" : ""}><span>{index < step ? <Check size={14}/> : index + 1}</span>{label}</li>)}</ol>
    <div className="setup-layout">
      <section className="setup-main" aria-busy={Boolean(busy)}>
        <h1 ref={heading} tabIndex={-1}>{step === 0 ? "Your first useful suggestion starts here." : step === 1 ? "Check once. Write with confidence." : "Try it on a fictional conversation."}</h1>
        <p className="setup-lead">{step === 0 ? "Choose a provider and connect an image-capable model. Your key is encrypted on this device." : step === 1 ? "We verify image input with a generated color test. Your windows are never sent for this check." : "Generate a reply, choose a candidate, then copy it. This example never reads your apps or inserts into them."}</p>
        {step === 0 && <form className="setup-form" onSubmit={(event) => { event.preventDefault(); void saveModel(); }}>
          <label>Provider<select disabled={Boolean(busy)} value={provider} onChange={(event) => changeProvider(event.target.value)}><option value="existing">{model.name && provider === "existing" ? model.name : "Current configuration"}</option><option value="openai">OpenAI</option><option value="compatible">OpenAI-compatible provider</option><option value="local">Local server</option></select></label>
          <label>Model ID<input disabled={Boolean(busy)} value={model.model} onChange={(event) => setModel({ ...model, model: event.target.value })} placeholder="The image-capable model ID from your provider" required/></label>
          <label>API key{provider === "local" && <small>Optional for a local server without authentication.</small>}<input disabled={Boolean(busy)} type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={model.apiKeyConfigured ? "Saved securely · leave blank to keep" : "Paste your API key"}/></label>
          <details className="setup-advanced" open={provider === "compatible" || provider === "local" ? true : undefined}><summary>Connection details</summary>
            <label>API base URL<input type="url" disabled={Boolean(busy)} value={model.apiBaseUrl} onChange={(event) => setModel({ ...model, apiBaseUrl: event.target.value })} placeholder="https://your-provider.example/v1" required/></label>
            <label>API format<select disabled={Boolean(busy)} value={model.apiProtocol} onChange={(event) => setModel({ ...model, apiProtocol: event.target.value as LlmConfig["apiProtocol"] })}><option value="responses">Responses API</option><option value="chat-completions">Chat Completions</option></select></label>
          </details>
          <button className="button button--primary setup-next" disabled={Boolean(busy)}>{busy === "save" ? "Saving…" : "Save connection & continue"}<ArrowRight size={16}/></button>
        </form>}
        {step === 1 && <div className="setup-checks">
          <section><Sparkles size={21}/><div><h2>Connection & image input</h2><p>{verified ? "Verified with a synthetic image." : `Send a small test image to ${model.name}. Your provider may charge for this request.`}</p><button className="button button--quiet" disabled={Boolean(busy)} onClick={() => void run("verify", async () => { setVerified(false); await contextCueApi.testModelConnection({ model, verifyImage: true }); setVerified(true); })}>{verified ? <Check size={14}/> : null}{busy === "verify" ? "Verifying…" : verified ? "Verify again" : "Verify model"}</button></div></section>
          <section><ScanLine size={21}/><div><h2>Screen access</h2><p>{screenReady ? "Screen capture is available." : "Allow screen access to use suggestions in your apps. Checking windows stays on this device."}</p><div className="setup-check-actions"><button className="button button--quiet" disabled={Boolean(busy)} onClick={() => void run("screen", async () => { setScreenChecked(false); const windows = await contextCueApi.getCaptureSources(); const status = await contextCueApi.getPermissions(); setPermissions(status); if (status.screen !== "granted" && !windows.length) throw new Error("Screen access is not available. Allow it in system settings, open a window, and check again."); setScreenChecked(true); })}>{busy === "screen" ? "Checking…" : "Check again"}</button>{!screenReady && <button className="text-button" onClick={() => void run("screen-settings", contextCueApi.openScreenSettings)}>Open system settings<ExternalLink size={13}/></button>}</div></div></section>
          <section><ShieldCheck size={21}/><div><h2>Direct insertion <small>optional</small></h2><p>{permissions?.accessibility ? "Access is available. Insertion still requires a recognized field; copying always works." : "Enable Accessibility on macOS to insert into recognized fields. You can continue with copying only."}</p>{!permissions?.accessibility && <button className="text-button" onClick={() => void run("accessibility", contextCueApi.openAccessibilitySettings)}>Open Accessibility<ExternalLink size={13}/></button>}</div></section>
          <div className="setup-footer"><button className="text-button" disabled={Boolean(busy)} onClick={() => { setError(""); setStep(0); }}><ArrowLeft size={14}/>Back</button><button className="button button--primary" disabled={Boolean(busy) || !verified || !screenReady} onClick={() => { setError(""); setStep(2); }}>Try the example<ArrowRight size={15}/></button></div>
        </div>}
        {step === 2 && <div className="setup-example">
          <img src={imageDataUrl} alt="Fictional message from Sam: Can we move the design review to Friday at 10 am? Please let me know if that works for you."/>
          <p>Your intent: agree to Friday at 10 am, briefly.</p>
          {!result ? <button className="button button--primary" disabled={Boolean(busy)} onClick={() => void run("example", async () => { setResult(await contextCueApi.generateExample(imageDataUrl)); })}><Sparkles size={16}/>{busy === "example" ? "Generating your first suggestions…" : "Generate example suggestions"}</button> : <CandidateCarousel candidates={result.candidates} channel="other" contact="" practice/>}
          <small>Only this fictional image and the example instruction are sent to {model.name}. No memory or previous conversations are included.{isBrowserDemo ? " Browser preview uses simulated results." : ""}</small>
          <div className="setup-footer"><button className="text-button" disabled={Boolean(busy)} onClick={() => { setError(""); setStep(1); }}><ArrowLeft size={14}/>Back</button><button className="button button--primary" disabled={!result || Boolean(busy)} onClick={() => void run("finish", async () => onFinish(await contextCueApi.completeSetup()))}>{busy === "finish" ? "Finishing…" : "Start using ContextCue"}<ArrowRight size={15}/></button></div>
        </div>}
        {error && <div className="setup-error" role="alert">{error}</div>}
      </section>
      <aside className="setup-aside"><KeyRound size={24}/><h2>Your page.<br/>Your decision.</h2><p>Each invocation starts fresh. Screenshots, drafts and answers from other windows do not follow you.</p><ul><li>Only the current page and this session</li><li>Review and edit before using a suggestion</li><li>Never automatically send or submit</li></ul><small>You can reopen this guide from the sidebar at any time.</small></aside>
    </div>
  </div>;
}
