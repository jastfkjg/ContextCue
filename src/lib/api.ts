import type {
  AppSettings,
  CaptureSource,
  GenerationResult,
  ContextCueApi,
  MemoryDocument,
  MemorySnapshot,
  TokenUsageRecord,
  UserProfile
} from "../shared/types";

const demoSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600">
  <rect width="960" height="600" fill="#f5f5f2"/>
  <rect width="210" height="600" fill="#e6e5df"/>
  <circle cx="55" cy="74" r="23" fill="#1a1a18"/><text x="92" y="81" font-family="Arial" font-size="20">Lin Yue</text>
  <rect x="270" y="118" width="410" height="74" rx="18" fill="#ffffff"/>
  <text x="294" y="151" font-family="Arial" font-size="18" fill="#222">Could we move the sync to Thursday?</text>
  <text x="294" y="176" font-family="Arial" font-size="18" fill="#222">Same time works for me.</text>
  <rect x="455" y="226" width="405" height="58" rx="18" fill="#c9ff3d"/>
  <text x="480" y="261" font-family="Arial" font-size="18" fill="#161713">Sure — let me check my calendar.</text>
  <rect x="270" y="320" width="475" height="74" rx="18" fill="#ffffff"/>
  <text x="294" y="353" font-family="Arial" font-size="18" fill="#222">Great. Also, can you send the updated deck</text>
  <text x="294" y="378" font-family="Arial" font-size="18" fill="#222">before the meeting?</text>
</svg>`);

const demoSources: CaptureSource[] = [
  {
    id: "demo-wechat",
    name: "WeChat — Lin Yue",
    channel: "wechat",
    thumbnail: `data:image/svg+xml,${demoSvg}`
  },
  {
    id: "demo-slack",
    name: "Slack — product-team",
    channel: "slack",
    thumbnail: `data:image/svg+xml,${demoSvg}`
  },
  {
    id: "demo-lark",
    name: "Lark — Fang Yuan",
    channel: "lark",
    thumbnail: `data:image/svg+xml,${demoSvg}`
  }
];

let demoMemory: MemorySnapshot = {
  profile: {
    displayName: "Alex",
    pronouns: "",
    role: "Product designer",
    company: "",
    about: "Works across China and Europe.",
    preferredLanguage: "Match the conversation",
    writingStyle: "Warm, concise, calm, and direct",
    avoid: "Overly enthusiastic language and unnecessary exclamation marks",
    customRules: ["Lead with the answer", "Offer concrete next steps"]
  },
  documents: [
    {
      id: "profile",
      filename: "profile.md",
      content: "# About me\n\nI’m Alex, a product designer working across China and Europe.\n\n## Current context\n\nI’m building tools that make AI assistance feel more personal and controllable.",
      scope: "global",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "preferences",
      filename: "preferences.md",
      content: "# Communication preferences\n\n- Match the language of the conversation\n- Be warm, concise, calm, and direct\n- Lead with the answer\n- Offer concrete next steps\n\n## Avoid\n\n- Generic AI phrasing\n- Unnecessary exclamation marks\n- Invented facts",
      scope: "global",
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  contacts: [],
  facts: [],
  acceptedReplies: []
};

let demoSettings: AppSettings = {
  models: [
    {
      id: "openai-default",
      name: "OpenAI",
      apiBaseUrl: "https://api.openai.com/v1",
      model: "gpt-5.6-luna",
      apiProtocol: "responses",
      supportsImageInput: true,
      apiKeyConfigured: false
    },
    {
      id: "local-demo",
      name: "Local vision",
      apiBaseUrl: "http://localhost:11434/v1",
      model: "qwen3-vl",
      apiProtocol: "chat-completions",
      supportsImageInput: true,
      apiKeyConfigured: true
    }
  ],
  activeModelId: "openai-default",
  candidateCount: 3,
  locale: "auto",
  globalShortcut: "CommandOrControl+Shift+Space",
  autoShowOverlay: true
};

const demoUsageModels = [
  { id: "openai-default", name: "OpenAI", model: "gpt-5.6-luna", protocol: "responses" as const },
  { id: "local-demo", name: "Local vision", model: "qwen3-vl", protocol: "chat-completions" as const }
];

const demoTokenUsage: TokenUsageRecord[] = Array.from({ length: 24 }, (_, index) => {
  const configured = demoUsageModels[index % 3 === 0 ? 1 : 0];
  const inputTokens = configured.id === "openai-default" ? 1860 + (index % 5) * 164 : 2380 + (index % 4) * 210;
  const outputTokens = configured.id === "openai-default" ? 286 + (index % 4) * 42 : 342 + (index % 3) * 58;
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - Math.floor(index / 2));
  createdAt.setHours(index % 2 ? 9 : 16, 18 + index, 0, 0);
  return {
    id: `demo-usage-${index}`,
    modelId: configured.id,
    modelName: configured.name,
    model: configured.model,
    apiProtocol: configured.protocol,
    requestType: index % 4 === 0 ? "reply" : "quick-reply",
    channel: (["wechat", "slack", "lark"] as const)[index % 3],
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cachedTokens: configured.id === "openai-default" ? Math.round(inputTokens * .24) : 0,
    reasoningTokens: index % 5 === 0 ? 64 : 0,
    reported: true,
    latencyMs: configured.id === "openai-default" ? 1240 + index * 17 : 780 + index * 13,
    createdAt: createdAt.toISOString()
  };
});

const demoResult: GenerationResult = {
  candidates: [
    {
      text: "Thursday at the same time works for me. I’ll update the invite and send the revised deck beforehand.",
      tone: "Clear · helpful",
      strategy: "Confirm both requests"
    },
    {
      text: "Thursday works. I’ll move the invite and get the updated deck to you before we meet.",
      tone: "Warm · concise",
      strategy: "Brief confirmation"
    },
    {
      text: "Same time on Thursday is good on my side. I’ll share the updated deck first, then update the calendar invite.",
      tone: "Structured · calm",
      strategy: "State the sequence"
    }
  ],
  conversationSummary: "Lin Yue wants to move the sync to Thursday and receive an updated deck before the meeting.",
  detectedContact: "Lin Yue",
  detectedLanguage: "English",
  memorySuggestions: [
    { category: "relationship", content: "Lin Yue prefers concise scheduling confirmations." },
    { category: "follow-up", content: "Send the updated deck before Thursday’s sync." }
  ],
  generatedAt: new Date().toISOString()
};

const browserDemoApi: ContextCueApi = {
  getCaptureSources: async () => demoSources,
  captureSource: async (id) => demoSources.find((source) => source.id === id)?.thumbnail ?? demoSources[0].thumbnail,
  generateReplies: async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return demoResult;
  },
  getMemory: async () => demoMemory,
  saveMemoryDocument: async (document: MemoryDocument) => {
    const saved = { ...document, updatedAt: new Date().toISOString() };
    demoMemory = { ...demoMemory, documents: [...demoMemory.documents.filter((item) => item.id !== saved.id), saved] };
    return demoMemory;
  },
  deleteMemoryDocument: async (id) => {
    demoMemory = { ...demoMemory, documents: demoMemory.documents.filter((item) => item.id !== id) };
    return demoMemory;
  },
  saveProfile: async (profile: UserProfile) => (demoMemory = { ...demoMemory, profile }),
  saveContact: async (contact) => {
    demoMemory = { ...demoMemory, contacts: [contact, ...demoMemory.contacts.filter((item) => item.id !== contact.id)] };
    return demoMemory;
  },
  deleteContact: async (id) => {
    demoMemory = { ...demoMemory, contacts: demoMemory.contacts.filter((item) => item.id !== id) };
    return demoMemory;
  },
  addFact: async (fact) => {
    demoMemory = {
      ...demoMemory,
      facts: [{ ...fact, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...demoMemory.facts]
    };
    return demoMemory;
  },
  deleteFact: async (id) => {
    demoMemory = { ...demoMemory, facts: demoMemory.facts.filter((item) => item.id !== id) };
    return demoMemory;
  },
  getTokenUsage: async () => ({ records: demoTokenUsage }),
  getSettings: async () => demoSettings,
  saveSettings: async (settings) => {
    const { apiKeys = {}, ...rest } = settings;
    demoSettings = {
      ...rest,
      models: rest.models.map((model) => ({
        ...model,
        apiKeyConfigured: Boolean(apiKeys[model.id]) || model.apiKeyConfigured
      }))
    };
    return demoSettings;
  },
  testModelConnection: async ({ model, apiKey }) => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    if (!apiKey && !model.apiKeyConfigured) throw new Error("Add an API key before testing this connection.");
    return { ok: true, latencyMs: 642, message: `${model.apiProtocol === "responses" ? "Responses" : "Chat Completions"} endpoint accepted the request.` };
  },
  useReply: async () => ({ copied: true, pasted: false }),
  openScreenSettings: async () => undefined,
  getPermissions: async () => ({ screen: "granted", accessibility: true }),
  onOverlayResult: (callback) => {
    if (new URLSearchParams(window.location.search).get("mode") !== "overlay") return () => undefined;
    const timeout = window.setTimeout(() => callback({ ...demoResult, channel: "wechat", contact: demoResult.detectedContact }), 650);
    return () => window.clearTimeout(timeout);
  },
  onOverlayStatus: () => () => undefined,
  hideOverlay: async () => undefined
};

export const contextCueApi: ContextCueApi = window.contextCue ?? browserDemoApi;
export const isBrowserDemo = !window.contextCue;
