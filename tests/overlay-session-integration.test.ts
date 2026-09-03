import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskOverlayContext, GenerationResult, InputTarget, OverlayResult } from "../src/shared/types";
import type { FrontmostWindow } from "../electron/services/front-window";

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  shortcuts: new Map<string, () => void>(),
  events: [] as Array<{ channel: string; payload: any }>,
  windows: [] as any[],
  appEvents: new Map<string, () => void>(),
  window: { applicationName: "WeChat", windowTitle: "Alice", windowId: "101", processId: 99 } as FrontmostWindow,
  cursor: { x: 20, y: 20 },
  poll: undefined as undefined | (() => Promise<void>),
  getWindow: vi.fn(), getTarget: vi.fn(), generate: vi.fn(), answer: vi.fn()
}));

vi.mock("electron", () => {
  class Window {
    webContents = { send: (channel: string, payload: unknown) => harness.events.push({ channel, payload }), isLoadingMainFrame: () => false };
    focused = false;
    listeners = new Map<string, () => void>();
    bounds: { x: number; y: number; width: number; height: number };
    constructor(options: { width: number; height: number }) {
      this.bounds = { x: 100, y: 100, width: options.width, height: options.height };
      harness.windows.push(this);
    }
    on(name: string, callback: () => void) { this.listeners.set(name, callback); }
    once() {} loadFile = async () => {}; loadURL = async () => {};
    setHasShadow() {} setVisibleOnAllWorkspaces() {}
    setPosition = vi.fn((x: number, y: number) => { this.bounds = { ...this.bounds, x, y }; });
    getPosition = () => [this.bounds.x, this.bounds.y];
    getBounds = () => ({ ...this.bounds });
    setBounds = (bounds: typeof this.bounds) => { this.bounds = { ...bounds }; };
    getSize = () => [this.bounds.width, this.bounds.height]; isDestroyed = () => false; isVisible = () => true;
    isFocused = () => this.focused;
    hide = vi.fn(() => { this.focused = false; });
    show() {} showInactive = vi.fn();
    focus() { this.focused = true; this.listeners.get("focus")?.(); }
    blur() { this.focused = false; this.listeners.get("blur")?.(); }
  }
  class Tray { setToolTip() {} on() {} destroy() {} }
  return {
    app: { whenReady: async () => {}, getPath: () => "/tmp/contextcue-tests", getAppPath: () => process.cwd(), getVersion: () => "test", on: (name: string, fn: () => void) => harness.appEvents.set(name, fn), isPackaged: false },
    BrowserWindow: Window, Tray,
    ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => harness.handlers.set(name, fn), on: (name: string, fn: (...args: any[]) => any) => harness.handlers.set(name, fn) },
    globalShortcut: { unregisterAll: () => harness.shortcuts.clear(), register: (key: string, fn: () => void) => { harness.shortcuts.set(key, fn); return true; } },
    clipboard: { writeText: vi.fn() }, Menu: { buildFromTemplate: () => [] },
    nativeImage: { createFromBuffer: () => ({ isEmpty: () => false, setTemplateImage() {} }) },
    screen: {
      getCursorScreenPoint: () => harness.cursor,
      getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1400, height: 900 } }),
      getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1400, height: 900 } })
    },
    safeStorage: { isEncryptionAvailable: () => true, decryptString: () => "test-key" },
    Notification: { isSupported: () => false }, net: {}, shell: {}, systemPreferences: {}
  };
});
vi.mock("electron-updater", () => ({ default: { autoUpdater: {} } }));
vi.mock("../electron/services/updater", () => ({ UpdateService: class { start() {} dispose() {} } }));
vi.mock("../electron/services/front-window", async (importOriginal) => ({
  ...await importOriginal<typeof import("../electron/services/front-window")>(),
  getFrontmostWindow: () => harness.getWindow()
}));
vi.mock("../electron/services/input-target", async (importOriginal) => ({
  ...await importOriginal<typeof import("../electron/services/input-target")>(),
  getFocusedInputTarget: () => harness.getTarget(), writeMacInputTarget: async () => false
}));
vi.mock("../electron/services/capture", () => ({ captureQuickSource: async () => `data:image/png;base64,${harness.window.applicationName}`, captureSource: async () => "", listCaptureSources: async () => [] }));
vi.mock("../electron/services/model", () => ({ generateWithModel: harness.generate, streamAnswerWithModel: harness.answer, testModelConnection: vi.fn() }));
vi.mock("../electron/services/memory-store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../electron/services/memory-store")>();
  return { ...original, importLegacyBrandData: async () => false, MemoryStore: class {
    data = { ...structuredClone(original.DEFAULT_DATA), encryptedApiKeys: { "openai-default": "test-key" } };
    load = async () => this.data;
    getData = () => this.data;
    recordTokenUsage = async () => {};
  } };
});

const result: GenerationResult = { candidates: [{ text: "Current draft", tone: "Direct", strategy: "Confirm" }], conversationSummary: "", detectedContact: "Alice", detectedLanguage: "English", memorySuggestions: [], generatedAt: "" };
const latest = <T>(channel: string): T => harness.events.filter((event) => event.channel === channel).at(-1)!.payload;
const event = () => ({ sender: harness.windows[1].webContents });
const invoke = (channel: string, payload?: unknown) => harness.handlers.get(channel)!(event(), payload);
const shortcut = (ask: boolean) => harness.shortcuts.get(ask ? "CommandOrControl+Shift+Enter" : "CommandOrControl+Shift+Space")!();
const askOpen = () => harness.events.filter((item) => item.channel === "overlay:ask-open");

async function openAsk(applicationName: string, windowId: string) {
  harness.window = { applicationName, windowId, windowTitle: `${applicationName} page`, processId: Number(windowId) };
  harness.windows.forEach((window) => { window.focused = false; });
  const count = askOpen().length;
  shortcut(true);
  await vi.waitFor(() => expect(askOpen()).toHaveLength(count + 1));
  return latest<AskOverlayContext>("overlay:ask-open");
}

beforeAll(async () => {
  vi.spyOn(globalThis, "setInterval").mockImplementation(((callback: () => Promise<void>, delay: number) => {
    if (delay === 600) harness.poll = callback;
    return { unref() {} };
  }) as any);
  await import("../electron/main");
  await vi.waitFor(() => expect(harness.windows).toHaveLength(2));
});
beforeEach(() => {
  harness.cursor = { x: 20, y: 20 };
  harness.generate.mockReset(); harness.answer.mockReset();
  harness.getWindow.mockReset().mockImplementation(async () => ({ ...harness.window }));
  harness.getTarget.mockReset().mockResolvedValue(null);
  harness.answer.mockResolvedValue({ answer: "A current answer", tokenUsage: { reported: false } });
});

describe("overlay clicks during asynchronous context checks", () => {
  const target: InputTarget = {
    platform: "darwin", appId: "test.wechat", applicationName: "WeChat", windowTitle: "Alice",
    controlId: "message-field", role: "text-area", nativeRole: "AXTextArea", multiline: true, sensitive: false
  };

  async function openSuggestions() {
    harness.window = { applicationName: "WeChat", appId: target.appId, windowTitle: "Alice", windowId: "101", processId: 99 };
    harness.getTarget.mockResolvedValue(target);
    harness.generate.mockResolvedValue(result);
    harness.windows.forEach((window) => { window.focused = false; });
    const count = harness.events.filter((item) => item.channel === "overlay:result").length;
    shortcut(false);
    await vi.waitFor(() => expect(harness.events.filter((item) => item.channel === "overlay:result")).toHaveLength(count + 1));
    const overlay = harness.windows[1];
    overlay.hide.mockClear();
    return overlay;
  }

  it("keeps the overlay in place when switching between long and short candidates near the placement boundary", async () => {
    harness.cursor = { x: 300, y: 620 };
    const overlay = await openSuggestions();
    const resize = (height: number) => harness.handlers.get("overlay:resize")!(event(), height, true, false);
    resize(320);
    const position = overlay.getPosition();
    const cappedHeight = overlay.getSize()[1];
    overlay.setPosition.mockClear();
    resize(180);
    expect(overlay.getSize()[1]).toBe(180);
    expect(overlay.getPosition()).toEqual(position);
    resize(320);
    expect(overlay.getSize()[1]).toBe(cappedHeight);
    expect(overlay.getPosition()).toEqual(position);
    expect(overlay.setPosition).not.toHaveBeenCalled();
    const bounds = overlay.getBounds();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(892);
  });

  it.each(["window", "input"])("keeps the clicked overlay open when a pending %s lookup reports a mismatch", async (lookup) => {
    const overlay = await openSuggestions();
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    let finish!: (value: any) => void;
    (lookup === "window" ? harness.getWindow : harness.getTarget).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = harness.poll!();
    overlay.focus();
    finish(lookup === "window" ? { ...harness.window, windowId: "202" } : null);
    await pending;
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
  });

  it("discards a lookup spanning focus and blur, then checks the current page on the next poll", async () => {
    const overlay = await openSuggestions();
    let finish!: (value: FrontmostWindow) => void;
    harness.getWindow.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = harness.poll!();
    overlay.focus();
    overlay.blur();
    finish({ ...harness.window, windowId: "202" });
    await pending;
    expect(overlay.hide).not.toHaveBeenCalled();
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
    harness.window = { ...harness.window, windowId: "303" };
    await harness.poll!();
    expect(overlay.hide).toHaveBeenCalledOnce();
  });

  it("still hides when the user actually selects a different field outside the overlay", async () => {
    const overlay = await openSuggestions();
    harness.getTarget.mockResolvedValue({ ...target, controlId: "another-field" });
    await harness.poll!();
    expect(overlay.hide).toHaveBeenCalledOnce();
    harness.getTarget.mockResolvedValue(target);
    overlay.showInactive.mockClear();
    await harness.poll!();
    expect(overlay.showInactive).toHaveBeenCalledOnce();
  });

  const reviseCurrent = () => invoke("assist:revise", {
    sessionId: latest<OverlayResult>("overlay:result").sessionId,
    requestId: crypto.randomUUID(), text: "Edited draft", instruction: "Shorter"
  });

  const markComposerOpen = (revising = true) => harness.handlers.get("overlay:revision-composer")!(
    event(), latest<OverlayResult>("overlay:result").sessionId, revising
  );

  it("streams revision candidates without reanchoring and ignores cancelled or superseded requests", async () => {
    const overlay = await openSuggestions();
    overlay.focus();
    markComposerOpen();
    const position = overlay.getPosition();
    const bounds = overlay.getBounds();
    const finishes: Array<(value: GenerationResult) => void> = [];
    harness.generate.mockImplementation(() => new Promise((resolve) => finishes.push(resolve)));
    const sessionId = latest<OverlayResult>("overlay:result").sessionId;
    const revise = (requestId: string) => invoke("assist:revise", { sessionId, requestId, text: "Selected draft", instruction: "Warmer" });
    const first = revise("first");
    const cancelled = expect(first).rejects.toThrow("cancelled");
    await vi.waitFor(() => expect(finishes).toHaveLength(1));
    const oldCall = harness.generate.mock.calls[1];
    oldCall[6](result.candidates[0]);
    expect(latest("overlay:revision-candidate")).toMatchObject({ sessionId, requestId: "first", candidate: result.candidates[0] });
    expect(overlay.getPosition()).toEqual(position);
    expect(overlay.getBounds()).toEqual(bounds);
    const second = revise("second");
    await vi.waitFor(() => expect(finishes).toHaveLength(2));
    expect(oldCall[5].aborted).toBe(true);
    invoke("assist:cancel-revision", "first");
    const newCall = harness.generate.mock.calls[2];
    expect(newCall[5].aborted).toBe(false);
    const count = harness.events.length;
    oldCall[6]({ ...result.candidates[0], text: "Late old candidate" });
    expect(harness.events).toHaveLength(count);
    finishes[0](result);
    await cancelled;
    newCall[6](result.candidates[0]);
    finishes[1](result);
    await expect(second).resolves.toEqual(result.candidates);
    expect(latest("overlay:revision-candidate")).toMatchObject({ requestId: "second" });
  });

  it("can cancel while foreground validation is still pending, before calling the model", async () => {
    await openSuggestions();
    let finish!: (value: FrontmostWindow) => void;
    harness.getWindow.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = invoke("assist:revise", { sessionId: latest<OverlayResult>("overlay:result").sessionId, requestId: "validation", text: "Draft", instruction: "Shorter" });
    invoke("assist:cancel-revision", "validation");
    finish(harness.window);
    await expect(pending).rejects.toThrow("cancelled");
    expect(harness.generate).toHaveBeenCalledTimes(1);
  });

  it("keeps the revision composer and invalidates only its page context when revision validation detects a page change", async () => {
    const overlay = await openSuggestions();
    markComposerOpen();
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    harness.window = { ...harness.window, windowId: "202" };
    await expect(reviseCurrent()).rejects.toThrow("window or page changed");
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
    expect(latest<{ message: string }>("overlay:expired").message).toContain("Your suggestions and instructions are kept");
    await expect(reviseCurrent()).rejects.toThrow("expired");
    expect(harness.generate).toHaveBeenCalledTimes(1);
  });

  it("does not hide an open revision composer because the source input loses focus", async () => {
    const overlay = await openSuggestions();
    markComposerOpen();
    harness.getTarget.mockResolvedValue(null);
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
    markComposerOpen(false);
    await harness.poll!();
    expect(overlay.hide).toHaveBeenCalledOnce();
  });

  it("expires an old page snapshot without clearing an unsaved revision composer", async () => {
    const overlay = await openSuggestions();
    markComposerOpen();
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60_000);
    try { await harness.poll!(); } finally { now.mockRestore(); }
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
    expect(latest<{ message: string }>("overlay:expired").message).toContain("expired");
    await expect(reviseCurrent()).rejects.toThrow("expired");
  });

  it("cancels an in-flight revision on a page change and retains the revision composer for recovery", async () => {
    const overlay = await openSuggestions();
    markComposerOpen();
    overlay.focus();
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    overlay.blur();
    harness.window = { ...harness.window, windowId: "202" };
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
    expect((harness.generate.mock.calls[1][5] as AbortSignal).aborted).toBe(true);
    finish(result);
    await expect(pending).rejects.toThrow("cancelled");
  });

  it("revises the captured page while the revision composer owns focus, without inspecting a different window underneath it", async () => {
    const overlay = await openSuggestions();
    overlay.focus();
    harness.getWindow.mockClear().mockResolvedValue({ ...harness.window, windowId: "202" });
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    await expect(reviseCurrent()).resolves.toEqual(result.candidates);
    expect(harness.getWindow).not.toHaveBeenCalled();
    expect(harness.generate.mock.calls[1][3]).toBe("data:image/png;base64,WeChat");
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
  });

  it("ignores a stale foreground result if the revision composer gains focus during revision validation", async () => {
    const overlay = await openSuggestions();
    let finish!: (value: FrontmostWindow) => void;
    harness.getWindow.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    overlay.focus();
    finish({ ...harness.window, windowId: "202" });
    await expect(pending).resolves.toEqual(result.candidates);
    expect(overlay.hide).not.toHaveBeenCalled();
  });

  it.each([false, true])("rechecks after focus and blur during revision validation (page changed: %s)", async (changed) => {
    const overlay = await openSuggestions();
    let finish!: (value: FrontmostWindow) => void;
    harness.getWindow.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    overlay.focus();
    overlay.blur();
    if (changed) harness.window = { ...harness.window, windowId: "303" };
    finish({ ...harness.window, windowId: "202" });
    if (changed) {
      await expect(pending).rejects.toThrow("window or page changed");
      expect(harness.generate).toHaveBeenCalledTimes(1);
    } else {
      await expect(pending).resolves.toEqual(result.candidates);
      expect(overlay.hide).not.toHaveBeenCalled();
    }
  });

  it.each(["window", "page"])("rejects revision when the external %s actually changes", async (change) => {
    await openSuggestions();
    harness.window = { ...harness.window, ...(change === "window" ? { windowId: "202" } : { windowTitle: "Another page" }) };
    await expect(reviseCurrent()).rejects.toThrow("window or page changed");
    expect(harness.generate).toHaveBeenCalledTimes(1);
  });

  it("preserves the session for retry if focus keeps changing during validation", async () => {
    const overlay = await openSuggestions();
    const interruptedLookup = async () => {
      overlay.focus();
      overlay.blur();
      return { ...harness.window, windowId: "202" };
    };
    harness.getWindow.mockImplementationOnce(interruptedLookup).mockImplementationOnce(interruptedLookup);
    await expect(reviseCurrent()).rejects.toThrow("Window focus is changing");
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.generate).toHaveBeenCalledTimes(1);
    await expect(reviseCurrent()).resolves.toEqual(result.candidates);
  });

  it("rejects a late revision if focus leaves the revision composer for a different page during generation", async () => {
    const overlay = await openSuggestions();
    overlay.focus();
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    overlay.blur();
    harness.window = { ...harness.window, windowId: "202" };
    finish(result);
    await expect(pending).rejects.toThrow("window or page changed");
    expect((harness.generate.mock.calls[1][5] as AbortSignal).aborted).toBe(true);
  });
});
afterAll(() => { harness.appEvents.get("will-quit")?.(); vi.restoreAllMocks(); });

describe("Electron overlay session boundaries", () => {
  it("ignores renderer-supplied old history and starts browser Q&A without WeChat context", async () => {
    const wechat = await openAsk("WeChat", "101");
    invoke("ask:start", { sessionId: wechat.sessionId, requestId: "wechat-question", question: "Private WeChat question", includeContext: true, history: [{ role: "user", content: "INJECTED_OLD_HISTORY" }] });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(harness.events.some((item) => item.payload?.requestId === "wechat-question" && item.payload?.type === "complete")).toBe(true));
    const oldDelta = harness.answer.mock.calls[0][6];
    expect(harness.answer.mock.calls[0][4]).toEqual([]);
    const browser = await openAsk("Browser", "202");
    expect(browser.sessionId).not.toBe(wechat.sessionId);
    const eventCount = harness.events.length;
    oldDelta("LATE_WECHAT_ANSWER");
    expect(harness.events).toHaveLength(eventCount);
    invoke("ask:start", { sessionId: browser.sessionId, requestId: "browser-question", question: "Browser question", includeContext: true, history: [{ role: "assistant", content: "WECHAT_HISTORY" }] });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(2));
    const call = harness.answer.mock.calls[1];
    expect(call[3]).toBe("data:image/png;base64,Browser");
    expect(call[4]).toEqual([]);
    expect(call[5].applicationName).toBe("Browser");
  });

  it("aborts old suggestions and discards their late completion after opening another page", async () => {
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    harness.window = { applicationName: "WeChat", windowTitle: "Alice", windowId: "101", processId: 101 };
    harness.windows.forEach((window) => { window.focused = false; });
    shortcut(false);
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    const call = harness.generate.mock.calls[0];
    expect(call[2].contextPolicy).toBe("page-only");
    await openAsk("Browser", "202");
    expect((call[5] as AbortSignal).aborted).toBe(true);
    const count = harness.events.filter((item) => item.channel === "overlay:result").length;
    finish(result);
    await Promise.resolve(); await Promise.resolve();
    expect(harness.events.filter((item) => item.channel === "overlay:result")).toHaveLength(count);
  });

  it("revises against the same page and rejects revisions from an expired window", async () => {
    harness.generate.mockResolvedValue(result);
    harness.windows.forEach((window) => { window.focused = false; });
    shortcut(false);
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(latest<OverlayResult>("overlay:result")?.sessionId).toBeTruthy());
    const suggestion = latest<OverlayResult>("overlay:result");
    await expect(invoke("assist:revise", { sessionId: suggestion.sessionId, requestId: crypto.randomUUID(), text: "Edited draft", instruction: "Shorter" })).resolves.toEqual(result.candidates);
    expect(harness.generate.mock.calls[1][2]).toMatchObject({ contextPolicy: "page-only", revision: { text: "Edited draft", instruction: "Shorter" } });
    await openAsk("Different browser", "303");
    await expect(invoke("assist:revise", { sessionId: suggestion.sessionId, requestId: crypto.randomUUID(), text: "Old draft", instruction: "Shorter" })).rejects.toThrow("expired");
  });
});
