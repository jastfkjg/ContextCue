import { contextBridge, ipcRenderer } from "electron";
import type {
  AskOverlayContext,
  AskRequest,
  AskStreamEvent,
  AppUpdateState,
  ContactMemory,
  GenerateRequest,
  GenerationResult,
  ContextCueApi,
  InputTarget,
  MemoryDocument,
  MemoryFact,
  OverlayStatus,
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
  useReply: (request: UseReplyRequest) => ipcRenderer.invoke("reply:use", request),
  useSuggestion: (request: UseReplyRequest) => ipcRenderer.invoke("assist:use", request),
  openScreenSettings: () => ipcRenderer.invoke("permissions:open-screen"),
  getPermissions: () => ipcRenderer.invoke("permissions:get"),
  onOverlayResult: (callback: (result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string; target?: InputTarget }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string; target?: InputTarget }) => callback(result);
    ipcRenderer.on("overlay:result", listener);
    return () => ipcRenderer.removeListener("overlay:result", listener);
  },
  onOverlayStatus: (callback: (status: OverlayStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OverlayStatus) => callback(status);
    ipcRenderer.on("overlay:status", listener);
    return () => ipcRenderer.removeListener("overlay:status", listener);
  },
  openAsk: () => ipcRenderer.invoke("ask:open"),
  exitAsk: (returnToSuggestions: boolean) => ipcRenderer.invoke("ask:exit", returnToSuggestions),
  startAsk: (request: AskRequest) => ipcRenderer.send("ask:start", request),
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
  moveOverlay: (deltaX, deltaY) => ipcRenderer.send("overlay:move-by", deltaX, deltaY),
  hideOverlay: () => ipcRenderer.invoke("overlay:hide")
};

contextBridge.exposeInMainWorld("contextCue", api);
