import { desktopCapturer } from "electron";
import type { CaptureSource } from "../../src/shared/types";
import { detectChannel } from "./channel";

const THUMBNAIL_SIZE = { width: 1440, height: 900 };

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: THUMBNAIL_SIZE,
    fetchWindowIcons: true
  });
  return sources
    .filter((source) => source.name !== "Hiply" && !source.thumbnail.isEmpty())
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.isEmpty() ? undefined : source.appIcon?.toDataURL(),
      channel: detectChannel(source.name)
    }))
    .sort((a, b) => Number(b.channel !== "other") - Number(a.channel !== "other"));
}

export async function captureSource(sourceId: string): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: THUMBNAIL_SIZE,
    fetchWindowIcons: false
  });
  const source = sources.find((item) => item.id === sourceId);
  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("The selected window is no longer available. Refresh the source list and try again.");
  }
  return source.thumbnail.toDataURL();
}
