import type { AppUpdater, UpdateInfo } from "electron-updater";
import type { AppUpdateState } from "../../src/shared/types";

type UpdateEngine = Pick<AppUpdater, "on" | "autoDownload" | "autoInstallOnAppQuit" | "allowPrerelease"
  | "allowDowngrade" | "checkForUpdates" | "downloadUpdate" | "quitAndInstall">;

interface UpdateOptions {
  engine: UpdateEngine;
  currentVersion: string;
  mode: AppUpdateState["mode"];
  onState: (state: AppUpdateState) => void;
  notify: (state: AppUpdateState) => void;
  downloadInstaller: (info: UpdateInfo, progress: (percent: number) => void) => Promise<string>;
  openInstaller: (path: string, info: UpdateInfo) => Promise<void>;
}

export class UpdateService {
  private state: AppUpdateState;
  private info: UpdateInfo | null = null;
  private installerPath: string | null = null;
  private busy = false;
  private operationError: Error | null = null;
  private disposed = false;
  private notified = new Set<string>();
  private startupTimer?: NodeJS.Timeout;
  private interval?: NodeJS.Timeout;

  constructor(private readonly options: UpdateOptions) {
    this.state = {
      revision: 0,
      currentVersion: options.currentVersion,
      mode: options.mode,
      status: options.mode === "unavailable" ? "disabled" : "idle",
      message: options.mode === "unavailable"
        ? "Updates are available in installed desktop builds."
        : "Updates are checked automatically. You choose when to download and install."
    };
    const { engine } = options;
    engine.autoDownload = false;
    engine.autoInstallOnAppQuit = false;
    engine.allowPrerelease = false;
    engine.allowDowngrade = false;
    engine.on("download-progress", ({ percent }) => {
      if (this.state.status === "downloading") this.progress(percent);
    });
    // Native macOS verification may fail asynchronously after quitAndInstall.
    // Always handle EventEmitter errors, even when no request is pending.
    engine.on("error", (error) => {
      if (this.busy) this.operationError = error;
      else this.fail(error);
    });
  }

  snapshot(): AppUpdateState { return { ...this.state }; }

  start(): void {
    if (this.state.mode === "unavailable" || this.startupTimer || this.interval) return;
    this.startupTimer = setTimeout(() => void this.check(), 15_000);
    this.interval = setInterval(() => void this.check(), 6 * 60 * 60_000);
    this.startupTimer.unref();
    this.interval.unref();
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.startupTimer);
    clearInterval(this.interval);
  }

  private update(patch: Partial<AppUpdateState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 };
    this.options.onState(this.snapshot());
  }

  private progress(percent: number): void {
    if (Number.isFinite(percent)) this.update({ progress: Math.max(0, Math.min(100, Math.floor(percent))) });
  }

  private notify(): void {
    const key = `${this.state.status}:${this.state.availableVersion}`;
    if (this.notified.has(key) || this.disposed) return;
    this.notified.add(key);
    this.options.notify(this.snapshot());
  }

  private fail(error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    const message = /verification|signature|size does not match/i.test(detail)
      ? "The update could not be verified. Please check for updates and download it again."
      : /ENOSPC|disk space/i.test(detail)
        ? "There is not enough disk space. Free some space and try again."
        : "The update could not be completed. Check your connection and try again.";
    console.warn("[updates]", detail);
    this.update({ status: "error", progress: undefined, message });
  }

  async check(): Promise<AppUpdateState> {
    if (this.disposed || this.busy || this.state.mode === "unavailable" || ["downloaded", "installing"].includes(this.state.status)) return this.snapshot();
    this.busy = true;
    this.operationError = null;
    this.info = null;
    this.installerPath = null;
    this.update({ status: "checking", availableVersion: undefined, releaseNotes: undefined, progress: undefined, message: "Checking for updates…" });
    try {
      const result = await this.options.engine.checkForUpdates();
      if (this.operationError) throw this.operationError;
      if (!result) throw new Error("The update service is unavailable.");
      const checkedAt = new Date().toISOString();
      if (!result.isUpdateAvailable) {
        this.update({ status: "idle", checkedAt, message: "You’re up to date." });
      } else {
        this.info = result.updateInfo;
        const notes = this.info.releaseNotes;
        this.update({
          status: "available", checkedAt, availableVersion: this.info.version,
          releaseNotes: (typeof notes === "string" ? notes : notes?.map((note) => note.note).join("\n\n"))?.slice(0, 12_000),
          message: `ContextCue ${this.info.version} is available.`
        });
        this.notify();
      }
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
    return this.snapshot();
  }

  async download(): Promise<AppUpdateState> {
    if (this.disposed || this.busy || !this.info || !["available", "error"].includes(this.state.status)) return this.snapshot();
    this.busy = true;
    this.operationError = null;
    this.update({ status: "downloading", progress: 0, message: "Downloading update… You can keep using ContextCue." });
    try {
      if (this.state.mode === "installer") {
        this.installerPath = await this.options.downloadInstaller(this.info, (percent) => this.progress(percent));
      } else {
        await this.options.engine.downloadUpdate();
      }
      if (this.operationError) throw this.operationError;
      this.update({ status: "downloaded", progress: 100, message: this.state.mode === "installer"
        ? "Installer ready. Open it, quit ContextCue, then drag the new app into Applications to replace it."
        : "Update ready. Save your work, then restart ContextCue to install." });
      this.notify();
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
    return this.snapshot();
  }

  async install(): Promise<AppUpdateState> {
    if (this.disposed || this.busy || this.state.status !== "downloaded" || !this.info) return this.snapshot();
    this.busy = true;
    this.update({ status: "installing", message: this.state.mode === "installer" ? "Opening installer…" : "Preparing to restart and install…" });
    try {
      if (this.state.mode === "installer" && this.installerPath) {
        await this.options.openInstaller(this.installerPath, this.info);
        this.update({ status: "downloaded", message: "Quit ContextCue, then drag the new app into Applications and choose Replace. Your settings and memory stay on this device." });
      } else if (this.state.mode === "automatic") {
        // Native errors can be emitted synchronously by this call.
        this.busy = false;
        this.options.engine.quitAndInstall(false, true);
      }
    } catch (error) { this.fail(error); }
    finally { this.busy = false; }
    return this.snapshot();
  }
}
