import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { UpdateInfo } from "electron-updater";

export interface InstallerAsset {
  name: string;
  url: string;
  sha512: string;
  size: number;
}

// Only our versioned release artifacts may become locally opened installers.
export function macInstallerAsset(info: UpdateInfo, arch: string): InstallerAsset {
  if (!/^\d+\.\d+\.\d+$/.test(info.version) || !["arm64", "x64"].includes(arch)) {
    throw new Error("This release does not support your version or architecture.");
  }
  const name = `ContextCue-${info.version}-${arch}.dmg`;
  const file = info.files.find((entry) => entry.url === name);
  if (!file || !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)
    || !Number.isSafeInteger(file.size) || file.size! <= 0) {
    throw new Error("The release is missing a verified installer for this Mac.");
  }
  return {
    name,
    url: `https://github.com/jastfkjg/ContextCue/releases/download/v${info.version}/${name}`,
    sha512: file.sha512,
    size: file.size!
  };
}

export async function verifyInstaller(path: string, asset: InstallerAsset): Promise<void> {
  const hash = createHash("sha512");
  let size = 0;
  await pipeline(createReadStream(path), new Writable({
    write(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      size += chunk.length;
      done();
    }
  }));
  if (size !== asset.size || hash.digest("base64") !== asset.sha512) {
    throw new Error("Installer verification failed. Download the update again.");
  }
}

export async function downloadInstaller(
  asset: InstallerAsset,
  directory: string,
  fetchFile: typeof fetch,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const destination = join(directory, asset.name);
  const temporary = `${destination}.part`;
  // Bound the whole request, including a stalled response body.
  const timeout = AbortSignal.timeout(30 * 60_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetchFile(asset.url, { signal: requestSignal, cache: "no-store" });
    if (!response.ok || !response.body) throw new Error(`Installer download failed (HTTP ${response.status}).`);
    const hash = createHash("sha512");
    let received = 0;
    let lastPercent = -1;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        received += chunk.length;
        if (received > asset.size) return done(new Error("Installer size does not match the release."));
        hash.update(chunk);
        const percent = Math.min(99, Math.floor(received / asset.size * 100));
        if (percent !== lastPercent) {
          lastPercent = percent;
          onProgress(percent);
        }
        done(null, chunk);
      }
    });
    const reader = response.body.getReader();
    const source = Readable.from((async function* () {
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          yield next.value;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    })());
    await pipeline(source, meter, createWriteStream(temporary, { mode: 0o600 }), { signal: requestSignal });
    if (received !== asset.size || hash.digest("base64") !== asset.sha512) {
      throw new Error("Installer verification failed. Download the update again.");
    }
    await rename(temporary, destination);
    onProgress(100);
    return destination;
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
