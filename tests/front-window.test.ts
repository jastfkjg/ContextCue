import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { MAC_FRONT_WINDOW_SCRIPT, normalizeFrontmostWindow, sameFrontmostWindow, sameNativeWindow } from "../electron/services/front-window";
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

describe("macOS window-ID lookup script", () => {
  function lookup(requestedId = "") {
    const record = (id: number, pid: number) => ({
      kCGWindowNumber: id, kCGWindowOwnerPID: pid, kCGWindowOwnerName: `App ${pid}`,
      kCGWindowName: "Same title", kCGWindowLayer: 0, kCGWindowAlpha: 1,
      kCGWindowBounds: { X: 0, Y: 0, Width: 420, Height: 340 }
    });
    const native = {
      NSWorkspace: { sharedWorkspace: { frontmostApplication: { processIdentifier: 202, localizedName: "Other app" } } },
      CGWindowListCopyWindowInfo: () => [record(999, 999), record(202, 202), record(101, 101)],
      NSRunningApplication: { runningApplicationWithProcessIdentifier: (pid: number) => ({ bundleIdentifier: `app.${pid}` }) }
    };
    return JSON.parse(runInNewContext(`${MAC_FRONT_WINDOW_SCRIPT}\nrun(["999", ${JSON.stringify(requestedId)}]);`, {
      $: native, ObjC: { import() {}, unwrap: (value: unknown) => value, deepUnwrap: (value: unknown) => value, castRefToObject: (value: unknown) => value }
    }));
  }
  it("selects the original background window even when another same-title window is in front", () => {
    expect(lookup("101")).toMatchObject({ windowId: "101", processId: 101, appId: "app.101" });
    expect(lookup()).toMatchObject({ windowId: "202", processId: 202 });
  });
  it("never substitutes a foreground window for a missing or excluded ID", () => {
    expect(lookup("303").windowId).toBeUndefined();
    expect(lookup("999").windowId).toBeUndefined();
  });
});
