import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  Brain,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  CircleDot,
  Command,
  ExternalLink,
  Eye,
  LockKeyhole,
  MemoryStick,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X
} from "lucide-react";
import { CandidateCarousel } from "./components/CandidateCarousel";
import { hiplyApi, isBrowserDemo } from "./lib/api";
import type {
  AppSettings,
  CaptureSource,
  ChannelId,
  ContactMemory,
  GenerationResult,
  LlmConfig,
  MemorySnapshot,
  PermissionStatus,
  UserProfile
} from "./shared/types";

type ViewId = "reply" | "memory" | "channels" | "settings";

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

const emptyProfile: UserProfile = {
  displayName: "",
  pronouns: "",
  role: "",
  company: "",
  about: "",
  preferredLanguage: "Match the conversation",
  writingStyle: "Warm, concise, natural, and direct",
  avoid: "Generic AI phrasing and invented facts",
  customRules: []
};

function sourceLabel(source?: CaptureSource): string {
  if (!source) return "Choose a conversation";
  return source.name.length > 46 ? `${source.name.slice(0, 43)}…` : source.name;
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? "nav-item--active" : ""}`} onClick={onClick}>
      {icon}<span>{label}</span>{active && <motion.i layoutId="nav-active" />}
    </button>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return <span className={`status-pill ${configured ? "status-pill--ok" : ""}`}><i />{configured ? "Ready" : "Setup needed"}</span>;
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
      const fresh = await hiplyApi.captureSource(selected.id);
      setScreenshot(fresh);
      const next = await hiplyApi.generateReplies({
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
    await hiplyApi.addFact({ category: suggestion.category, content: suggestion.content, source: "model-suggestion" });
    setSavedSuggestions((current) => new Set(current).add(index));
  };

  return (
    <div className="workspace reply-workspace">
      <header className="workspace-header">
        <div>
          <span className="eyebrow">CURRENT REPLY</span>
          <h1>Draft beside the conversation.</h1>
        </div>
        <div className="shortcut-hint"><Command size={15} /><kbd>⇧</kbd><kbd>Space</kbd><span>open Hiply</span></div>
      </header>

      {permissions && permissions.screen !== "granted" && permissions.screen !== "unknown" && (
        <div className="permission-banner">
          <ShieldCheck size={18} />
          <div><strong>{permissions.screen === "not-determined" ? "Screen access is needed." : "Screen access is off."}</strong><span>Allow Hiply to capture only the window you choose.</span></div>
          <button onClick={() => void hiplyApi.openScreenSettings()}>Open settings <ExternalLink size={14} /></button>
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
              <select value={channel} onChange={(event) => setChannel(event.target.value as ChannelId)}>
                {Object.entries(CHANNEL_LABELS).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
              </select>
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
                <CandidateCarousel candidates={result.candidates} channel={channel} contact={contact || result.detectedContact} />
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
                <span>Choose a conversation and Hiply will draft distinct, send-ready options in your voice.</span>
                <div className="keys"><kbd>←</kbd><kbd>→</kbd><small>switch</small><kbd>↵</kbd><small>insert</small></div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function MemoryView({ memory, onChange }: { memory: MemorySnapshot | null; onChange: (memory: MemorySnapshot) => void }) {
  const [profile, setProfile] = useState<UserProfile>(memory?.profile ?? emptyProfile);
  const [rule, setRule] = useState("");
  const [fact, setFact] = useState("");
  const [editingContact, setEditingContact] = useState<ContactMemory | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (memory) setProfile(memory.profile); }, [memory]);
  if (!memory) return <div className="workspace-loading"><span className="spinner" /> Loading memory…</div>;

  const saveProfile = async () => {
    const next = await hiplyApi.saveProfile(profile);
    onChange(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  };
  const addRule = () => {
    if (!rule.trim()) return;
    setProfile((current) => ({ ...current, customRules: [...current.customRules, rule.trim()] }));
    setRule("");
  };
  const addFact = async () => {
    if (!fact.trim()) return;
    onChange(await hiplyApi.addFact({ category: "personal", content: fact, source: "manual" }));
    setFact("");
  };
  const saveContact = async (contact: ContactMemory) => {
    onChange(await hiplyApi.saveContact(contact));
    setEditingContact(null);
  };

  return (
    <div className="workspace memory-workspace">
      <header className="workspace-header">
        <div><span className="eyebrow">LOCAL MEMORY</span><h1>Teach Hiply what matters.</h1></div>
        <div className="privacy-note"><ShieldCheck size={17} /><span>Stored as a local file<br/><small>Inspectable and removable</small></span></div>
      </header>
      <div className="memory-layout">
        <section className="profile-editor">
          <div className="section-bar"><div><span className="step-number">YOU</span><h2>Voice & profile</h2></div><button className="button button--primary" onClick={() => void saveProfile()}>{saved ? <Check size={16}/> : <Save size={16}/>} {saved ? "Saved" : "Save"}</button></div>
          <div className="form-grid">
            <label><span>Name</span><input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} placeholder="How should Hiply refer to you?" /></label>
            <label><span>Role</span><input value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} placeholder="Product lead, founder…" /></label>
            <label><span>Company / context</span><input value={profile.company} onChange={(e) => setProfile({ ...profile, company: e.target.value })} placeholder="Optional" /></label>
            <label><span>Language</span><input value={profile.preferredLanguage} onChange={(e) => setProfile({ ...profile, preferredLanguage: e.target.value })} /></label>
          </div>
          <label className="full-field"><span>About you</span><textarea value={profile.about} onChange={(e) => setProfile({ ...profile, about: e.target.value })} placeholder="Stable context that helps with replies." /></label>
          <label className="full-field"><span>Your writing style</span><textarea value={profile.writingStyle} onChange={(e) => setProfile({ ...profile, writingStyle: e.target.value })} /></label>
          <label className="full-field"><span>Avoid</span><textarea value={profile.avoid} onChange={(e) => setProfile({ ...profile, avoid: e.target.value })} /></label>
          <div className="rules-block">
            <span className="field-title">Rules that always apply</span>
            <div className="rule-list">
              {profile.customRules.map((item, index) => <span key={`${item}-${index}`}>{item}<button onClick={() => setProfile({ ...profile, customRules: profile.customRules.filter((_, i) => i !== index) })}><X size={13}/></button></span>)}
            </div>
            <div className="inline-input"><input value={rule} onChange={(e) => setRule(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addRule(); }} placeholder="e.g. Never use exclamation marks"/><button onClick={addRule}><Plus size={16}/> Add rule</button></div>
          </div>
        </section>

        <aside className="memory-sidebar">
          <section>
            <div className="aside-title"><div><Users size={16}/><h3>Relationships</h3></div><button onClick={() => setEditingContact({ id: crypto.randomUUID(), name: "", relation: "", channel: "other", tone: "", notes: "", customRules: [], lastUsedAt: new Date().toISOString() })}><Plus size={15}/></button></div>
            <p className="aside-help">Different voice for different people.</p>
            <div className="contact-list">
              {memory.contacts.map((contact) => <button key={contact.id} onClick={() => setEditingContact(contact)}><span>{contact.name.slice(0, 1).toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.relation || CHANNEL_LABELS[contact.channel]}</small></div><ChevronRight size={14}/></button>)}
              {memory.contacts.length === 0 && <div className="list-empty">Add a manager, teammate, client, or friend.</div>}
            </div>
          </section>
          <section>
            <div className="aside-title"><div><MemoryStick size={16}/><h3>Facts & follow-ups</h3></div><span>{memory.facts.length}</span></div>
            <div className="inline-input compact"><input value={fact} onChange={(e) => setFact(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addFact(); }} placeholder="Something worth remembering"/><button onClick={() => void addFact()}><Plus size={15}/></button></div>
            <div className="fact-list">
              {memory.facts.slice(0, 12).map((item) => <div key={item.id}><em>{item.category}</em><span>{item.content}</span><button onClick={async () => onChange(await hiplyApi.deleteFact(item.id))}><Trash2 size={13}/></button></div>)}
              {memory.facts.length === 0 && <div className="list-empty">Saved insights appear here.</div>}
            </div>
          </section>
          <div className="learned-count"><strong>{memory.acceptedReplies.length}</strong><span>accepted replies available as style examples</span></div>
        </aside>
      </div>
      {editingContact && <ContactDialog contact={editingContact} onClose={() => setEditingContact(null)} onSave={saveContact} onDelete={async (id) => { onChange(await hiplyApi.deleteContact(id)); setEditingContact(null); }} />}
    </div>
  );
}

function ContactDialog({ contact, onClose, onSave, onDelete }: { contact: ContactMemory; onClose: () => void; onSave: (contact: ContactMemory) => void; onDelete: (id: string) => void }) {
  const [value, setValue] = useState(contact);
  return <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><motion.div className="dialog" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
    <header><div><span className="avatar-large">{value.name.slice(0, 1).toUpperCase() || "?"}</span><div><span>RELATIONSHIP CARD</span><h2>{value.name || "New person"}</h2></div></div><button onClick={onClose}><X size={17}/></button></header>
    <div className="form-grid"><label><span>Name</span><input autoFocus value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })}/></label><label><span>Relationship</span><input value={value.relation} onChange={(e) => setValue({ ...value, relation: e.target.value })} placeholder="Manager, client, friend…"/></label><label><span>Channel</span><select value={value.channel} onChange={(e) => setValue({ ...value, channel: e.target.value as ChannelId })}>{Object.entries(CHANNEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label><span>Tone</span><input value={value.tone} onChange={(e) => setValue({ ...value, tone: e.target.value })} placeholder="Respectful but concise"/></label></div>
    <label className="full-field"><span>Notes and communication preferences</span><textarea value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} placeholder="Lead with the conclusion. Offer two time slots. Avoid weekend messages…"/></label>
    <footer>{memorySafeExisting(contact) && <button className="danger-button" onClick={() => onDelete(value.id)}><Trash2 size={15}/> Delete</button>}<span/><button className="button button--quiet" onClick={onClose}>Cancel</button><button className="button button--primary" disabled={!value.name.trim()} onClick={() => onSave({ ...value, lastUsedAt: new Date().toISOString() })}>Save relationship</button></footer>
  </motion.div></div>;
}

function memorySafeExisting(contact: ContactMemory) { return Boolean(contact.name); }

function ChannelsView({ sources, refresh }: { sources: CaptureSource[]; refresh: () => Promise<void> }) {
  const supported: Array<{ id: ChannelId; detail: string; level: string }> = [
    { id: "wechat", detail: "Window screenshot · visual conversation reading", level: "Ready" },
    { id: "slack", detail: "Desktop or browser window screenshot", level: "Ready" },
    { id: "lark", detail: "Lark and Feishu desktop windows", level: "Ready" },
    { id: "gmail", detail: "Browser window screenshot", level: "Ready" },
    { id: "teams", detail: "Desktop or browser window screenshot", level: "Ready" },
    { id: "whatsapp", detail: "Desktop or browser window screenshot", level: "Ready" },
    { id: "other", detail: "Any visible screen or application window", level: "Universal" }
  ];
  return <div className="workspace channels-workspace"><header className="workspace-header"><div><span className="eyebrow">CHANNELS</span><h1>Works where the conversation is.</h1></div><button className="button button--quiet" onClick={() => void refresh()}><RefreshCw size={15}/> Scan windows</button></header>
    <div className="channel-intro"><div className="channel-orbit"><span>微</span><span>S</span><span>L</span><i><ScanLine size={27}/></i></div><div><h2>One visual pipeline, every app.</h2><p>Hiply captures only the window you select. It does not require access to your full chat history, and the same reply flow works across native and browser apps.</p></div></div>
    <section className="channel-table"><header><span>Channel</span><span>Context method</span><span>Status</span></header>{supported.map((item) => <div key={item.id}><span><i className={`channel-logo channel-logo--${item.id}`}>{CHANNEL_MARKS[item.id]}</i><strong>{CHANNEL_LABELS[item.id]}</strong></span><span>{item.detail}</span><span className="ready-mark"><i/>{item.level}</span></div>)}</section>
    <section className="visible-windows"><div className="section-bar"><div><span className="step-number">LIVE</span><h2>Visible conversations</h2></div><span>{sources.length} windows found</span></div><div className="window-list">{sources.slice(0, 12).map((source) => <div key={source.id}><img src={source.thumbnail} alt=""/><span><strong>{source.name}</strong><small>{CHANNEL_LABELS[source.channel]}</small></span></div>)}{sources.length === 0 && <div className="list-empty">No capturable windows found. Open a conversation and scan again.</div>}</div></section>
  </div>;
}

function SettingsView({ settings, onChange }: { settings: AppSettings | null; onChange: (settings: AppSettings) => void }) {
  const [form, setForm] = useState<AppSettings | null>(settings);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(settings);
    setSelectedModelId((current) => settings?.models.some((model) => model.id === current) ? current : (settings?.activeModelId ?? ""));
    setApiKeys({});
  }, [settings]);
  if (!form) return <div className="workspace-loading"><span className="spinner"/> Loading settings…</div>;
  const selectedModel = form.models.find((model) => model.id === selectedModelId) ?? form.models[0];
  const activeModel = form.models.find((model) => model.id === form.activeModelId) ?? form.models[0];
  const updateModel = (changes: Partial<LlmConfig>) => {
    if (!selectedModel) return;
    setForm({ ...form, models: form.models.map((model) => model.id === selectedModel.id ? { ...model, ...changes } : model) });
    setMessage("");
  };
  const addModel = () => {
    const id = crypto.randomUUID();
    const next = {
      id,
      name: "New provider",
      apiBaseUrl: "https://api.openai.com/v1",
      model: "",
      apiProtocol: "responses" as const,
      apiKeyConfigured: false
    };
    setForm({ ...form, models: [...form.models, next] });
    setSelectedModelId(id);
    setMessage("New model added. Complete its details, then save.");
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
    setMessage("Model removed. Save to apply this change.");
  };
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const saved = await hiplyApi.saveSettings({ ...form, apiKeys });
      onChange(saved); setForm(saved); setApiKeys({}); setMessage("Settings saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setSaving(false); }
  };
  return <div className="workspace settings-workspace">
    <header className="workspace-header settings-header"><div><span className="eyebrow">SETTINGS</span><h1>Models and preferences.</h1><p>Connect multiple providers and choose which model Hiply uses.</p></div><StatusPill configured={Boolean(activeModel?.apiKeyConfigured)}/></header>
    <div className="model-settings-shell">
      <aside className="model-rail">
        <div className="model-rail-heading"><div><span>YOUR MODELS</span><strong>{form.models.length} configured</strong></div><button aria-label="Add model" title="Add model" onClick={addModel}><Plus size={16}/></button></div>
        <div className="model-list" role="listbox" aria-label="Configured models">
          {form.models.map((model, index) => <button key={model.id} role="option" aria-selected={selectedModel?.id === model.id} className={`model-list-item ${selectedModel?.id === model.id ? "model-list-item--selected" : ""}`} onClick={() => setSelectedModelId(model.id)}>
            <span className="model-monogram">{model.name.trim().slice(0, 1).toUpperCase() || index + 1}</span>
            <span className="model-list-copy"><strong>{model.name || "Untitled model"}</strong><small>{model.model || "Model ID needed"}</small></span>
            <span className={`model-health ${model.apiKeyConfigured ? "model-health--ready" : ""}`} title={model.apiKeyConfigured ? "API key configured" : "API key needed"}/>
            {form.activeModelId === model.id && <span className="current-chip">DEFAULT</span>}
          </button>)}
        </div>
        <button className="add-model-button" onClick={addModel}><Plus size={15}/> Add another model</button>
        <div className="rail-security"><LockKeyhole size={15}/><span>Keys are encrypted by your operating system and stored per model.</span></div>
      </aside>

      <div className="settings-main">
        <AnimatePresence mode="wait">
          {selectedModel && <motion.section key={selectedModel.id} className="model-editor" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .18 }}>
            <div className="model-editor-header">
              <div className="model-title"><span><Bot size={19}/></span><div><small>MODEL CONFIGURATION</small><h2>{selectedModel.name || "Untitled model"}</h2></div></div>
              <div className="model-editor-actions">
                {form.activeModelId === selectedModel.id ? <span className="active-model-label"><CircleDot size={15}/> Default model</span> : <button className="use-model-button" onClick={() => { setForm({ ...form, activeModelId: selectedModel.id }); setMessage("Default model changed. Save to apply."); }}><CircleDot size={15}/> Set as default</button>}
                <button className="remove-model-button" disabled={form.models.length === 1} onClick={removeModel} aria-label="Remove model" title={form.models.length === 1 ? "At least one model is required" : "Remove model"}><Trash2 size={15}/></button>
              </div>
            </div>
            <div className="model-form-grid">
              <label><span>Display name</span><input value={selectedModel.name} onChange={(event) => updateModel({ name: event.target.value })} placeholder="e.g. OpenAI work"/></label>
              <label><span>Model ID</span><input value={selectedModel.model} onChange={(event) => updateModel({ model: event.target.value })} placeholder="e.g. gpt-5.6"/></label>
              <label className="model-url-field"><span>API base URL</span><input type="url" value={selectedModel.apiBaseUrl} onChange={(event) => updateModel({ apiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1"/></label>
              <label><span>Protocol</span><select value={selectedModel.apiProtocol} onChange={(event) => updateModel({ apiProtocol: event.target.value as typeof selectedModel.apiProtocol })}><option value="responses">Responses API</option><option value="chat-completions">Chat Completions</option></select></label>
              <label><span>API key</span><input type="password" autoComplete="new-password" value={apiKeys[selectedModel.id] ?? ""} onChange={(event) => setApiKeys({ ...apiKeys, [selectedModel.id]: event.target.value })} placeholder={selectedModel.apiKeyConfigured ? "••••••••  Saved securely" : "Paste a key"}/></label>
            </div>
            <div className="security-line"><ShieldCheck size={15}/><span>{selectedModel.apiKeyConfigured ? "A secure key is saved. Enter a new one only to replace it." : "This model needs an API key before it can generate replies."}</span></div>
          </motion.section>}
        </AnimatePresence>

      </div>
    </div>
    <div className="preference-grid">
      <section className="preference-section"><div className="settings-heading"><MessageSquareText size={20}/><div><h2>Reply behavior</h2><p>Default output for every model.</p></div></div><div className="form-grid"><label><span>Candidates</span><select value={form.candidateCount} onChange={(e) => setForm({ ...form, candidateCount: Number(e.target.value) })}><option value={2}>2 candidates</option><option value={3}>3 candidates</option><option value={4}>4 candidates</option><option value={5}>5 candidates</option></select></label><label><span>Reply language</span><select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as AppSettings["locale"] })}><option value="auto">Match conversation</option><option value="en">English</option><option value="zh-CN">简体中文</option></select></label></div><label className="toggle-row"><div><strong>Show floating candidates</strong><span>Open the compact panel after generation.</span></div><input type="checkbox" checked={form.autoShowOverlay} onChange={(e) => setForm({ ...form, autoShowOverlay: e.target.checked })}/><i/></label></section>
      <section className="preference-section"><div className="settings-heading"><Command size={20}/><div><h2>Global shortcut</h2><p>Press it while you are in WeChat or any other app.</p></div></div><label className="full-field"><span>Electron accelerator</span><input value={form.globalShortcut} onChange={(e) => setForm({ ...form, globalShortcut: e.target.value })}/><small>macOS: ⌘⇧Space · Windows/Linux: Ctrl+Shift+Space</small></label></section>
    </div>
    <section className="privacy-strip"><ShieldCheck size={20}/><div><strong>Local by default</strong><span>Memory stays on this device. Screenshots are sent only when you generate.</span></div><ul><li><Check size={15}/>No background recording</li><li><Check size={15}/>Explicit memory saves</li></ul></section>
    <div className="settings-save" aria-live="polite"><span>{message}</span><button className="button button--primary" disabled={saving} onClick={() => void save()}>{saving ? <span className="spinner spinner--dark"/> : <Save size={16}/>} {saving ? "Saving…" : "Save settings"}</button></div>
  </div>;
}

export function App() {
  const [view, setView] = useState<ViewId>("reply");
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const selected = useMemo(() => sources.find((item) => item.id === selectedId), [sources, selectedId]);
  const activeModel = settings?.models.find((model) => model.id === settings.activeModelId) ?? settings?.models[0];

  const refreshSources = useCallback(async () => {
    try {
      const next = await hiplyApi.getCaptureSources();
      setSources(next);
      setSelectedId((current) => next.some((item) => item.id === current) ? current : (next.find((item) => item.channel !== "other")?.id ?? next[0]?.id ?? ""));
    } catch {
      setSources([]);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshSources(),
      hiplyApi.getMemory().then(setMemory),
      hiplyApi.getSettings().then(setSettings),
      hiplyApi.getPermissions().then(setPermissions)
    ]);
  }, [refreshSources]);

  useEffect(() => {
    document.querySelector(".main-surface")?.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  const views: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
    { id: "reply", label: "Reply", icon: <Sparkles size={18}/> },
    { id: "memory", label: "Memory", icon: <Brain size={18}/> },
    { id: "channels", label: "Channels", icon: <MessageSquareText size={18}/> },
    { id: "settings", label: "Settings", icon: <Settings size={18}/> }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><i/><b/></span><strong>Hiply</strong></div>
        <nav>{views.map((item) => <NavItem key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => setView(item.id)}/>)}</nav>
        <div className="sidebar-foot">
          {isBrowserDemo && <span className="demo-badge">Browser preview</span>}
          <div className={`model-status ${activeModel?.apiKeyConfigured ? "" : "model-status--needed"}`}><i/><span><strong>{activeModel?.name || "Model not set"}</strong><small>{activeModel ? `${activeModel.model || "Model ID needed"} · ${activeModel.apiKeyConfigured ? "ready" : "add key"}` : "Add a model"}</small></span></div>
          <button onClick={() => setView("settings")}><CircleHelp size={16}/> Setup guide</button>
        </div>
      </aside>
      <main className="main-surface">
        <AnimatePresence mode="wait">
          <motion.div key={view} className="view-frame" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {view === "reply" && <ReplyWorkspace sources={sources} selected={selected} setSelected={setSelectedId} refreshSources={refreshSources} permissions={permissions}/>} 
            {view === "memory" && <MemoryView memory={memory} onChange={setMemory}/>} 
            {view === "channels" && <ChannelsView sources={sources} refresh={refreshSources}/>} 
            {view === "settings" && <SettingsView settings={settings} onChange={setSettings}/>} 
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
