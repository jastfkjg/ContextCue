import { describe, expect, it } from "vitest";
import { normalizeFrontmostWindow, sameFrontmostWindow, sameNativeWindow } from "../electron/services/front-window";
import { sourceForWindow } from "../electron/services/quick-context";

describe("native foreground window identity", () => {
  it.each(["Safari", "Google Chrome", "Arc", "Discord", "Notes", "WeChat", "Some New App"])("selects %s by ID without a title", (applicationName) => {
    const front = normalizeFrontmostWindow({ windowId: "1234", processId: 41, applicationName }, 999);
    expect(sourceForWindow(front)?.id).toBe("window:1234:0");
  });

  it("never falls back to WeChat, another window, or our own window when identity is missing", () => {
    expect(sourceForWindow({ applicationName: "WeChat", windowTitle: "WeChat" })).toBeUndefined();
    expect(sourceForWindow(normalizeFrontmostWindow({ windowId: "0" }, 999))).toBeUndefined();
    expect(sourceForWindow(normalizeFrontmostWindow({ windowId: "1234", processId: 999 }, 999))).toBeUndefined();
    expect(sourceForWindow(normalizeFrontmostWindow({ windowId: "1234; echo test" }, 999))).toBeUndefined();
  });

  it("distinguishes same-title windows and detects browser tab changes", () => {
    const front = { applicationName: "Browser", windowTitle: "Conversation", windowId: "1234", processId: 41 };
    expect(sameFrontmostWindow(front, { ...front })).toBe(true);
    expect(sameFrontmostWindow(front, { ...front, windowId: "5678" })).toBe(false);
    expect(sameFrontmostWindow(front, { ...front, processId: 42 })).toBe(false);
    expect(sameFrontmostWindow(front, { ...front, windowTitle: "Another tab" })).toBe(false);
    expect(sameNativeWindow(front, { ...front, windowTitle: "Another tab" })).toBe(true);
    expect(sameNativeWindow(front, { ...front, windowId: "5678" })).toBe(false);
    expect(sameNativeWindow(front, { ...front, processId: 42 })).toBe(false);
    expect(sameFrontmostWindow(front, { applicationName: "", windowTitle: "" })).toBe(false);
    expect(sameFrontmostWindow({ ...front, windowTitle: "" }, { ...front, windowTitle: "" })).toBe(true);
  });
});
