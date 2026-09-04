import type { CapturePreview } from "../../src/shared/types";
import { sameFrontmostWindow, type FrontmostWindow } from "./front-window";
import { sourceForWindow } from "./quick-context";

export async function testWindowCapture(deps: {
  getWindow: () => Promise<FrontmostWindow>;
  capture: (sourceId: string) => Promise<string>;
  isOwnWindow: (window: FrontmostWindow) => boolean;
}): Promise<CapturePreview> {
  const frontmost = await deps.getWindow();
  if (deps.isOwnWindow(frontmost)) {
    throw new Error("ContextCue is still in front. Start the test again and switch to another app during the countdown.");
  }
  const source = sourceForWindow(frontmost);
  if (!source) throw new Error("Could not locate the current window. Focus a visible application window and try again.");
  const imageDataUrl = await deps.capture(source.id);
  const current = await deps.getWindow();
  if (deps.isOwnWindow(current) || !sameFrontmostWindow(frontmost, current)) {
    throw new Error("The window or tab changed during capture. Keep the target window in front until the test finishes, then return to Settings.");
  }
  return { name: source.name, imageDataUrl, capturedAt: new Date().toISOString() };
}
