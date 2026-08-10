import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeftRight,
  Bot,
  Brain,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CircleDot,
  Command,
  CornerDownLeft,
  ExternalLink,
  House,
  Eye,
  Keyboard,
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
  Wifi,
  X
} from "lucide-react";
import { CandidateCarousel } from "./components/CandidateCarousel";
import { contextCueApi, isBrowserDemo } from "./lib/api";
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

type ViewId = "home" | "memory" | "channels" | "settings";

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
    <button className={`nav-item ${active ? "nav-item--active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      {icon}<span>{label}</span>{active && <motion.i layoutId="nav-active" />}
    </button>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return <span className={`status-pill ${configured ? "status-pill--ok" : ""}`}><i />{configured ? "Ready" : "Setup needed"}</span>;
}

function HomeView({
  sources,
  refreshSources,
  permissions,
  settings,
  onOpenSettings,
  onOpenChannels
}: {
  sources: CaptureSource[];
  refreshSources: () => Promise<void>;
  permissions: PermissionStatus | null;
  settings: AppSettings | null;
  onOpenSettings: () => void;
  onOpenChannels: () => void;
}) {
  const activeModel = settings?.models.find((model) => model.id === settings.activeModelId) ?? settings?.models[0];
  const modelReady = Boolean(activeModel?.apiKeyConfigured && activeModel.model.trim());
  const screenReady = isBrowserDemo || permissions?.screen === "granted" || permissions?.screen === "unknown";
  const shortcut = settings?.globalShortcut || "CommandOrControl+Shift+Space";
  const readyCount = [modelReady, screenReady, sources.length > 0].filter(Boolean).length;

  return (
    <div className="workspace home-workspace">
      <header className="workspace-header home-header">
        <div>
          <span className="eyebrow">QUICK START</span>
          <h1>Reply from the conversation.</h1>
          <p>Keep ContextCue in the background. Call it only when you need a draft.</p>
        </div>
        <span className={`home-readiness ${readyCount === 3 ? "home-readiness--ready" : ""}`}><i />{readyCount === 3 ? "Ready to use" : `${readyCount} of 3 ready`}</span>
      </header>

      <section className="home-command-stage">
        <div className="home-command-copy">
          <span className="home-command-label"><Command size={14}/> Global shortcut</span>
          <h2>One shortcut.<br/>Right where you’re typing.</h2>
          <p>Open a conversation in any app, then press:</p>
          <button className="home-shortcut" onClick={onOpenSettings} aria-label="Change global shortcut">
            {shortcutParts(shortcut).map((part, index) => <kbd key={`${part}-${index}`}>{part}</kbd>)}
            <span>Change</span>
          </button>
          <small>ContextCue reads the active conversation and opens a compact reply panel. It never sends automatically.</small>
        </div>

        <div className="home-overlay-demo" aria-hidden="true">
          <motion.div className="home-demo-window" initial={{ opacity: 0, y: 12, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: .08, duration: .35 }}>
            <header><span><i/> ContextCue</span><small>2 / 3</small></header>
            <p>Got it — I’ll move it to four and keep you posted.</p>
            <footer><span><kbd>←</kbd><kbd>→</kbd> choose</span><strong><kbd>↵</kbd> insert</strong></footer>
          </motion.div>
          <div className="home-demo-caption"><ShieldCheck size={14}/><span>Only captures after you press the shortcut</span></div>
        </div>
      </section>

      <div className="home-lower-grid">
        <section className="home-workflow">
          <div className="home-section-heading"><span className="eyebrow">HOW IT WORKS</span><h2>Three steps, without switching context.</h2></div>
          <ol>
            <li><span>01</span><div><strong>Stay in the conversation</strong><small>Place the chat you want to answer in front.</small></div><MessageSquareText size={18}/></li>
            <li><span>02</span><div><strong>Call ContextCue</strong><small>Press your global shortcut to read the visible context.</small></div><Command size={18}/></li>
            <li><span>03</span><div><strong>Choose and insert</strong><small>Use the arrow keys to switch, then Enter to insert.</small></div><CornerDownLeft size={18}/></li>
          </ol>
          <div className="home-key-note"><ArrowLeftRight size={15}/><span><kbd>←</kbd><kbd>→</kbd> switch replies</span><span><kbd>↵</kbd> insert selection</span><small>Sending is always up to you.</small></div>
        </section>

        <aside className="home-checklist">
          <div className="home-section-heading"><span className="eyebrow">READY CHECK</span><h2>Before your first reply.</h2></div>
          <button onClick={onOpenSettings}>
            <span className={modelReady ? "is-ready" : ""}>{modelReady ? <Check size={15}/> : "1"}</span>
            <div><strong>Model & API key</strong><small>{modelReady ? `${activeModel?.name} is configured` : "Add a model connection"}</small></div>
            <ChevronRight size={15}/>
          </button>
          <button onClick={() => screenReady ? onOpenChannels() : void contextCueApi.openScreenSettings()}>
            <span className={screenReady ? "is-ready" : ""}>{screenReady ? <Check size={15}/> : "2"}</span>
            <div><strong>Screen access</strong><small>{screenReady ? "Permission is available" : "Allow conversation capture"}</small></div>
            {screenReady ? <ChevronRight size={15}/> : <ExternalLink size={14}/>}
          </button>
          <button onClick={() => void refreshSources()}>
            <span className={sources.length > 0 ? "is-ready" : ""}>{sources.length > 0 ? <Check size={15}/> : "3"}</span>
            <div><strong>Visible conversation</strong><small>{sources.length > 0 ? `${sources.length} window${sources.length === 1 ? "" : "s"} found` : "Open a chat, then scan again"}</small></div>
            <RefreshCw size={14}/>
          </button>
          <p><ShieldCheck size={14}/> Memory stays local. Screenshots are sent only when you invoke a reply.</p>
        </aside>
      </div>
    </div>
  );
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

function MemoryView({ memory, onChange }: { memory: MemorySnapshot | null; onChange: (memory: MemorySnapshot) => void }) {
  const [profile, setProfile] = useState<UserProfile>(memory?.profile ?? emptyProfile);
  const [rule, setRule] = useState("");
  const [fact, setFact] = useState("");
  const [editingContact, setEditingContact] = useState<ContactMemory | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (memory) setProfile(memory.profile); }, [memory]);
  if (!memory) return <div className="workspace-loading"><span className="spinner" /> Loading memory…</div>;

  const saveProfile = async () => {
    const next = await contextCueApi.saveProfile(profile);
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
    onChange(await contextCueApi.addFact({ category: "personal", content: fact, source: "manual" }));
    setFact("");
  };
  const saveContact = async (contact: ContactMemory) => {
    onChange(await contextCueApi.saveContact(contact));
    setEditingContact(null);
  };

  return (
    <div className="workspace memory-workspace">
      <header className="workspace-header">
        <div><span className="eyebrow">LOCAL MEMORY</span><h1>Teach ContextCue what matters.</h1></div>
        <div className="privacy-note"><ShieldCheck size={17} /><span>Stored as a local file<br/><small>Inspectable and removable</small></span></div>
      </header>
      <div className="memory-layout">
        <section className="profile-editor">
          <div className="section-bar"><div><span className="step-number">YOU</span><h2>Voice & profile</h2></div><button className="button button--primary" onClick={() => void saveProfile()}>{saved ? <Check size={16}/> : <Save size={16}/>} {saved ? "Saved" : "Save"}</button></div>
          <div className="form-grid">
            <label><span>Name</span><input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} placeholder="How should ContextCue refer to you?" /></label>
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
              {memory.facts.slice(0, 12).map((item) => <div key={item.id}><em>{item.category}</em><span>{item.content}</span><button onClick={async () => onChange(await contextCueApi.deleteFact(item.id))}><Trash2 size={13}/></button></div>)}
              {memory.facts.length === 0 && <div className="list-empty">Saved insights appear here.</div>}
            </div>
          </section>
          <div className="learned-count"><strong>{memory.acceptedReplies.length}</strong><span>accepted replies available as style examples</span></div>
        </aside>
      </div>
      {editingContact && <ContactDialog contact={editingContact} onClose={() => setEditingContact(null)} onSave={saveContact} onDelete={async (id) => { onChange(await contextCueApi.deleteContact(id)); setEditingContact(null); }} />}
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
    <div className="channel-intro"><div className="channel-orbit"><span>微</span><span>S</span><span>L</span><i><ScanLine size={27}/></i></div><div><h2>One visual pipeline, every app.</h2><p>ContextCue captures only the window you select. It does not require access to your full chat history, and the same reply flow works across native and browser apps.</p></div></div>
    <section className="channel-table"><header><span>Channel</span><span>Context method</span><span>Status</span></header>{supported.map((item) => <div key={item.id}><span><i className={`channel-logo channel-logo--${item.id}`}>{CHANNEL_MARKS[item.id]}</i><strong>{CHANNEL_LABELS[item.id]}</strong></span><span>{item.detail}</span><span className="ready-mark"><i/>{item.level}</span></div>)}</section>
    <section className="visible-windows"><div className="section-bar"><div><span className="step-number">LIVE</span><h2>Visible conversations</h2></div><span>{sources.length} windows found</span></div><div className="window-list">{sources.slice(0, 12).map((source) => <div key={source.id}><img src={source.thumbnail} alt=""/><span><strong>{source.name}</strong><small>{CHANNEL_LABELS[source.channel]}</small></span></div>)}{sources.length === 0 && <div className="list-empty">No capturable windows found. Open a conversation and scan again.</div>}</div></section>
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

function ShortcutRecorder({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
  return <button type="button" className={`shortcut-recorder ${recording ? "shortcut-recorder--recording" : ""}`} onClick={() => setRecording((current) => !current)} onKeyDown={record} onBlur={() => setRecording(false)} aria-pressed={recording}>
    <span className="shortcut-recorder-copy"><Keyboard size={17}/><span><strong>{recording ? "Press your shortcut" : "Global shortcut"}</strong><small>{recording ? "Use a modifier · Esc, click again, or click outside to cancel" : "Click to record a new shortcut"}</small></span></span>
    <span className="shortcut-keys">{recording ? <i>Listening…</i> : shortcutParts(value).map((part, index) => <kbd key={`${part}-${index}`}>{part}</kbd>)}</span>
  </button>;
}

function SettingsView({ settings, onChange }: { settings: AppSettings | null; onChange: (settings: AppSettings) => void }) {
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
    if (signature === lastSavedSignature.current && !pendingKeys && pendingSaveCount.current === 0) return;
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
    const next = { id, name: "New provider", apiBaseUrl: "https://api.openai.com/v1", model: "", apiProtocol: "responses" as const, apiKeyConfigured: false };
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
    <header className="workspace-header settings-header"><div><span className="eyebrow">SETTINGS</span><h1>Models and preferences.</h1><p>Connect providers, test them, and choose how ContextCue replies.</p></div><div className="settings-header-status"><StatusPill configured={Boolean(activeModel && (activeModel.apiKeyConfigured || apiKeys[activeModel.id]?.trim()))}/><span className={`autosave-status autosave-status--${saveState}`} aria-live="polite">{saveState === "saving" ? <span className="spinner spinner--dark"/> : saveState === "saved" ? <CheckCircle2 size={14}/> : <i/>}{saveMessage}</span></div></header>
    <div className="model-settings-shell">
      <aside className="model-rail">
        <div className="model-rail-heading"><div><span>YOUR MODELS</span><strong>{form.models.length} {form.models.length === 1 ? "model" : "models"}</strong></div><button aria-label="Add model" title="Add model" onClick={addModel}><Plus size={16}/></button></div>
        <div className="model-list" role="listbox" aria-label="Configured models">
          {form.models.map((model, index) => <button key={model.id} role="option" aria-selected={selectedModel?.id === model.id} className={`model-list-item ${selectedModel?.id === model.id ? "model-list-item--selected" : ""}`} onClick={() => setSelectedModelId(model.id)}>
            <span className="model-monogram">{model.name.trim().slice(0, 1).toUpperCase() || index + 1}</span>
            <span className="model-list-copy"><strong>{model.name || "Untitled model"}</strong><small>{model.model || "Model ID needed"}</small></span>
            <span className={`model-health ${model.apiKeyConfigured ? "model-health--ready" : ""}`} title={model.apiKeyConfigured ? "API key configured" : "API key needed"} aria-label={model.apiKeyConfigured ? "API key configured" : "API key needed"}/>
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
                {form.activeModelId === selectedModel.id ? <span className="active-model-label"><CircleDot size={15}/> Default model</span> : <button className="use-model-button" onClick={() => setForm({ ...form, activeModelId: selectedModel.id })}><CircleDot size={15}/> Set as default</button>}
                <button className="remove-model-button" disabled={form.models.length === 1} onClick={removeModel} aria-label="Remove model" title={form.models.length === 1 ? "At least one model is required" : "Remove model"}><Trash2 size={15}/></button>
              </div>
            </div>
            <div className="model-form-grid">
              <label><span>Display name</span><input value={selectedModel.name} onChange={(event) => updateModel({ name: event.target.value })} placeholder="e.g. OpenAI work"/></label>
              <label><span>Model ID</span><input value={selectedModel.model} onChange={(event) => updateModel({ model: event.target.value })} placeholder="e.g. gpt-5.6"/></label>
              <label className="model-url-field"><span>API base URL</span><input type="url" value={selectedModel.apiBaseUrl} onChange={(event) => updateModel({ apiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1"/></label>
              <fieldset className="protocol-field"><legend>API format <button type="button" aria-label="About API formats" title="This must match the endpoint format supported by your provider."><CircleHelp size={14}/></button></legend><div className="protocol-options"><button type="button" className={selectedModel.apiProtocol === "responses" ? "protocol-option--active" : ""} onClick={() => updateModel({ apiProtocol: "responses" })}><span>Responses API<small>OpenAI current</small></span>{selectedModel.apiProtocol === "responses" && <Check size={15}/>}</button><button type="button" className={selectedModel.apiProtocol === "chat-completions" ? "protocol-option--active" : ""} onClick={() => updateModel({ apiProtocol: "chat-completions" })}><span>Chat Completions<small>Broadly compatible</small></span>{selectedModel.apiProtocol === "chat-completions" && <Check size={15}/>}</button></div><p>{selectedModel.apiProtocol === "responses" ? "Use for api.openai.com or a provider that explicitly supports /responses." : "Use for Ollama, DashScope, and most OpenAI-compatible /chat/completions providers."}</p></fieldset>
              <label><span>API key</span><input type="password" autoComplete="new-password" value={apiKeys[selectedModel.id] ?? ""} onChange={(event) => setApiKeys({ ...apiKeys, [selectedModel.id]: event.target.value })} placeholder={selectedModel.apiKeyConfigured ? "••••••••  Saved securely" : "Paste a key"}/></label>
            </div>
            <div className="connection-row"><div className="security-line"><ShieldCheck size={15}/><span>{selectedModel.apiKeyConfigured ? "A secure key is saved. Enter a new one only to replace it." : "The key is encrypted by your operating system after the model is complete."}</span></div><button className="test-connection-button" disabled={!modelComplete || !hasModelKey || selectedConnection?.state === "testing"} onClick={() => void testConnection()}>{selectedConnection?.state === "testing" ? <span className="spinner spinner--dark"/> : <Wifi size={16}/>} {selectedConnection?.state === "testing" ? "Testing…" : "Test connection"}</button></div>
            {selectedConnection && selectedConnection.state !== "testing" && <div className={`connection-result connection-result--${selectedConnection.state}`} role="status">{selectedConnection.state === "success" ? <CheckCircle2 size={16}/> : <CircleHelp size={16}/>}<span><strong>{selectedConnection.state === "success" ? `Connected${selectedConnection.latencyMs ? ` · ${selectedConnection.latencyMs} ms` : ""}` : "Connection failed"}</strong><small>{selectedConnection.message}</small></span></div>}
          </motion.section>}
        </AnimatePresence>

      </div>
    </div>
    <div className="preference-grid">
      <section className="preference-section"><div className="settings-heading"><MessageSquareText size={20}/><div><h2>Reply behavior</h2><p>Used by every configured model.</p></div></div><div className="preference-control"><span className="field-title">Candidates</span><div className="choice-group choice-group--count" role="group" aria-label="Candidate count">{[2, 3, 4, 5].map((count) => <button type="button" key={count} className={form.candidateCount === count ? "choice-button--active" : ""} aria-pressed={form.candidateCount === count} onClick={() => setForm({ ...form, candidateCount: count })}>{count}</button>)}</div></div><div className="preference-control"><span className="field-title">Reply language</span><div className="choice-group choice-group--language" role="group" aria-label="Reply language">{([{ value: "auto", label: "Match conversation" }, { value: "en", label: "English" }, { value: "zh-CN", label: "简体中文" }] as const).map((option) => <button type="button" key={option.value} className={form.locale === option.value ? "choice-button--active" : ""} aria-pressed={form.locale === option.value} onClick={() => setForm({ ...form, locale: option.value })}>{option.label}</button>)}</div></div><label className="toggle-row"><div><strong>Show floating candidates</strong><span>Open the compact panel after generation.</span></div><input type="checkbox" checked={form.autoShowOverlay} onChange={(e) => setForm({ ...form, autoShowOverlay: e.target.checked })}/><i/></label></section>
      <section className="preference-section"><div className="settings-heading"><Command size={20}/><div><h2>Global shortcut</h2><p>Works from WeChat or any other app.</p></div></div><ShortcutRecorder value={form.globalShortcut} onChange={(globalShortcut) => setForm({ ...form, globalShortcut })}/><p className="shortcut-help">The shortcut must include a modifier. If another app already uses it, ContextCue keeps your previous shortcut.</p></section>
    </div>
    <section className="privacy-strip"><ShieldCheck size={20}/><div><strong>Local by default</strong><span>Memory stays on this device. Screenshots are sent only when you generate.</span></div><ul><li><Check size={15}/>No background recording</li><li><Check size={15}/>Explicit memory saves</li></ul></section>
  </div>;
}

export function App() {
  const [view, setView] = useState<ViewId>("home");
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);
  const selected = useMemo(() => sources.find((item) => item.id === selectedId), [sources, selectedId]);
  const activeModel = settings?.models.find((model) => model.id === settings.activeModelId) ?? settings?.models[0];

  const refreshSources = useCallback(async () => {
    try {
      const next = await contextCueApi.getCaptureSources();
      setSources(next);
      setSelectedId((current) => next.some((item) => item.id === current) ? current : (next.find((item) => item.channel !== "other")?.id ?? next[0]?.id ?? ""));
    } catch {
      setSources([]);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      refreshSources(),
      contextCueApi.getMemory().then(setMemory),
      contextCueApi.getSettings().then(setSettings),
      contextCueApi.getPermissions().then(setPermissions)
    ]);
  }, [refreshSources]);

  useEffect(() => {
    document.querySelector(".main-surface")?.scrollTo({ top: 0, behavior: "auto" });
  }, [view]);

  const views: Array<{ id: ViewId; label: string; icon: React.ReactNode }> = [
    { id: "home", label: "Home", icon: <House size={18}/> },
    { id: "memory", label: "Memory", icon: <Brain size={18}/> },
    { id: "channels", label: "Channels", icon: <MessageSquareText size={18}/> },
    { id: "settings", label: "Settings", icon: <Settings size={18}/> }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span><i/><b/></span><strong>ContextCue</strong></div>
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
            {view === "home" && <HomeView sources={sources} refreshSources={refreshSources} permissions={permissions} settings={settings} onOpenSettings={() => setView("settings")} onOpenChannels={() => setView("channels")}/>}
            {view === "memory" && <MemoryView memory={memory} onChange={setMemory}/>} 
            {view === "channels" && <ChannelsView sources={sources} refresh={refreshSources}/>} 
            {view === "settings" && <SettingsView settings={settings} onChange={setSettings}/>} 
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
