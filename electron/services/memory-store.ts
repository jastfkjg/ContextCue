import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
    apiBaseUrl: process.env.HIPLY_API_BASE_URL || "https://api.openai.com/v1",
    model: process.env.HIPLY_MODEL || "gpt-5.6-luna",
    apiProtocol: "responses",
    candidateCount: 3,
    locale: "auto",
    globalShortcut: "CommandOrControl+Shift+Space",
    autoShowOverlay: true
  }
};

function cloneDefaults(): AppData {
  return JSON.parse(JSON.stringify(DEFAULT_DATA)) as AppData;
}

function migrate(input: Partial<AppData>): AppData {
  const defaults = cloneDefaults();
  return {
    ...defaults,
    ...input,
    version: 1,
    profile: { ...defaults.profile, ...(input.profile ?? {}) },
    settings: { ...defaults.settings, ...(input.settings ?? {}) },
    contacts: Array.isArray(input.contacts) ? input.contacts : [],
    facts: Array.isArray(input.facts) ? input.facts : [],
    acceptedReplies: Array.isArray(input.acceptedReplies) ? input.acceptedReplies.slice(-100) : []
  };
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

  settings(apiKeyConfigured: boolean): AppSettings {
    return { ...structuredClone(this.data.settings), apiKeyConfigured };
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

  async saveSettings(settings: AppData["settings"], encryptedApiKey?: string): Promise<void> {
    this.data.settings = structuredClone(settings);
    if (encryptedApiKey !== undefined) this.data.encryptedApiKey = encryptedApiKey;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.data, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
