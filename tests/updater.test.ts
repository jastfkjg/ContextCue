import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppUpdater, UpdateInfo } from "electron-updater";
import { UpdateService } from "../electron/services/updater";

const info: UpdateInfo = { version: "0.2.0", files: [], path: "", sha512: "", releaseDate: "2026-09-02", releaseNotes: "Improved suggestions." };
function setup(mode: "automatic" | "installer" | "unavailable" = "automatic") {
  const engine = Object.assign(new EventEmitter(), {
    autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: true, allowDowngrade: true,
    checkForUpdates: vi.fn(async () => ({ isUpdateAvailable: true, updateInfo: info, versionInfo: info })),
    downloadUpdate: vi.fn(async () => ["update.zip"]),
    quitAndInstall: vi.fn()
  });
  const options = {
    engine: engine as unknown as AppUpdater, mode, currentVersion: "0.1.3",
    onState: vi.fn(), notify: vi.fn(),
    downloadInstaller: vi.fn(async () => "/tmp/update.dmg"),
    openInstaller: vi.fn(async () => undefined)
  };
  return { engine, options, service: new UpdateService(options) };
}

afterEach(() => vi.useRealTimers());

describe("app updates", () => {
  it("checks automatically without downloading, deduplicates notices, and stops on quit", async () => {
    vi.useFakeTimers();
    const { service, engine, options } = setup();
    service.start(); service.start();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(engine.autoDownload).toBe(false);
    expect(engine.autoInstallOnAppQuit).toBe(false);
    expect(engine.allowPrerelease).toBe(false);
    expect(engine.allowDowngrade).toBe(false);
    expect(engine.downloadUpdate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect(engine.checkForUpdates).toHaveBeenCalledTimes(2);
    expect(options.notify).toHaveBeenCalledTimes(1);
    service.dispose();
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect(engine.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("serializes check/download actions and waits for a verified download before installing", async () => {
    const { service, engine } = setup();
    let finish!: (paths: string[]) => void;
    engine.downloadUpdate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await service.install();
    expect(engine.quitAndInstall).not.toHaveBeenCalled();
    await service.check();
    const download = service.download();
    await service.check(); await service.download(); await service.install();
    engine.emit("download-progress", { percent: 48.9 });
    expect(service.snapshot()).toMatchObject({ status: "downloading", progress: 48 });
    expect(engine.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(engine.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(engine.quitAndInstall).not.toHaveBeenCalled();
    finish(["update.zip"]);
    await download;
    await service.check();
    expect(service.snapshot().status).toBe("downloaded");
    await service.install(); await service.install();
    expect(engine.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
  });

  it("recovers from failed downloads and handles asynchronous native verification errors", async () => {
    const { service, engine } = setup();
    await service.check();
    engine.downloadUpdate.mockRejectedValueOnce(new Error("Network unavailable"));
    expect((await service.download()).status).toBe("error");
    expect(engine.quitAndInstall).not.toHaveBeenCalled();
    await service.check(); await service.download(); await service.install();
    engine.emit("error", new Error("Code signature verification failed"));
    expect(service.snapshot()).toMatchObject({ status: "error", message: expect.stringContaining("verified") });
    await service.check();
    expect(service.snapshot().status).toBe("available");
  });

  it("uses the manual installer path for unsigned Macs and never calls the native installer", async () => {
    const { service, engine, options } = setup("installer");
    await service.check(); await service.download();
    expect(options.openInstaller).not.toHaveBeenCalled();
    expect(service.snapshot()).toMatchObject({ status: "downloaded", mode: "installer" });
    await service.install();
    expect(options.openInstaller).toHaveBeenCalledWith("/tmp/update.dmg", info);
    expect(engine.downloadUpdate).not.toHaveBeenCalled();
    expect(engine.quitAndInstall).not.toHaveBeenCalled();
    options.openInstaller.mockRejectedValueOnce(new Error("Installer verification failed"));
    expect((await service.install()).status).toBe("error");
  });

  it("does not mark a download ready when the engine emits a verification error before resolving", async () => {
    const { service, engine } = setup();
    await service.check();
    engine.downloadUpdate.mockImplementationOnce(async () => {
      engine.emit("error", new Error("Code signature verification failed"));
      return ["update.zip"];
    });
    expect((await service.download()).status).toBe("error");
    await service.install();
    expect(engine.quitAndInstall).not.toHaveBeenCalled();
  });

  it("does not offer the current version and reports network failures without notifications", async () => {
    const { service, engine, options } = setup();
    engine.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false, updateInfo: info, versionInfo: info });
    expect((await service.check()).status).toBe("idle");
    engine.checkForUpdates.mockRejectedValueOnce(new Error("Network unavailable"));
    expect((await service.check()).status).toBe("error");
    expect(options.notify).not.toHaveBeenCalled();
  });

  it("never reaches the updater in development or unsupported builds", async () => {
    const { service, engine } = setup("unavailable");
    service.start();
    await service.check(); await service.download(); await service.install();
    expect(service.snapshot().status).toBe("disabled");
    expect(engine.checkForUpdates).not.toHaveBeenCalled();
    expect(engine.downloadUpdate).not.toHaveBeenCalled();
  });
});
