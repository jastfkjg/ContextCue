import { execFile } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { join } from "node:path";
import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  safeStorage,
  screen,
  shell,
  systemPreferences
} from "electron";
import type {
  ContactMemory,
  GenerateRequest,
  MemoryFact,
  OverlayStatus,
  SaveSettingsRequest,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";
import {
  captureSource,
  captureQuickSource,
  listCaptureSourceRefs,
  listCaptureSources,
  type CaptureSourceRef
} from "./services/capture";
import { selectQuickReplySource, targetApplicationName } from "./services/channel";
import { MemoryStore } from "./services/memory-store";
import { generateWithModel } from "./services/model";

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let store: MemoryStore;
let quickReplyInFlight = false;
let quickSourceRefs: CaptureSourceRef[] = [];

function rendererUrl(mode?: "overlay"): string {
  const url = process.env.ELECTRON_RENDERER_URL;
  if (!url) return "";
  const parsed = new URL(url);
  if (mode) parsed.searchParams.set("mode", mode);
  return parsed.toString();
}

async function loadRenderer(window: BrowserWindow, mode?: "overlay"): Promise<void> {
  const devUrl = rendererUrl(mode);
  if (devUrl) await window.loadURL(devUrl);
  else await window.loadFile(join(__dirname, "../renderer/index.html"), mode ? { query: { mode } } : undefined);
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1220,
    height: 790,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: "#f4f3ee",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  void loadRenderer(window);
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    mainWindow = null;
  });
  return window;
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 560,
    height: 390,
    minWidth: 500,
    minHeight: 340,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void loadRenderer(window, "overlay");
  window.on("closed", () => {
    overlayWindow = null;
  });
  return window;
}

function sendToOverlay(channel: "overlay:status" | "overlay:result", payload: unknown): void {
  if (!overlayWindow) overlayWindow = createOverlayWindow();
  const send = () => overlayWindow?.webContents.send(channel, payload);
  if (overlayWindow.webContents.isLoadingMainFrame()) overlayWindow.webContents.once("did-finish-load", send);
  else send();
}

function positionOverlayNearInput(): void {
  if (!overlayWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(cursor);
  const [width, height] = overlayWindow.getSize();
  const margin = 18;
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
  const x = clamp(cursor.x - Math.round(width / 2), workArea.x + margin, workArea.x + workArea.width - width - margin);
  const preferredY = cursor.y - height - 22;
  const fallbackY = cursor.y + 22;
  const y = clamp(
    preferredY >= workArea.y + margin ? preferredY : fallbackY,
    workArea.y + margin,
    workArea.y + workArea.height - height - margin
  );
  overlayWindow.setPosition(x, y, false);
}

function showOverlayStatus(status: OverlayStatus): void {
  if (!overlayWindow) overlayWindow = createOverlayWindow();
  positionOverlayNearInput();
  sendToOverlay("overlay:status", status);
  overlayWindow.showInactive();
}

async function frontmostApplicationName(): Promise<string> {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        "tell application \"System Events\" to get name of first application process whose frontmost is true"
      ]);
      return stdout.trim();
    }
    if (process.platform === "linux") {
      const { stdout } = await execFileAsync("xdotool", ["getactivewindow", "getwindowname"]);
      return stdout.trim();
    }
  } catch {
    return "";
  }
  return "";
}

async function refreshQuickSourceRefs(): Promise<CaptureSourceRef[]> {
  quickSourceRefs = await listCaptureSourceRefs();
  return quickSourceRefs;
}

async function showQuickReply(): Promise<void> {
  if (quickReplyInFlight) return;
  quickReplyInFlight = true;
  const startedAt = performance.now();
  let discoveryFinishedAt = startedAt;
  let captureFinishedAt = startedAt;
  try {
    showOverlayStatus({ state: "loading", message: "Reading the current conversation…" });
    const [applicationName, availableSources] = await Promise.all([
      frontmostApplicationName(),
      quickSourceRefs.length ? Promise.resolve(quickSourceRefs) : refreshQuickSourceRefs()
    ]);
    let source = selectQuickReplySource(availableSources, applicationName);
    if (!source) source = selectQuickReplySource(await refreshQuickSourceRefs(), applicationName);
    if (!source) throw new Error("No active chat window was found. Keep the WeChat conversation visible and try again.");
    discoveryFinishedAt = performance.now();

    let screenshot: string;
    try {
      screenshot = await captureQuickSource(source.id);
    } catch {
      source = selectQuickReplySource(await refreshQuickSourceRefs(), applicationName);
      if (!source) throw new Error("The current WeChat window is no longer available. Keep it visible and try again.");
      screenshot = await captureQuickSource(source.id);
    }
    captureFinishedAt = performance.now();
    const snapshot = store.getData();
    const model = snapshot.settings.models.find((item) => item.id === snapshot.settings.activeModelId)
      ?? snapshot.settings.models[0];
    showOverlayStatus({ state: "loading", message: `Generating 2 replies with ${model?.name || "the current model"}…` });
    const request: GenerateRequest = {
      sourceId: source.id,
      channel: source.channel,
      locale: snapshot.settings.locale,
      quick: true
    };
    const result = await generateWithModel(snapshot, readApiKey(), request, screenshot);
    const contact = result.detectedContact;
    sendToOverlay("overlay:result", { ...result, channel: source.channel, contact });
    overlayWindow?.showInactive();
    const finishedAt = performance.now();
    console.info(
      `[quick-reply] discover=${Math.round(discoveryFinishedAt - startedAt)}ms `
      + `capture=${Math.round(captureFinishedAt - discoveryFinishedAt)}ms `
      + `model=${Math.round(finishedAt - captureFinishedAt)}ms total=${Math.round(finishedAt - startedAt)}ms`
    );
    void refreshQuickSourceRefs().catch(() => undefined);
  } catch (error) {
    console.warn(`[quick-reply] failed after ${Math.round(performance.now() - startedAt)}ms`, error);
    showOverlayStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    quickReplyInFlight = false;
  }
}

function registerShortcut(accelerator: string): boolean {
  globalShortcut.unregisterAll();
  return globalShortcut.register(accelerator, () => void showQuickReply());
}

function readApiKey(modelId = store.getData().settings.activeModelId): string {
  if (process.env.HIPLY_API_KEY && modelId === store.getData().settings.activeModelId) return process.env.HIPLY_API_KEY;
  const encrypted = store.getData().encryptedApiKeys?.[modelId];
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return "";
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  } catch {
    return "";
  }
}

function configuredModelIds(): Set<string> {
  return new Set(store.getData().settings.models.filter((model) => Boolean(readApiKey(model.id))).map((model) => model.id));
}

function encryptApiKey(apiKey: string): string | undefined {
  if (!apiKey.trim()) return undefined;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure key storage is unavailable on this device. Use the HIPLY_API_KEY environment variable instead.");
  }
  return safeStorage.encryptString(apiKey.trim()).toString("base64");
}

async function bestEffortPaste(channel: UseReplyRequest["channel"]): Promise<boolean> {
  try {
    if (process.platform === "darwin") {
      overlayWindow?.hide();
      mainWindow?.hide();
      app.hide();
      const target = targetApplicationName(channel);
      const script = target
        ? `tell application "${target}" to activate\ndelay 0.2\ntell application "System Events" to keystroke "v" using command down`
        : "delay 0.2\ntell application \"System Events\" to keystroke \"v\" using command down";
      await execFileAsync("osascript", ["-e", script]);
      return true;
    }
    if (process.platform === "win32") {
      overlayWindow?.hide();
      mainWindow?.hide();
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      ]);
      return true;
    }
    await execFileAsync("xdotool", ["key", "ctrl+v"]);
    return true;
  } catch {
    return false;
  }
}

function registerIpc(): void {
  ipcMain.handle("capture:list", () => listCaptureSources());
  ipcMain.handle("capture:source", (_event, sourceId: string) => captureSource(sourceId));
  ipcMain.handle("permissions:get", () => ({
    screen: process.platform === "darwin" ? systemPreferences.getMediaAccessStatus("screen") : "unknown",
    accessibility: process.platform === "darwin" ? systemPreferences.isTrustedAccessibilityClient(false) : true
  }));
  ipcMain.handle("permissions:open-screen", async () => {
    if (process.platform === "darwin") {
      await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    }
  });

  ipcMain.handle("reply:generate", async (_event, request: GenerateRequest) => {
    const screenshot = request.imageDataUrl || (request.sourceId ? await captureSource(request.sourceId) : "");
    const result = await generateWithModel(store.getData(), readApiKey(), request, screenshot);
    const contact = request.contact?.trim() || result.detectedContact;
    if (store.getData().settings.autoShowOverlay) {
      if (!overlayWindow) overlayWindow = createOverlayWindow();
      positionOverlayNearInput();
      sendToOverlay("overlay:result", { ...result, channel: request.channel, contact });
      overlayWindow.show();
      overlayWindow.focus();
    }
    return result;
  });

  ipcMain.handle("reply:use", async (_event, request: UseReplyRequest) => {
    clipboard.writeText(request.text);
    await store.rememberAcceptedReply({
      text: request.text,
      channel: request.channel,
      contact: request.contact
    });
    const pasted = request.paste ? await bestEffortPaste(request.channel) : false;
    return { copied: true, pasted };
  });
  ipcMain.handle("overlay:hide", () => overlayWindow?.hide());

  ipcMain.handle("memory:get", () => store.snapshot());
  ipcMain.handle("memory:profile", (_event, profile: UserProfile) => store.saveProfile(profile));
  ipcMain.handle("memory:contact-save", (_event, contact: ContactMemory) => store.saveContact(contact));
  ipcMain.handle("memory:contact-delete", (_event, id: string) => store.deleteContact(id));
  ipcMain.handle(
    "memory:fact-add",
    (_event, fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) => store.addFact(fact)
  );
  ipcMain.handle("memory:fact-delete", (_event, id: string) => store.deleteFact(id));

  ipcMain.handle("settings:get", () => store.settings(configuredModelIds()));
  ipcMain.handle(
    "settings:save",
    async (_event, incoming: SaveSettingsRequest) => {
      const { apiKeys = {}, models, ...preferences } = incoming;
      if (!models.length) throw new Error("Add at least one model configuration.");
      if (!models.some((model) => model.id === incoming.activeModelId)) throw new Error("Choose a valid current model.");
      const storedModels = models.map(({ apiKeyConfigured: _configured, ...model }) => ({
        ...model,
        name: model.name.trim(),
        apiBaseUrl: model.apiBaseUrl.trim(),
        model: model.model.trim()
      }));
      if (storedModels.some((model) => !model.name || !model.apiBaseUrl || !model.model)) {
        throw new Error("Each model needs a name, API base URL, and model ID.");
      }
      const modelIds = new Set(storedModels.map((model) => model.id));
      const encryptedApiKeys = Object.fromEntries(
        Object.entries(store.getData().encryptedApiKeys ?? {}).filter(([id]) => modelIds.has(id))
      );
      for (const [id, apiKey] of Object.entries(apiKeys)) {
        if (modelIds.has(id) && apiKey.trim()) encryptedApiKeys[id] = encryptApiKey(apiKey)!;
      }
      const settings = { ...preferences, models: storedModels };
      await store.saveSettings(settings, encryptedApiKeys);
      if (!registerShortcut(settings.globalShortcut)) {
        throw new Error(`The shortcut ${settings.globalShortcut} is already used by another application.`);
      }
      return store.settings(configuredModelIds());
    }
  );
}

app.whenReady().then(async () => {
  store = new MemoryStore(join(app.getPath("userData"), "hiply-data.json"));
  await store.load();
  registerIpc();
  registerShortcut(store.getData().settings.globalShortcut);
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  void refreshQuickSourceRefs().catch(() => undefined);

  app.on("activate", () => {
    if (!mainWindow) mainWindow = createMainWindow();
    mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
