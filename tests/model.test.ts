import { describe, expect, it, vi } from "vitest";
import type { AppData, GenerateRequest } from "../src/shared/types";
import { DEFAULT_DATA } from "../electron/services/memory-store";
import {
  askDeltaFromPayload,
  buildMemoryContext,
  generateWithModel,
  parseModelJson,
  responseTokenUsage,
  streamAnswerWithModel,
  testModelConnection
} from "../electron/services/model";

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

const request: GenerateRequest = { includeMemory: true, channel: "lark", contact: "Lin Yue", intent: "Agree", locale: "auto" };

describe("model memory and parsing", () => {
  it("uses saved preference documents without legacy relationships, facts or accepted replies", () => {
    const context = buildMemoryContext(data(), request);
    expect(context).toContain("Warm, concise, natural, and direct");
    expect(context).not.toContain("Lead with the conclusion");
    expect(context).not.toContain("Avoid exclamation marks");
    expect(context).not.toContain("Thursday works");
  });

  it("includes only enabled Markdown files whose scope matches the reply", () => {
    const configured = data();
    const timestamp = "2026-01-01T00:00:00.000Z";
    configured.documents = [
      { id: "global", filename: "global.md", content: "Global context", purpose: "preference", scope: "global", enabled: true, createdAt: timestamp, updatedAt: timestamp },
      { id: "lark", filename: "lark.md", content: "Lark context", scope: "channel", scopeValue: "lark", enabled: true, createdAt: timestamp, updatedAt: timestamp },
      { id: "slack", filename: "slack.md", content: "Slack context", scope: "channel", scopeValue: "slack", enabled: true, createdAt: timestamp, updatedAt: timestamp },
      { id: "lin", filename: "lin.md", content: "Lin context", scope: "person", scopeValue: "Lin Yue", enabled: true, createdAt: timestamp, updatedAt: timestamp },
      { id: "other", filename: "other.md", content: "Other person context", scope: "person", scopeValue: "Someone Else", enabled: true, createdAt: timestamp, updatedAt: timestamp },
      { id: "paused", filename: "paused.md", content: "Paused context", scope: "global", enabled: false, createdAt: timestamp, updatedAt: timestamp }
    ];

    const context = buildMemoryContext(configured, request);
    expect(context).toContain("Global context");
    expect(context).toContain("Lark context");
    expect(context).toContain("Lin context");
    expect(context).not.toContain("Slack context");
    expect(context).not.toContain("Other person context");
    expect(context).not.toContain("Paused context");
  });

  it("never reuses accepted examples, even when the scenario matches", () => {
    const configured = data();
    configured.acceptedReplies = [
      { id: "reply", text: "Chat-style answer", channel: "other", contact: "", scenario: "reply", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "form", text: "Product designer", channel: "other", contact: "", scenario: "form", applicationName: "Safari", createdAt: "2026-01-01T00:00:00.000Z" }
    ];
    const context = buildMemoryContext(configured, {
      includeMemory: true,
      channel: "other",
      locale: "auto",
      scenario: "auto",
      target: {
        platform: "darwin",
        appId: "com.apple.Safari",
        applicationName: "Safari",
        windowTitle: "Profile",
        controlId: "role",
        role: "text-field",
        label: "Role",
        multiline: false,
        sensitive: false
      }
    });

    expect(context).not.toContain("Product designer");
    expect(context).not.toContain("Chat-style answer");
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

  it("normalizes token usage from Responses and Chat Completions providers", () => {
    expect(responseTokenUsage({ usage: {
      input_tokens: 1200,
      output_tokens: 240,
      total_tokens: 1440,
      input_tokens_details: { cached_tokens: 300 },
      output_tokens_details: { reasoning_tokens: 80 }
    } }, 812.4)).toEqual({
      inputTokens: 1200,
      outputTokens: 240,
      totalTokens: 1440,
      cachedTokens: 300,
      reasoningTokens: 80,
      reported: true,
      latencyMs: 812
    });
    expect(responseTokenUsage({ usage: { prompt_tokens: 900, completion_tokens: 100 } })).toMatchObject({
      inputTokens: 900,
      outputTokens: 100,
      totalTokens: 1000,
      reported: true
    });
    expect(responseTokenUsage({})).toMatchObject({ totalTokens: 0, reported: false });
  });

  it("extracts ask deltas from both supported streaming protocols", () => {
    expect(askDeltaFromPayload({ type: "response.output_text.delta", delta: "Hello" }, "responses")).toBe("Hello");
    expect(askDeltaFromPayload({ choices: [{ delta: { content: "你好" } }] }, "chat-completions")).toBe("你好");
    expect(askDeltaFromPayload({ choices: [{ delta: { reasoning_content: "hidden" } }] }, "chat-completions")).toBe("");
  });

  it("streams compact contextual answers through the Responses API", async () => {
    const encoder = new TextEncoder();
    const events = [
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "It means " })}\n\n`,
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Thursday." })}\n\n`,
      `data: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 120, output_tokens: 12, total_tokens: 132 } } })}\n\n`,
      "data: [DONE]\n\n"
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(events.slice(0, 71)));
        controller.enqueue(encoder.encode(events.slice(71)));
        controller.close();
      }
    });
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" }
    }));
    const deltas: string[] = [];
    const result = await streamAnswerWithModel(
      data(),
      "secret",
      "What does this mean?",
      "data:image/png;base64,abc",
      [],
      { applicationName: "Lark", windowTitle: "Lin Yue" },
      (delta) => deltas.push(delta),
      new AbortController().signal,
      fetcher as typeof fetch
    );

    expect(deltas).toEqual(["It means ", "Thursday."]);
    expect(result.answer).toBe("It means Thursday.");
    expect(result.tokenUsage).toMatchObject({ totalTokens: 132, reported: true });
    const [, options] = fetcher.mock.calls[0]!;
    const body = JSON.parse(String(options?.body));
    expect(body.stream).toBe(true);
    expect(body.text).toBeUndefined();
    expect(JSON.stringify(body)).toContain("data:image/png;base64,abc");
  });

  it("allows text-only Ask AI requests when page context is excluded", async () => {
    const configured = data();
    configured.settings.models[0].apiProtocol = "chat-completions";
    configured.settings.models[0].supportsImageInput = false;
    const payload = {
      choices: [{ message: { content: "A concise answer." } }],
      usage: { prompt_tokens: 20, completion_tokens: 4, total_tokens: 24 }
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));
    const deltas: string[] = [];
    const result = await streamAnswerWithModel(
      configured,
      "secret",
      "A general question",
      "",
      [],
      undefined,
      (delta) => deltas.push(delta),
      new AbortController().signal,
      fetcher as typeof fetch
    );

    expect(result.answer).toBe("A concise answer.");
    expect(deltas).toEqual(["A concise answer."]);
    const [, options] = fetcher.mock.calls[0]!;
    expect(String(options?.body)).not.toContain("image_url");
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

  it("recovers common candidate body aliases and ignores null or malformed entries", () => {
    const result = parseModelJson(JSON.stringify({
      candidates: [null, 42, {}, { label: "Not a draft" }, { reply: "First draft" }, { text: " ", content: "Second draft" }],
      memory_suggestions: [null]
    }));
    expect(result.candidates.map((candidate) => candidate.text)).toEqual(["First draft", "Second draft"]);
    expect(result.memorySuggestions).toEqual([]);
  });

  it.each([
    [[], "empty suggestion list"],
    [[{ text: " " }, { label: "Only metadata" }], "without readable text"]
  ])("distinguishes empty candidates from candidates missing text: %j", (candidates, message) => {
    expect(() => parseModelJson(JSON.stringify({ candidates }))).toThrow(String(message));
  });

  it.each(["responses", "chat-completions"] as const)("recovers empty %s output once using the original screenshot and records both requests' usage", async (protocol) => {
    const configured = data();
    configured.settings.models[0].apiProtocol = protocol;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const text = JSON.stringify({ candidates: fetcher.mock.calls.length === 1 ? [] : [{ text: "Recovered draft" }] });
      const payload = protocol === "responses" ? { output_text: text } : { choices: [{ message: { content: text }, finish_reason: "stop" }] };
      return Response.json({ ...payload, usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } });
    });
    const result = await generateWithModel(configured, "test-key", { ...request, quick: true }, "data:image/png;base64,original", fetcher as typeof fetch);
    expect(result.candidates[0].text).toBe("Recovered draft");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const bodies = fetcher.mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(JSON.stringify(bodies[1])).toContain("previous response had no readable candidates");
    for (const body of bodies) expect(JSON.stringify(body)).toContain("data:image/png;base64,original");
    expect(result.tokenUsage).toMatchObject({ inputTokens: 20, outputTokens: 10, totalTokens: 30, reported: true });
  });

  it("stops after one format recovery and logs structure without generated text or keys", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const fetcher = vi.fn(async () => Response.json({ output_text: JSON.stringify({ candidates: [], conversation_summary: "private page contents" }) }));
      await expect(generateWithModel(data(), "private-api-key", request, "data:image/png;base64,private", fetcher as typeof fetch)).rejects.toThrow("empty suggestion list");
      expect(fetcher).toHaveBeenCalledTimes(2);
      const diagnostics = JSON.stringify(warn.mock.calls);
      expect(diagnostics).toContain('"kind":"empty"');
      expect(diagnostics).not.toContain("private");
    } finally { warn.mockRestore(); }
  });

  it("retries malformed output without treating commentary as a candidate", async () => {
    const fetcher = vi.fn(async () => Response.json({ output_text: fetcher.mock.calls.length === 1
      ? "The conversation seems to need a reply."
      : JSON.stringify({ candidates: ["A complete draft"] }) }));
    const result = await generateWithModel(data(), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch);
    expect(result.candidates.map((candidate) => candidate.text)).toEqual(["A complete draft"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("increases the recovery budget only when unusable output was truncated", async () => {
    const configured = data();
    configured.settings.models[0].apiProtocol = "chat-completions";
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ choices: [{
      message: { content: fetcher.mock.calls.length === 1 ? '{"candidates":[{"text":"unfinished' : '{"candidates":[{"text":"Finished"}]}' },
      finish_reason: fetcher.mock.calls.length === 1 ? "length" : "stop"
    }] }));
    await generateWithModel(configured, "test-key", { ...request, quick: true }, "data:image/png;base64,fixture", fetcher as typeof fetch);
    const bodies = fetcher.mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(bodies.map((body) => body.max_tokens)).toEqual([1040, 2080]);
  });

  it.each([
    { choices: [{ finish_reason: "content_filter", message: { content: '{"candidates":[]}' } }] },
    { choices: [{ message: { refusal: "Declined", content: '{"candidates":[]}' } }] },
    { output: [{ content: [{ type: "refusal", refusal: "Declined" }] }] }
  ])("does not retry a provider refusal or filtered response: %j", async (payload) => {
    const fetcher = vi.fn(async () => Response.json(payload));
    await expect(generateWithModel(data(), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch)).rejects.toThrow("declined");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not retry an HTTP error", async () => {
    const fetcher = vi.fn(async () => Response.json({ error: { message: "Rate limited" } }, { status: 429 }));
    await expect(generateWithModel(data(), "test-key", request, "data:image/png;base64,fixture", fetcher as typeof fetch)).rejects.toThrow("Rate limited");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("blocks text-only models before sending a context-free request", async () => {
    const configured = data();
    configured.settings.models[0].name = "DeepSeek Flash";
    configured.settings.models[0].model = "deepseek-v4-flash";
    configured.settings.models[0].supportsImageInput = false;
    const fetcher = vi.fn();

    await expect(generateWithModel(
      configured,
      "secret",
      request,
      "data:image/png;base64,abc",
      fetcher as typeof fetch
    )).rejects.toThrow("text-only model");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends screenshot and memory through the Responses API", async () => {
    const payload = {
      usage: { input_tokens: 1800, output_tokens: 260, total_tokens: 2060 },
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
    expect(result.tokenUsage).toMatchObject({ inputTokens: 1800, outputTokens: 260, totalTokens: 2060, reported: true });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    const body = JSON.parse(String(options?.body));
    expect(JSON.stringify(body)).toContain("data:image/png;base64,abc");
    expect(JSON.stringify(body)).toContain("Warm, concise, natural, and direct");
  });

  it("uses the selected model configuration", async () => {
    const configured = data();
    configured.settings.models.push({
      id: "local-vision",
      name: "Local vision",
      apiBaseUrl: "http://localhost:11434/v1",
      model: "qwen3-vl",
      apiProtocol: "chat-completions",
      supportsImageInput: true
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

  it("uses Alibaba Chat Completions for private Base64 screenshots", async () => {
    const configured = data();
    configured.settings.models.push({
      id: "qwen-plus",
      name: "Qwen Plus",
      apiBaseUrl: "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.7-plus",
      apiProtocol: "responses",
      supportsImageInput: true
    });
    configured.settings.activeModelId = "qwen-plus";
    const payload = {
      choices: [{ message: { content: JSON.stringify({
        candidates: [{ text: "Relevant reply", tone: "Direct", strategy: "Reply" }],
        detected_contact: "",
        detected_language: "Chinese"
      }) } }]
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await generateWithModel(
      configured,
      "secret",
      { ...request, quick: true },
      "data:image/jpeg;base64,private-screenshot",
      fetcher as typeof fetch
    );

    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions");
    const body = JSON.parse(String(options?.body));
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,private-screenshot");
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
    expect(body.input[0].content[0].text).toContain("up to 3 useful text candidates");
    expect(body.input[1].content[1].detail).toBe("auto");
    expect(body.text.format.schema.properties).not.toHaveProperty("memory_suggestions");
  });

  it("parses a form assistance result with an explicit write action", () => {
    const result = parseModelJson(JSON.stringify({
      scenario: "form",
      task_label: "Complete company description",
      candidates: [{
        text: "ContextCue is a private desktop writing assistant.",
        tone: "Clear",
        strategy: "Concise description",
        label: "Concise",
        action: "replace-all"
      }]
    }));

    expect(result.scenario).toBe("form");
    expect(result.taskLabel).toBe("Complete company description");
    expect(result.candidates[0]).toMatchObject({ action: "replace-all", label: "Concise" });
  });

  it("lets the screenshot determine the task when no editable field is available", async () => {
    const payload = { output: [{ content: [{ type: "output_text", text: JSON.stringify({
      scenario: "generic", candidates: [{ text: "A useful prompt", tone: "Clear", strategy: "Next step" }]
    }) }] }] };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));
    await generateWithModel(data(), "test-key", { channel: "other", locale: "auto", quick: true, scenario: "auto" }, "data:image/png;base64,fixture", fetcher as typeof fetch);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body.input[1].content[0].text).toContain("Scenario hint: auto");
    expect(body.input[1].content[1].image_url).toBe("data:image/png;base64,fixture");
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

  it("tests the configured protocol with a minimal authenticated request", async () => {
    const configuration = {
      id: "openai",
      name: "OpenAI",
      apiBaseUrl: "https://api.openai.com/v1/",
      model: "gpt-5.6",
      apiProtocol: "responses" as const,
      supportsImageInput: true,
      apiKeyConfigured: true
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ output_text: "OK" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }));

    const result = await testModelConnection(configuration, "secret", fetcher as typeof fetch);

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect((options?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    expect(JSON.parse(String(options?.body))).toMatchObject({ model: "gpt-5.6", max_output_tokens: 16 });
  });

  it("surfaces the provider message when a connection test fails", async () => {
    const configuration = {
      id: "local",
      name: "Compatible provider",
      apiBaseUrl: "https://example.com/v1",
      model: "vision-model",
      apiProtocol: "chat-completions" as const,
      supportsImageInput: true,
      apiKeyConfigured: false
    };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ error: { message: "Unknown model" } }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    }));

    await expect(testModelConnection(configuration, "secret", fetcher as typeof fetch)).rejects.toThrow("Unknown model");
  });
});
