import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateInfo } from "electron-updater";
import { downloadInstaller, macInstallerAsset, verifyInstaller } from "../electron/services/installer-download";

const payload = Buffer.from("verified installer contents");
const hash = createHash("sha512").update(payload).digest("base64");
const info: UpdateInfo = {
  version: "0.2.0", releaseDate: "2026-09-02", path: "", sha512: "",
  files: ["arm64", "x64"].map((arch) => ({ url: `ContextCue-0.2.0-${arch}.dmg`, sha512: hash, size: payload.length }))
};
const directories: string[] = [];
async function temporary() { const directory = await mkdtemp(join(tmpdir(), "contextcue-updates-")); directories.push(directory); return directory; }
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { force: true, recursive: true }))); });

describe("installer downloads", () => {
  it("selects the matching architecture and rejects remote URLs and missing checksums", () => {
    expect(macInstallerAsset(info, "x64").url).toBe("https://github.com/jastfkjg/ContextCue/releases/download/v0.2.0/ContextCue-0.2.0-x64.dmg");
    expect(macInstallerAsset(info, "arm64").name).toContain("arm64");
    expect(() => macInstallerAsset(info, "ia32")).toThrow();
    expect(() => macInstallerAsset({ ...info, version: "../../other" }, "arm64")).toThrow();
    expect(() => macInstallerAsset({ ...info, files: [{ ...info.files[0], url: "https://example.com/install.dmg" }] }, "arm64")).toThrow();
    expect(() => macInstallerAsset({ ...info, files: [{ ...info.files[0], sha512: "" }] }, "arm64")).toThrow();
  });

  it("streams and verifies a download, then detects local tampering before opening", async () => {
    const directory = await temporary();
    const asset = macInstallerAsset(info, "arm64");
    const progress = vi.fn();
    const path = await downloadInstaller(asset, directory, vi.fn(async () => new Response(payload)), progress);
    expect(await readFile(path)).toEqual(payload);
    expect(progress).toHaveBeenLastCalledWith(100);
    await verifyInstaller(path, asset);
    await writeFile(path, "tampered");
    await expect(verifyInstaller(path, asset)).rejects.toThrow("verification failed");
  });

  it.each(["bad-checksum", "truncated", "oversized", "http-error"])("removes incomplete files after %s", async (failure) => {
    const directory = await temporary();
    const asset = macInstallerAsset(info, "arm64");
    const body = failure === "bad-checksum" ? Buffer.alloc(payload.length) : failure === "truncated" ? payload.subarray(0, 3) : Buffer.concat([payload, payload]);
    const response = failure === "http-error" ? new Response(null, { status: 404 }) : new Response(body);
    await expect(downloadInstaller(asset, directory, vi.fn(async () => response), vi.fn())).rejects.toThrow();
    expect(await readdir(directory)).toEqual([]);
  });
});
