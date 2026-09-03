import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AcceptedReply,
  AppData,
  AppSettings,
  ContactMemory,
  MemoryDocument,
  MemoryFact,
  MemorySnapshot,
  TokenUsageRecord,
  TokenUsageSnapshot,
  UserProfile
} from "../../src/shared/types";
import { inferImageInputSupport } from "../../src/shared/model-capabilities";

const DEFAULT_PROFILE: UserProfile = {
  displayName: "",
  pronouns: "",
  role: "",
  company: "",
  about: "",
  preferredLanguage: "Match the conversation",
  writingStyle: "Warm, concise, natural, and direct",
  avoid: "Generic AI phrasing, unnecessary exclamation marks, and invented facts",
  customRules: []
};

function legacyDocuments(profile: UserProfile, contacts: ContactMemory[] = [], createdAt = new Date().toISOString()): MemoryDocument[] {
  const now = createdAt;
  const aboutLines = [
    profile.displayName && `- Name: ${profile.displayName}`,
    profile.pronouns && `- Pronouns: ${profile.pronouns}`,
    profile.role && `- Role: ${profile.role}`,
    profile.company && `- Company / context: ${profile.company}`
  ].filter(Boolean);
  const profileContent = [
    "# About me",
    "",
    ...aboutLines,
    ...(profile.about ? ["", "## Background", "", profile.about] : [])
  ].join("\n");
  const preferenceContent = [
    "# Communication preferences",
    "",
    `- Language: ${profile.preferredLanguage}`,
    `- Writing style: ${profile.writingStyle}`,
    `- Avoid: ${profile.avoid}`,
    ...(profile.customRules.length ? ["", "## Rules that always apply", "", ...profile.customRules.map((rule) => `- ${rule}`)] : [])
  ].join("\n");
  const people = contacts.map((contact) => ({
    id: `person-${contact.id}`,
    filename: `${contact.name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").replace(/^-|-$/g, "") || "person"}.md`,
    content: [
      `# ${contact.name}`,
      "",
      ...(contact.relation ? [`- Relationship: ${contact.relation}`] : []),
      ...(contact.channel ? [`- Channel: ${contact.channel}`] : []),
      ...(contact.tone ? [`- Tone: ${contact.tone}`] : []),
      ...(contact.notes ? ["", "## Notes", "", contact.notes] : []),
      ...(contact.customRules.length ? ["", "## Communication rules", "", ...contact.customRules.map((rule) => `- ${rule}`)] : [])
    ].join("\n"),
    scope: "person" as const,
    scopeValue: contact.name,
    enabled: true,
    createdAt: now,
    updatedAt: contact.lastUsedAt || now
  }));
  return [
    { id: "profile", filename: "profile.md", content: profileContent, scope: "global", enabled: true, createdAt: now, updatedAt: now },
    { id: "preferences", filename: "preferences.md", content: preferenceContent, scope: "global", enabled: true, createdAt: now, updatedAt: now },
    ...people
  ];
}

export const DEFAULT_DATA: AppData = {
  version: 2,
  profile: DEFAULT_PROFILE,
  documents: legacyDocuments(DEFAULT_PROFILE),
  contacts: [],
  facts: [],
  acceptedReplies: [],
  tokenUsage: [],
  settings: {
    models: [{
      id: "openai-default",
      name: "OpenAI",
      apiBaseUrl: process.env.CONTEXTCUE_API_BASE_URL || "https://api.openai.com/v1",
      model: process.env.CONTEXTCUE_MODEL || "gpt-5.6-luna",
      apiProtocol: "responses",
      supportsImageInput: true
    }],
    activeModelId: "openai-default",
    candidateCount: 3,
    locale: "auto",
    globalShortcut: "CommandOrControl+Shift+Space",
    askShortcut: "CommandOrControl+Shift+Enter",
    autoShowOverlay: true,
    onboardingComplete: false
  }
};

function cloneDefaults(): AppData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA)) as AppData;
}

type LegacyAppData = Partial<AppData> & {
  encryptedApiKey?: string;
  settings?: Partial<AppData["settings"]> & {
    apiBaseUrl?: string;
    model?: string;
    apiProtocol?: AppData["settings"]["models"][number]["apiProtocol"];
  };
};

function migrate(input: LegacyAppData): AppData {
  const defaults = cloneDefaults();
  const profile = { ...defaults.profile, ...(input.profile ?? {}) };
  const contacts = Array.isArray(input.contacts) ? input.contacts : [];
  const legacySettings = input.settings;
  const configuredModelsSource = Array.isArray(legacySettings?.models) && legacySettings.models.length
    ? legacySettings.models
    : [{
        id: "openai-default",
        name: "OpenAI",
        apiBaseUrl: legacySettings?.apiBaseUrl || defaults.settings.models[0].apiBaseUrl,
        model: legacySettings?.model || defaults.settings.models[0].model,
        apiProtocol: legacySettings?.apiProtocol || defaults.settings.models[0].apiProtocol,
        supportsImageInput: inferImageInputSupport(legacySettings?.model || defaults.settings.models[0].model)
      }];
  const configuredModels = configuredModelsSource.map((model) => ({
    ...model,
    supportsImageInput: typeof model.supportsImageInput === "boolean"
      ? model.supportsImageInput
      : inferImageInputSupport(model.model)
  }));
  const activeModelId = configuredModels.some((model) => model.id === legacySettings?.activeModelId)
    ? legacySettings!.activeModelId!
    : configuredModels[0].id;
  return {
    version: 2,
    profile,
    documents: Array.isArray(input.documents)
      ? input.documents.map((document) => ({
          ...document,
          id: document.id || randomUUID(),
          filename: document.filename?.trim() || "untitled.md",
          content: typeof document.content === "string"
            ? document.content.replace(/<!--\s*Add stable background that helps ContextCue understand you\.\s*-->/g, "").replace(/\n{3,}/g, "\n\n")
            : "",
          scope: ["global", "channel", "person"].includes(document.scope) ? document.scope : "global",
          enabled: document.enabled !== false,
          createdAt: document.createdAt || new Date().toISOString(),
          updatedAt: document.updatedAt || document.createdAt || new Date().toISOString()
        }))
      : legacyDocuments(profile, contacts),
    settings: {
      ...defaults.settings,
      ...(legacySettings ?? {}),
      onboardingComplete: legacySettings?.onboardingComplete ?? Boolean(input.encryptedApiKey || Object.keys(input.encryptedApiKeys ?? {}).length || input.tokenUsage?.length),
      models: configuredModels,
      activeModelId
    },
    encryptedApiKeys: input.encryptedApiKeys ?? (input.encryptedApiKey ? { [activeModelId]: input.encryptedApiKey } : undefined),
    contacts,
    facts: Array.isArray(input.facts) ? input.facts : [],
    acceptedReplies: Array.isArray(input.acceptedReplies) ? input.acceptedReplies.slice(-100) : [],
    tokenUsage: Array.isArray(input.tokenUsage) ? input.tokenUsage.slice(-5000) : []
  };
}

function isPristineInstall(data: AppData): boolean {
  const defaults = cloneDefaults();
  const [model] = data.settings.models;
  const [defaultModel] = defaults.settings.models;
  return data.contacts.length === 0
    && data.facts.length === 0
    && data.acceptedReplies.length === 0
    && data.tokenUsage.length === 0
    && JSON.stringify(data.profile) === JSON.stringify(defaults.profile)
    && JSON.stringify(data.documents.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...document }) => document))
      === JSON.stringify(defaults.documents.map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...document }) => document))
    && Object.keys(data.encryptedApiKeys ?? {}).length === 0
    && data.settings.models.length === 1
    && model.id === defaultModel.id
    && model.name === defaultModel.name
    && model.apiBaseUrl === defaultModel.apiBaseUrl
    && model.model === defaultModel.model
    && model.apiProtocol === defaultModel.apiProtocol
    && model.supportsImageInput === defaultModel.supportsImageInput
    && data.settings.activeModelId === defaults.settings.activeModelId
    && data.settings.candidateCount === defaults.settings.candidateCount
    && data.settings.locale === defaults.settings.locale
    && data.settings.globalShortcut === defaults.settings.globalShortcut
    && data.settings.askShortcut === defaults.settings.askShortcut
    && data.settings.autoShowOverlay === defaults.settings.autoShowOverlay;
}

function mergeById<T extends { id: string }>(primary: T[], additional: T[]): T[] {
  const seen = new Set(primary.map((item) => item.id));
  return [...primary, ...additional.filter((item) => !seen.has(item.id))];
}

async function writeDataFile(filePath: string, data: AppData): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, filePath);
}

export async function importLegacyBrandData(currentFilePath: string, legacyFilePath: string): Promise<boolean> {
  const markerPath = `${currentFilePath}.hiply-imported`;
  try {
    await access(markerPath);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  let legacy: AppData;
  try {
    legacy = migrate(JSON.parse(await readFile(legacyFilePath, "utf8")) as LegacyAppData);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }

  let current: AppData;
  try {
    current = migrate(JSON.parse(await readFile(currentFilePath, "utf8")) as LegacyAppData);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    current = cloneDefaults();
  }

  const pristine = isPristineInstall(current);
  const merged: AppData = pristine ? legacy : {
    ...current,
    settings: {
      ...current.settings,
      models: mergeById(current.settings.models, legacy.settings.models)
    },
    encryptedApiKeys: {
      ...(legacy.encryptedApiKeys ?? {}),
      ...(current.encryptedApiKeys ?? {})
    },
    contacts: mergeById(current.contacts, legacy.contacts),
    documents: mergeById(current.documents, legacy.documents),
    facts: mergeById(current.facts, legacy.facts),
    acceptedReplies: mergeById(current.acceptedReplies, legacy.acceptedReplies).slice(-100),
    tokenUsage: mergeById(current.tokenUsage, legacy.tokenUsage).slice(-5000)
  };
  const changed = JSON.stringify(merged) !== JSON.stringify(current);
  if (changed) await writeDataFile(currentFilePath, merged);
  await writeFile(markerPath, new Date().toISOString(), { encoding: "utf8", mode: 0o600 });
  return changed;
}

export class MemoryStore {
  private data: AppData = cloneDefaults();
  private loaded = false;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<AppData> {
    if (this.loaded) return this.data;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AppData>;
      this.data = migrate(parsed);
      if (JSON.stringify(parsed) !== JSON.stringify(this.data)) await this.persist();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }
    this.loaded = true;
    return this.data;
  }

  getData(): AppData {
    return this.data;
  }

  snapshot(): MemorySnapshot {
    return {
      profile: structuredClone(this.data.profile),
      documents: structuredClone(this.data.documents),
      contacts: structuredClone(this.data.contacts),
      facts: structuredClone(this.data.facts),
      acceptedReplies: structuredClone(this.data.acceptedReplies)
    };
  }

  tokenUsage(): TokenUsageSnapshot {
    return { records: structuredClone(this.data.tokenUsage).reverse() };
  }

  settings(configuredModelIds: Set<string>): AppSettings {
    return {
      ...structuredClone(this.data.settings),
      models: this.data.settings.models.map((model) => ({
        ...structuredClone(model),
        apiKeyConfigured: configuredModelIds.has(model.id)
      }))
    };
  }

  async saveProfile(profile: UserProfile): Promise<MemorySnapshot> {
    this.data.profile = structuredClone(profile);
    await this.persist();
    return this.snapshot();
  }

  async saveMemoryDocument(document: MemoryDocument): Promise<MemorySnapshot> {
    const now = new Date().toISOString();
    const filename = `${document.filename.trim().replace(/\.md$/i, "") || "untitled"}.md`;
    const normalized: MemoryDocument = {
      ...structuredClone(document),
      id: document.id || randomUUID(),
      filename,
      content: document.content.replace(/\r\n/g, "\n"),
      scopeValue: document.scope === "global" ? undefined : document.scopeValue?.trim(),
      createdAt: document.createdAt || now,
      updatedAt: now
    };
    const index = this.data.documents.findIndex((item) => item.id === normalized.id);
    if (index >= 0) this.data.documents[index] = normalized;
    else this.data.documents.push(normalized);
    await this.persist();
    return this.snapshot();
  }

  async deleteMemoryDocument(id: string): Promise<MemorySnapshot> {
    this.data.documents = this.data.documents.filter((item) => item.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async saveContact(contact: ContactMemory): Promise<MemorySnapshot> {
    const normalized = {
      ...contact,
      id: contact.id || randomUUID(),
      lastUsedAt: contact.lastUsedAt || new Date().toISOString()
    };
    const index = this.data.contacts.findIndex((item) => item.id === normalized.id);
    if (index >= 0) this.data.contacts[index] = normalized;
    else this.data.contacts.unshift(normalized);
    await this.persist();
    return this.snapshot();
  }

  async deleteContact(id: string): Promise<MemorySnapshot> {
    this.data.contacts = this.data.contacts.filter((item) => item.id !== id);
    this.data.facts = this.data.facts.filter((item) => item.contactId !== id);
    await this.persist();
    return this.snapshot();
  }

  async addFact(fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">): Promise<MemorySnapshot> {
    const content = fact.content.trim();
    if (!content) return this.snapshot();
    const exists = this.data.facts.some(
      (item) => item.content.toLowerCase() === content.toLowerCase() && item.contactId === fact.contactId
    );
    if (!exists) {
      this.data.facts.unshift({ ...fact, content, id: randomUUID(), createdAt: new Date().toISOString() });
      this.data.facts = this.data.facts.slice(0, 250);
      await this.persist();
    }
    return this.snapshot();
  }

  async deleteFact(id: string): Promise<MemorySnapshot> {
    this.data.facts = this.data.facts.filter((item) => item.id !== id);
    await this.persist();
    return this.snapshot();
  }

  async rememberAcceptedReply(reply: Omit<AcceptedReply, "id" | "createdAt">): Promise<void> {
    this.data.acceptedReplies.push({ ...reply, id: randomUUID(), createdAt: new Date().toISOString() });
    this.data.acceptedReplies = this.data.acceptedReplies.slice(-100);
    await this.persist();
  }

  async rememberAcceptedSuggestion(reply: Omit<AcceptedReply, "id" | "createdAt">): Promise<void> {
    await this.rememberAcceptedReply(reply);
  }

  async recordTokenUsage(record: Omit<TokenUsageRecord, "id" | "createdAt">): Promise<void> {
    this.data.tokenUsage.push({
      ...structuredClone(record),
      id: randomUUID(),
      createdAt: new Date().toISOString()
    });
    this.data.tokenUsage = this.data.tokenUsage.slice(-5000);
    await this.persist();
  }

  async saveSettings(settings: AppData["settings"], encryptedApiKeys?: Record<string, string>): Promise<void> {
    this.data.settings = structuredClone(settings);
    if (encryptedApiKeys !== undefined) this.data.encryptedApiKeys = structuredClone(encryptedApiKeys);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const snapshot = structuredClone(this.data);
    const write = this.persistenceQueue.then(() => writeDataFile(this.filePath, snapshot));
    this.persistenceQueue = write.catch(() => undefined);
    await write;
  }
}
