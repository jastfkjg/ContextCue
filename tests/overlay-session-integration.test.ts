import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskOverlayContext, GenerationResult, OverlayResult } from "../src/shared/types";

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  shortcuts: new Map<string, () => void>(),
  events: [] as Array<{ channel: string; payload: any }>,
  windows: [] as any[],
  appEvents: new Map<string, () => void>(),
  window: { applicationName: "WeChat", windowTitle: "Alice", windowId: "101", processId: 99 },
  generate: vi.fn(), answer: vi.fn()
}));

vi.mock("electron", () => {
  class Window {
    webContents = { send: (channel: string, payload: unknown) => harness.events.push({ channel, payload }), isLoadingMainFrame: () => false };
    focused = false;
    constructor() { harness.windows.push(this); }
    on() {} once() {} loadFile = async () => {}; loadURL = async () => {};
    setHasShadow() {} setVisibleOnAllWorkspaces() {} setPosition() {}
    getSize = () => [420, 336]; isDestroyed = () => false; isVisible = () => true;
    isFocused = () => this.focused;
    hide() { this.focused = false; } show() {} showInactive() {} focus() { this.focused = true; }
  }
  class Tray { setToolTip() {} on() {} destroy() {} }
  return {
    app: { whenReady: async () => {}, getPath: () => "/tmp/contextcue-tests", getAppPath: () => process.cwd(), getVersion: () => "test", on: (name: string, fn: () => void) => harness.appEvents.set(name, fn), isPackaged: false },
    BrowserWindow: Window, Tray,
    ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => harness.handlers.set(name, fn), on: (name: string, fn: (...args: any[]) => any) => harness.handlers.set(name, fn) },
    globalShortcut: { unregisterAll: () => harness.shortcuts.clear(), register: (key: string, fn: () => void) => { harness.shortcuts.set(key, fn); return true; } },
    clipboard: { writeText: vi.fn() }, Menu: { buildFromTemplate: () => [] },
    nativeImage: { createFromBuffer: () => ({ isEmpty: () => false, setTemplateImage() {} }) },
    screen: { getCursorScreenPoint: () => ({ x: 20, y: 20 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1400, height: 900 } }) },
    safeStorage: { isEncryptionAvailable: () => true, decryptString: () => "test-key" },
    Notification: { isSupported: () => false }, net: {}, shell: {}, systemPreferences: {}
  };
});
vi.mock("electron-updater", () => ({ default: { autoUpdater: {} } }));
vi.mock("../electron/services/updater", () => ({ UpdateService: class { start() {} dispose() {} } }));
vi.mock("../electron/services/overlay-size", () => ({ OverlaySizer: class { show() {} } }));
vi.mock("../electron/services/front-window", async (importOriginal) => ({
  ...await importOriginal<typeof import("../electron/services/front-window")>(),
  getFrontmostWindow: async () => ({ ...harness.window })
}));
vi.mock("../electron/services/input-target", () => ({ getFocusedInputTarget: async () => null, sameInputTarget: () => false, writeMacInputTarget: async () => false }));
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
  vi.spyOn(globalThis, "setInterval").mockImplementation((() => ({ unref() {} })) as any);
  await import("../electron/main");
  await vi.waitFor(() => expect(harness.windows).toHaveLength(2));
});
beforeEach(() => {
  harness.generate.mockReset(); harness.answer.mockReset();
  harness.answer.mockResolvedValue({ answer: "A current answer", tokenUsage: { reported: false } });
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
    await expect(invoke("assist:revise", { sessionId: suggestion.sessionId, text: "Edited draft", instruction: "Shorter" })).resolves.toBe("Current draft");
    expect(harness.generate.mock.calls[1][2]).toMatchObject({ contextPolicy: "page-only", revision: { text: "Edited draft", instruction: "Shorter" } });
    await openAsk("Different browser", "303");
    await expect(invoke("assist:revise", { sessionId: suggestion.sessionId, text: "Old draft", instruction: "Shorter" })).rejects.toThrow("expired");
  });
});
