export type ChannelId = "wechat" | "slack" | "lark" | "gmail" | "teams" | "whatsapp" | "other";

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
}

export interface MemorySuggestion {
  category: "profile" | "preference" | "relationship" | "follow-up";
  content: string;
}

export interface GenerationResult {
  candidates: CandidateReply[];
  conversationSummary: string;
  detectedContact: string;
  detectedLanguage: string;
  memorySuggestions: MemorySuggestion[];
  generatedAt: string;
}

export interface GenerateRequest {
  sourceId?: string;
  imageDataUrl?: string;
  channel: ChannelId;
  contact?: string;
  intent?: string;
  locale: "auto" | "en" | "zh-CN";
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

export interface AcceptedReply {
  id: string;
  text: string;
  channel: ChannelId;
  contact: string;
  createdAt: string;
}

export interface AppSettings {
  apiBaseUrl: string;
  model: string;
  apiProtocol: ApiProtocol;
  candidateCount: number;
  locale: "auto" | "en" | "zh-CN";
  globalShortcut: string;
  autoShowOverlay: boolean;
  apiKeyConfigured: boolean;
}

export interface AppData {
  version: 1;
  profile: UserProfile;
  contacts: ContactMemory[];
  facts: MemoryFact[];
  acceptedReplies: AcceptedReply[];
  settings: Omit<AppSettings, "apiKeyConfigured">;
  encryptedApiKey?: string;
}

export interface MemorySnapshot {
  profile: UserProfile;
  contacts: ContactMemory[];
  facts: MemoryFact[];
  acceptedReplies: AcceptedReply[];
}

export interface UseReplyRequest {
  text: string;
  channel: ChannelId;
  contact: string;
  paste: boolean;
}

export interface PermissionStatus {
  screen: "not-determined" | "granted" | "denied" | "restricted" | "unknown";
  accessibility: boolean;
}

export interface HiplyApi {
  getCaptureSources: () => Promise<CaptureSource[]>;
  captureSource: (sourceId: string) => Promise<string>;
  generateReplies: (request: GenerateRequest) => Promise<GenerationResult>;
  getMemory: () => Promise<MemorySnapshot>;
  saveProfile: (profile: UserProfile) => Promise<MemorySnapshot>;
  saveContact: (contact: ContactMemory) => Promise<MemorySnapshot>;
  deleteContact: (id: string) => Promise<MemorySnapshot>;
  addFact: (fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) => Promise<MemorySnapshot>;
  deleteFact: (id: string) => Promise<MemorySnapshot>;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Omit<AppSettings, "apiKeyConfigured"> & { apiKey?: string }) => Promise<AppSettings>;
  useReply: (request: UseReplyRequest) => Promise<{ copied: boolean; pasted: boolean }>;
  openScreenSettings: () => Promise<void>;
  getPermissions: () => Promise<PermissionStatus>;
  onCaptureRequested: (callback: () => void) => () => void;
  onOverlayResult: (callback: (result: GenerationResult & { channel: ChannelId; contact: string }) => void) => () => void;
  hideOverlay: () => Promise<void>;
}
