import { contextBridge, ipcRenderer } from "electron";
import type {
  ContactMemory,
  GenerateRequest,
  GenerationResult,
  ContextCueApi,
  MemoryDocument,
  MemoryFact,
  OverlayStatus,
  SaveSettingsRequest,
  TestModelConnectionRequest,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";

const api: ContextCueApi = {
  getCaptureSources: () => ipcRenderer.invoke("capture:list"),
  captureSource: (sourceId: string) => ipcRenderer.invoke("capture:source", sourceId),
  generateReplies: (request: GenerateRequest) => ipcRenderer.invoke("reply:generate", request),
  getMemory: () => ipcRenderer.invoke("memory:get"),
  saveMemoryDocument: (document: MemoryDocument) => ipcRenderer.invoke("memory:document-save", document),
  deleteMemoryDocument: (id: string) => ipcRenderer.invoke("memory:document-delete", id),
  saveProfile: (profile: UserProfile) => ipcRenderer.invoke("memory:profile", profile),
  saveContact: (contact: ContactMemory) => ipcRenderer.invoke("memory:contact-save", contact),
  deleteContact: (id: string) => ipcRenderer.invoke("memory:contact-delete", id),
  addFact: (fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) =>
    ipcRenderer.invoke("memory:fact-add", fact),
  deleteFact: (id: string) => ipcRenderer.invoke("memory:fact-delete", id),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: SaveSettingsRequest) =>
    ipcRenderer.invoke("settings:save", settings),
  testModelConnection: (request: TestModelConnectionRequest) =>
    ipcRenderer.invoke("settings:test-model", request),
  useReply: (request: UseReplyRequest) => ipcRenderer.invoke("reply:use", request),
  openScreenSettings: () => ipcRenderer.invoke("permissions:open-screen"),
  getPermissions: () => ipcRenderer.invoke("permissions:get"),
  onOverlayResult: (callback: (result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string }) => callback(result);
    ipcRenderer.on("overlay:result", listener);
    return () => ipcRenderer.removeListener("overlay:result", listener);
  },
  onOverlayStatus: (callback: (status: OverlayStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: OverlayStatus) => callback(status);
    ipcRenderer.on("overlay:status", listener);
    return () => ipcRenderer.removeListener("overlay:status", listener);
  },
  hideOverlay: () => ipcRenderer.invoke("overlay:hide")
};

contextBridge.exposeInMainWorld("contextCue", api);
