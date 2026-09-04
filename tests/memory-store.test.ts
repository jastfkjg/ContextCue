import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { importLegacyBrandData, MemoryStore } from "../electron/services/memory-store";

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("MemoryStore", () => {
  it("persists first-run completion without changing credentials or memory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-setup-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    expect(store.settings(new Set()).onboardingComplete).toBe(false);
    await store.saveSettings(store.getData().settings, { "openai-default": "encrypted-test-key" });
    const memory = store.snapshot();
    await store.saveSettings({ ...store.getData().settings, onboardingComplete: true });
    const next = new MemoryStore(path);
    await next.load();
    expect(next.settings(new Set()).onboardingComplete).toBe(true);
    expect(next.getData().encryptedApiKeys).toEqual({ "openai-default": "encrypted-test-key" });
    expect(next.snapshot()).toEqual(memory);
  });

  it("does not force an already configured legacy install through onboarding", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-setup-migration-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    const { onboardingComplete: _complete, ...legacy } = store.getData().settings;
    await store.saveSettings(legacy, { "openai-default": "encrypted-test-key" });
    const reloaded = new MemoryStore(path);
    await reloaded.load();
    expect(reloaded.settings(new Set()).onboardingComplete).toBe(true);
    expect(reloaded.getData().encryptedApiKeys?.["openai-default"]).toBe("encrypted-test-key");
  });
  it("persists profile, relationships, facts, and accepted replies", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    await store.saveProfile({ ...store.snapshot().profile, displayName: "Alex" });
    await store.saveContact({ id: "contact", name: "Lin Yue", relation: "Manager", channel: "lark", tone: "Concise", notes: "", customRules: [], lastUsedAt: new Date().toISOString() });
    await store.addFact({ category: "preference", content: "No emoji", contactId: "contact", source: "manual" });
    await store.rememberAcceptedSuggestion({
      text: "Thursday works.",
      channel: "lark",
      contact: "Lin Yue",
      scenario: "reply",
      applicationName: "Lark",
      controlId: "message-box"
    });

    const reloaded = new MemoryStore(path);
    await reloaded.load();
    expect(reloaded.snapshot().profile.displayName).toBe("Alex");
    expect(reloaded.snapshot().contacts[0].tone).toBe("Concise");
    expect(reloaded.snapshot().facts[0].content).toBe("No emoji");
    expect(reloaded.snapshot().acceptedReplies[0].text).toBe("Thursday works.");
    expect(reloaded.snapshot().acceptedReplies[0]).toMatchObject({ scenario: "reply", applicationName: "Lark", controlId: "message-box" });
    expect(reloaded.getData().version).toBe(2);
    expect((await readFile(path, "utf8"))).not.toContain("secret-api-key");
  });

  it("does not duplicate the same memory fact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-test-"));
    temporaryDirectories.push(directory);
    const store = new MemoryStore(join(directory, "data.json"));
    await store.load();
    await store.addFact({ category: "preference", content: "No emoji", source: "manual" });
    await store.addFact({ category: "preference", content: "no emoji", source: "manual" });
    expect(store.snapshot().facts).toHaveLength(1);
  });

  it("persists token usage with configured model snapshots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-usage-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    await store.recordTokenUsage({
      modelId: "work-openai",
      modelName: "OpenAI work",
      model: "gpt-5.6",
      apiProtocol: "responses",
      requestType: "quick-reply",
      channel: "lark",
      inputTokens: 1200,
      outputTokens: 180,
      totalTokens: 1380,
      cachedTokens: 200,
      reasoningTokens: 40,
      reported: true,
      latencyMs: 760
    });

    const records = new MemoryStore(path);
    await records.load();
    expect(records.tokenUsage().records[0]).toMatchObject({
      modelId: "work-openai",
      model: "gpt-5.6",
      totalTokens: 1380,
      requestType: "quick-reply"
    });
  });

  it("persists, updates, and removes Markdown memory files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-documents-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    const now = new Date().toISOString();
    await store.saveMemoryDocument({
      id: "project-context",
      filename: "project-context",
      content: "# Project\r\n\r\nBuild ContextCue",
      scope: "person",
      scopeValue: " Lin Yue ",
      enabled: true,
      createdAt: now,
      updatedAt: now
    });

    const reloaded = new MemoryStore(path);
    await reloaded.load();
    const document = reloaded.snapshot().documents.find((item) => item.id === "project-context");
    expect(document).toMatchObject({ filename: "project-context.md", scopeValue: "Lin Yue" });
    expect(document?.content).toBe("# Project\n\nBuild ContextCue");

    await reloaded.deleteMemoryDocument("project-context");
    expect(reloaded.snapshot().documents.some((item) => item.id === "project-context")).toBe(false);
  });

  it("serializes overlapping Markdown autosaves without losing a file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-autosave-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    const now = new Date().toISOString();
    const base = { filename: "note.md", content: "# Note", scope: "global" as const, enabled: true, createdAt: now, updatedAt: now };

    await Promise.all([
      store.saveMemoryDocument({ ...base, id: "one", filename: "one.md" }),
      store.saveMemoryDocument({ ...base, id: "two", filename: "two.md" })
    ]);

    const documents = (await new MemoryStore(path).load()).documents;
    expect(documents.some((item) => item.id === "one")).toBe(true);
    expect(documents.some((item) => item.id === "two")).toBe(true);
  });

  it("turns legacy profiles and relationships into Markdown memory files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-documents-migration-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(path, JSON.stringify({
      version: 1,
      profile: { displayName: "Alex", writingStyle: "Brief and calm" },
      contacts: [{ id: "lin", name: "Lin Yue", relation: "Manager", channel: "lark", tone: "Direct", notes: "", customRules: [], lastUsedAt: "2026-01-01T00:00:00.000Z" }]
    })));

    const loaded = await new MemoryStore(path).load();
    expect(loaded.documents.find((item) => item.filename === "profile.md")?.content).toContain("Alex");
    expect(loaded.documents.find((item) => item.filename === "preferences.md")?.content).toContain("Brief and calm");
    expect(loaded.documents.find((item) => item.filename === "lin-yue.md")).toMatchObject({ scope: "person", scopeValue: "Lin Yue" });
  });

  it("migrates the legacy single-model settings without losing its encrypted key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(path, JSON.stringify({
      version: 1,
      settings: {
        apiBaseUrl: "https://legacy.example/v1",
        model: "legacy-vision",
        apiProtocol: "chat-completions",
        candidateCount: 4
      },
      encryptedApiKey: "encrypted-value"
    })));

    const store = new MemoryStore(path);
    const loaded = await store.load();

    expect(loaded.settings.models[0]).toMatchObject({
      apiBaseUrl: "https://legacy.example/v1",
      model: "legacy-vision",
      apiProtocol: "chat-completions"
    });
    expect(loaded.settings.activeModelId).toBe(loaded.settings.models[0].id);
    expect(loaded.settings.askShortcut).toBe("CommandOrControl+Shift+Enter");
    expect(loaded.encryptedApiKeys?.[loaded.settings.activeModelId]).toBe("encrypted-value");
  });

  it("marks an existing DeepSeek text model as unable to read screenshots", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(path, JSON.stringify({
      version: 1,
      settings: {
        models: [{
          id: "deepseek",
          name: "DeepSeek",
          apiBaseUrl: "https://example.com/v1",
          model: "deepseek-v4-flash",
          apiProtocol: "chat-completions"
        }],
        activeModelId: "deepseek"
      }
    })));

    const loaded = await new MemoryStore(path).load();
    expect(loaded.settings.models[0].supportsImageInput).toBe(false);
  });

  it("imports models and encrypted keys from the former Hiply data file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-brand-test-"));
    temporaryDirectories.push(directory);
    const currentPath = join(directory, "contextcue", "contextcue-data.json");
    const legacyPath = join(directory, "hiply", "hiply-data.json");
    const current = new MemoryStore(currentPath);
    await current.load();
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(join(directory, "hiply"), { recursive: true });
      await writeFile(legacyPath, JSON.stringify({
        version: 1,
        settings: {
          models: [
            { id: "openai-default", name: "OpenAI", apiBaseUrl: "https://api.openai.com/v1", model: "gpt-5.6-luna", apiProtocol: "responses" },
            { id: "qwen", name: "Qwen", apiBaseUrl: "https://qwen.example/v1", model: "qwen3.7-plus", apiProtocol: "responses" }
          ],
          activeModelId: "qwen",
          candidateCount: 4
        },
        encryptedApiKeys: { qwen: "encrypted-qwen-key" }
      }));
    });

    expect(await importLegacyBrandData(currentPath, legacyPath)).toBe(true);
    const restored = new MemoryStore(currentPath);
    const loaded = await restored.load();
    expect(loaded.settings.models.map((model) => model.id)).toEqual(["openai-default", "qwen"]);
    expect(loaded.settings.activeModelId).toBe("qwen");
    expect(loaded.settings.candidateCount).toBe(4);
    expect(loaded.encryptedApiKeys?.qwen).toBe("encrypted-qwen-key");
    expect(JSON.parse(await readFile(legacyPath, "utf8")).settings.activeModelId).toBe("qwen");
    expect(await importLegacyBrandData(currentPath, legacyPath)).toBe(false);
  });
});

describe("Ask-first shortcuts", () => {
  it("uses Ask AI as the primary shortcut on a fresh install and keeps it after reload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-shortcuts-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    expect(store.getData().settings.askShortcut).toBe("CommandOrControl+Shift+Space");
    expect(store.getData().settings.globalShortcut).toBe("CommandOrControl+Shift+Enter");
    const reloaded = new MemoryStore(path);
    await reloaded.load();
    expect(reloaded.getData().settings).toEqual(store.getData().settings);
  });
  it("preserves existing custom shortcuts", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-shortcuts-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    await store.saveSettings({ ...store.getData().settings, globalShortcut: "Alt+Shift+R", askShortcut: "Alt+Shift+A" });
    const reloaded = new MemoryStore(path);
    await reloaded.load();
    expect(reloaded.getData().settings.globalShortcut).toBe("Alt+Shift+R");
    expect(reloaded.getData().settings.askShortcut).toBe("Alt+Shift+A");
  });
});
