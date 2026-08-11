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
  Menu,
  nativeImage,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  Tray
} from "electron";
import type {
  ContactMemory,
  GenerateRequest,
  MemoryDocument,
  MemoryFact,
  OverlayStatus,
  SaveSettingsRequest,
  TestModelConnectionRequest,
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
import {
  frontmostMatchesQuickReplyContext,
  selectQuickReplySource,
  targetApplicationName,
  type QuickReplyContext
} from "./services/channel";
import { importLegacyBrandData, MemoryStore } from "./services/memory-store";
import { generateWithModel, testModelConnection } from "./services/model";

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: MemoryStore;
let quickReplyInFlight = false;
let quickSourceRefs: CaptureSourceRef[] = [];
let quickReplyAnchor: { x: number; y: number } | null = null;
let quickReplyTargetApplication = "";
let quickOverlayActive = false;
let quickReplyContext: QuickReplyContext | null = null;
let quickOverlayHiddenForContext = false;
let quickContextCheckInFlight = false;
let quickContextTimer: NodeJS.Timeout | null = null;

const OVERLAY_RESULT_SIZE = { width: 360, height: 136 };
const OVERLAY_LOADING_SIZE = { width: 360, height: 142 };
const OVERLAY_ERROR_SIZE = { width: 360, height: 174 };

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

function showMainWindow(): void {
  if (!mainWindow) mainWindow = createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow(): void {
  if (mainWindow?.isVisible()) {
    mainWindow.hide();
    return;
  }
  showMainWindow();
}

function createTrayIcon(): Electron.NativeImage {
  // A monochrome version of the reply-assistant mark. macOS recolors template
  // images automatically so the icon remains legible in either menu-bar theme.
  const png = "iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAJKADAAQAAAABAAAAJAAAAAAqDuP8AAAC8klEQVRYCe2WS4iOURjHX4z7ZURDRFHs1JRELhsbGysmKdaTrITEethMWUgjljbKJXYWdgorC2ShsCDjltxmCBF+/6/3fJ73vOe8l/HWN8VT/+88t/M/z7m853xJ8l9aK7CN32njaS2uUcz28VLQegr5AW6BGZ0sStt0FXwHv1K8oj0JloNC6SE6AO6AUeAIxtqK4x64DMQpHq3SabAWFEof0Y9grIOX9RP3CBgCOenyPCrmEpjg+Zs050Cmop+UkWqb6qzMC/L7U7ymLVsZP66xNGZUdGb8TjF7mNxeMDnFvhp9LafGjMpdIjY5prtiJhqmgxX7+pw64BmxZ0VfwqxMNG88x7UV3Ac/0/B8Wn0tdvnnYa8E00GRfCI4O5bgV+/b3+i4BtiVEZcmpQtupoEmtgjsBVpRn8vahMNik0L6I7r5xYSZ/ninoOrSuw1CnPJFJdbB+XXDboj2jge0gsuAbmXHZVvcYbFJMf0hXVd73XVedAPfTHGD9gLYDJxoZY+AEK/LybWhZN+ng+wXpcEOAK2gw1f0l2ATcLIERXGf08VzrZ8Ys0NFqaBQ/jkzigp/GsgzKUnSlbGqGToTK8BFcCrtonsoJIuNUxP5bOxSNTTDIp8GeJ9Ceih3wIw6Cf1dIM+kZNUQ4d/4rkCvS9PJRpQQn4u3WrtleiAXZqJ54w2uY2A4H2p7NKgO9GPwtu1NkkNGd6pu6qicJxKagfUdJkc38tQSaHus7Mf4AiyX9NxbZjvFltSS6GuqI3NJHgQfgOVxuj1jLV59MVbOYOyxDk/Xf6Dj4Jnnt6Y4u8EqsAUsBaFHewS/vlYdg7b4BelMnQW72xlZRTPTHyv9Hy4SbZneMT26/hjqJ54dQDd8JdlJlvbXLW2TrSbUV6mKQFJThYzCrQnqzPQExqnsKitIb1Z/ZbYGEosK0sFe18AYtShiBV2HZUEtpoaSQwWdgFtfY0fE3q56qXd1pAoz6FF0veQPQK/xd1TVLas/V/+m/Aagxb2ejhPzzgAAAABJRU5ErkJggg==";
  const icon = nativeImage.createFromBuffer(Buffer.from(png, "base64"), { scaleFactor: 2 });
  if (icon.isEmpty()) throw new Error("Could not create the ContextCue menu-bar icon.");
  icon.setTemplateImage(true);
  return icon;
}

function createTray(): Tray {
  const nextTray = new Tray(createTrayIcon());
  nextTray.setToolTip("ContextCue");
  nextTray.on("click", toggleMainWindow);
  nextTray.on("right-click", () => {
    nextTray.popUpContextMenu(Menu.buildFromTemplate([
      { label: "Open ContextCue", click: showMainWindow },
      { label: "Quick reply", click: () => void showQuickReply() },
      { type: "separator" },
      { label: "Quit ContextCue", role: "quit" }
    ]));
  });
  return nextTray;
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: OVERLAY_RESULT_SIZE.width,
    height: OVERLAY_RESULT_SIZE.height,
    minWidth: 320,
    minHeight: 118,
    frame: false,
    transparent: true,
    resizable: false,
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
  const anchor = quickReplyAnchor ?? screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(anchor);
  const [width, height] = overlayWindow.getSize();
  const margin = 18;
  const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
  const x = clamp(anchor.x - 24, workArea.x + margin, workArea.x + workArea.width - width - margin);
  const preferredY = anchor.y + 14;
  const fallbackY = anchor.y - height - 14;
  const y = clamp(
    preferredY + height <= workArea.y + workArea.height - margin ? preferredY : fallbackY,
    workArea.y + margin,
    workArea.y + workArea.height - height - margin
  );
  overlayWindow.setPosition(x, y, false);
}

function showOverlayStatus(status: OverlayStatus): void {
  if (!overlayWindow) overlayWindow = createOverlayWindow();
  const size = status.state === "error" ? OVERLAY_ERROR_SIZE : OVERLAY_LOADING_SIZE;
  overlayWindow.setSize(size.width, size.height, false);
  positionOverlayNearInput();
  sendToOverlay("overlay:status", status);
  if (!quickOverlayHiddenForContext) overlayWindow.showInactive();
}

interface FrontmostWindow {
  applicationName: string;
  windowTitle: string;
}

async function frontmostWindow(): Promise<FrontmostWindow> {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        "tell application \"System Events\"",
        "-e",
        "set frontProcess to first application process whose frontmost is true",
        "-e",
        "set applicationName to name of frontProcess",
        "-e",
        "try",
        "-e",
        "set windowTitle to name of front window of frontProcess as text",
        "-e",
        "on error",
        "-e",
        "set windowTitle to \"\"",
        "-e",
        "end try",
        "-e",
        "return applicationName & linefeed & windowTitle",
        "-e",
        "end tell"
      ]);
      const [applicationName = "", ...titleLines] = stdout.trimEnd().split(/\r?\n/);
      return { applicationName: applicationName.trim(), windowTitle: titleLines.join("\n").trim() };
    }
    if (process.platform === "linux") {
      const { stdout } = await execFileAsync("xdotool", ["getactivewindow", "getwindowname"]);
      return { applicationName: "", windowTitle: stdout.trim() };
    }
  } catch {
    return { applicationName: "", windowTitle: "" };
  }
  return { applicationName: "", windowTitle: "" };
}

async function refreshQuickSourceRefs(): Promise<CaptureSourceRef[]> {
  quickSourceRefs = await listCaptureSourceRefs();
  return quickSourceRefs;
}

function bindQuickReplyContext(source: CaptureSourceRef, frontmost: FrontmostWindow): void {
  quickReplyContext = {
    applicationName: frontmost.applicationName,
    windowTitle: frontmost.windowTitle,
    sourceName: source.name,
    channel: source.channel
  };
  quickOverlayHiddenForContext = false;
}

function clearQuickReplySession(): void {
  quickOverlayActive = false;
  quickReplyTargetApplication = "";
  quickReplyContext = null;
  quickOverlayHiddenForContext = false;
}

async function syncQuickOverlayWithFrontmostWindow(): Promise<void> {
  if (
    quickContextCheckInFlight
    || !quickOverlayActive
    || !quickReplyContext
    || !overlayWindow
    || overlayWindow.isFocused()
  ) return;

  if (mainWindow?.isFocused()) {
    if (overlayWindow.isVisible()) overlayWindow.hide();
    quickOverlayHiddenForContext = true;
    return;
  }

  quickContextCheckInFlight = true;
  const context = quickReplyContext;
  try {
    const current = await frontmostWindow();
    if (!quickOverlayActive || quickReplyContext !== context) return;
    const matches = frontmostMatchesQuickReplyContext(
      context,
      current.applicationName,
      current.windowTitle
    );
    if (matches) {
      if (quickOverlayHiddenForContext) {
        quickOverlayHiddenForContext = false;
        positionOverlayNearInput();
        overlayWindow.showInactive();
      }
      return;
    }
    if (overlayWindow.isVisible()) overlayWindow.hide();
    quickOverlayHiddenForContext = true;
  } finally {
    quickContextCheckInFlight = false;
  }
}

async function showQuickReply(): Promise<void> {
  if (quickReplyInFlight) return;
  quickReplyInFlight = true;
  const startedAt = performance.now();
  let discoveryFinishedAt = startedAt;
  let captureFinishedAt = startedAt;
  try {
    quickOverlayActive = true;
    quickReplyTargetApplication = "";
    quickReplyContext = null;
    quickOverlayHiddenForContext = false;
    quickReplyAnchor = screen.getCursorScreenPoint();
    mainWindow?.hide();
    showOverlayStatus({ state: "loading", message: "Reading the current conversation…" });
    const [frontmost, availableSources] = await Promise.all([
      frontmostWindow(),
      // Window IDs and browser titles can change whenever the user switches a
      // tab. Always discover a fresh source before a quick capture.
      refreshQuickSourceRefs()
    ]);
    let source = selectQuickReplySource(availableSources, frontmost.applicationName, frontmost.windowTitle);
    if (!source) {
      source = selectQuickReplySource(await refreshQuickSourceRefs(), frontmost.applicationName, frontmost.windowTitle);
    }
    if (!source) {
      throw new Error("No active conversation window was found. Keep the page or app window visible and try again.");
    }
    quickReplyTargetApplication = frontmost.applicationName;
    bindQuickReplyContext(source, frontmost);
    discoveryFinishedAt = performance.now();

    let screenshot: string;
    try {
      screenshot = await captureQuickSource(source.id);
    } catch {
      source = selectQuickReplySource(
        await refreshQuickSourceRefs(),
        frontmost.applicationName,
        frontmost.windowTitle
      );
      if (!source) throw new Error("The current page or app window is no longer available. Keep it visible and try again.");
      bindQuickReplyContext(source, frontmost);
      screenshot = await captureQuickSource(source.id);
    }
    captureFinishedAt = performance.now();
    const snapshot = store.getData();
    const model = snapshot.settings.models.find((item) => item.id === snapshot.settings.activeModelId)
      ?? snapshot.settings.models[0];
    showOverlayStatus({
      state: "loading",
      message: `Generating ${snapshot.settings.candidateCount} replies with ${model?.name || "the current model"}…`
    });
    const request: GenerateRequest = {
      sourceId: source.id,
      channel: source.channel,
      locale: snapshot.settings.locale,
      quick: true
    };
    const result = await generateWithModel(snapshot, readApiKey(), request, screenshot);
    const contact = result.detectedContact;
    overlayWindow?.setSize(OVERLAY_RESULT_SIZE.width, OVERLAY_RESULT_SIZE.height, false);
    positionOverlayNearInput();
    sendToOverlay("overlay:result", { ...result, channel: source.channel, contact });
    if (!quickOverlayHiddenForContext) overlayWindow?.showInactive();
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
  if (process.env.CONTEXTCUE_API_KEY && modelId === store.getData().settings.activeModelId) return process.env.CONTEXTCUE_API_KEY;
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
    throw new Error("Secure key storage is unavailable on this device. Use the CONTEXTCUE_API_KEY environment variable instead.");
  }
  return safeStorage.encryptString(apiKey.trim()).toString("base64");
}

function appleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function activateApplication(applicationName: string): Promise<void> {
  if (!applicationName) return;
  if (process.platform === "darwin") {
    await execFileAsync("/usr/bin/open", ["-a", applicationName]);
    return;
  }
  if (process.platform === "win32") {
    const escapedName = applicationName.replace(/'/g, "''");
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(New-Object -ComObject WScript.Shell).AppActivate('${escapedName}') | Out-Null`
    ]);
    return;
  }
  await execFileAsync("xdotool", ["search", "--name", applicationName, "windowactivate"]);
}

async function hideQuickOverlay(): Promise<void> {
  overlayWindow?.hide();
  if (!quickOverlayActive) return;
  const target = quickReplyTargetApplication;
  clearQuickReplySession();
  try {
    await activateApplication(target);
  } catch (error) {
    console.warn("[quick-reply] could not restore the originating application", error);
  }
}

async function bestEffortPaste(channel: UseReplyRequest["channel"]): Promise<{ pasted: boolean; error?: string }> {
  try {
    if (process.platform === "darwin") {
      if (!systemPreferences.isTrustedAccessibilityClient(true)) {
        await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
        return {
          pasted: false,
          error: "Allow ContextCue (or Electron while developing) in Accessibility, then click Insert again. The reply was copied."
        };
      }
      overlayWindow?.hide();
      mainWindow?.hide();
      const target = quickReplyTargetApplication || targetApplicationName(channel);
      const escapedTarget = target ? appleScriptString(target) : "";
      const script = escapedTarget
        ? `tell application "System Events"\nif not (exists process "${escapedTarget}") then error "Target application is not running"\nset frontmost of process "${escapedTarget}" to true\ndelay 0.15\nkeystroke "v" using command down\nend tell`
        : "tell application \"System Events\"\ndelay 0.15\nkeystroke \"v\" using command down\nend tell";
      await execFileAsync("osascript", ["-e", script]);
      clearQuickReplySession();
      return { pasted: true };
    }
    if (process.platform === "win32") {
      overlayWindow?.hide();
      mainWindow?.hide();
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('^v')"
      ]);
      clearQuickReplySession();
      return { pasted: true };
    }
    await execFileAsync("xdotool", ["key", "ctrl+v"]);
    clearQuickReplySession();
    return { pasted: true };
  } catch (error) {
    if (!quickOverlayHiddenForContext) overlayWindow?.showInactive();
    return {
      pasted: false,
      error: `Could not focus the chat input. The reply was copied. ${error instanceof Error ? error.message : ""}`.trim()
    };
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
      clearQuickReplySession();
      if (!overlayWindow) overlayWindow = createOverlayWindow();
      overlayWindow.setSize(OVERLAY_RESULT_SIZE.width, OVERLAY_RESULT_SIZE.height, false);
      positionOverlayNearInput();
      sendToOverlay("overlay:result", { ...result, channel: request.channel, contact });
      overlayWindow.show();
      overlayWindow.focus();
    }
    return result;
  });

  ipcMain.handle("reply:use", async (_event, request: UseReplyRequest) => {
    clipboard.writeText(request.text);
    const pasteResult = request.paste ? await bestEffortPaste(request.channel) : { pasted: false };
    void store.rememberAcceptedReply({
      text: request.text,
      channel: request.channel,
      contact: request.contact
    }).catch((error) => console.warn("[memory] could not remember accepted reply", error));
    return { copied: true, ...pasteResult };
  });
  ipcMain.handle("overlay:hide", () => hideQuickOverlay());

  ipcMain.handle("memory:get", () => store.snapshot());
  ipcMain.handle("memory:document-save", (_event, document: MemoryDocument) => store.saveMemoryDocument(document));
  ipcMain.handle("memory:document-delete", (_event, id: string) => store.deleteMemoryDocument(id));
  ipcMain.handle("memory:profile", (_event, profile: UserProfile) => store.saveProfile(profile));
  ipcMain.handle("memory:contact-save", (_event, contact: ContactMemory) => store.saveContact(contact));
  ipcMain.handle("memory:contact-delete", (_event, id: string) => store.deleteContact(id));
  ipcMain.handle(
    "memory:fact-add",
    (_event, fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) => store.addFact(fact)
  );
  ipcMain.handle("memory:fact-delete", (_event, id: string) => store.deleteFact(id));

  ipcMain.handle("settings:get", () => store.settings(configuredModelIds()));
  ipcMain.handle("settings:test-model", (_event, incoming: TestModelConnectionRequest) =>
    testModelConnection(incoming.model, incoming.apiKey?.trim() || readApiKey(incoming.model.id))
  );
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
      const previousShortcut = store.getData().settings.globalShortcut;
      if (settings.globalShortcut !== previousShortcut && !registerShortcut(settings.globalShortcut)) {
        registerShortcut(previousShortcut);
        throw new Error(`The shortcut ${settings.globalShortcut} is already used by another application.`);
      }
      try {
        await store.saveSettings(settings, encryptedApiKeys);
      } catch (error) {
        if (settings.globalShortcut !== previousShortcut) registerShortcut(previousShortcut);
        throw error;
      }
      return store.settings(configuredModelIds());
    }
  );
}

app.whenReady().then(async () => {
  const dataPath = join(app.getPath("userData"), "contextcue-data.json");
  const legacyDataPath = join(app.getPath("appData"), "hiply", "hiply-data.json");
  if (await importLegacyBrandData(dataPath, legacyDataPath)) {
    console.info("[settings] imported existing Hiply data into ContextCue");
  }
  store = new MemoryStore(dataPath);
  await store.load();
  registerIpc();
  registerShortcut(store.getData().settings.globalShortcut);
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  tray = createTray();
  void refreshQuickSourceRefs().catch(() => undefined);
  quickContextTimer = setInterval(() => void syncQuickOverlayWithFrontmostWindow(), 600);

  app.on("activate", () => {
    if (quickOverlayActive) return;
    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (quickContextTimer) clearInterval(quickContextTimer);
  quickContextTimer = null;
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
});
