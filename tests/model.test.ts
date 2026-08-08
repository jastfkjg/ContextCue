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
});
