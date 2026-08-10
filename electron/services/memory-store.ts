import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AcceptedReply,
  AppData,
  AppSettings,
  ContactMemory,
  MemoryFact,
  MemorySnapshot,
  UserProfile
} from "../../src/shared/types";

export const DEFAULT_DATA: AppData = {
  version: 1,
  profile: {
    displayName: "",
    pronouns: "",
    role: "",
    company: "",
    about: "",
    preferredLanguage: "Match the conversation",
    writingStyle: "Warm, concise, natural, and direct",
    avoid: "Generic AI phrasing, unnecessary exclamation marks, and invented facts",
    customRules: []
  },
  contacts: [],
  facts: [],
  acceptedReplies: [],
  settings: {
    models: [{
      id: "openai-default",
      name: "OpenAI",
      apiBaseUrl: process.env.CONTEXTCUE_API_BASE_URL || "https://api.openai.com/v1",
      model: process.env.CONTEXTCUE_MODEL || "gpt-5.6-luna",
      apiProtocol: "responses"
    }],
    activeModelId: "openai-default",
    candidateCount: 3,
    locale: "auto",
    globalShortcut: "CommandOrControl+Shift+Space",
    autoShowOverlay: true
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
  const legacySettings = input.settings;
  const configuredModels = Array.isArray(legacySettings?.models) && legacySettings.models.length
    ? legacySettings.models
    : [{
        id: "openai-default",
        name: "OpenAI",
        apiBaseUrl: legacySettings?.apiBaseUrl || defaults.settings.models[0].apiBaseUrl,
        model: legacySettings?.model || defaults.settings.models[0].model,
        apiProtocol: legacySettings?.apiProtocol || defaults.settings.models[0].apiProtocol
      }];
  const activeModelId = configuredModels.some((model) => model.id === legacySettings?.activeModelId)
    ? legacySettings!.activeModelId!
    : configuredModels[0].id;
  return {
    version: 1,
    profile: { ...defaults.profile, ...(input.profile ?? {}) },
    settings: {
      ...defaults.settings,
      ...(legacySettings ?? {}),
      models: configuredModels,
      activeModelId
    },
    encryptedApiKeys: input.encryptedApiKeys ?? (input.encryptedApiKey ? { [activeModelId]: input.encryptedApiKey } : undefined),
    contacts: Array.isArray(input.contacts) ? input.contacts : [],
    facts: Array.isArray(input.facts) ? input.facts : [],
    acceptedReplies: Array.isArray(input.acceptedReplies) ? input.acceptedReplies.slice(-100) : []
  };
}

function isPristineInstall(data: AppData): boolean {
  const defaults = cloneDefaults();
  const [model] = data.settings.models;
  const [defaultModel] = defaults.settings.models;
  return data.contacts.length === 0
    && data.facts.length === 0
    && data.acceptedReplies.length === 0
    && JSON.stringify(data.profile) === JSON.stringify(defaults.profile)
    && Object.keys(data.encryptedApiKeys ?? {}).length === 0
    && data.settings.models.length === 1
    && model.id === defaultModel.id
    && model.name === defaultModel.name
    && model.apiBaseUrl === defaultModel.apiBaseUrl
    && model.model === defaultModel.model
    && model.apiProtocol === defaultModel.apiProtocol
    && data.settings.activeModelId === defaults.settings.activeModelId
    && data.settings.candidateCount === defaults.settings.candidateCount
    && data.settings.locale === defaults.settings.locale
    && data.settings.globalShortcut === defaults.settings.globalShortcut
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
    facts: mergeById(current.facts, legacy.facts),
    acceptedReplies: mergeById(current.acceptedReplies, legacy.acceptedReplies).slice(-100)
  };
  const changed = JSON.stringify(merged) !== JSON.stringify(current);
  if (changed) await writeDataFile(currentFilePath, merged);
  await writeFile(markerPath, new Date().toISOString(), { encoding: "utf8", mode: 0o600 });
  return changed;
}

export class MemoryStore {
  private data: AppData = cloneDefaults();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  async load(): Promise<AppData> {
    if (this.loaded) return this.data;
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = migrate(JSON.parse(raw) as Partial<AppData>);
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
      contacts: structuredClone(this.data.contacts),
      facts: structuredClone(this.data.facts),
      acceptedReplies: structuredClone(this.data.acceptedReplies)
    };
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

  async saveSettings(settings: AppData["settings"], encryptedApiKeys?: Record<string, string>): Promise<void> {
    this.data.settings = structuredClone(settings);
    if (encryptedApiKeys !== undefined) this.data.encryptedApiKeys = structuredClone(encryptedApiKeys);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await writeDataFile(this.filePath, this.data);
  }
}
