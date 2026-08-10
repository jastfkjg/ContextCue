import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { desktopCapturer, nativeImage } from "electron";
import type { CaptureSource } from "../../src/shared/types";
import { detectChannel } from "./channel";

const THUMBNAIL_SIZE = { width: 1440, height: 900 };
export const QUICK_CAPTURE_SIZE = { width: 1200, height: 750 };
export type CaptureSourceRef = Pick<CaptureSource, "id" | "name" | "channel">;
const execFileAsync = promisify(execFile);

export async function listCaptureSourceRefs(): Promise<CaptureSourceRef[]> {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  });
  return sources
    .filter((source) => source.name !== "ContextCue")
    .map((source) => ({ id: source.id, name: source.name, channel: detectChannel(source.name) }))
    .sort((a, b) => Number(b.channel !== "other") - Number(a.channel !== "other"));
}

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: THUMBNAIL_SIZE,
    fetchWindowIcons: true
  });
  return sources
    .filter((source) => source.name !== "ContextCue" && !source.thumbnail.isEmpty())
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.isEmpty() ? undefined : source.appIcon?.toDataURL(),
      channel: detectChannel(source.name)
    }))
    .sort((a, b) => Number(b.channel !== "other") - Number(a.channel !== "other"));
}

export async function captureSource(
  sourceId: string,
  thumbnailSize = THUMBNAIL_SIZE,
  types: Array<"window" | "screen"> = ["window", "screen"],
  format: "png" | "jpeg" = "png"
): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize,
    fetchWindowIcons: false
  });
  const source = sources.find((item) => item.id === sourceId);
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("The selected window is no longer available. Refresh the source list and try again.");
  }
  if (format === "jpeg") return `data:image/jpeg;base64,${source.thumbnail.toJPEG(82).toString("base64")}`;
  return source.thumbnail.toDataURL();
}

async function captureMacWindow(sourceId: string): Promise<string> {
  const windowId = /^window:(\d+):/.exec(sourceId)?.[1];
  if (!windowId) throw new Error("The selected source is not a window.");
  const path = join(tmpdir(), `contextcue-quick-${process.pid}-${randomUUID()}.jpg`);
  try {
    await execFileAsync("/usr/sbin/screencapture", ["-x", `-l${windowId}`, "-tjpg", path]);
    const image = nativeImage.createFromBuffer(await readFile(path));
    if (image.isEmpty()) throw new Error("The current window could not be captured.");
    const size = image.getSize();
    const scale = Math.min(1, QUICK_CAPTURE_SIZE.width / size.width, QUICK_CAPTURE_SIZE.height / size.height);
    const output = scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
          quality: "good"
        })
      : image;
    return `data:image/jpeg;base64,${output.toJPEG(80).toString("base64")}`;
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

export async function captureQuickSource(sourceId: string): Promise<string> {
  if (process.platform === "darwin") {
    try {
      return await captureMacWindow(sourceId);
    } catch {
      // Some capture backends do not expose a CGWindowID; keep Electron as a safe fallback.
    }
  }
  return captureSource(sourceId, QUICK_CAPTURE_SIZE, ["window"], "jpeg");
}
