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
  getWindow: vi.fn(), getCapturedWindow: vi.fn(), capture: vi.fn(), execFile: vi.fn(), getTarget: vi.fn(), generate: vi.fn(), answer: vi.fn()
}));

// Integration tests must never activate real applications on the developer's desktop.
vi.mock("node:child_process", () => ({ execFile: (...args: any[]) => harness.execFile(...args) }));

vi.mock("electron", () => {
  class Window {
    webContents = { send: (channel: string, payload: unknown) => harness.events.push({ channel, payload }), isLoadingMainFrame: () => false };
    focused = false;
    visible = false;
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
    getSize = () => [this.bounds.width, this.bounds.height]; isDestroyed = () => false; isVisible = () => this.visible;
    isFocused = () => this.focused;
    hide = vi.fn(() => { this.visible = false; this.focused = false; });
    show() { this.visible = true; } showInactive = vi.fn(() => { this.visible = true; });
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
    nativeImage: {
      createFromBuffer: () => ({ isEmpty: () => false, setTemplateImage() {} }),
      createEmpty: () => ({ addRepresentation() {}, isEmpty: () => false, setTemplateImage() {} })
    },
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
  getFrontmostWindow: () => harness.getWindow(),
  getCapturedWindow: (expected: FrontmostWindow) => harness.getCapturedWindow(expected)
}));
vi.mock("../electron/services/input-target", async (importOriginal) => ({
  ...await importOriginal<typeof import("../electron/services/input-target")>(),
  getFocusedInputTarget: (processId?: number) => harness.getTarget(processId), writeMacInputTarget: async () => false
}));
vi.mock("../electron/services/capture", () => ({ captureQuickSource: (id: string) => harness.capture(id), captureSource: async () => "", listCaptureSources: async () => [] }));
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
const shortcut = (ask: boolean) => harness.shortcuts.get(ask ? "CommandOrControl+Shift+Space" : "CommandOrControl+Shift+Enter")!();
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
  harness.getCapturedWindow.mockReset().mockImplementation(() => harness.getWindow());
  harness.capture.mockReset().mockImplementation(async () => `data:image/png;base64,${harness.window.applicationName}`);
  harness.execFile.mockReset().mockImplementation((...args: any[]) => args.at(-1)(null, "", ""));
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

  it("keeps the clicked overlay open when a pending window lookup reports a mismatch", async () => {
    const overlay = await openSuggestions();
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    let finish!: (value: any) => void;
    harness.getWindow.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = harness.poll!();
    overlay.focus();
    finish({ ...harness.window, windowId: "202" });
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

  it("keeps suggestions visible when focus moves to another field in the source window", async () => {
    const overlay = await openSuggestions();
    harness.getTarget.mockResolvedValue({ ...target, controlId: "another-field" });
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
    harness.getTarget.mockResolvedValue(target);
    overlay.showInactive.mockClear();
    await harness.poll!();
    expect(overlay.showInactive).not.toHaveBeenCalled();
  });

  const reviseCurrent = () => invoke("assist:revise", {
    sessionId: latest<OverlayResult>("overlay:result").sessionId,
    requestId: crypto.randomUUID(), text: "Edited draft", instruction: "Shorter"
  });

  it.each(["other window", "unknown window", "settings"])("restores the same panel and geometry after visiting %s without resetting the renderer", async (destination) => {
    const overlay = await openSuggestions();
    const original = harness.window;
    overlay.setPosition(260, 190);
    harness.handlers.get("overlay:resize-by")!(event(), "bottom-right", 120, 80);
    const bounds = overlay.getBounds();
    const eventCount = harness.events.length;
    overlay.showInactive.mockClear();
    if (destination === "settings") harness.windows[0].focus();
    else harness.window = destination === "unknown window"
      ? { applicationName: "", windowTitle: "" }
      : { ...original, windowId: "202" };
    await harness.poll!();
    await harness.poll!();
    expect(overlay.hide).toHaveBeenCalledOnce();
    expect(overlay.isVisible()).toBe(false);
    expect(harness.events).toHaveLength(eventCount);
    harness.windows[0].blur();
    harness.window = original;
    harness.getTarget.mockResolvedValue(null);
    await harness.poll!();
    expect(overlay.isVisible()).toBe(true);
    expect(overlay.isFocused()).toBe(false);
    expect(overlay.showInactive).toHaveBeenCalledOnce();
    expect(overlay.getBounds()).toEqual(bounds);
    expect(harness.events).toHaveLength(eventCount);
    await expect(reviseCurrent()).resolves.toEqual(result.candidates);
  });

  it("does not expire a session when an action races with switching away", async () => {
    const overlay = await openSuggestions();
    const original = harness.window;
    const eventCount = harness.events.length;
    harness.window = { ...original, windowId: "202" };
    await expect(reviseCurrent()).rejects.toThrow("Return to the original window");
    expect(overlay.isVisible()).toBe(false);
    expect(harness.events).toHaveLength(eventCount);
    harness.window = original;
    await harness.poll!();
    await expect(reviseCurrent()).resolves.toEqual(result.candidates);
  });

  it("finishes revisions in the background without showing over another window", async () => {
    const overlay = await openSuggestions();
    const original = harness.window;
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    harness.window = { ...original, windowId: "202" };
    await harness.poll!();
    const call = harness.generate.mock.calls[1];
    expect(call[5].aborted).toBe(false);
    call[6](result.candidates[0]);
    finish(result);
    await expect(pending).resolves.toEqual(result.candidates);
    expect(overlay.isVisible()).toBe(false);
    harness.window = original;
    await harness.poll!();
    expect(overlay.isVisible()).toBe(true);
  });

  it("restores local work after the snapshot expires while away, without reviving AI authority", async () => {
    const overlay = await openSuggestions();
    const original = harness.window;
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    harness.window = { ...original, windowId: "202" };
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60_000);
    try { await harness.poll!(); } finally { now.mockRestore(); }
    expect(overlay.isVisible()).toBe(false);
    harness.window = original;
    await harness.poll!();
    expect(overlay.isVisible()).toBe(true);
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
    await expect(reviseCurrent()).rejects.toThrow("expired");
    expect(await invoke("ask:open")).toMatchObject({ hasPageContext: false });
  });

  it("does not resurrect a manually closed panel when returning to its source window", async () => {
    const overlay = await openSuggestions();
    // An empty application name avoids native activation in this mocked IPC test.
    await openAsk("", "909");
    overlay.blur();
    const original = harness.window;
    await invoke("overlay:hide");
    overlay.showInactive.mockClear();
    harness.window = { ...original, windowId: "202" };
    await harness.poll!();
    harness.window = original;
    await harness.poll!();
    expect(overlay.isVisible()).toBe(false);
    expect(overlay.showInactive).not.toHaveBeenCalled();
  });

  it("streams revision candidates without reanchoring and ignores cancelled or superseded requests", async () => {
    const overlay = await openSuggestions();
    overlay.focus();
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
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    harness.window = { ...harness.window, windowTitle: "Another page" };
    await expect(reviseCurrent()).rejects.toThrow("window or page changed");
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
    expect(latest<{ message: string }>("overlay:expired").message).toContain("Your suggestions and instructions are kept");
    await expect(reviseCurrent()).rejects.toThrow("expired");
    expect(harness.generate).toHaveBeenCalledTimes(1);
  });

  it("does not hide an open revision composer because the source input loses focus", async () => {
    const overlay = await openSuggestions();
    harness.getTarget.mockResolvedValue(null);
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
    await harness.poll!();
    expect(overlay.hide).not.toHaveBeenCalled();
  });

  it("expires an old page snapshot without clearing an unsaved revision composer", async () => {
    const overlay = await openSuggestions();
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
    overlay.focus();
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = reviseCurrent();
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(2));
    overlay.blur();
    harness.window = { ...harness.window, windowTitle: "Another page" };
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
    if (changed) harness.window = { ...harness.window, windowTitle: "Another page" };
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
    await expect(reviseCurrent()).rejects.toThrow(change === "window" ? "Return to the original window" : "window or page changed");
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
    harness.window = { ...harness.window, windowTitle: "Another page" };
    finish(result);
    await expect(pending).rejects.toThrow("window or page changed");
    expect((harness.generate.mock.calls[1][5] as AbortSignal).aborted).toBe(true);
  });
});
afterAll(() => { harness.appEvents.get("will-quit")?.(); vi.restoreAllMocks(); });

describe("Electron overlay session boundaries", () => {
  it.each([false, true])("finishes initial suggestions while away, including before the watcher runs (polled: %s)", async (polled) => {
    let finish!: (value: GenerationResult) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    harness.window = { applicationName: "Browser", windowTitle: "Page", windowId: "101", processId: 101 };
    const original = harness.window;
    harness.windows.forEach((window) => { window.focused = false; });
    const resultCount = harness.events.filter((item) => item.channel === "overlay:result").length;
    shortcut(false);
    await vi.waitFor(() => expect(harness.generate).toHaveBeenCalledTimes(1));
    const overlay = harness.windows[1];
    overlay.setPosition(240, 190);
    const position = overlay.getPosition();
    harness.window = { ...original, windowId: "202" };
    if (polled) await harness.poll!();
    finish(result);
    await vi.waitFor(() => expect(harness.events.filter((item) => item.channel === "overlay:result")).toHaveLength(resultCount + 1));
    expect(harness.generate.mock.calls[0][5].aborted).toBe(false);
    expect(overlay.isVisible()).toBe(false);
    expect(overlay.getPosition()).toEqual(position);
    harness.window = original;
    const eventCount = harness.events.length;
    await harness.poll!();
    expect(overlay.isVisible()).toBe(true);
    expect(harness.events).toHaveLength(eventCount);
  });

  it("keeps streaming Ask AI while hidden and resumes the same conversation on return", async () => {
    const context = await openAsk("Browser", "101");
    const original = harness.window;
    const overlay = harness.windows[1];
    const bounds = overlay.getBounds();
    const openCount = askOpen().length;
    let finish!: (value: { answer: string; tokenUsage: { reported: boolean } }) => void;
    harness.answer.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    invoke("ask:start", { sessionId: context.sessionId, requestId: "background-ask", question: "First question", includeContext: true });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(1));
    overlay.blur();
    harness.window = { ...original, windowId: "202" };
    await harness.poll!();
    const call = harness.answer.mock.calls[0];
    expect(call[7].aborted).toBe(false);
    call[6]("Saved answer");
    finish({ answer: "Saved answer", tokenUsage: { reported: false } });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event")).toMatchObject({ requestId: "background-ask", type: "complete" }));
    expect(overlay.isVisible()).toBe(false);
    harness.window = original;
    await harness.poll!();
    expect(overlay.isVisible()).toBe(true);
    expect(overlay.isFocused()).toBe(false);
    expect(overlay.getBounds()).toEqual(bounds);
    expect(askOpen()).toHaveLength(openCount);
    invoke("ask:start", { sessionId: context.sessionId, requestId: "followup-ask", question: "Follow up", includeContext: true });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(2));
    expect(harness.answer.mock.calls[1][4]).toEqual([{ role: "user", content: "First question" }, { role: "assistant", content: "Saved answer" }]);
  });

  it("expires an Ask snapshot in place and rejects further AI requests without clearing the transcript", async () => {
    const context = await openAsk("Browser", "101");
    const overlay = harness.windows[1];
    const resetCount = harness.events.filter((item) => item.channel === "overlay:reset").length;
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6 * 60_000);
    try { await harness.poll!(); } finally { now.mockRestore(); }
    expect(overlay.isVisible()).toBe(true);
    expect(latest<any>("overlay:expired").sessionId).toBe(context.sessionId);
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resetCount);
    invoke("ask:start", { sessionId: context.sessionId, requestId: "expired-ask", question: "Question", includeContext: true });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event")).toMatchObject({ requestId: "expired-ask", type: "error" }));
    expect(harness.answer).not.toHaveBeenCalled();
  });

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

describe("Ask AI entry and draft workflow", () => {
  it("opens Ask AI from the primary shortcut without generating unsolicited drafts", async () => {
    await openAsk("WeChat", "101");
    expect(harness.generate).not.toHaveBeenCalled();
    expect(harness.answer).not.toHaveBeenCalled();
  });

  it("turns a writing request into revisable drafts with the original target", async () => {
    const context = await openAsk("WeChat", "101");
    harness.answer.mockResolvedValue({ answer: "Current draft", draft: result, tokenUsage: { reported: false } });
    invoke("ask:start", { sessionId: context.sessionId, requestId: "draft", question: "Draft a reply declining", includeContext: true });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event").draft?.candidates).toEqual(result.candidates));
    await invoke("ask:show-draft", context.sessionId);
    harness.generate.mockResolvedValue(result);
    await invoke("assist:revise", { sessionId: context.sessionId, requestId: "revise-draft", text: "Current draft", instruction: "Shorter" });
    expect(harness.generate.mock.calls[0][3]).toContain("WeChat");
    const back = await invoke("ask:open");
    expect(back.sessionId).toBe(context.sessionId);
    expect(back.canReturnToSuggestions).toBe(true);
  });

  it("does not reattach the screenshot or metadata when revising a page-off draft", async () => {
    const context = await openAsk("WeChat", "101");
    harness.answer.mockResolvedValue({ answer: "Current draft", draft: result, tokenUsage: { reported: false } });
    invoke("ask:start", { sessionId: context.sessionId, requestId: "off-draft", question: "Write a greeting", includeContext: false });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event").requestId).toBe("off-draft"));
    harness.generate.mockResolvedValue(result);
    await invoke("assist:revise", { sessionId: context.sessionId, requestId: "off-revise", text: "Hello", instruction: "Warmer" });
    const call = harness.generate.mock.calls[0];
    expect(call[3]).toBe("");
    expect(call[2]).toMatchObject({ contextPolicy: "page-only", withoutPageContext: true });
    expect(call[2].target).toBeUndefined();
    expect(call[2].pageContext).toBeUndefined();
  });

  it("refreshes a changed title in the original window into an empty session", async () => {
    const context = await openAsk("WeChat", "101");
    invoke("ask:start", { sessionId: context.sessionId, requestId: "before-refresh", question: "Explain", includeContext: true });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event")).toMatchObject({ requestId: "before-refresh", type: "complete" }));
    harness.window.windowTitle = "Updated page";
    const refreshed = await invoke("ask:refresh", context.sessionId);
    expect(refreshed.sessionId).not.toBe(context.sessionId);
    expect(refreshed.windowTitle).toBe("Updated page");
    expect(refreshed.canReturnToSuggestions).toBe(false);
    invoke("ask:start", { sessionId: refreshed.sessionId, requestId: "after-refresh", question: "Explain again", includeContext: true });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(2));
    expect(harness.answer.mock.calls[1][4]).toEqual([]);
  });

  it("keeps the original session after a refresh tries to capture another window", async () => {
    const context = await openAsk("WeChat", "101");
    const resets = harness.events.filter((item) => item.channel === "overlay:reset").length;
    harness.window = { applicationName: "Safari", windowTitle: "Other", windowId: "202", processId: 202 };
    await expect(invoke("ask:refresh", context.sessionId)).rejects.toThrow("original window");
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resets);
    harness.window = { applicationName: "WeChat", windowTitle: "WeChat page", windowId: "101", processId: 101 };
    await harness.poll!();
    expect(harness.windows[1].visible).toBe(true);
    expect((await invoke("ask:open")).sessionId).toBe(context.sessionId);
  });

  it("discards a draft arriving after refresh", async () => {
    const context = await openAsk("WeChat", "101");
    let finish!: (value: unknown) => void;
    harness.answer.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    invoke("ask:start", { sessionId: context.sessionId, requestId: "late-draft", question: "Draft a reply", includeContext: true });
    await vi.waitFor(() => expect(harness.answer).toHaveBeenCalledTimes(1));
    await invoke("ask:refresh", context.sessionId);
    finish({ answer: "Old draft", draft: result, tokenUsage: { reported: false } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(harness.events.filter((item) => item.channel === "overlay:ask-event" && item.payload.requestId === "late-draft" && item.payload.type === "complete")).toEqual([]);
  });

  it.runIf(process.platform === "darwin")("refreshes the bound window without hiding the panel or activating whichever app is underneath", async () => {
    const context = await openAsk("Source", "101");
    const original = { ...harness.window, windowTitle: "Updated source page" };
    const overlay = harness.windows[1];
    overlay.hide.mockClear();
    harness.execFile.mockClear();
    harness.window = { applicationName: "Other app", windowTitle: "Other page", windowId: "202", processId: 202 };
    harness.getCapturedWindow.mockResolvedValue(original);
    harness.capture.mockClear();
    const refreshed = await invoke("ask:refresh", context.sessionId);
    expect(refreshed.windowTitle).toBe("Updated source page");
    expect(harness.capture).toHaveBeenCalledExactlyOnceWith("window:101:0");
    expect(harness.execFile).not.toHaveBeenCalled();
    expect(overlay.hide).not.toHaveBeenCalled();
    expect(overlay.isVisible()).toBe(true);
  });

  it("keeps the conversation usable after a refresh failure and allows immediate close", async () => {
    const context = await openAsk("Source", "101");
    const resets = harness.events.filter((item) => item.channel === "overlay:reset").length;
    harness.getCapturedWindow.mockRejectedValueOnce(new Error("Could not read the original window. Try again."));
    await expect(invoke("ask:refresh", context.sessionId)).rejects.toThrow("Could not read the original window");
    expect(harness.events.filter((item) => item.channel === "overlay:reset")).toHaveLength(resets);
    expect(harness.windows[1].isVisible()).toBe(true);
    expect((await invoke("ask:open")).sessionId).toBe(context.sessionId);
    // Native activation never calls back: closing still finishes synchronously.
    harness.execFile.mockImplementation(() => {});
    expect(invoke("overlay:hide")).toBeUndefined();
    expect(harness.windows[1].isVisible()).toBe(false);
    await harness.poll!();
    expect(harness.windows[1].isVisible()).toBe(false);
  });

  it.runIf(process.platform === "darwin")("still checks the source application's sensitive field while the panel owns focus", async () => {
    const context = await openAsk("Source", "101");
    harness.capture.mockClear();
    harness.getTarget.mockResolvedValue({ sensitive: true });
    await expect(invoke("ask:refresh", context.sessionId)).rejects.toThrow("sensitive fields");
    expect(harness.getTarget).toHaveBeenLastCalledWith(101);
    expect(harness.capture).not.toHaveBeenCalled();
    expect(harness.windows[1].isVisible()).toBe(true);
  });

  it.each(["success", "failure"])("does not reopen a closed panel after a late refresh %s", async (outcome) => {
    const context = await openAsk("", "101");
    let finish!: () => void;
    harness.capture.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finish = () => outcome === "success" ? resolve("data:image/png;base64,new") : reject(new Error("Capture failed"));
    }));
    const opened = askOpen().length;
    const pending = invoke("ask:refresh", context.sessionId);
    const rejected = expect(pending).rejects.toThrow(outcome === "success" ? "session has ended" : "Capture failed");
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await invoke("overlay:hide");
    finish();
    await rejected;
    await harness.poll!();
    expect(askOpen()).toHaveLength(opened);
    expect(harness.windows[1].isVisible()).toBe(false);
  });

  it("does not reveal refreshed content over another window after focus leaves the panel", async () => {
    const context = await openAsk("Source", "101");
    const original = { ...harness.window };
    let finish!: (image: string) => void;
    harness.getCapturedWindow.mockResolvedValue(original);
    harness.capture.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = invoke("ask:refresh", context.sessionId);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    harness.windows[1].blur();
    harness.window = { applicationName: "Other", windowTitle: "Other", windowId: "202", processId: 202 };
    finish("data:image/png;base64,new");
    await pending;
    expect(harness.windows[1].isVisible()).toBe(false);
    harness.window = original;
    await harness.poll!();
    expect(harness.windows[1].isVisible()).toBe(true);
  });
});

describe("Memory controls at Electron session boundaries", () => {
  const usage = { enabled: true, reason: "matched" as const, sources: [{ id: "preferences", filename: "preferences.md", content: "PRIVATE_NOTE", updatedAt: "2026-01-01" }] };
  const ask = async (sessionId: string, requestId: string, extra = {}) => {
    invoke("ask:start", { sessionId, requestId, question: "Draft a reply", includeContext: false, includeMemory: true, ...extra });
    await vi.waitFor(() => expect(latest<any>("overlay:ask-event")).toMatchObject({ requestId, type: "complete" }));
  };
  it("keeps page and Memory independent, reports sources and clears inherited answers when Memory changes", async () => {
    const context = await openAsk("Source", "101");
    harness.answer.mockResolvedValueOnce({ answer: "PRIVATE_NOTE answer", memoryUsage: usage, tokenUsage: { reported: false } });
    await ask(context.sessionId, "memory-on");
    expect(harness.answer.mock.calls[0][3]).toBe("");
    expect(harness.answer.mock.calls[0][9]).toMatchObject({ enabled: true });
    expect(latest<any>("overlay:ask-event").memoryUsage).toEqual(usage);
    await ask(context.sessionId, "memory-followup", { question: "Explain that" });
    expect(harness.answer.mock.calls[1][9].inheritedSources).toEqual(usage.sources);
    await ask(context.sessionId, "memory-off", { includeMemory: false, includeContext: true });
    const call = harness.answer.mock.calls[2];
    expect(call[3]).toContain("data:image/");
    expect(call[4]).toEqual([]);
    expect(call[9]).toMatchObject({ enabled: false, inheritedSources: [] });
    expect((await invoke("ask:open")).includeMemory).toBe(false);
  });
  it("applies the Memory switch to revisions even before another question is sent", async () => {
    const context = await openAsk("Source", "101");
    harness.answer.mockResolvedValueOnce({ answer: "PRIVATE_DRAFT", draft: { ...result, memoryUsage: usage }, memoryUsage: usage, tokenUsage: { reported: false } });
    await ask(context.sessionId, "before-toggle");
    await harness.handlers.get("memory:session")!(event(), context.sessionId, false);
    expect((await invoke("ask:open")).includeMemory).toBe(false);
    harness.generate.mockResolvedValue(result);
    await invoke("assist:revise", { sessionId: context.sessionId, requestId: "after-toggle", text: "PRIVATE_DRAFT", instruction: "Shorter" });
    expect(harness.generate.mock.calls[0][2].includeMemory).toBe(false);
    expect(harness.generate.mock.calls[0][7]).toEqual(usage.sources);
    await ask(context.sessionId, "after-toggle-question", { includeMemory: false });
    expect(harness.answer.mock.calls[1][4]).toEqual([]);
  });
  it("retries a question without earlier answers even if the Memory switch is already off", async () => {
    const context = await openAsk("Source", "101");
    await ask(context.sessionId, "first-off", { includeMemory: false });
    await ask(context.sessionId, "retry-off", { includeMemory: false, resetConversation: true });
    expect(harness.answer.mock.calls[1][4]).toEqual([]);
  });
  it("regenerates an Ask draft from its original question, excluding model answers and revised text", async () => {
    const context = await openAsk("Source", "101");
    harness.answer.mockResolvedValueOnce({ answer: "PRIVATE_NOTE answer", memoryUsage: usage, tokenUsage: { reported: false } });
    await ask(context.sessionId, "context-turn", { question: "Use my project notes" });
    harness.answer.mockResolvedValueOnce({ answer: "PRIVATE_DRAFT", draft: { ...result, memoryUsage: usage }, memoryUsage: usage, tokenUsage: { reported: false } });
    await ask(context.sessionId, "draft-turn");
    harness.generate.mockResolvedValue(result);
    await invoke("assist:revise", { sessionId: context.sessionId, requestId: "revision", text: "PRIVATE_DRAFT", instruction: "Warmer" });
    harness.answer.mockResolvedValueOnce({ answer: "Clean", draft: { ...result, memoryUsage: { enabled: false, reason: "off", sources: [] } }, tokenUsage: { reported: false } });
    const clean = await harness.handlers.get("assist:regenerate-without-memory")!(event(), context.sessionId, "clean-retry");
    const call = harness.answer.mock.calls[2];
    expect(call[2]).toBe("Draft a reply");
    expect(call[3]).toBe("");
    expect(call[4]).toEqual([{ role: "user", content: "Use my project notes" }]);
    expect(call[9]).toEqual({ enabled: false });
    expect(JSON.stringify(call.slice(2, 6))).not.toContain("PRIVATE_");
    expect(clean.memoryUsage.enabled).toBe(false);
    await ask(context.sessionId, "after-clean", { includeMemory: false });
    expect(harness.answer.mock.calls[3][4]).toEqual([]);
  });
  it("regenerates Quick writing without old draft text and discards a late result after close", async () => {
    harness.window = { applicationName: "WeChat", windowTitle: "Alice", windowId: "101", processId: 99 };
    harness.windows.forEach((window) => { window.focused = false; });
    harness.generate.mockResolvedValue({ ...result, memoryUsage: usage });
    const count = harness.events.filter((item) => item.channel === "overlay:result").length;
    shortcut(false);
    await vi.waitFor(() => expect(harness.events.filter((item) => item.channel === "overlay:result")).toHaveLength(count + 1));
    const original = latest<OverlayResult>("overlay:result");
    expect(harness.generate.mock.calls[0][2].includeMemory).toBe(true);
    await harness.handlers.get("assist:regenerate-without-memory")!(event(), original.sessionId, "clean-quick");
    expect(harness.generate.mock.calls[1][2]).toMatchObject({ includeMemory: false, contextPolicy: "page-only" });
    expect(harness.generate.mock.calls[1][2].revision).toBeUndefined();
    let finish!: (value: unknown) => void;
    harness.generate.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = harness.handlers.get("assist:regenerate-without-memory")!(event(), original.sessionId, "late-clean");
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await invoke("overlay:hide");
    finish(result);
    await rejected;
    expect(harness.windows[1].isVisible()).toBe(false);
  });
});
