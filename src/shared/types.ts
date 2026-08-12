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
  requestType: "reply" | "quick-reply" | "assist" | "quick-assist" | "connection-test";
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

export interface ContextCueApi {
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
  moveOverlay: (deltaX: number, deltaY: number) => void;
  hideOverlay: () => Promise<void>;
}
