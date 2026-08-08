import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  ContactMemory,
  GenerateRequest,
  GenerationResult,
  HiplyApi,
  MemoryFact,
  UseReplyRequest,
  UserProfile
} from "../src/shared/types";

const api: HiplyApi = {
  getCaptureSources: () => ipcRenderer.invoke("capture:list"),
  captureSource: (sourceId: string) => ipcRenderer.invoke("capture:source", sourceId),
  generateReplies: (request: GenerateRequest) => ipcRenderer.invoke("reply:generate", request),
  getMemory: () => ipcRenderer.invoke("memory:get"),
  saveProfile: (profile: UserProfile) => ipcRenderer.invoke("memory:profile", profile),
  saveContact: (contact: ContactMemory) => ipcRenderer.invoke("memory:contact-save", contact),
  deleteContact: (id: string) => ipcRenderer.invoke("memory:contact-delete", id),
  addFact: (fact: Pick<MemoryFact, "category" | "content" | "contactId" | "source">) =>
    ipcRenderer.invoke("memory:fact-add", fact),
  deleteFact: (id: string) => ipcRenderer.invoke("memory:fact-delete", id),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings: Omit<AppSettings, "apiKeyConfigured"> & { apiKey?: string }) =>
    ipcRenderer.invoke("settings:save", settings),
  useReply: (request: UseReplyRequest) => ipcRenderer.invoke("reply:use", request),
  openScreenSettings: () => ipcRenderer.invoke("permissions:open-screen"),
  getPermissions: () => ipcRenderer.invoke("permissions:get"),
  onCaptureRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("capture:requested", listener);
    return () => ipcRenderer.removeListener("capture:requested", listener);
  },
  onOverlayResult: (callback: (result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, result: GenerationResult & { channel: UseReplyRequest["channel"]; contact: string }) => callback(result);
    ipcRenderer.on("overlay:result", listener);
    return () => ipcRenderer.removeListener("overlay:result", listener);
  },
  hideOverlay: () => ipcRenderer.invoke("overlay:hide")
};

contextBridge.exposeInMainWorld("hiply", api);
