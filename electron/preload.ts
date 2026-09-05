import { contextBridge, ipcRenderer } from "electron";
import type {
  AskOverlayContext,
  AskRequest,
  AskStreamEvent,
  AppUpdateState,
  ContactMemory,
  GenerateRequest,
  ContextCueApi,
  MemoryDocument,
  MemoryFact,
  OverlayStatus,
  OverlayResult,
  RevisionCandidateEvent,
  SaveSettingsRequest,
  TestModelConnectionRequest,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";

const api: ContextCueApi = {
  getUpdateState: () => ipcRenderer.invoke("updates:get"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateState: (callback: (state: AppUpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppUpdateState) => callback(state);
    ipcRenderer.on("updates:state", listener);
    return () => ipcRenderer.removeListener("updates:state", listener);
  },
  onOpenUpdates: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("updates:open", listener);
    ipcRenderer.send("updates:ready");
    return () => ipcRenderer.removeListener("updates:open", listener);
  },
  getCaptureSources: () => ipcRenderer.invoke("capture:list"),
  testWindowCapture: () => ipcRenderer.invoke("capture:test-window"),
  captureSource: (sourceId: string) => ipcRenderer.invoke("capture:source", sourceId),
  generateReplies: (request: GenerateRequest) => ipcRenderer.invoke("reply:generate", request),
  generateAssistance: (request: GenerateRequest) => ipcRenderer.invoke("assist:generate", request),
  getMemory: () => ipcRenderer.invoke("memory:get"),
  saveMemoryDocument: (document: MemoryDocument) => ipcRenderer.invoke("memory:document-save", document),
  deleteMemoryDocument: (id: string) => ipcRenderer.invoke("memory:document-delete", id),
  saveProfile: (profile: UserProfile) => ipcRenderer.invoke("memory:profile", profile),
  saveContact: (contact: ContactMemory) => ipcRenderer.invoke("memory:contact-save", contact),
  deleteContact: (id: string) => ipcRenderer.invoke("memory:contact-delete", id),
  addFact: (fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) =>
    ipcRenderer.invoke("memory:fact-add", fact),
  deleteFact: (id: string) => ipcRenderer.invoke("memory:fact-delete", id),
  getTokenUsage: () => ipcRenderer.invoke("usage:get"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: SaveSettingsRequest) =>
    ipcRenderer.invoke("settings:save", settings),
  testModelConnection: (request: TestModelConnectionRequest) =>
    ipcRenderer.invoke("settings:test-model", request),
  askExample: (imageDataUrl, question) => ipcRenderer.invoke("setup:ask-example", imageDataUrl, question),
  generateExample: (imageDataUrl) => ipcRenderer.invoke("setup:example", imageDataUrl),
  completeSetup: () => ipcRenderer.invoke("setup:complete"),
  useReply: (request: UseReplyRequest) => ipcRenderer.invoke("reply:use", request),
  useSuggestion: (request: UseReplyRequest) => ipcRenderer.invoke("assist:use", request),
  openScreenSettings: () => ipcRenderer.invoke("permissions:open-screen"),
  openAccessibilitySettings: () => ipcRenderer.invoke("permissions:open-accessibility"),
  getPermissions: () => ipcRenderer.invoke("permissions:get"),
  onOverlayResult: (callback: (result: OverlayResult) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: OverlayResult) => callback(result);
    ipcRenderer.on("overlay:result", listener);
    return () => ipcRenderer.removeListener("overlay:result", listener);
  },
  onOverlayExpired: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: { sessionId: string; message: string }) => callback(value);
    ipcRenderer.on("overlay:expired", listener);
    return () => ipcRenderer.removeListener("overlay:expired", listener);
  },
  onOverlayReset: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("overlay:reset", listener);
    return () => ipcRenderer.removeListener("overlay:reset", listener);
  },
  onOverlayStatus: (callback: (status: OverlayStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OverlayStatus) => callback(status);
    ipcRenderer.on("overlay:status", listener);
    return () => ipcRenderer.removeListener("overlay:status", listener);
  },
  openAsk: () => ipcRenderer.invoke("ask:open"),
  refreshAsk: (sessionId) => ipcRenderer.invoke("ask:refresh", sessionId),
  showDraft: (sessionId) => ipcRenderer.invoke("ask:show-draft", sessionId),
  exitAsk: (returnToSuggestions: boolean) => ipcRenderer.invoke("ask:exit", returnToSuggestions),
  startAsk: (request: AskRequest) => ipcRenderer.send("ask:start", request),
  setSessionMemory: (sessionId, enabled) => ipcRenderer.invoke("memory:session", sessionId, enabled),
  cancelAsk: (requestId: string) => ipcRenderer.send("ask:cancel", requestId),
  copyText: (text: string) => ipcRenderer.invoke("ask:copy", text),
  onAskOpen: (callback: (context: AskOverlayContext) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, context: AskOverlayContext) => callback(context);
    ipcRenderer.on("overlay:ask-open", listener);
    return () => ipcRenderer.removeListener("overlay:ask-open", listener);
  },
  onAskEvent: (callback: (event: AskStreamEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, askEvent: AskStreamEvent) => callback(askEvent);
    ipcRenderer.on("overlay:ask-event", listener);
    return () => ipcRenderer.removeListener("overlay:ask-event", listener);
  },
  resizeOverlay: (height, newCandidate, expanded) => ipcRenderer.send("overlay:resize", height, newCandidate, expanded),
  resizeOverlayBy: (edge, deltaX, deltaY) => ipcRenderer.send("overlay:resize-by", edge, deltaX, deltaY),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide"),
  regenerateWithoutMemory: (sessionId, requestId) => ipcRenderer.invoke("assist:regenerate-without-memory", sessionId, requestId),
  reviseSuggestion: (request) => ipcRenderer.invoke("assist:revise", request),
  onRevisionCandidate: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, value: RevisionCandidateEvent) => callback(value);
    ipcRenderer.on("overlay:revision-candidate", listener);
    return () => ipcRenderer.removeListener("overlay:revision-candidate", listener);
  },
  cancelRevision: (requestId) => ipcRenderer.send("assist:cancel-revision", requestId)
};

contextBridge.exposeInMainWorld("contextCue", api);
