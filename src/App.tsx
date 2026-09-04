import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftRight,
  BarChart3,
  Bot,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleDot,
  Command,
  Cpu,
  Clock,
  CornerDownLeft,
  ExternalLink,
  House,
  Eye,
  FileText,
  Globe2,
  Hash,
  Keyboard,
  LockKeyhole,
  Ellipsis,
  MessageSquareText,
  Plus,
  RefreshCw,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserRound,
  Wifi,
  X
} from "lucide-react";
import { CandidateCarousel } from "./components/CandidateCarousel";
import { MarkdownContent } from "./components/MarkdownContent";
import { SelectMenu } from "./components/SelectMenu";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ScreenPermissions } from "./components/ScreenPermissions";
import { AppUpdates } from "./components/AppUpdates";
import { SetupGuide } from "./components/SetupGuide";
import { contextCueApi, isBrowserDemo } from "./lib/api";
import { inferImageInputSupport } from "./shared/model-capabilities";
import contextCueIcon from "../build/icon.svg";
import type {
  AppSettings,
  AppUpdateState,
  CaptureSource,
  ChannelId,
  GenerationResult,
  LlmConfig,
  MemoryDocument,
  MemoryDocumentScope,
  MemorySnapshot,
  PermissionStatus,
  TokenUsageRecord
} from "./shared/types";

type SettingsTab = "general" | "models" | "permissions" | "about";
const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [{ id: "general", label: "General" }, { id: "models", label: "Models" }, { id: "permissions", label: "Permissions" }, { id: "about", label: "About" }];

type ViewId = "home" | "memory" | "usage" | "settings";

const CHANNEL_LABELS: Record<ChannelId, string> = {
  wechat: "WeChat",
  slack: "Slack",
  lark: "Lark / Feishu",
  gmail: "Gmail",
  teams: "Microsoft Teams",
  whatsapp: "WhatsApp",
  other: "Any app"
};

const CHANNEL_MARKS: Record<ChannelId, string> = {
  wechat: "微",
  slack: "S",
  lark: "L",
  gmail: "G",
  teams: "T",
  whatsapp: "W",
  other: "·"
};

function sourceLabel(source?: CaptureSource): string {
  if (!source) return "Choose a window";
  return source.name.length > 46 ? `${source.name.slice(0, 43)}…` : source.name;
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? "nav-item--active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      {icon}<span>{label}</span>{active && <motion.i layoutId="nav-active" />}
    </button>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return <span className={`status-pill ${configured ? "status-pill--ok" : ""}`}><i />{configured ? "Ready" : "Setup needed"}</span>;
}

function HomeView({
  permissions,
  settings,
  onOpenSettings,
  onOpenScreenSettings
}: {
  permissions: PermissionStatus | null;
  settings: AppSettings | null;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenScreenSettings: () => void;
}) {
  const activeModel = settings?.models.find((model) => model.id === settings.activeModelId) ?? settings?.models[0];
  const modelReady = Boolean(activeModel?.apiKeyConfigured && activeModel.supportsImageInput && activeModel.model.trim());
  const screenReady = isBrowserDemo || permissions?.screen === "granted";
  const screenUnknown = !permissions || permissions.screen === "unknown";
  const shortcut = settings?.globalShortcut || "CommandOrControl+Shift+Enter";
  const askShortcut = settings?.askShortcut || "CommandOrControl+Shift+Space";
  return <div className="workspace daily-workspace">
    <header className="workspace-header"><div><h1>Ask or write from your screen.</h1><p>Use your shortcut from any app.</p></div><StatusPill configured={modelReady && Boolean(screenReady)}/></header>
    <div className="daily-actions"><section className="daily-primary"><Sparkles size={25}/><h2>Ask AI</h2><p>Ask a question or describe a draft.</p><button className="home-shortcut" onClick={() => onOpenSettings()} aria-label="Change Ask AI shortcut">{shortcutParts(askShortcut).map((part, index) => <kbd key={index}>{part}</kbd>)}<span>Change</span></button></section><section className="daily-secondary"><MessageSquareText size={21}/><h2>Quick writing</h2><p>Get writing suggestions in one step.</p><button className="home-shortcut" onClick={() => onOpenSettings()} aria-label="Change quick writing shortcut">{shortcutParts(shortcut).map((part, index) => <kbd key={index}>{part}</kbd>)}<span>Change</span></button></section></div>
    <section className="daily-status"><div><Cpu size={18}/><span><strong>{activeModel?.name || "Model needed"}</strong><small>{!activeModel ? "Configure a model" : !activeModel.supportsImageInput ? "Image input required" : !activeModel.apiKeyConfigured ? "Add an API key" : activeModel.model}</small></span><button className="text-button" onClick={() => onOpenSettings("models")}>Manage model<ChevronRight size={14}/></button></div><div><ScanLine size={18}/><span><strong>{screenReady ? "Screen access available" : screenUnknown ? "Screen access not verified" : "Screen access needed"}</strong><small>Capture on demand · copying always available</small></span><button className="text-button" onClick={onOpenScreenSettings}>Check screen access<ChevronRight size={14}/></button></div></section>
    <p className="daily-privacy"><ShieldCheck size={17}/>Uses only the current page and session. You choose what to copy or insert.</p>
  </div>;

}

function ReplyWorkspace({
  sources,
  selected,
  setSelected,
  refreshSources,
  permissions
}: {
  sources: CaptureSource[];
  selected?: CaptureSource;
  setSelected: (id: string) => void;
  refreshSources: () => Promise<void>;
  permissions: PermissionStatus | null;
}) {
  const [screenshot, setScreenshot] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [contact, setContact] = useState("");
  const [intent, setIntent] = useState("");
  const [channel, setChannel] = useState<ChannelId>(selected?.channel ?? "other");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [savedSuggestions, setSavedSuggestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selected) {
      setChannel(selected.channel);
      setScreenshot(selected.thumbnail);
      setResult(null);
    }
  }, [selected?.id]);

  const generate = async () => {
    if (!selected) {
      setError("Select a visible conversation window first.");
      return;
    }
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const fresh = await contextCueApi.captureSource(selected.id);
      setScreenshot(fresh);
      const next = await contextCueApi.generateReplies({
        sourceId: selected.id,
        imageDataUrl: isBrowserDemo ? fresh : undefined,
        channel,
        contact,
        intent,
        locale: "auto"
      });
      setResult(next);
      if (!contact && next.detectedContact) setContact(next.detectedContact);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setGenerating(false);
    }
  };

  const saveSuggestion = async (index: number) => {
    if (!result) return;
    const suggestion = result.memorySuggestions[index];
    await contextCueApi.addFact({ category: suggestion.category, content: suggestion.content, source: "model-suggestion" });
    setSavedSuggestions((current) => new Set(current).add(index));
  };

  return (
    <div className="workspace reply-workspace">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">CURRENT REPLY</span>
          <h1>Draft beside the conversation.</h1>
        </div>
        <div className="shortcut-hint"><Command size={15} /><kbd>⇧</kbd><kbd>Space</kbd><span>open ContextCue</span></div>
      </header>

      {permissions && permissions.screen !== "granted" && permissions.screen !== "unknown" && (
        <div className="permission-banner">
          <ShieldCheck size={18} />
          <div><strong>{permissions.screen === "not-determined" ? "Screen access is needed." : "Screen access is off."}</strong><span>Allow ContextCue to capture only the window you choose.</span></div>
          <button onClick={() => void contextCueApi.openScreenSettings()}>Open settings <ExternalLink size={14} /></button>
        </div>
      )}

      <div className="reply-grid">
        <section className="capture-pane">
          <div className="section-bar">
            <div><span className="step-number">01</span><h2>Conversation</h2></div>
            <button className="text-button" onClick={() => void refreshSources()}><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="source-strip">
            {sources.slice(0, 8).map((source) => (
              <button
                key={source.id}
                className={`source-chip ${selected?.id === source.id ? "source-chip--active" : ""}`}
                onClick={() => setSelected(source.id)}
                title={source.name}
              >
                {source.appIcon ? <img src={source.appIcon} alt="" /> : <span>{CHANNEL_MARKS[source.channel]}</span>}
                <small>{CHANNEL_LABELS[source.channel]}</small>
                {selected?.id === source.id && <Check size={13} />}
              </button>
            ))}
            {sources.length === 0 && (
              <button className="source-chip source-chip--empty" onClick={() => void refreshSources()}><ScanLine size={17} /><small>Find windows</small></button>
            )}
          </div>

          <div className="capture-preview">
            {screenshot ? (
              <motion.img key={screenshot.slice(-24)} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} src={screenshot} alt="Selected conversation screenshot" />
            ) : (
              <div className="preview-empty"><Camera size={27} /><strong>No conversation selected</strong><span>Open WeChat, Slack, or Lark, then refresh.</span></div>
            )}
            <div className="capture-caption"><Eye size={14} /><span>{sourceLabel(selected)}</span><i>{CHANNEL_LABELS[channel]}</i></div>
          </div>

          <div className="context-fields">
            <label>
              <span>Contact <em>optional</em></span>
              <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Infer from screenshot" />
            </label>
            <label>
              <span>Channel</span>
              <SelectMenu label="Channel" value={channel} onChange={(value) => setChannel(value as ChannelId)} options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}/>
            </label>
          </div>
          <label className="intent-field">
            <span>What do you want to say? <em>optional</em></span>
            <textarea value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="e.g. Say yes, but move it to four. Keep it brief." />
          </label>

          <button className="generate-button" disabled={generating || !selected} onClick={() => void generate()}>
            {generating ? <span className="spinner spinner--dark" /> : <Sparkles size={18} />}
            {generating ? "Reading the conversation…" : "Generate replies"}
            {!generating && <ChevronRight size={17} />}
          </button>
          {error && <div className="error-message"><CircleHelp size={16} /><span>{error}</span></div>}
        </section>

        <section className="draft-pane">
          <div className="section-bar">
            <div><span className="step-number">02</span><h2>Candidates</h2></div>
            <span className="local-label"><ShieldCheck size={14} /> memory stays local</span>
          </div>
          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div key="loading" className="draft-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="scan-orbit"><ScanLine size={26} /></div>
                <strong>Reading context</strong>
                <span>Matching your voice, relationship, and intent.</span>
                <div className="loading-lines"><i /><i /><i /></div>
              </motion.div>
            ) : result ? (
              <motion.div key="result" className="draft-result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <div className="result-summary">
                  <span>UNDERSTOOD</span>
                  <p>{result.conversationSummary}</p>
                </div>
                <CandidateCarousel key={result.generatedAt} candidates={result.candidates} channel={channel} contact={contact || result.detectedContact} />
                {result.memorySuggestions.length > 0 && (
                  <div className="memory-suggestions">
                    <div className="suggestion-title"><Brain size={15} /><span>Worth remembering?</span><small>Nothing is saved automatically.</small></div>
                    {result.memorySuggestions.map((suggestion, index) => (
                      <div className="suggestion-row" key={`${suggestion.content}-${index}`}>
                        <div><em>{suggestion.category}</em><span>{suggestion.content}</span></div>
                        <button disabled={savedSuggestions.has(index)} onClick={() => void saveSuggestion(index)}>
                          {savedSuggestions.has(index) ? <Check size={15} /> : <Plus size={15} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" className="draft-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="empty-cards"><i /><i /><i /></div>
                <strong>Three ways to reply</strong>
                <span>Choose a conversation and ContextCue will draft distinct, send-ready options in your voice.</span>
                <div className="keys"><kbd>←</kbd><kbd>→</kbd><small>switch</small><kbd>↵</kbd><small>insert</small></div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <MarkdownContent
      content={content}
      className="markdown-preview"
      emptyFallback={<div className="markdown-empty"><FileText size={25}/><strong>This file is empty</strong><span>Switch to Write and add the context you want ContextCue to use.</span></div>}
    />
  );
}

type MemorySaveState = "saved" | "pending" | "saving" | "error";

function scopeLabel(document: MemoryDocument): string {
  if (document.scope === "global") return "Every conversation";
  if (document.scope === "channel") return document.scopeValue ? CHANNEL_LABELS[document.scopeValue as ChannelId] ?? document.scopeValue : "Choose a channel";
  return document.scopeValue || "Choose a person";
}

function MemoryView({ memory, onChange }: { memory: MemorySnapshot | null; onChange: (memory: MemorySnapshot) => void }) {
  const [deletion, setDeletion] = useState<{ kind: "document" | "fact"; id: string; label: string } | null>(null);
  const documentFilenameInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<MemoryDocument[]>(memory?.documents ?? []);
  const [selectedId, setSelectedId] = useState(memory?.documents[0]?.id ?? "");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saveState, setSaveState] = useState<MemorySaveState>("saved");
  const saveTimer = useRef<number>();
  const pendingDocument = useRef<MemoryDocument | null>(null);
  const revision = useRef(0);
  const scopeDetails = useRef<HTMLDetailsElement>(null);
  const moreDetails = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if ((event.target as Element).closest?.(".select-menu")) return;
      for (const ref of [scopeDetails, moreDetails]) if (!ref.current?.contains(event.target as Node)) ref.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      for (const ref of [scopeDetails, moreDetails]) if (ref.current?.open) {
        ref.current.removeAttribute("open"); ref.current.querySelector("summary")?.focus(); event.preventDefault();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, []);


  useEffect(() => {
    if (!memory || pendingDocument.current) return;
    setDocuments(memory.documents);
    setSelectedId((current) => current === "__learned__" || memory.documents.some((document) => document.id === current) ? current : (memory.documents[0]?.id ?? ""));
  }, [memory]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (pendingDocument.current) void contextCueApi.saveMemoryDocument(pendingDocument.current);
  }, []);

  if (!memory) return <div className="workspace-loading"><span className="spinner" /> Loading memory…</div>;

  const learnedSelected = selectedId === "__learned__";
  const activeDocument = learnedSelected ? undefined : (documents.find((document) => document.id === selectedId) ?? documents[0]);

  const persistDocument = async (document: MemoryDocument, currentRevision: number) => {
    setSaveState("saving");
    try {
      const next = await contextCueApi.saveMemoryDocument(document);
      if (revision.current !== currentRevision) return;
      pendingDocument.current = null;
      setDocuments(next.documents);
      onChange(next);
      setSaveState("saved");
    } catch {
      if (revision.current === currentRevision) setSaveState("error");
    }
  };

  const updateDocument = (patch: Partial<MemoryDocument>) => {
    if (!activeDocument) return;
    const updated = { ...activeDocument, ...patch, updatedAt: new Date().toISOString() };
    setDocuments((current) => current.map((document) => document.id === updated.id ? updated : document));
    pendingDocument.current = updated;
    revision.current += 1;
    const currentRevision = revision.current;
    setSaveState("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persistDocument(updated, currentRevision), 650);
  };

  const flushPendingDocument = () => {
    if (!pendingDocument.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    void persistDocument(pendingDocument.current, revision.current);
  };

  const selectDocument = (id: string) => {
    flushPendingDocument();
    scopeDetails.current?.removeAttribute("open");
    moreDetails.current?.removeAttribute("open");
    setSelectedId(id);
  };

  const addDocument = async () => {
    flushPendingDocument();
    const now = new Date().toISOString();
    const existing = new Set(documents.map((document) => document.filename));
    let index = 1;
    while (existing.has(index === 1 ? "untitled.md" : `untitled-${index}.md`)) index += 1;
    const filename = index === 1 ? "untitled.md" : `untitled-${index}.md`;
    const document: MemoryDocument = {
      id: crypto.randomUUID(),
      filename,
      content: "# Untitled memory\n\n",
      scope: "global",
      enabled: true,
      createdAt: now,
      updatedAt: now
    };
    const next = await contextCueApi.saveMemoryDocument(document);
    pendingDocument.current = null;
    setDocuments(next.documents);
    setSelectedId(document.id);
    setMode("write");
    onChange(next);
    window.requestAnimationFrame(() => documentFilenameInputRef.current?.select());
  };

  const deleteDocument = async () => {
    if (!deletion || deletion.kind !== "document") return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    pendingDocument.current = null;
    const next = await contextCueApi.deleteMemoryDocument(deletion.id);
    setDocuments(next.documents);
    setSelectedId(next.documents[0]?.id ?? "");
    onChange(next);
  };

  const deleteFact = (id: string, content: string) => setDeletion({ kind: "fact", id, label: content });

  const scopeOptions: Array<{ value: MemoryDocumentScope; label: string; icon: React.ReactNode }> = [
    { value: "global", label: "Global", icon: <Globe2 size={14}/> },
    { value: "channel", label: "Channel", icon: <Hash size={14}/> },
    { value: "person", label: "Person", icon: <UserRound size={14}/> }
  ];
  const tokenEstimate = activeDocument ? Math.max(1, Math.ceil(activeDocument.content.length / 4)) : 0;

  return (
    <div className="workspace memory-workspace">
      {deletion && <ConfirmDialog title={deletion.kind === "document" ? `Delete ${deletion.label}?` : "Delete this memory?"} description={deletion.kind === "document" ? "This file will be permanently removed from this device." : `“${deletion.label}” will be permanently removed.`} onCancel={() => setDeletion(null)} onConfirm={async () => { if (deletion.kind === "document") await deleteDocument(); else onChange(await contextCueApi.deleteFact(deletion.id)); }}/>}
      <header className="workspace-header memory-header">
        <div><h1>Memory files</h1><p>Local notes. Not used in Ask AI or writing sessions.</p></div>

      </header>

      <div className="memory-studio">
        <aside className="memory-file-rail" aria-label="Memory files">
          <div className="memory-rail-heading"><div><span>FILES</span><strong>{documents.length} Markdown {documents.length === 1 ? "file" : "files"}</strong></div><button onClick={() => void addDocument()} aria-label="New memory file" title="New memory file"><Plus size={17}/></button></div>
          <div className="memory-file-list">
            {documents.map((document) => (
              <button key={document.id} className={document.id === activeDocument?.id ? "memory-file--active" : ""} onClick={() => selectDocument(document.id)} aria-pressed={document.id === activeDocument?.id}>
                <span className="memory-file-icon"><FileText size={16}/></span>
                <span><strong>{document.filename}</strong><small>{scopeLabel(document)}</small></span>
                <i className={document.enabled ? "is-enabled" : ""}/>
              </button>
            ))}
          </div>
          <div className="memory-learned-nav">
            <span>LEARNED</span>
            <button className={learnedSelected ? "memory-file--active" : ""} onClick={() => selectDocument("__learned__")} aria-pressed={learnedSelected}>
              <span className="memory-file-icon"><Brain size={16}/></span>
              <span><strong>Learned facts</strong><small>Saved from AI suggestions</small></span>
              <b>{memory.facts.length}</b>
            </button>
          </div>

        </aside>

        <section className="memory-document-pane">
          {learnedSelected ? (
            <div className="learned-memory-pane">
              <header>
                <div><span className="eyebrow">LEARNED MEMORY</span><h2>Facts saved from suggestions</h2><p>These are explicitly accepted facts, kept separate from the Markdown files you write.</p></div>
                <span className="learned-total"><strong>{memory.facts.length}</strong> saved</span>
              </header>
              <div className="learned-memory-list">
                {memory.facts.map((fact) => (
                  <div key={fact.id}>
                    <span className="learned-memory-mark"><Brain size={15}/></span>
                    <div><span>{fact.category}</span><p>{fact.content}</p><small>{fact.source === "model-suggestion" ? "Accepted suggestion" : "Added manually"} · {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(fact.createdAt))}</small></div>
                    <button onClick={() => void deleteFact(fact.id, fact.content)} aria-label={`Remove ${fact.content}`} title="Remove learned fact"><Trash2 size={15}/></button>
                  </div>
                ))}
                {memory.facts.length === 0 && <div className="learned-memory-empty"><Brain size={26}/><strong>No learned facts yet</strong><span>When ContextCue suggests something worth remembering, you decide whether to save it.</span></div>}
              </div>
              <footer><span>{memory.acceptedReplies.length} previously accepted suggestions are retained locally, but excluded from page-only sessions.</span></footer>
            </div>
          ) : activeDocument ? (
            <>
              <header className="memory-document-header">
                <div className="memory-filename"><FileText size={17}/><input ref={documentFilenameInputRef} value={activeDocument.filename} onChange={(event) => updateDocument({ filename: event.target.value })} onBlur={() => { if (!activeDocument.filename.trim()) updateDocument({ filename: "untitled.md" }); }} aria-label="Memory filename" spellCheck={false}/></div>
                <div className="memory-document-tools">
                  <details className="memory-scope-menu" ref={scopeDetails} onToggle={(event) => { if (event.currentTarget.open) moreDetails.current?.removeAttribute("open"); }}>
                    <summary aria-label={`Change scope. Currently ${scopeLabel(activeDocument)}`}>{activeDocument.scope === "global" ? <Globe2 size={14}/> : activeDocument.scope === "channel" ? <Hash size={14}/> : <UserRound size={14}/>}<span>{scopeLabel(activeDocument)}</span><ChevronDown size={13}/></summary>
                    <div className="memory-scope-popover">
                      <span className="memory-popover-label">Saved scope</span>
                      <div className="memory-scope-options">
                        {scopeOptions.map((option) => <button key={option.value} className={activeDocument.scope === option.value ? "is-active" : ""} onClick={() => { updateDocument({ scope: option.value, scopeValue: option.value === "global" ? undefined : activeDocument.scope === option.value ? activeDocument.scopeValue : option.value === "channel" ? "other" : "" }); if (option.value === "global") scopeDetails.current?.removeAttribute("open"); }} aria-pressed={activeDocument.scope === option.value}>{option.icon}{option.label}</button>)}
                      </div>
                      {activeDocument.scope === "channel" && <label className="memory-scope-value"><span>Channel</span><SelectMenu label="Channel" value={activeDocument.scopeValue ?? "other"} onChange={(value) => updateDocument({ scopeValue: value })} options={Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value, label }))}/></label>}
                      {activeDocument.scope === "person" && <label className="memory-scope-value"><span>Person</span><input value={activeDocument.scopeValue ?? ""} onChange={(event) => updateDocument({ scopeValue: event.target.value })} placeholder="Exact contact name"/></label>}
                      <p>Saved metadata only; not used in current sessions.</p>
                    </div>
                  </details>
                  <button className={`memory-active-control ${activeDocument.enabled ? "is-active" : ""}`} onClick={() => updateDocument({ enabled: !activeDocument.enabled })} role="switch" aria-checked={activeDocument.enabled}><i/>{activeDocument.enabled ? "Active" : "Paused"}</button>
                  <div className="memory-view-switch" role="group" aria-label="Document view">
                    <button className={mode === "write" ? "is-active" : ""} onClick={() => setMode("write")} aria-pressed={mode === "write"}>Write</button>
                    <button className={mode === "preview" ? "is-active" : ""} onClick={() => setMode("preview")} aria-pressed={mode === "preview"}><Eye size={13}/> Preview</button>
                  </div>
                  <span className={`memory-save-state memory-save-state--${saveState}`} aria-live="polite">{saveState === "saving" ? <span className="spinner"/> : saveState === "saved" ? <Check size={13}/> : <i/>}{saveState === "pending" ? "Unsaved" : saveState === "saving" ? "Saving" : saveState === "error" ? "Couldn’t save" : "Saved"}</span>
                  <details className="memory-more-menu" ref={moreDetails} onToggle={(event) => { if (event.currentTarget.open) scopeDetails.current?.removeAttribute("open"); }}>
                    <summary aria-label="File actions" title="File actions"><Ellipsis size={17}/></summary>
                    <div><button onClick={() => { moreDetails.current?.removeAttribute("open"); setDeletion({ kind: "document", id: activeDocument.id, label: activeDocument.filename }); }}><Trash2 size={14}/> Delete file</button></div>
                  </details>
                </div>
              </header>
              <AnimatePresence mode="wait" initial={false}>
                {mode === "write" ? (
                  <motion.div key="write" className="memory-editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <textarea value={activeDocument.content} onChange={(event) => updateDocument({ content: event.target.value })} aria-label={`Edit ${activeDocument.filename}`} placeholder="# What should ContextCue know?" spellCheck/>
                    <footer><span>Markdown</span><span>~{tokenEstimate.toLocaleString()} tokens</span><span>Updated {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(activeDocument.updatedAt))}</span><span>{activeDocument.content.length.toLocaleString()} characters</span></footer>
                  </motion.div>
                ) : (
                  <motion.div key="preview" className="memory-preview-scroll" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><MarkdownPreview content={activeDocument.content}/></motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="memory-no-document"><FileText size={28}/><h2>Create your first memory file</h2><p>Keep background, preferences, people, or project context in plain Markdown.</p><button className="button button--primary" onClick={() => void addDocument()}><Plus size={15}/> New file</button></div>
          )}
        </section>
      </div>
    </div>
  );
}


type UsageRange = "7d" | "30d" | "all";
const USAGE_COLORS = ["#789f13", "#5577c6", "#c17b36", "#8b62aa", "#3f9186", "#bd596c"];

function usageModelKey(record: Pick<TokenUsageRecord, "modelId" | "model">): string {
  return `${record.modelId}::${record.model}`;
}

function usageColor(key: string): string {
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return USAGE_COLORS[(hash >>> 0) % USAGE_COLORS.length];
}

function compactTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}

function usageRequestLabel(requestType: TokenUsageRecord["requestType"]): string {
  if (requestType === "ask") return "Ask AI";
  if (requestType === "quick-assist") return "Quick assist";
  if (requestType === "assist") return "Workspace assist";
  if (requestType === "quick-reply") return "Quick reply";
  if (requestType === "connection-test") return "Connection test";
  return "Workspace reply";
}

function usageDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function UsageView({ settings }: { settings: AppSettings | null }) {
  const [records, setRecords] = useState<TokenUsageRecord[] | null>(null);
  const [range, setRange] = useState<UsageRange>("30d");
  const [modelFilter, setModelFilter] = useState("all");

  useEffect(() => {
    let active = true;
    void contextCueApi.getTokenUsage().then((snapshot) => {
      if (active) setRecords(snapshot.records);
    }).catch(() => {
      if (active) setRecords([]);
    });
    return () => { active = false; };
  }, []);

  const modelOptions = useMemo(() => {
    const options = new Map<string, { key: string; name: string; model: string }>();
    settings?.models.forEach((model) => options.set(`${model.id}::${model.model}`, { key: `${model.id}::${model.model}`, name: model.name, model: model.model }));
    records?.forEach((record) => {
      const key = usageModelKey(record);
      if (!options.has(key)) options.set(key, { key, name: record.modelName, model: record.model });
    });
    return [...options.values()];
  }, [records, settings]);

  const rangedRecords = useMemo(() => {
    if (!records) return [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range !== "all") start.setDate(start.getDate() - (range === "7d" ? 6 : 29));
    return records.filter((record) => {
      const inRange = range === "all" || new Date(record.createdAt).getTime() >= start.getTime();
      const matchesModel = modelFilter === "all" || usageModelKey(record) === modelFilter;
      return inRange && matchesModel;
    });
  }, [modelFilter, range, records]);

  const totals = useMemo(() => rangedRecords.reduce((sum, record) => ({
    input: sum.input + (record.reported ? record.inputTokens : 0),
    output: sum.output + (record.reported ? record.outputTokens : 0),
    total: sum.total + (record.reported ? record.totalTokens : 0),
    reported: sum.reported + (record.reported ? 1 : 0),
    latency: sum.latency + record.latencyMs
  }), { input: 0, output: 0, total: 0, reported: 0, latency: 0 }), [rangedRecords]);

  const chart = useMemo(() => {
    const chartDays = range === "7d" ? 7 : 30;
    const days = Array.from({ length: chartDays }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (chartDays - index - 1));
      return { key: usageDayKey(date), date, total: 0, models: new Map<string, number>() };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));
    rangedRecords.forEach((record) => {
      if (!record.reported) return;
      const day = byDay.get(usageDayKey(new Date(record.createdAt)));
      if (!day) return;
      const key = usageModelKey(record);
      day.total += record.totalTokens;
      day.models.set(key, (day.models.get(key) ?? 0) + record.totalTokens);
    });
    return { days, max: Math.max(1, ...days.map((day) => day.total)) };
  }, [range, rangedRecords]);

  const breakdown = useMemo(() => {
    const models = new Map<string, { key: string; name: string; model: string; input: number; output: number; total: number; requests: number }>();
    rangedRecords.forEach((record) => {
      const key = usageModelKey(record);
      const current = models.get(key) ?? { key, name: record.modelName, model: record.model, input: 0, output: 0, total: 0, requests: 0 };
      current.requests += 1;
      if (record.reported) {
        current.input += record.inputTokens;
        current.output += record.outputTokens;
        current.total += record.totalTokens;
      }
      models.set(key, current);
    });
    return [...models.values()].sort((left, right) => right.total - left.total);
  }, [rangedRecords]);

  if (!records) return <div className="workspace-loading"><span className="spinner"/> Loading token usage…</div>;
  const average = totals.reported ? Math.round(totals.total / totals.reported) : 0;
  const chartModelKeys = breakdown.map((model) => model.key);
  const rangeLabel = range === "all" ? "All time" : range === "7d" ? "Last 7 days" : "Last 30 days";

  return <div className="workspace usage-workspace">
    <header className="workspace-header usage-header">
      <div><h1>Token usage</h1><p>Reported by your providers.</p></div>
      <div className="usage-filters">
        <label><span>Model</span><SelectMenu label="Model" value={modelFilter} onChange={setModelFilter} options={[{ value: "all", label: "All models" }, ...modelOptions.map((model) => ({ value: model.key, label: model.name, description: model.model !== model.name ? model.model : undefined }))]}/></label>
        <div className="usage-range" role="group" aria-label="Usage period">{(["7d", "30d", "all"] as const).map((option) => <button key={option} className={range === option ? "usage-range--active" : ""} onClick={() => setRange(option)}>{option === "all" ? "All" : option}</button>)}</div>
      </div>
    </header>

    <section className="usage-summary" aria-label={`${rangeLabel} summary`}>
      <div className="usage-primary-total"><span>Total tokens · {rangeLabel}</span><strong>{compactTokens(totals.total)}</strong><small>{totals.reported} of {rangedRecords.length} requests reported usage</small></div>
      <dl><div><dt>Input</dt><dd>{compactTokens(totals.input)}</dd></div><div><dt>Output</dt><dd>{compactTokens(totals.output)}</dd></div><div><dt>Requests</dt><dd>{rangedRecords.length.toLocaleString()}</dd></div><div><dt>Avg / request</dt><dd>{compactTokens(average)}</dd></div></dl>
    </section>

    {rangedRecords.length ? <>
      <section className="usage-trend">
        <div className="usage-section-heading"><div><TrendingUp size={18}/><span><strong>Daily token usage</strong><small>{range === "all" ? "Latest 30 days · all-time totals above" : rangeLabel}</small></span></div><div className="usage-legend">{breakdown.map((model) => <span key={model.key}><i style={{ backgroundColor: usageColor(model.key) }}/>{model.name}</span>)}</div></div>
        <div className="usage-chart" aria-label="Daily token usage chart">
          <div className="usage-chart-scale"><span>{compactTokens(chart.max)}</span><span>{compactTokens(Math.round(chart.max / 2))}</span><span>0</span></div>
          <div className="usage-chart-plot">{chart.days.map((day, index) => <div className="usage-chart-day" key={day.key} title={`${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(day.date)} · ${day.total.toLocaleString()} tokens`}><div className="usage-bar-stack">{chartModelKeys.map((key) => <i key={key} style={{ height: `${((day.models.get(key) ?? 0) / chart.max) * 100}%`, backgroundColor: usageColor(key) }}/>)}</div><span>{(chart.days.length === 7 || index === 0 || index === chart.days.length - 1 || (index % 7 === 0 && index < chart.days.length - 4)) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(day.date) : ""}</span></div>)}</div>
        </div>
      </section>

      <section className="usage-models">
        <div className="usage-section-heading"><div><Cpu size={18}/><span><strong>By configured model</strong><small>Each connection and model ID is tracked separately.</small></span></div></div>
        <div className="usage-model-table"><header><span>Model</span><span>Share</span><span>Requests</span><span>Input</span><span>Output</span><span>Total</span></header>{breakdown.map((model) => <div key={model.key}><span className="usage-model-name"><i style={{ backgroundColor: usageColor(model.key) }}/><span><strong>{model.name}</strong><small>{model.model}</small></span></span><span><span className="usage-share-track"><i style={{ width: `${totals.total ? model.total / totals.total * 100 : 0}%`, backgroundColor: usageColor(model.key) }}/></span><small>{totals.total ? Math.round(model.total / totals.total * 100) : 0}%</small></span><span>{model.requests}</span><span>{compactTokens(model.input)}</span><span>{compactTokens(model.output)}</span><strong>{compactTokens(model.total)}</strong></div>)}</div>
      </section>

      <section className="usage-history">
        <div className="usage-section-heading"><div><Clock size={18}/><span><strong>Request history</strong><small>Most recent 50 calls in this view.</small></span></div></div>
        <div className="usage-history-table"><header><span>When</span><span>Model</span><span>Request</span><span>Input</span><span>Output</span><span>Total</span></header>{rangedRecords.slice(0, 50).map((record) => <div key={record.id}><time dateTime={record.createdAt}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.createdAt))}</time><span className="history-model"><i style={{ backgroundColor: usageColor(usageModelKey(record)) }}/><span><strong>{record.modelName}</strong><small>{record.model}</small></span></span><span><strong>{usageRequestLabel(record.requestType)}</strong><small>{record.channel ? CHANNEL_LABELS[record.channel] : "Configuration"} · {(record.latencyMs / 1000).toFixed(1)}s</small></span><span>{record.reported ? record.inputTokens.toLocaleString() : "—"}</span><span>{record.reported ? record.outputTokens.toLocaleString() : "—"}</span><strong>{record.reported ? record.totalTokens.toLocaleString() : "Not reported"}</strong></div>)}</div>
      </section>
    </> : <section className="usage-empty"><BarChart3 size={28}/><h2>No usage in this view</h2><p>Generate a suggestion or widen the selected date range. Providers that do not report token counts will still appear in request history.</p></section>}
  </div>;
}

type AutoSaveState = "saved" | "pending" | "saving" | "incomplete" | "error";
type ConnectionState = { state: "testing" | "success" | "error"; message: string; latencyMs?: number };

function settingsSignature(settings: AppSettings): string {
  return JSON.stringify(settings);
}

function shortcutParts(value: string): string[] {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return value.split("+").map((part) => {
    if (part === "CommandOrControl") return isMac ? "⌘" : "Ctrl";
    if (part === "Command") return "⌘";
    if (part === "Control") return "Ctrl";
    if (part === "Shift") return isMac ? "⇧" : "Shift";
    if (part === "Alt") return isMac ? "⌥" : "Alt";
    if (part === "Space") return "Space";
    return part;
  });
}

function ShortcutRecorder({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setRecording(false);
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [recording]);
  const record = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") { setRecording(false); return; }
    if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return;
    const modifiers: string[] = [];
    if (event.metaKey || event.ctrlKey) modifiers.push("CommandOrControl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (!modifiers.length) return;
    const key = event.code === "Space" ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
    onChange([...modifiers, key].join("+"));
    setRecording(false);
  };
  return <button type="button" className={`shortcut-recorder ${recording ? "shortcut-recorder--recording" : ""}`} onClick={() => setRecording((current) => !current)} onKeyDown={record} onBlur={() => setRecording(false)} aria-pressed={recording} aria-label={`Change ${label} shortcut`}>
    <span className="shortcut-recorder-copy"><span><strong>{recording ? "Press your shortcut" : label}</strong>{recording && <small>Include ⌘ / Ctrl, Alt or Shift · Esc to cancel</small>}</span></span>
    <span className="shortcut-keys">{recording ? <i>Listening…</i> : shortcutParts(value).map((part, index) => <kbd key={`${part}-${index}`}>{part}</kbd>)}</span>
  </button>;
}

function SettingsView({ settings, onChange, updateState, permissions, onPermissions, tab, onTabChange }: { tab: SettingsTab; onTabChange: (tab: SettingsTab) => void; settings: AppSettings | null; onChange: (settings: AppSettings) => void; updateState: AppUpdateState | null; permissions: PermissionStatus | null; onPermissions: (status: PermissionStatus) => void }) {
  const [form, setForm] = useState<AppSettings | null>(settings);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<AutoSaveState>("saved");
  const [saveMessage, setSaveMessage] = useState("Saved automatically");
  const [connectionStates, setConnectionStates] = useState<Record<string, ConnectionState>>({});
  const lastSavedSignature = useRef(settings ? settingsSignature(settings) : "");
  const latestSignature = useRef(lastSavedSignature.current);
  const saveRun = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const pendingSaveCount = useRef(0);

  useEffect(() => {
    if (!settings) return;
    lastSavedSignature.current = settingsSignature(settings);
    latestSignature.current = lastSavedSignature.current;
    setForm(settings);
    setSelectedModelId((current) => settings.models.some((model) => model.id === current) ? current : settings.activeModelId);
    setApiKeys({});
    setSaveState("saved");
    setSaveMessage("Saved automatically");
  }, [settings]);

  useEffect(() => {
    if (!form) return;
    const signature = settingsSignature(form);
    latestSignature.current = signature;
    const requestId = ++saveRun.current;
    const pendingKeys = Object.values(apiKeys).some((key) => key.trim());
    if (signature === lastSavedSignature.current && !pendingKeys && pendingSaveCount.current === 0) {
      setSaveState("saved");
      setSaveMessage("Saved automatically");
      return;
    }
    const incomplete = !form.models.length
      || !form.models.some((model) => model.id === form.activeModelId)
      || form.models.some((model) => !model.name.trim() || !model.apiBaseUrl.trim() || !model.model.trim());
    if (incomplete) {
      setSaveState("incomplete");
      setSaveMessage("Complete the required model fields to save");
      return;
    }

    setSaveState("pending");
    setSaveMessage("Waiting for you to finish…");
    const requestForm = form;
    const requestKeys = apiKeys;
    const timeout = window.setTimeout(() => {
      pendingSaveCount.current += 1;
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        setSaveState("saving");
        setSaveMessage("Saving changes…");
        try {
          const saved = await contextCueApi.saveSettings({ ...requestForm, apiKeys: requestKeys });
          lastSavedSignature.current = settingsSignature(saved);
          if (requestId === saveRun.current && latestSignature.current === settingsSignature(requestForm)) {
            setForm(saved);
            setApiKeys({});
            setSaveState("saved");
            setSaveMessage("Saved automatically");
            onChange(saved);
          }
        } catch (error) {
          if (requestId === saveRun.current) {
            setSaveState("error");
            setSaveMessage(error instanceof Error ? error.message : String(error));
          }
        } finally {
          pendingSaveCount.current = Math.max(0, pendingSaveCount.current - 1);
        }
      });
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [apiKeys, form, onChange]);

  if (!form) return <div className="workspace-loading"><span className="spinner"/> Loading settings…</div>;
  const selectedModel = form.models.find((model) => model.id === selectedModelId) ?? form.models[0];
  const activeModel = form.models.find((model) => model.id === form.activeModelId) ?? form.models[0];
  const selectedConnection = selectedModel ? connectionStates[selectedModel.id] : undefined;
  const updateModel = (changes: Partial<LlmConfig>) => {
    if (!selectedModel) return;
    setForm({ ...form, models: form.models.map((model) => model.id === selectedModel.id ? { ...model, ...changes } : model) });
    setConnectionStates((current) => {
      const next = { ...current };
      delete next[selectedModel.id];
      return next;
    });
  };
  const addModel = () => {
    const id = crypto.randomUUID();
    const next = { id, name: "New provider", apiBaseUrl: "https://api.openai.com/v1", model: "", apiProtocol: "responses" as const, supportsImageInput: true, apiKeyConfigured: false };
    setForm({ ...form, models: [...form.models, next] });
    setSelectedModelId(id);
  };
  const removeModel = () => {
    if (!selectedModel || form.models.length === 1) return;
    const remaining = form.models.filter((model) => model.id !== selectedModel.id);
    const nextActiveId = form.activeModelId === selectedModel.id ? remaining[0].id : form.activeModelId;
    setForm({ ...form, models: remaining, activeModelId: nextActiveId });
    setSelectedModelId(nextActiveId);
    setApiKeys((current) => {
      const next = { ...current };
      delete next[selectedModel.id];
      return next;
    });
  };
  const testConnection = async () => {
    if (!selectedModel) return;
    setConnectionStates((current) => ({ ...current, [selectedModel.id]: { state: "testing", message: "Sending a minimal request…" } }));
    try {
      const result = await contextCueApi.testModelConnection({ model: selectedModel, apiKey: apiKeys[selectedModel.id] });
      setConnectionStates((current) => ({ ...current, [selectedModel.id]: { state: "success", message: result.message, latencyMs: result.latencyMs } }));
    } catch (error) {
      setConnectionStates((current) => ({ ...current, [selectedModel.id]: { state: "error", message: error instanceof Error ? error.message : String(error) } }));
    }
  };
  const modelComplete = Boolean(selectedModel?.name.trim() && selectedModel.apiBaseUrl.trim() && selectedModel.model.trim());
  const hasModelKey = Boolean(selectedModel && (selectedModel.apiKeyConfigured || apiKeys[selectedModel.id]?.trim()));

  return <div className="workspace settings-workspace">
    <header className="workspace-header settings-header"><h1>Settings</h1><span className={`autosave-status autosave-status--${saveState}`} role="status">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveMessage}</span></header>
    <div className="settings-tabs" role="tablist" aria-label="Settings sections">{SETTINGS_TABS.map((item, index) => <button key={item.id} id={`tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => onTabChange(item.id)} onKeyDown={(event) => {
      const next = event.key === "ArrowRight" ? (index + 1) % SETTINGS_TABS.length : event.key === "ArrowLeft" ? (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length : event.key === "Home" ? 0 : event.key === "End" ? SETTINGS_TABS.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); onTabChange(SETTINGS_TABS[next].id); document.getElementById(`tab-${SETTINGS_TABS[next].id}`)?.focus(); }
    }}>{item.label}</button>)}</div>
    <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="settings-panel">
    {tab === "models" && <>
    <div className="model-settings-shell">
      <aside className="model-rail">
        <div className="model-rail-heading"><div><span>YOUR MODELS</span><strong>{form.models.length} {form.models.length === 1 ? "model" : "models"}</strong></div><button aria-label="Add model" title="Add model" onClick={addModel}><Plus size={16}/></button></div>
        <div className="model-list" role="listbox" aria-label="Configured models">
          {form.models.map((model, index) => <button key={model.id} role="option" aria-selected={selectedModel?.id === model.id} className={`model-list-item ${selectedModel?.id === model.id ? "model-list-item--selected" : ""}`} onClick={() => setSelectedModelId(model.id)}>
            <span className="model-monogram">{model.name.trim().slice(0, 1).toUpperCase() || index + 1}</span>
            <span className="model-list-copy"><strong>{model.name || "Untitled model"}</strong>{model.model !== model.name && <small>{model.model || "Model ID needed"}</small>}</span>
            <span className={`model-health ${model.apiKeyConfigured && model.supportsImageInput ? "model-health--ready" : ""}`} title={!model.supportsImageInput ? "Image input required" : model.apiKeyConfigured ? "API key configured" : "API key needed"} aria-label={!model.supportsImageInput ? "Image input required" : model.apiKeyConfigured ? "API key configured" : "API key needed"}/>
            {form.activeModelId === model.id && <span className="current-chip">DEFAULT</span>}
          </button>)}
        </div>
      </aside>

      <div className="settings-main">
        <AnimatePresence mode="wait">
          {selectedModel && <motion.section key={selectedModel.id} className="model-editor" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .18 }}>
            <div className="model-editor-header">
              <div className="model-title"><span><Bot size={19}/></span><div><h2>{selectedModel.name || "Untitled model"}</h2></div></div>
              <div className="model-editor-actions">
                {form.activeModelId === selectedModel.id ? <span className={`active-model-label ${selectedModel.supportsImageInput ? "" : "active-model-label--warning"}`}><CircleDot size={15}/> {selectedModel.supportsImageInput ? "Default model" : "Default · text only"}</span> : <button className="use-model-button" disabled={!selectedModel.supportsImageInput} title={selectedModel.supportsImageInput ? "Set as default" : "ContextCue needs image input to read screenshots"} onClick={() => setForm({ ...form, activeModelId: selectedModel.id })}><CircleDot size={15}/> Set as default</button>}
                <button className="remove-model-button" disabled={form.models.length === 1} onClick={removeModel} aria-label="Remove model" title={form.models.length === 1 ? "At least one model is required" : "Remove model"}><Trash2 size={15}/></button>
              </div>
            </div>
            <div className="model-form-grid">
              <label><span>Display name</span><input value={selectedModel.name} onChange={(event) => updateModel({ name: event.target.value })} placeholder="e.g. OpenAI work"/></label>
              <label><span>Model ID</span><input value={selectedModel.model} onChange={(event) => { const model = event.target.value; updateModel({ model, supportsImageInput: inferImageInputSupport(model) }); }} placeholder="e.g. gpt-5.6"/></label>
              <label className="model-url-field"><span>API base URL</span><input type="url" value={selectedModel.apiBaseUrl} onChange={(event) => updateModel({ apiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1"/></label>
              <label className={`vision-capability ${selectedModel.supportsImageInput ? "vision-capability--enabled" : "vision-capability--warning"}`}><input type="checkbox" checked={selectedModel.supportsImageInput} onChange={(event) => updateModel({ supportsImageInput: event.target.checked })}/><Eye size={17}/><span><strong>Image input</strong></span><i>{selectedModel.supportsImageInput ? "Supported" : "Text only"}</i></label>
              <label><span>API format</span><SelectMenu label="API format" value={selectedModel.apiProtocol} onChange={(value) => updateModel({ apiProtocol: value as LlmConfig["apiProtocol"] })} options={[{ value: "responses", label: "Responses API" }, { value: "chat-completions", label: "Chat Completions" }]}/></label>
              <label><span>API key</span><input type="password" autoComplete="new-password" value={apiKeys[selectedModel.id] ?? ""} onChange={(event) => setApiKeys({ ...apiKeys, [selectedModel.id]: event.target.value })} placeholder={selectedModel.apiKeyConfigured ? "••••••••  Saved securely" : "Paste a key"}/></label>
            </div>
            <div className="connection-row"><div className="security-line"><ShieldCheck size={15}/><span>{selectedModel.apiKeyConfigured ? "Key saved securely" : "Keys are encrypted on this device"}</span></div><button className="test-connection-button" disabled={!modelComplete || !hasModelKey || selectedConnection?.state === "testing"} onClick={() => void testConnection()}>{selectedConnection?.state === "testing" ? <span className="spinner spinner--dark"/> : <Wifi size={16}/>} {selectedConnection?.state === "testing" ? "Testing…" : "Test connection"}</button></div>
            {selectedConnection && selectedConnection.state !== "testing" && <div className={`connection-result connection-result--${selectedConnection.state}`} role="status">{selectedConnection.state === "success" ? <CheckCircle2 size={16}/> : <CircleHelp size={16}/>}<span><strong>{selectedConnection.state === "success" ? `Connected${selectedConnection.latencyMs ? ` · ${selectedConnection.latencyMs} ms` : ""}` : "Connection failed"}</strong><small>{selectedConnection.message}</small></span></div>}
          </motion.section>}
        </AnimatePresence>

      </div>
    </div>
    </>}
    {tab === "general" && <div className="general-settings">
      <section className="settings-group"><h2>Shortcuts</h2><div className="shortcut-list"><ShortcutRecorder value={form.askShortcut} onChange={(askShortcut) => setForm({ ...form, askShortcut })} label="Ask AI"/><ShortcutRecorder value={form.globalShortcut} onChange={(globalShortcut) => setForm({ ...form, globalShortcut })} label="Quick writing"/></div></section>
      <section className="settings-group"><h2>Writing</h2>
        <div className="setting-row"><span>Writing language</span><SelectMenu label="Writing language" value={form.locale} onChange={(locale) => setForm({ ...form, locale: locale as AppSettings["locale"] })} options={[{ value: "auto", label: "Match context" }, { value: "en", label: "English" }, { value: "zh-CN", label: "简体中文" }]}/></div>
        <div className="setting-row"><span>Number of suggestions</span><SelectMenu label="Number of suggestions" value={String(form.candidateCount)} onChange={(value) => setForm({ ...form, candidateCount: Number(value) })} options={[2, 3, 4, 5].map(count => ({ value: String(count), label: String(count) }))}/></div>
        <label className="toggle-row"><div><strong>Show suggestions automatically</strong></div><input type="checkbox" checked={form.autoShowOverlay} onChange={(event) => setForm({ ...form, autoShowOverlay: event.target.checked })}/><i/></label>
      </section>
    </div>}
    {tab === "permissions" && <ScreenPermissions permissions={permissions} onPermissions={onPermissions}/>}
    {tab === "about" && <><div className="about-app"><img src={contextCueIcon} alt=""/><h2>ContextCue</h2><p>Ask and write from your screen.</p></div><AppUpdates state={updateState}/><p className="about-privacy"><ShieldCheck size={16}/>No background recording. You choose what to copy or insert.</p></>}
    </section>
  </div>;
}

export function App() {
  const [view, setView] = useState<ViewId>("home");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateState | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const openSettings = (tab: SettingsTab = "general") => { setSettingsTab(tab); setView("settings"); };
  const [updatesFocus, setUpdatesFocus] = useState(0);
  const openUpdates = useCallback(() => { setSettingsTab("about"); setView("settings"); setUpdatesFocus((value) => value + 1); }, []);
  const [screenFocus, setScreenFocus] = useState(0);
  const openScreenSettings = () => { setSettingsTab("permissions"); setView("settings"); setScreenFocus((value) => value + 1); };
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const activeModel = settings?.models.find((model) => model.id === settings.activeModelId) ?? settings?.models[0];


  useEffect(() => {
    void Promise.all([
      contextCueApi.getMemory().then(setMemory),
      contextCueApi.getSettings().then(setSettings),
      contextCueApi.getPermissions().then(setPermissions)
    ]);
  }, []);

  useEffect(() => {
    const refresh = () => { void contextCueApi.getPermissions().then(setPermissions).catch(() => undefined); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    document.querySelector(".main-surface")?.scrollTo({ top: 0, behavior: "auto" });
  }, [view, setupOpen, setupDismissed, settings?.onboardingComplete]);

  useEffect(() => {
    const receive = (next: AppUpdateState) => setUpdateState((current) => !current || next.revision >= current.revision ? next : current);
    const unsubscribe = contextCueApi.onUpdateState(receive);
    const stopOpening = contextCueApi.onOpenUpdates(openUpdates);
    void contextCueApi.getUpdateState().then(receive).catch(() => receive({
      revision: 0, currentVersion: "Unknown", mode: "unavailable", status: "disabled", message: "Could not connect to the update service. Restart ContextCue to try again."
    }));
    return () => { unsubscribe(); stopOpening(); };
  }, [openUpdates]);

  useEffect(() => {
    if (!updatesFocus || view !== "settings") return;
    // Wait for the outgoing view's exit transition and Settings to mount.
    const timer = window.setTimeout(() => {
      const section = document.getElementById("app-updates");
      if (section) { section.scrollIntoView({ block: "center" }); setUpdatesFocus(0); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [view, updatesFocus, settings]);

  useEffect(() => {
    if (!screenFocus || view !== "settings") return;
    const timer = window.setTimeout(() => {
      const section = document.getElementById("screen-permissions");
      if (section) { section.scrollIntoView({ block: "start" }); section.focus({ preventScroll: true }); setScreenFocus(0); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [view, screenFocus, settings]);

  const views: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
    { id: "home", label: "Home", icon: <House size={18}/> },
    { id: "memory", label: "Memory", icon: <Brain size={18}/> },
    { id: "usage", label: "Token usage", icon: <BarChart3 size={18}/> },
    { id: "settings", label: "Settings", icon: <Settings size={18}/> }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img src={contextCueIcon} alt=""/><strong>ContextCue</strong></div>
        <nav>{views.map((item) => <NavItem key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => item.id === "settings" ? openSettings() : setView(item.id)}/>)}</nav>
        <div className="sidebar-foot">
          {updateState && (["available", "downloading", "downloaded", "installing"].includes(updateState.status) || (updateState.status === "error" && updateState.availableVersion)) && <button className="sidebar-update" onClick={openUpdates}><RefreshCw size={16} aria-hidden="true"/><span>{updateState.status === "downloaded" ? "Update ready" : updateState.status === "downloading" ? `Downloading · ${updateState.progress ?? 0}%` : updateState.status === "installing" ? "Installing update…" : updateState.status === "error" ? "Update needs attention" : `Update · ${updateState.availableVersion}`}</span></button>}
          {isBrowserDemo && <span className="demo-badge"><span>Browser </span>preview</span>}
          <div className={`model-status ${activeModel?.apiKeyConfigured && activeModel.supportsImageInput ? "" : "model-status--needed"}`}><i/><span><strong>{activeModel?.name || "Model not set"}</strong><small>{activeModel ? `${activeModel.model || "Model ID needed"} · ${!activeModel.supportsImageInput ? "image input required" : activeModel.apiKeyConfigured ? "ready" : "add key"}` : "Add a model"}</small></span></div>
          <button aria-label="Setup guide" title="Setup guide" onClick={() => { setView("home"); setSetupOpen(true); }}><CircleHelp size={16}/><span>Setup guide</span></button>
        </div>
      </aside>
      <main className="main-surface">
        <AnimatePresence mode="wait">
          <motion.div key={view} className="view-frame" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {view === "home" && (settings && (setupOpen || (!settings.onboardingComplete && !setupDismissed))
              ? <SetupGuide settings={settings} onChange={setSettings} onDismiss={() => { setSetupOpen(false); setSetupDismissed(true); }} onFinish={(next) => { setSettings(next); setSetupOpen(false); setSetupDismissed(false); }}/>
              : <HomeView permissions={permissions} settings={settings} onOpenSettings={openSettings} onOpenScreenSettings={openScreenSettings}/>)}
            {view === "memory" && <MemoryView memory={memory} onChange={setMemory}/>}
            {view === "usage" && <UsageView settings={settings}/>}
            {view === "settings" && <SettingsView tab={settingsTab} onTabChange={setSettingsTab} settings={settings} onChange={setSettings} updateState={updateState} permissions={permissions} onPermissions={setPermissions}/>}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
