import { describe, expect, it } from "vitest";
import { createPageSession, pageRequest, rememberPageTurn } from "../electron/services/page-session";
import { buildMemoryContext } from "../electron/services/model";
import { DEFAULT_DATA } from "../electron/services/memory-store";

function session(applicationName = "WeChat", windowId = "100", windowTitle = "Alice") {
  return createPageSession({ frontmost: { applicationName, windowId, windowTitle }, target: null,
    source: { id: `window:${windowId}:0`, name: windowTitle, channel: applicationName === "WeChat" ? "wechat" : "other" },
    screenshot: `data:image/png;base64,${applicationName}` });
}

describe("page-only sessions", () => {
  it("starts with fresh history, screenshot and identity even for the same window", () => {
    const wechat = session();
    rememberPageTurn(wechat, "Private WeChat question", "Private answer");
    wechat.result = { candidates: [{ text: "WeChat draft", tone: "", strategy: "" }], conversationSummary: "", detectedContact: "Alice", detectedLanguage: "zh", memorySuggestions: [], generatedAt: "" };
    for (const current of [session("Browser", "200", "Search"), session(), session("Browser", "200", "Another tab")]) {
      expect(current.id).not.toBe(wechat.id);
      expect(current.history).toEqual([]);
      expect(current.result).toBeUndefined();
      expect(current.hasSuggestions).toBe(false);
    }
    expect(session("Browser", "200").screenshot).not.toContain("WeChat");
  });

  it("isolates conversations and unscoped background while allowing enabled writing preferences", () => {
    const data = structuredClone(DEFAULT_DATA);
    data.profile.about = "Private WeChat topic";
    data.documents[0].content = "Private WeChat topic";
    data.facts = [{ id: "secret", content: "Private WeChat topic", category: "follow-up", source: "model-suggestion", createdAt: "" }];
    data.acceptedReplies = [{ id: "old", text: "Private WeChat topic", channel: "other", contact: "", createdAt: "" }];
    const request = pageRequest(session("Browser", "200", "Browser page"), "auto");
    expect(request.contextPolicy).toBe("page-only");
    expect(request.includeMemory).toBe(true);
    expect(buildMemoryContext(data, request)).toContain("Communication preferences");
    expect(buildMemoryContext(data, request)).not.toContain("Private WeChat");
    expect(request.pageContext?.windowTitle).toBe("Browser page");
  });

  it("keeps only completed turns owned by that invocation", () => {
    const current = session();
    for (let i = 0; i < 5; i++) rememberPageTurn(current, `Q${i}`, `A${i}`);
    expect(current.history).toHaveLength(6);
    expect(current.history[0].content).toBe("Q2");
    expect(session().history).toEqual([]);
  });
});
