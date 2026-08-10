import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../electron/services/memory-store";

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
});
