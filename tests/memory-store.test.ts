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
  it("persists profile, relationships, facts, and accepted replies", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contextcue-test-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "data.json");
    const store = new MemoryStore(path);
    await store.load();
    await store.saveProfile({ ...store.snapshot().profile, displayName: "Alex" });
    await store.saveContact({ id: "contact", name: "Lin Yue", relation: "Manager", channel: "lark", tone: "Concise", notes: "", customRules: [], lastUsedAt: new Date().toISOString() });
    await store.addFact({ category: "preference", content: "No emoji", contactId: "contact", source: "manual" });
    await store.rememberAcceptedReply({ text: "Thursday works.", channel: "lark", contact: "Lin Yue" });

    const reloaded = new MemoryStore(path);
    await reloaded.load();
    expect(reloaded.snapshot().profile.displayName).toBe("Alex");
    expect(reloaded.snapshot().contacts[0].tone).toBe("Concise");
    expect(reloaded.snapshot().facts[0].content).toBe("No emoji");
    expect(reloaded.snapshot().acceptedReplies[0].text).toBe("Thursday works.");
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
