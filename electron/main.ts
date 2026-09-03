import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
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
  net,
  nativeImage,
  Notification,
  safeStorage,
  screen,
  shell,
  systemPreferences,
  Tray
} from "electron";
import type {
  AskOverlayContext,
  AskRequest,
  AskStreamEvent,
  ChannelId,
  ContactMemory,
  GenerateRequest,
  InputTarget,
  MemoryDocument,
  MemoryFact,
  OverlayStatus,
  ReviseSuggestionRequest,
  SaveSettingsRequest,
  TestModelConnectionRequest,
  TokenUsageRecord,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";
import {
  captureSource,
  captureQuickSource,
  listCaptureSources
} from "./services/capture";
import {
  targetApplicationName
} from "./services/channel";
import { importLegacyBrandData, MemoryStore } from "./services/memory-store";
import { generateWithModel, streamAnswerWithModel, testModelConnection } from "./services/model";
import { getFocusedInputTarget, sameInputTarget, writeMacInputTarget } from "./services/input-target";
import electronUpdater from "electron-updater";
import { UpdateService } from "./services/updater";
import { downloadInstaller, macInstallerAsset, verifyInstaller } from "./services/installer-download";
import type { AppUpdateState } from "../src/shared/types";
import { getFrontmostWindow, sameFrontmostWindow, type FrontmostWindow } from "./services/front-window";
import { prepareQuickContext } from "./services/quick-context";
import { prepareQuickWindows } from "./services/quick-windows";
import { OverlaySizer } from "./services/overlay-size";
import { createPageSession, pageRequest, rememberPageTurn, type PageSession } from "./services/page-session";
import { createVisionProbe } from "./services/vision-probe";
import type { OverlayResizeEdge } from "../src/shared/types";

const execFileAsync = promisify(execFile);
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let store: MemoryStore;
let updates: UpdateService;
let openUpdatesRequested = false;
const installerAbort = new AbortController();
let quickReplyInFlight = false;
let quickReplyAnchor: { x: number; y: number } | null = null;
let quickReplyTargetApplication = "";
let quickInputTarget: InputTarget | null = null;
let quickOverlayActive = false;
let quickReplyContext: FrontmostWindow | null = null;
let quickOverlayHiddenForContext = false;
let quickContextCheckInFlight = false;
let quickContextTimer: NodeJS.Timeout | null = null;

type QuickOverlaySession = PageSession;
let quickOverlaySession: PageSession | null = null;
let quickInvocation = 0;
let suggestionController: AbortController | null = null;
let revisionController: AbortController | null = null;
let askInFlight: { requestId: string; controller: AbortController } | null = null;

let overlaySizer: OverlaySizer | null = null;
let overlayManuallyPositioned = false;
const OVERLAY_RESULT_SIZE = { width: 420, height: 140 };
const ASK_SESSION_TTL_MS = 5 * 60_000;

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
      { label: "Smart suggestions", click: () => void showQuickReply() },
      { label: "Ask AI", click: () => requestQuickAsk() },
      { type: "separator" },
      { label: "Check for Updates…", click: () => { showUpdates(); void updates.check(); } },
      { type: "separator" },
      { label: "Quit ContextCue", role: "quit" }
    ]));
  });
  return nextTray;
}

function showUpdates(): void {
  openUpdatesRequested = true;
  showMainWindow();
  if (mainWindow && !mainWindow.webContents.isLoadingMainFrame()) {
    openUpdatesRequested = false;
    mainWindow.webContents.send("updates:open");
  }
}

function createUpdateService(): UpdateService {
  const metadata = JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf8"));
  const supported = process.platform === "darwin" || process.platform === "win32"
    || (process.platform === "linux" && Boolean(process.env.APPIMAGE));
  const mode: AppUpdateState["mode"] = !app.isPackaged || !supported ? "unavailable"
    : process.platform === "darwin" && metadata.contextcueMacAutoUpdate !== true ? "installer" : "automatic";
  return new UpdateService({
    engine: electronUpdater.autoUpdater,
    currentVersion: app.getVersion(),
    mode,
    onState: (state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("updates:state", state);
    },
    notify: (state) => {
      if (!Notification.isSupported()) return;
      const notification = new Notification({
        title: state.status === "downloaded" ? "ContextCue update ready" : "ContextCue update available",
        body: state.status === "downloaded" ? "Open ContextCue to finish updating." : `Version ${state.availableVersion} is ready to download.`
      });
      notification.on("click", showUpdates);
      try { notification.show(); }
      catch (error) { console.warn("[updates] could not show notification", error); }
    },
    downloadInstaller: (info, progress) => downloadInstaller(
      macInstallerAsset(info, process.arch), join(app.getPath("userData"), "updates"),
      (url, init) => net.fetch(url instanceof URL ? url.toString() : url, init), progress, installerAbort.signal
    ),
    openInstaller: async (path, info) => {
      await verifyInstaller(path, macInstallerAsset(info, process.arch));
      const error = await shell.openPath(path);
      if (error) throw new Error(error);
    }
  });
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: OVERLAY_RESULT_SIZE.width,
    height: OVERLAY_RESULT_SIZE.height,
    minWidth: 340,
    minHeight: 96,
    frame: false,
    // Native panels join fullscreen Spaces without transforming the entire app's
    // process type (which can hide its main window and disrupt Split View).
    type: process.platform === "darwin" ? "panel" : undefined,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    // Transparent windows use our edge handles; native resizing is unreliable across platforms.
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  window.setHasShadow(false);
  overlaySizer = new OverlaySizer(window, (bounds) => screen.getDisplayMatching(bounds).workArea);
  if (process.platform !== "darwin") window.setVisibleOnAllWorkspaces(true);
  void loadRenderer(window, "overlay");
  window.on("closed", () => {
    overlayWindow = null;
    overlaySizer = null;
    clearQuickReplySession();
  });
  return window;
}

function sendToOverlay(
  channel: "overlay:status" | "overlay:result" | "overlay:ask-open" | "overlay:ask-event" | "overlay:reset",
  payload: unknown
): void {
  if (!overlayWindow) overlayWindow = createOverlayWindow();
  if (channel === "overlay:result") {
    overlaySizer?.show("suggestions");
    overlayManuallyPositioned = false;
  } else if (channel === "overlay:ask-open") overlaySizer?.show("ask");
  else if (channel === "overlay:status") overlaySizer?.show((payload as OverlayStatus).state === "error" ? "error" : "loading");
  if (channel !== "overlay:ask-event" && channel !== "overlay:reset") positionOverlayNearInput();
  const invocation = quickInvocation;
  const destination = overlayWindow;
  const send = () => {
    if (invocation === quickInvocation && destination === overlayWindow && !destination.isDestroyed()) {
      destination.webContents.send(channel, payload);
    }
  };
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
  sendToOverlay("overlay:status", status);
  if (!quickOverlayHiddenForContext) overlayWindow.showInactive();
}

function bindQuickOverlayContext(frontmost: FrontmostWindow): void {
  quickReplyContext = frontmost.windowId ? frontmost : null;
  quickOverlayHiddenForContext = false;
}

async function prepareCurrentWindow(allowWithoutScreenshot: boolean) {
  // Clear the old overlay before capture, preserving the main window's Space.
  await prepareQuickWindows({
    platform: process.platform,
    main: mainWindow,
    overlay: overlayWindow,
    activateExternal: async () => {
      const target = await getFrontmostWindow();
      if (target.windowId && target.applicationName) await activateApplication(target.applicationName);
    }
  });
  return prepareQuickContext({
    getWindow: () => getFrontmostWindow(),
    getTarget: getFocusedInputTarget,
    capture: captureQuickSource
  }, allowWithoutScreenshot);
}

function cancelAskInFlight(requestId?: string): void {
  if (!askInFlight || (requestId && askInFlight.requestId !== requestId)) return;
  askInFlight.controller.abort();
  askInFlight = null;
}

function clearQuickReplySession(): void {
  quickInvocation += 1;
  suggestionController?.abort();
  suggestionController = null;
  revisionController?.abort();
  revisionController = null;
  quickReplyInFlight = false;
  cancelAskInFlight();
  quickOverlayActive = false;
  quickReplyTargetApplication = "";
  quickInputTarget = null;
  quickReplyContext = null;
  quickOverlaySession = null;
  quickOverlayHiddenForContext = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) sendToOverlay("overlay:reset", null);
}

async function syncQuickOverlayWithFrontmostWindow(): Promise<void> {
  if (quickOverlaySession && Date.now() - quickOverlaySession.createdAt > ASK_SESSION_TTL_MS) {
    overlayWindow?.hide();
    clearQuickReplySession();
    return;
  }
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
    const [current, currentTarget] = await Promise.all([
      getFrontmostWindow(),
      quickInputTarget ? getFocusedInputTarget() : Promise.resolve(null)
    ]);
    if (!quickOverlayActive || quickReplyContext !== context) return;
    const matches = sameFrontmostWindow(context, current);
    if (!matches) {
      overlayWindow.hide();
      clearQuickReplySession();
      return;
    }
    const targetMatches = !quickInputTarget || sameInputTarget(quickInputTarget, currentTarget);
    if (matches && targetMatches) {
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

function askContextForSession(session: QuickOverlaySession): AskOverlayContext {
  return {
    sessionId: session.id,
    applicationName: session.frontmost.applicationName,
    windowTitle: session.frontmost.windowTitle,
    channel: session.source?.channel ?? "other",
    hasPageContext: Boolean(session.screenshot),
    contextUnavailableReason: session.contextUnavailableReason,
    canReturnToSuggestions: session.hasSuggestions
  };
}

function usableQuickOverlaySession(): QuickOverlaySession | null {
  const session = quickOverlaySession;
  if (!session) return null;
  if (Date.now() - session.createdAt <= ASK_SESSION_TTL_MS) return session;
  clearQuickReplySession();
  return null;
}

async function assertSessionCurrent(session: PageSession): Promise<void> {
  if (quickOverlaySession !== session) throw new Error("This page session has ended. Open ContextCue again.");
  // macOS can inspect the external window underneath our panel. Other platforms
  // report our own window while it is focused, so their background watcher checks it.
  if (session.frontmost.windowId && (process.platform === "darwin" || !overlayWindow?.isFocused())) {
    const current = await getFrontmostWindow();
    if (quickOverlaySession !== session) throw new Error("This page session has ended. Open ContextCue again.");
    if (!sameFrontmostWindow(session.frontmost, current)) {
      overlayWindow?.hide();
      clearQuickReplySession();
      throw new Error("The window or page changed. Open ContextCue again on the current page.");
    }
  }
}

async function reviseSuggestion(request: ReviseSuggestionRequest): Promise<string> {
  const session = usableQuickOverlaySession();
  if (!session || request.sessionId !== session.id || !session.result || !session.screenshot) {
    throw new Error("This suggestion has expired. Open ContextCue again on the current page.");
  }
  if (typeof request.text !== "string" || !request.text.trim() || request.text.length > 16_000
    || typeof request.instruction !== "string" || !request.instruction.trim() || request.instruction.length > 2_000) {
    throw new Error("Enter a draft and a revision instruction (up to 2,000 characters).");
  }
  await assertSessionCurrent(session);
  revisionController?.abort();
  const controller = new AbortController();
  revisionController = controller;
  const snapshot = store.getData();
  const generation = { ...pageRequest(session, snapshot.settings.locale), revision: { text: request.text, instruction: request.instruction } };
  try {
    const result = await generateWithModel(snapshot, readApiKey(), generation, session.screenshot, fetch, controller.signal);
    if (controller.signal.aborted || quickOverlaySession !== session) throw new Error("Revision cancelled.");
    await assertSessionCurrent(session);
    await rememberTokenUsage(generation, result, snapshot);
    if (controller.signal.aborted || quickOverlaySession !== session) throw new Error("Revision cancelled.");
    return result.candidates[0].text;
  } finally {
    if (revisionController === controller) revisionController = null;
  }
}

function showAskOverlay(session: QuickOverlaySession): AskOverlayContext {
  if (!overlayWindow) overlayWindow = createOverlayWindow();
  const context = askContextForSession(session);
  sendToOverlay("overlay:ask-open", context);
  overlayWindow.show();
  overlayWindow.focus();
  return context;
}

async function showQuickAsk(): Promise<AskOverlayContext> {
  if (quickReplyInFlight) throw new Error("ContextCue is already preparing the current page.");

  clearQuickReplySession();
  const invocation = quickInvocation;
  quickReplyInFlight = true;
  try {
    quickOverlayActive = true;
    quickReplyAnchor = screen.getCursorScreenPoint();
    const context = await prepareCurrentWindow(true);
    if (invocation !== quickInvocation) throw new Error("This invocation was replaced. Open Ask AI again.");
    const { target: focusedTarget, frontmost } = context;
    quickInputTarget = focusedTarget;
    quickReplyTargetApplication = frontmost.applicationName;
    if (focusedTarget?.bounds) {
      quickReplyAnchor = {
        x: focusedTarget.bounds.x + Math.min(24, focusedTarget.bounds.width / 2),
        y: focusedTarget.bounds.y + focusedTarget.bounds.height
      };
    }
    bindQuickOverlayContext(frontmost);
    const session = createPageSession(context);
    quickOverlaySession = session;
    return showAskOverlay(session);
  } catch (error) {
    if (invocation === quickInvocation) clearQuickReplySession();
    throw error;
  } finally {
    if (invocation === quickInvocation) quickReplyInFlight = false;
  }
}

function requestQuickAsk(): void {
  void showQuickAsk().catch((error) => {
    showOverlayStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  });
}

async function showQuickReply(): Promise<void> {
  if (quickReplyInFlight) return;
  clearQuickReplySession();
  const invocation = quickInvocation;
  const controller = new AbortController();
  suggestionController = controller;
  quickReplyInFlight = true;
  const startedAt = performance.now();
  let captureFinishedAt = startedAt;
  try {
    quickOverlayActive = true;
    quickReplyTargetApplication = "";
    quickInputTarget = null;
    quickReplyContext = null;
    quickOverlayHiddenForContext = false;
    quickReplyAnchor = screen.getCursorScreenPoint();
    const context = await prepareCurrentWindow(false);
    if (invocation !== quickInvocation) return;
    const { target: focusedTarget, frontmost, source, screenshot } = context;
    if (!source || !screenshot) throw new Error("The current window could not be captured. Try opening Ask AI without page context.");
    quickInputTarget = focusedTarget;
    quickReplyTargetApplication = frontmost.applicationName;
    if (focusedTarget?.bounds) {
      quickReplyAnchor = {
        x: focusedTarget.bounds.x + Math.min(24, focusedTarget.bounds.width / 2),
        y: focusedTarget.bounds.y + focusedTarget.bounds.height
      };
    }
    bindQuickOverlayContext(frontmost);
    captureFinishedAt = performance.now();
    const session = createPageSession(context);
    quickOverlaySession = session;
    quickReplyInFlight = false;
    const snapshot = store.getData();
    const model = snapshot.settings.models.find((item) => item.id === snapshot.settings.activeModelId)
      ?? snapshot.settings.models[0];
    showOverlayStatus({
      state: "loading",
      message: `Generating ${snapshot.settings.candidateCount} suggestions…`,
      modelName: model?.model || model?.name || "Configured model"
    });
    const request = pageRequest(session, snapshot.settings.locale);
    const result = await generateWithModel(snapshot, readApiKey(), request, screenshot, fetch, controller.signal);
    if (controller.signal.aborted || quickOverlaySession !== session) return;
    await assertSessionCurrent(session);
    await rememberTokenUsage(request, result, snapshot);
    if (controller.signal.aborted || quickOverlaySession !== session) return;
    const contact = result.detectedContact;
    session.result = result;
    session.hasSuggestions = true;
    sendToOverlay("overlay:result", { ...result, sessionId: session.id, channel: source.channel, contact, target: focusedTarget ?? undefined });
    if (!quickOverlayHiddenForContext) overlayWindow?.showInactive();
    const finishedAt = performance.now();
    console.info(
      `[quick-reply] prepare=${Math.round(captureFinishedAt - startedAt)}ms `
      + `model=${Math.round(finishedAt - captureFinishedAt)}ms total=${Math.round(finishedAt - startedAt)}ms`
    );
  } catch (error) {
    if (invocation !== quickInvocation || controller.signal.aborted) return;
    console.warn(`[quick-reply] failed after ${Math.round(performance.now() - startedAt)}ms`, error);
    showOverlayStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    if (invocation === quickInvocation) quickReplyInFlight = false;
    if (suggestionController === controller) suggestionController = null;
  }
}

function registerShortcuts(replyShortcut: string, askShortcut: string): { ok: true } | { ok: false; shortcut: string } {
  globalShortcut.unregisterAll();
  if (replyShortcut === askShortcut) return { ok: false, shortcut: askShortcut };
  if (!globalShortcut.register(replyShortcut, () => void showQuickReply())) {
    return { ok: false, shortcut: replyShortcut };
  }
  if (!globalShortcut.register(askShortcut, requestQuickAsk)) {
    globalShortcut.unregisterAll();
    return { ok: false, shortcut: askShortcut };
  }
  return { ok: true };
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

async function rememberTokenUsage(
  request: GenerateRequest,
  result: Awaited<ReturnType<typeof generateWithModel>>,
  data = store.getData()
): Promise<void> {
  if (!result.tokenUsage) return;
  const model = data.settings.models.find((item) => item.id === data.settings.activeModelId) ?? data.settings.models[0];
  if (!model) return;
  const record: Omit<TokenUsageRecord, "id" | "createdAt"> = {
    ...result.tokenUsage,
    modelId: model.id,
    modelName: model.name,
    model: model.model,
    apiProtocol: model.apiProtocol,
    requestType: request.target
      ? (request.quick ? "quick-assist" : "assist")
      : (request.quick ? "quick-reply" : "reply"),
    channel: request.channel
  };
  await store.recordTokenUsage(record);
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

async function bestEffortPaste(request: UseReplyRequest): Promise<{ pasted: boolean; error?: string }> {
  try {
    if (!request.target) return { pasted: false, error: "No editable field was identified. The suggestion was copied." };
    if (process.platform === "darwin") {
      if (!systemPreferences.isTrustedAccessibilityClient(true)) {
        await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
        return {
          pasted: false,
          error: "Allow ContextCue (or Electron while developing) in Accessibility, then try again. The suggestion was copied."
        };
      }
      overlayWindow?.hide();
      const targetApplication = request.target?.applicationName || quickReplyTargetApplication || targetApplicationName(request.channel);
      await activateApplication(targetApplication || "");
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (request.target) {
        const currentTarget = await getFocusedInputTarget();
        if (!sameInputTarget(request.target, currentTarget)) {
          if (!quickOverlayHiddenForContext) overlayWindow?.showInactive();
          return {
            pasted: false,
            error: "The focused field changed. The suggestion was copied, but nothing was inserted."
          };
        }
        if (request.target.sensitive) {
          return { pasted: false, error: "ContextCue does not insert into sensitive fields." };
        }
        if (await writeMacInputTarget(request.text, request.action ?? "insert")) {
          clearQuickReplySession();
          return { pasted: true };
        }
      }
      const escapedTarget = targetApplication ? appleScriptString(targetApplication) : "";
      const replaceAll = request.action === "replace-all" ? "keystroke \"a\" using command down\n" : "";
      const script = escapedTarget
        ? `tell application "System Events"\nif not (exists process "${escapedTarget}") then error "Target application is not running"\nset frontmost of process "${escapedTarget}" to true\ndelay 0.15\n${replaceAll}keystroke "v" using command down\nend tell`
        : `tell application "System Events"\ndelay 0.15\n${replaceAll}keystroke "v" using command down\nend tell`;
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
      error: `Could not restore the target input. The suggestion was copied. ${error instanceof Error ? error.message : ""}`.trim()
    };
  }
}

function sendAskEvent(event: AskStreamEvent): void {
  if (!overlayWindow || !quickOverlayActive) return;
  sendToOverlay("overlay:ask-event", event);
}

async function screenshotForAsk(session: QuickOverlaySession): Promise<string> {
  // Ask always uses the snapshot from invocation, even if the tab later changes.
  if (session.screenshot) return session.screenshot;
  throw new Error(session.contextUnavailableReason || "No page snapshot is available. Turn off page context and ask again.");
}

async function rememberAskTokenUsage(
  tokenUsage: Awaited<ReturnType<typeof streamAnswerWithModel>>["tokenUsage"],
  channel: ChannelId,
  data = store.getData()
): Promise<void> {
  const model = data.settings.models.find((item) => item.id === data.settings.activeModelId) ?? data.settings.models[0];
  if (!model) return;
  await store.recordTokenUsage({
    ...tokenUsage,
    modelId: model.id,
    modelName: model.name,
    model: model.model,
    apiProtocol: model.apiProtocol,
    requestType: "ask",
    channel
  });
}

async function startAsk(request: AskRequest): Promise<void> {
  const session = usableQuickOverlaySession();
  if (!session || session.id !== request.sessionId) {
    sendAskEvent({
      type: "error",
      sessionId: request.sessionId,
      requestId: request.requestId,
      message: "This page context expired. Open Ask AI again."
    });
    return;
  }
  const question = request.question.trim().slice(0, 2_000);
  if (!question) {
    sendAskEvent({ type: "error", sessionId: session.id, requestId: request.requestId, message: "Type a question first." });
    return;
  }

  cancelAskInFlight();
  const controller = new AbortController();
  askInFlight = { requestId: request.requestId, controller };
  const snapshot = store.getData();
  try {
    await assertSessionCurrent(session);
    const screenshot = request.includeContext ? await screenshotForAsk(session) : "";
    const result = await streamAnswerWithModel(
      snapshot,
      readApiKey(),
      question,
      screenshot,
      session.history,
      request.includeContext
        ? { applicationName: session.frontmost.applicationName, windowTitle: session.frontmost.windowTitle }
        : undefined,
      (delta) => {
        if (askInFlight?.requestId !== request.requestId || quickOverlaySession !== session) return;
        sendAskEvent({ type: "delta", sessionId: session.id, requestId: request.requestId, delta });
      },
      controller.signal
    );
    if (askInFlight?.requestId !== request.requestId || quickOverlaySession !== session) return;
    await rememberAskTokenUsage(result.tokenUsage, session.source?.channel ?? "other", snapshot);
    if (askInFlight?.requestId !== request.requestId || quickOverlaySession !== session) return;
    rememberPageTurn(session, question, result.answer);
    sendAskEvent({ type: "complete", sessionId: session.id, requestId: request.requestId, answer: result.answer });
  } catch (error) {
    if (quickOverlaySession !== session) return;
    const cancelled = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    sendAskEvent(cancelled
      ? { type: "cancelled", sessionId: session.id, requestId: request.requestId }
      : {
          type: "error",
          sessionId: session.id,
          requestId: request.requestId,
          message: error instanceof Error ? error.message : String(error)
        });
  } finally {
    if (askInFlight?.requestId === request.requestId) askInFlight = null;
  }
}

async function exitAsk(returnToSuggestions: boolean): Promise<void> {
  cancelAskInFlight();
  const session = usableQuickOverlaySession();
  if (!returnToSuggestions || !session?.hasSuggestions) {
    await hideQuickOverlay();
    return;
  }
  overlaySizer?.show("suggestions");
  positionOverlayNearInput();
  try {
    await activateApplication(quickReplyTargetApplication);
  } catch (error) {
    console.warn("[ask] could not restore the originating application", error);
  }
  if (!quickOverlayHiddenForContext) overlayWindow?.showInactive();
}

function registerIpc(): void {
  // The floating overlay has no authority to download or install software.
  const requireMainWindow = (event: Electron.IpcMainInvokeEvent) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("Open Settings to manage updates.");
  };
  ipcMain.handle("updates:get", (event) => { requireMainWindow(event); return updates.snapshot(); });
  ipcMain.handle("updates:check", (event) => { requireMainWindow(event); return updates.check(); });
  ipcMain.handle("updates:download", (event) => { requireMainWindow(event); return updates.download(); });
  ipcMain.handle("updates:install", (event) => { requireMainWindow(event); return updates.install(); });
  ipcMain.on("updates:ready", (event) => {
    if (mainWindow && event.sender === mainWindow.webContents && openUpdatesRequested) {
      openUpdatesRequested = false;
      event.sender.send("updates:open");
    }
  });
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
  ipcMain.handle("permissions:open-accessibility", async () => {
    if (process.platform === "darwin") await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
  });

  const generateAssistance = async (request: GenerateRequest) => {
    const invocation = quickInvocation;
    request = { ...request, contextPolicy: "page-only" };
    const screenshot = request.imageDataUrl || (request.sourceId ? await captureSource(request.sourceId) : "");
    const snapshot = store.getData();
    const result = await generateWithModel(snapshot, readApiKey(), request, screenshot);
    await rememberTokenUsage(request, result, snapshot);
    const contact = request.contact?.trim() || result.detectedContact;
    if (store.getData().settings.autoShowOverlay && invocation === quickInvocation) {
      clearQuickReplySession();
      if (!overlayWindow) overlayWindow = createOverlayWindow();
      sendToOverlay("overlay:result", { ...result, channel: request.channel, contact, target: request.target });
      overlayWindow.show();
      overlayWindow.focus();
    }
    return result;
  };
  ipcMain.handle("assist:generate", (_event, request: GenerateRequest) => generateAssistance(request));
  ipcMain.handle("reply:generate", (_event, request: GenerateRequest) => generateAssistance({ scenario: "reply", ...request }));

  const useSuggestion = async (request: UseReplyRequest) => {
    if (request.sessionId) {
      const session = usableQuickOverlaySession();
      if (!session || session.id !== request.sessionId) throw new Error("This suggestion has expired. Open ContextCue again.");
      await assertSessionCurrent(session);
      request = { ...request, target: session.target ?? undefined };
    }
    clipboard.writeText(request.text);
    const pasteResult = request.paste ? await bestEffortPaste(request) : { pasted: false };
    if (!request.sessionId) void store.rememberAcceptedSuggestion({
      text: request.text,
      channel: request.channel,
      contact: request.contact,
      scenario: request.scenario,
      applicationName: request.target?.applicationName,
      controlId: request.target?.controlId
    }).catch((error) => console.warn("[memory] could not remember accepted suggestion", error));
    return { copied: true, ...pasteResult };
  };
  ipcMain.handle("assist:use", (_event, request: UseReplyRequest) => useSuggestion(request));
  ipcMain.handle("reply:use", (_event, request: UseReplyRequest) => useSuggestion({ scenario: "reply", ...request }));
  ipcMain.on("overlay:resize", (event, requestedHeight: number, newCandidate: boolean, editing?: boolean) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    if (overlaySizer?.fitContent(requestedHeight, newCandidate === true, editing === true) && !overlayManuallyPositioned) positionOverlayNearInput();
  });
  ipcMain.on("overlay:resize-by", (event, edge: OverlayResizeEdge, deltaX: number, deltaY: number) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    overlayManuallyPositioned = true;
    overlaySizer?.resizeBy(edge, deltaX, deltaY);
  });
  ipcMain.on("overlay:move-by", (event, deltaX: number, deltaY: number) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    overlayManuallyPositioned = true;

    const [currentX, currentY] = overlayWindow.getPosition();
    const [width, height] = overlayWindow.getSize();
    const pointer = screen.getCursorScreenPoint();
    const { workArea } = screen.getDisplayNearestPoint(pointer);
    const margin = 8;
    const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);
    const nextX = clamp(Math.round(currentX + deltaX), workArea.x + margin, workArea.x + workArea.width - width - margin);
    const nextY = clamp(Math.round(currentY + deltaY), workArea.y + margin, workArea.y + workArea.height - height - margin);
    overlayWindow.setPosition(nextX, nextY, false);
  });
  ipcMain.handle("overlay:hide", () => hideQuickOverlay());
  ipcMain.handle("assist:revise", (event, request: ReviseSuggestionRequest) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) throw new Error("Open the floating suggestions to revise a draft.");
    return reviseSuggestion(request);
  });
  ipcMain.on("assist:cancel-revision", (event) => {
    if (event.sender === overlayWindow?.webContents) { revisionController?.abort(); revisionController = null; }
  });
  ipcMain.handle("ask:open", async (event) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) throw new Error("Ask AI is available from the floating panel.");
    const session = usableQuickOverlaySession();
    if (session) await assertSessionCurrent(session);
    return session ? showAskOverlay(session) : showQuickAsk();
  });
  ipcMain.handle("ask:exit", (event, returnToSuggestions: boolean) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    return exitAsk(Boolean(returnToSuggestions));
  });
  ipcMain.on("ask:start", (event, request: AskRequest) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    void startAsk(request);
  });
  ipcMain.on("ask:cancel", (event, requestId: string) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    cancelAskInFlight(requestId);
  });
  ipcMain.handle("ask:copy", (event, text: string) => {
    if (!overlayWindow || event.sender !== overlayWindow.webContents) return;
    clipboard.writeText(String(text).slice(0, 50_000));
  });

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
  ipcMain.handle("usage:get", () => store.tokenUsage());

  ipcMain.handle("settings:get", () => store.settings(configuredModelIds()));
  ipcMain.handle("settings:test-model", async (_event, incoming: TestModelConnectionRequest) => {
    const result = await testModelConnection(incoming.model, incoming.apiKey?.trim() || readApiKey(incoming.model.id), fetch, incoming.verifyImage ? createVisionProbe() : undefined);
    if (result.tokenUsage) {
      await store.recordTokenUsage({
        ...result.tokenUsage,
        modelId: incoming.model.id,
        modelName: incoming.model.name,
        model: incoming.model.model,
        apiProtocol: incoming.model.apiProtocol,
        requestType: "connection-test"
      });
    }
    return result;
  });
  ipcMain.handle("setup:example", async (event, imageDataUrl: string) => {
    requireMainWindow(event);
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/png;base64,") || imageDataUrl.length > 500_000) throw new Error("Invalid example image. Reopen the setup guide.");
    const snapshot = store.getData();
    const request: GenerateRequest = { channel: "other", locale: snapshot.settings.locale, quick: true, scenario: "reply", contextPolicy: "page-only", intent: "This is a fictional setup example. Agree to move the design review to Friday at 10 am. Keep the reply brief." };
    const result = await generateWithModel(snapshot, readApiKey(), request, imageDataUrl);
    await rememberTokenUsage(request, result, snapshot);
    return result;
  });
  ipcMain.handle("setup:complete", async (event) => {
    requireMainWindow(event);
    await store.saveSettings({ ...store.getData().settings, onboardingComplete: true });
    return store.settings(configuredModelIds());
  });
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
      const previousSettings = store.getData().settings;
      const shortcutsChanged = settings.globalShortcut !== previousSettings.globalShortcut
        || settings.askShortcut !== previousSettings.askShortcut;
      if (shortcutsChanged) {
        const registration = registerShortcuts(settings.globalShortcut, settings.askShortcut);
        if (!registration.ok) {
          registerShortcuts(previousSettings.globalShortcut, previousSettings.askShortcut);
          throw new Error(`The shortcut ${registration.shortcut} is already used by another application or ContextCue action.`);
        }
      }
      try {
        await store.saveSettings(settings, encryptedApiKeys);
      } catch (error) {
        if (shortcutsChanged) registerShortcuts(previousSettings.globalShortcut, previousSettings.askShortcut);
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
  updates = createUpdateService();
  registerIpc();
  registerShortcuts(store.getData().settings.globalShortcut, store.getData().settings.askShortcut);
  mainWindow = createMainWindow();
  overlayWindow = createOverlayWindow();
  tray = createTray();
  updates.start();
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
  updates?.dispose();
  installerAbort.abort();
  if (quickContextTimer) clearInterval(quickContextTimer);
  quickContextTimer = null;
  globalShortcut.unregisterAll();
  tray?.destroy();
  tray = null;
});
