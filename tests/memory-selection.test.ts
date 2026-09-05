import { describe, expect, it, vi } from "vitest";
import { memoryTask, selectMemory } from "../src/shared/memory-selection";
import type { MemoryDocument } from "../src/shared/types";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import { generateWithModel, streamAnswerWithModel } from "../electron/services/model";

const note = (id: string, patch: Partial<MemoryDocument> = {}): MemoryDocument => ({
  id, filename: `${id}.md`, content: `NOTE_${id}`, scope: "global", enabled: true,
  purpose: "background", createdAt: "2026-01-01", updatedAt: "2026-01-02", ...patch
});
const documents = [
  note("preferences", { purpose: "preference" }),
  note("project", { matchTerms: "ContextCue, 核心项目" }),
  note("unrelated"),
  note("work", { scope: "channel", scopeValue: "slack" }),
  note("alice", { scope: "person", scopeValue: "Alice" }),
  note("disabled", { enabled: false, purpose: "preference" })
];
const select = (input: string, patch = {}) => selectMemory(documents, { enabled: true, task: "ask", input, ...patch });
const ids = (usage: ReturnType<typeof select>) => usage.sources.map((source) => source.id);

describe("controlled memory selection", () => {
  it.each(["Draft a reply", "帮我回复他", "帮我婉拒", "Rewrite this", "Make it shorter", "写一封邮件"])("uses writing preferences for %s", (input) => {
    expect(ids(select(input))).toEqual(["preferences"]);
  });
  it.each(["Summarize this page", "Translate the selected text", "解释这页代码", "这页讲了什么", "如何写邮件", "What is a reply header?"])("does not use personal notes for %s", (input) => {
    expect(ids(select(input, { channel: "slack", windowTitle: "ContextCue" }))).toEqual([]);
  });
  it("matches topic phrases and channel only after selecting a relevant task", () => {
    expect(ids(select("Draft a ContextCue update", { channel: "slack" }))).toEqual(["preferences", "project", "work"]);
    expect(ids(select("结合我的核心项目分析这个方案"))).toEqual(["project"]);
    expect(ids(select("Draft about ContextCueExtra"))).toEqual(["preferences"]);
    expect(ids(select("Explain project.md"))).toEqual(["project"]);
    expect(ids(select("Explain disabled.md"))).toEqual([]);
  });
  it("requires an exact recipient or communication-window title, never a substring or model guess", () => {
    expect(ids(select("Draft a reply", { channel: "slack", windowTitle: "Alice" }))).toContain("alice");
    expect(ids(select("Draft a reply", { channel: "slack", windowTitle: "Alice and Bob" }))).not.toContain("alice");
    expect(ids(select("Draft a reply", { channel: "other", windowTitle: "Alice" }))).not.toContain("alice");
    expect(ids(select("Write a reply to Alice"))).toContain("alice");
    expect(ids(select("Write a reply to AliceExtra"))).not.toContain("alice");
    expect(ids(select("Write something mentioning Alice"))).not.toContain("alice");
  });
  it("turns everything off independently of task, file reference or scope", () => {
    expect(select("Draft a reply using project.md", { enabled: false, channel: "slack", contact: "Alice" })).toEqual({ enabled: false, reason: "off", sources: [] });
  });
  it("bounds submitted content and strips private HTML comments", () => {
    const result = selectMemory(Array.from({ length: 12 }, (_, i) => note(`${i}`, { purpose: "preference", content: `<!--hidden-->${"X".repeat(3_000)}` })), { enabled: true, task: "writing", input: "" });
    expect(result.sources.map((source) => source.content).join("")).toHaveLength(8_000);
    expect(result.sources.every((source) => source.content.length <= 2_000)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("hidden");
  });
  it("uses the explicit current task, not a keyword in quoted page metadata", () => {
    expect(memoryTask("Explain how to write a reply")).toBe("none");
    expect(memoryTask("按我的风格改写这段话")).toBe("writing");
  });
});

describe.each(["responses", "chat-completions"] as const)("Memory in %s payloads", (protocol) => {
  const setup = () => {
    const data = structuredClone(DEFAULT_DATA);
    data.documents = structuredClone(documents);
    data.profile.about = "SECRET_LEGACY_PROFILE";
    data.facts = [{ id: "old", category: "preference", content: "SECRET_FACT", source: "manual", createdAt: "" }];
    data.acceptedReplies = [{ id: "old", text: "SECRET_ACCEPTED_REPLY", channel: "other", contact: "", createdAt: "" }];
    data.settings.models[0].apiProtocol = protocol;
    return data;
  };
  const response = (text: string) => Response.json(protocol === "responses" ? { output_text: text } : { choices: [{ message: { content: text } }] });

  it("sends selected writing notes and returns exact provenance even during streamed revisions", async () => {
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => response('{"candidates":[{"text":"Draft","memoryUsage":{"sources":[{"id":"forged"}]}}]}'));
    const seen = vi.fn();
    const result = await generateWithModel(setup(), "key", { channel: "other", locale: "auto", contextPolicy: "page-only", includeMemory: true, revision: { text: "Original", instruction: "Shorter" } }, "data:image/png;base64,PAGE", fetcher, undefined, seen);
    const body = String(fetcher.mock.calls[0][1]?.body);
    expect(body).toContain("NOTE_preferences");
    for (const excluded of ["NOTE_project", "NOTE_unrelated", "NOTE_alice", "NOTE_disabled", "SECRET_LEGACY_PROFILE", "SECRET_FACT", "SECRET_ACCEPTED_REPLY"]) expect(body).not.toContain(excluded);
    expect(result.memoryUsage?.sources).toEqual([expect.objectContaining({ id: "preferences", content: "NOTE_preferences" })]);
    expect(seen.mock.calls[0][0].memoryUsage).toEqual(result.memoryUsage);
    expect(body).toContain("current instruction overrides");
    expect(body).toContain("not proof of current status");
  });
  it.each([true, false])("Ask writing uses Memory independently of screenshot (page=%s)", async (page) => {
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => response('CONTEXTCUE_DRAFT\n{"candidates":[{"text":"Reply"}]}'));
    const result = await streamAnswerWithModel(setup(), "key", "Draft a reply", page ? "data:image/png;base64,PAGE" : "", [], undefined, () => {}, new AbortController().signal, fetcher, { enabled: true });
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain("NOTE_preferences");
    expect(result.draft?.memoryUsage).toEqual(result.memoryUsage);
    expect(result.draft?.candidates[0].memoryUsage).toEqual(result.memoryUsage);
  });
  it.each(["Explain the page", "Translate this paragraph"])("does not submit irrelevant notes for %s", async (question) => {
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => response("Answer"));
    const result = await streamAnswerWithModel(setup(), "key", question, "", [], { applicationName: "Slack", windowTitle: "Alice" }, () => {}, new AbortController().signal, fetcher, { enabled: true, channel: "slack" });
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain("NOTE_");
    expect(result.memoryUsage?.reason).toBe("not-needed");
  });
  it("reports prior draft influence without injecting its source notes again", async () => {
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => response('{"candidates":[{"text":"Revised"}]}'));
    const inherited = [{ id: "old-note", filename: "old.md", content: "OLD_NOTE_SOURCE", updatedAt: "2026-01-01" }];
    const result = await generateWithModel(setup(), "key", { channel: "other", locale: "auto", includeMemory: false, revision: { text: "A chosen draft", instruction: "Shorter" } }, "data:image/png;base64,PAGE", fetcher, undefined, undefined, inherited);
    expect(result.memoryUsage).toMatchObject({ enabled: false, sources: [], inheritedSources: inherited });
    expect(String(fetcher.mock.calls[0][1]?.body)).not.toContain("OLD_NOTE_SOURCE");
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain("A chosen draft");
  });
  it("omits Memory in both writing and Ask requests when disabled", async () => {
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) => response('{"candidates":[{"text":"Reply"}]}'));
    await generateWithModel(setup(), "key", { channel: "slack", contact: "Alice", locale: "auto", includeMemory: false }, "data:image/png;base64,PAGE", fetcher);
    await streamAnswerWithModel(setup(), "key", "Write a reply using project.md", "", [], undefined, () => {}, new AbortController().signal, fetcher, { enabled: false });
    for (const [, init] of fetcher.mock.calls) expect(String(init?.body)).not.toContain("NOTE_");
  });
});
