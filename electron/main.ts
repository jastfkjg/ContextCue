import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  safeStorage,
  shell,
  systemPreferences
} from "electron";
import type {
  ContactMemory,
  GenerateRequest,
  MemoryFact,
  SaveSettingsRequest,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";
import { listCaptureSources, captureSource } from "./services/capture";
import { targetApplicationName } from "./services/channel";
import { MemoryStore } from "./services/memory-store";
import { generateWithModel } from "./services/model";

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let store: MemoryStore;

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
    width: 520,
    height: 390,
    minWidth: 440,
    minHeight: 320,
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

function showMainCapture(): void {
  if (!mainWindow) mainWindow = createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("capture:requested");
}

function registerShortcut(accelerator: string): boolean {
  globalShortcut.unregisterAll();
  return globalShortcut.register(accelerator, showMainCapture);
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
      overlayWindow.webContents.send("overlay:result", { ...result, channel: request.channel, contact });
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

  app.on("activate", () => {
    if (!mainWindow) mainWindow = createMainWindow();
    mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => globalShortcut.unregisterAll());
