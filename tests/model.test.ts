import { describe, expect, it, vi } from "vitest";
import type { AppData, GenerateRequest } from "../src/shared/types";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import { buildMemoryContext, generateWithModel, parseModelJson } from "../electron/services/model";

function data(): AppData {
  return {
    ...structuredClone(DEFAULT_DATA),
    profile: { ...DEFAULT_DATA.profile, displayName: "Alex", writingStyle: "Brief and calm" },
    contacts: [{
      id: "lin",
      name: "Lin Yue",
      relation: "Manager",
      channel: "lark",
      tone: "Lead with the conclusion",
      notes: "No emoji",
      customRules: [],
      lastUsedAt: "2026-01-01T00:00:00.000Z"
    }],
    facts: [{ id: "f1", category: "preference", content: "Avoid exclamation marks", contactId: "lin", createdAt: "2026-01-01T00:00:00.000Z", source: "manual" }],
    acceptedReplies: [{ id: "r1", text: "Thursday works. I’ll update it.", channel: "lark", contact: "Lin Yue", createdAt: "2026-01-01T00:00:00.000Z" }]
  };
}

const request: GenerateRequest = { channel: "lark", contact: "Lin Yue", intent: "Agree", locale: "auto" };

describe("model memory and parsing", () => {
  it("selects relevant relationship memory and accepted replies", () => {
    const context = buildMemoryContext(data(), request);
    expect(context).toContain("Lead with the conclusion");
    expect(context).toContain("Avoid exclamation marks");
    expect(context).toContain("Thursday works");
  });

  it("parses fenced JSON and limits candidates", () => {
    const result = parseModelJson(`\`\`\`json\n${JSON.stringify({
      candidates: [
        { text: "One", tone: "Direct", strategy: "Confirm" },
        { text: "Two", tone: "Warm", strategy: "Confirm and add detail" },
        { text: "Three", tone: "Brief", strategy: "Short" }
      ],
      conversation_summary: "A schedule change",
      detected_contact: "Lin Yue",
      detected_language: "English",
      memory_suggestions: [{ category: "relationship", content: "Prefers short answers" }]
    })}\n\`\`\``, 2);
    expect(result.candidates).toHaveLength(2);
    expect(result.detectedContact).toBe("Lin Yue");
    expect(result.memorySuggestions[0].category).toBe("relationship");
  });

  it("ignores extra JSON emitted before or after the reply object", () => {
    const reply = JSON.stringify({
      candidates: [
        { text: "One {confirmed}", tone: "Direct", strategy: "Confirm" },
        { text: "Two", tone: "Warm", strategy: "Alternative" }
      ],
      detected_contact: "Lin Yue",
      detected_language: "English"
    });
    const result = parseModelJson(`{"reasoning":"done"}\n${reply}\n{"usage":{"tokens":42}}`);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].text).toBe("One {confirmed}");
  });

  it("merges partial candidate objects and removes duplicate replies", () => {
    const first = JSON.stringify({
      candidates: [{ text: "One", tone: "Direct", strategy: "Confirm" }],
      detected_contact: "Lin Yue"
    });
    const second = JSON.stringify({
      candidates: [
        { text: "One", tone: "Direct", strategy: "Confirm" },
        { text: "Two", tone: "Warm", strategy: "Alternative" }
      ],
      detected_language: "English"
    });
    const result = parseModelJson(`${first}\n${second}`);
    expect(result.candidates.map((candidate) => candidate.text)).toEqual(["One", "Two"]);
    expect(result.detectedContact).toBe("Lin Yue");
    expect(result.detectedLanguage).toBe("English");
  });

  it("keeps a single usable reply instead of failing the overlay", () => {
    const result = parseModelJson(JSON.stringify({
      candidates: [{ text: "One", tone: "Direct", strategy: "Confirm" }]
    }));
    expect(result.candidates).toHaveLength(1);
  });

  it("accepts a direct array and common reply field aliases", () => {
    const arrayResult = parseModelJson(JSON.stringify(["One", "Two"]));
    const aliasResult = parseModelJson(JSON.stringify({
      replies: [{ text: "Three" }, { text: "Four" }]
    }));
    expect(arrayResult.candidates.map((candidate) => candidate.text)).toEqual(["One", "Two"]);
    expect(aliasResult.candidates.map((candidate) => candidate.text)).toEqual(["Three", "Four"]);
  });

  it("recovers complete candidate text from truncated JSON", () => {
    const result = parseModelJson('{"candidates":[{"text":"One","tone":"Direct"},{"text":"Two"');
    expect(result.candidates.map((candidate) => candidate.text)).toEqual(["One", "Two"]);
  });

  it("sends screenshot and memory through the Responses API", async () => {
    const payload = {
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        candidates: [
          { text: "One", tone: "Direct", strategy: "Confirm" },
          { text: "Two", tone: "Warm", strategy: "Alternative" }
        ],
        conversation_summary: "Summary",
        detected_contact: "Lin Yue",
        detected_language: "English",
        memory_suggestions: []
      }) }] }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    const result = await generateWithModel(data(), "secret", request, "data:image/png;base64,abc", fetcher as typeof fetch);
    expect(result.candidates[0].text).toBe("One");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const body = JSON.parse(String(options?.body));
    expect(JSON.stringify(body)).toContain("data:image/png;base64,abc");
    expect(JSON.stringify(body)).toContain("Lead with the conclusion");
  });

  it("uses the selected model configuration", async () => {
    const configured = data();
    configured.settings.models.push({
      id: "local-vision",
      name: "Local vision",
      apiBaseUrl: "http://localhost:11434/v1",
      model: "qwen3-vl",
      apiProtocol: "chat-completions"
    });
    configured.settings.activeModelId = "local-vision";
    const payload = {
      choices: [{ message: { content: JSON.stringify({
        candidates: [
          { text: "One", tone: "Direct", strategy: "Confirm" },
          { text: "Two", tone: "Warm", strategy: "Alternative" }
        ],
        conversation_summary: "Summary",
        detected_contact: "Lin Yue",
        detected_language: "English",
        memory_suggestions: []
      }) } }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await generateWithModel(configured, "secret", request, "data:image/png;base64,abc", fetcher as typeof fetch);

    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(JSON.parse(String(options?.body)).model).toBe("qwen3-vl");
  });

  it("uses the smaller schema and token budget for quick replies", async () => {
    const configured = data();
    const payload = {
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        candidates: [
          { text: "One", tone: "Direct", strategy: "Confirm" },
          { text: "Two", tone: "Warm", strategy: "Alternative" }
        ],
        detected_contact: "Lin Yue",
        detected_language: "English"
      }) }] }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await generateWithModel(configured, "secret", { ...request, quick: true }, "data:image/png;base64,abc", fetcher as typeof fetch);

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.max_output_tokens).toBe(1040);
    expect(body.text.format.schema.properties.candidates.maxItems).toBe(3);
    expect(body.input[0].content[0].text).toContain("exactly 3 useful replies");
    expect(body.input[1].content[1].detail).toBe("auto");
    expect(body.text.format.schema.properties).not.toHaveProperty("memory_suggestions");
  });

  it("asks Qwen to skip thinking for quick replies", async () => {
    const configured = data();
    configured.settings.models[0].model = "qwen3.7-plus";
    const payload = {
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        candidates: [{ text: "One", tone: "Direct", strategy: "Confirm" }],
        detected_contact: "Lin Yue",
        detected_language: "English"
      }) }] }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await generateWithModel(configured, "secret", { ...request, quick: true }, "data:image/jpeg;base64,abc", fetcher as typeof fetch);

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.input[1].content[0].text).toContain("/no_think");
    expect(body.reasoning).toEqual({ effort: "none" });
  });

  it("uses the Qwen API thinking switch with Chat Completions", async () => {
    const configured = data();
    configured.settings.models[0].model = "qwen3.7-plus";
    configured.settings.models[0].apiProtocol = "chat-completions";
    const payload = {
      choices: [{ message: { content: JSON.stringify({ candidates: ["One"] }) } }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    await generateWithModel(configured, "secret", { ...request, quick: true }, "data:image/jpeg;base64,abc", fetcher as typeof fetch);

    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.enable_thinking).toBe(false);
  });
});
