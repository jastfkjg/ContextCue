export type ChannelId = "wechat" | "slack" | "lark" | "gmail" | "teams" | "whatsapp" | "other";

export type AssistScenario = "reply" | "form" | "compose" | "rewrite" | "search" | "generic";
export type AssistAction = "insert" | "replace-selection" | "replace-all";

export interface InputTarget {
  platform: NodeJS.Platform | "browser";
  appId: string;
  applicationName: string;
  windowTitle: string;
  controlId: string;
  role: "text-field" | "text-area" | "content-editable" | "combo-box" | "unknown";
  nativeRole?: string;
  label?: string;
  placeholder?: string;
  currentText?: string;
  selectedText?: string;
  multiline: boolean;
  sensitive: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface PageContext {
  applicationName: string;
  windowTitle: string;
  nearbyText?: string[];
}

export type ApiProtocol = "responses" | "chat-completions";

export interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string;
  channel: ChannelId;
}

export interface CandidateReply {
  text: string;
  tone: string;
  strategy: string;
  label?: string;
  action?: AssistAction;
}

export interface MemorySuggestion {
  category: "profile" | "preference" | "relationship" | "follow-up";
  content: string;
}

export interface GenerationResult {
  candidates: CandidateReply[];
  scenario?: AssistScenario;
  taskLabel?: string;
  conversationSummary: string;
  detectedContact: string;
  detectedLanguage: string;
  memorySuggestions: MemorySuggestion[];
  generatedAt: string;
  tokenUsage?: GenerationTokenUsage;
}

export interface GenerationTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  reported: boolean;
  latencyMs: number;
}

export interface TokenUsageRecord extends GenerationTokenUsage {
  id: string;
  modelId: string;
  modelName: string;
  model: string;
  apiProtocol: ApiProtocol;
  requestType: "reply" | "quick-reply" | "assist" | "quick-assist" | "ask" | "connection-test";
  channel?: ChannelId;
  createdAt: string;
}

export interface TokenUsageSnapshot {
  records: TokenUsageRecord[];
}

export interface GenerateRequest {
  sourceId?: string;
  imageDataUrl?: string;
  channel: ChannelId;
  contact?: string;
  intent?: string;
  locale: "auto" | "en" | "zh-CN";
  quick?: boolean;
  scenario?: AssistScenario | "auto";
  target?: InputTarget;
  pageContext?: PageContext;
}

export interface AskHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AskRequest {
  sessionId: string;
  requestId: string;
  question: string;
  includeContext: boolean;
  history?: AskHistoryMessage[];
}

export type OverlayResizeEdge = "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface AskOverlayContext {
  sessionId: string;
  applicationName: string;
  windowTitle: string;
  channel: ChannelId;
  hasPageContext: boolean;
  contextUnavailableReason?: string;
  canReturnToSuggestions: boolean;
}

export type AskStreamEvent =
  | { type: "delta"; sessionId: string; requestId: string; delta: string }
  | { type: "complete"; sessionId: string; requestId: string; answer: string }
  | { type: "cancelled"; sessionId: string; requestId: string }
  | { type: "error"; sessionId: string; requestId: string; message: string };

export interface UserProfile {
  displayName: string;
  pronouns: string;
  role: string;
  company: string;
  about: string;
  preferredLanguage: string;
  writingStyle: string;
  avoid: string;
  customRules: string[];
}

export type MemoryDocumentScope = "global" | "channel" | "person";

export interface MemoryDocument {
  id: string;
  filename: string;
  content: string;
  scope: MemoryDocumentScope;
  scopeValue?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactMemory {
  id: string;
  name: string;
  relation: string;
  channel: ChannelId;
  tone: string;
  notes: string;
  customRules: string[];
  lastUsedAt: string;
}

export interface MemoryFact {
  id: string;
  category: string;
  content: string;
  contactId?: string;
  createdAt: string;
  source: "manual" | "model-suggestion";
}

export interface AcceptedSuggestion {
  id: string;
  text: string;
  channel: ChannelId;
  contact: string;
  scenario?: AssistScenario;
  applicationName?: string;
  controlId?: string;
  createdAt: string;
}

/** @deprecated Kept as a storage/API alias while v1 data migrates. */
export type AcceptedReply = AcceptedSuggestion;

export interface LlmConfig {
  id: string;
  name: string;
  apiBaseUrl: string;
  model: string;
  apiProtocol: ApiProtocol;
  supportsImageInput: boolean;
  apiKeyConfigured: boolean;
}

export interface AppSettings {
  models: LlmConfig[];
  activeModelId: string;
  candidateCount: number;
  locale: "auto" | "en" | "zh-CN";
  globalShortcut: string;
  askShortcut: string;
  autoShowOverlay: boolean;
}

export type StoredAppSettings = Omit<AppSettings, "models"> & {
  models: Array<Omit<LlmConfig, "apiKeyConfigured">>;
};

export type SaveSettingsRequest = AppSettings & {
  apiKeys?: Record<string, string>;
};

export interface TestModelConnectionRequest {
  model: LlmConfig;
  apiKey?: string;
}

export interface TestModelConnectionResult {
  ok: true;
  message: string;
  latencyMs: number;
  tokenUsage?: GenerationTokenUsage;
}

export interface AppData {
  version: 2;
  profile: UserProfile;
  documents: MemoryDocument[];
  contacts: ContactMemory[];
  facts: MemoryFact[];
  acceptedReplies: AcceptedReply[];
  tokenUsage: TokenUsageRecord[];
  settings: StoredAppSettings;
  encryptedApiKeys?: Record<string, string>;
}

export interface MemorySnapshot {
  profile: UserProfile;
  documents: MemoryDocument[];
  contacts: ContactMemory[];
  facts: MemoryFact[];
  acceptedReplies: AcceptedReply[];
}

export interface UseReplyRequest {
  text: string;
  channel: ChannelId;
  contact: string;
  paste: boolean;
  action?: AssistAction;
  scenario?: AssistScenario;
  target?: InputTarget;
}

export interface UseReplyResult {
  copied: boolean;
  pasted: boolean;
  error?: string;
}

export interface PermissionStatus {
  screen: "not-determined" | "granted" | "denied" | "restricted" | "unknown";
  accessibility: boolean;
}

export interface OverlayStatus {
  state: "loading" | "error";
  message: string;
  modelName?: string;
  channel?: ChannelId;
}

export interface AppUpdateState {
  revision: number;
  currentVersion: string;
  mode: "automatic" | "installer" | "unavailable";
  status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error" | "disabled";
  availableVersion?: string;
  releaseNotes?: string;
  progress?: number;
  checkedAt?: string;
  message: string;
}

export interface ContextCueApi {
  getUpdateState: () => Promise<AppUpdateState>;
  checkForUpdates: () => Promise<AppUpdateState>;
  downloadUpdate: () => Promise<AppUpdateState>;
  installUpdate: () => Promise<AppUpdateState>;
  onUpdateState: (callback: (state: AppUpdateState) => void) => () => void;
  onOpenUpdates: (callback: () => void) => () => void;
  getCaptureSources: () => Promise<CaptureSource[]>;
  captureSource: (sourceId: string) => Promise<string>;
  generateReplies: (request: GenerateRequest) => Promise<GenerationResult>;
  generateAssistance: (request: GenerateRequest) => Promise<GenerationResult>;
  getMemory: () => Promise<MemorySnapshot>;
  saveMemoryDocument: (document: MemoryDocument) => Promise<MemorySnapshot>;
  deleteMemoryDocument: (id: string) => Promise<MemorySnapshot>;
  saveProfile: (profile: UserProfile) => Promise<MemorySnapshot>;
  saveContact: (contact: ContactMemory) => Promise<MemorySnapshot>;
  deleteContact: (id: string) => Promise<MemorySnapshot>;
  addFact: (fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) => Promise<MemorySnapshot>;
  deleteFact: (id: string) => Promise<MemorySnapshot>;
  getTokenUsage: () => Promise<TokenUsageSnapshot>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: SaveSettingsRequest) => Promise<AppSettings>;
  testModelConnection: (request: TestModelConnectionRequest) => Promise<TestModelConnectionResult>;
  useReply: (request: UseReplyRequest) => Promise<UseReplyResult>;
  useSuggestion: (request: UseReplyRequest) => Promise<UseReplyResult>;
  openScreenSettings: () => Promise<void>;
  getPermissions: () => Promise<PermissionStatus>;
  onOverlayResult: (callback: (result: GenerationResult & { channel: ChannelId; contact: string; target?: InputTarget }) => void) => () => void;
  onOverlayStatus: (callback: (status: OverlayStatus) => void) => () => void;
  openAsk: () => Promise<AskOverlayContext>;
  exitAsk: (returnToSuggestions: boolean) => Promise<void>;
  startAsk: (request: AskRequest) => void;
  cancelAsk: (requestId: string) => void;
  copyText: (text: string) => Promise<void>;
  onAskOpen: (callback: (context: AskOverlayContext) => void) => () => void;
  onAskEvent: (callback: (event: AskStreamEvent) => void) => () => void;
  moveOverlay: (deltaX: number, deltaY: number) => void;
  resizeOverlay: (height: number, newCandidate: boolean) => void;
  resizeOverlayBy: (edge: OverlayResizeEdge, deltaX: number, deltaY: number) => void;
  hideOverlay: () => Promise<void>;
}
