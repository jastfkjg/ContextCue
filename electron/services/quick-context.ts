import type { InputTarget } from "../../src/shared/types";
import type { CaptureSourceRef } from "./capture";
import { detectChannel } from "./channel";
import { sameFrontmostWindow, type FrontmostWindow } from "./front-window";

interface ContextDependencies {
  getWindow: () => Promise<FrontmostWindow>;
  getTarget: () => Promise<InputTarget | null>;
  capture: (sourceId: string) => Promise<string>;
}

class PageChangedError extends Error {}

export interface QuickContext {
  frontmost: FrontmostWindow;
  target: InputTarget | null;
  source?: CaptureSourceRef;
  screenshot?: string;
  contextUnavailableReason?: string;
}

export function sourceForWindow(window: FrontmostWindow): CaptureSourceRef | undefined {
  if (!window.windowId || !/^[1-9]\d*$/.test(window.windowId)) return undefined;
  return {
    id: `window:${window.windowId}:0`,
    name: window.windowTitle || window.applicationName || "Current window",
    // Channel is optional model context, never a condition for choosing a window.
    channel: detectChannel(`${window.applicationName} ${window.windowTitle}`)
  };
}

export async function prepareQuickContext(deps: ContextDependencies, allowWithoutScreenshot: boolean): Promise<QuickContext> {
  const [frontmost, candidateTarget] = await Promise.all([
    deps.getWindow().catch(() => ({ applicationName: "", windowTitle: "" } as FrontmostWindow)),
    deps.getTarget().catch(() => null)
  ]);
  if (candidateTarget?.sensitive) throw new Error("ContextCue is disabled for passwords, verification codes, and other sensitive fields.");
  const target = candidateTarget && frontmost.appId === candidateTarget.appId
    && (!frontmost.windowTitle || !candidateTarget.windowTitle || frontmost.windowTitle === candidateTarget.windowTitle)
    ? candidateTarget : null;
  const source = sourceForWindow(frontmost);
  try {
    if (!source) throw new Error("Could not locate the foreground window. Focus the window and try again. You can still use Ask AI without page context.");
    const screenshot = await deps.capture(source.id);
    // Capture only the original ID, and never silently retry on another window.
    if (!sameFrontmostWindow(frontmost, await deps.getWindow())) {
      throw new PageChangedError("The active window or tab changed. Open ContextCue again on the page you want to use.");
    }
    return { frontmost, target, source, screenshot };
  } catch (error) {
    if (!allowWithoutScreenshot || error instanceof PageChangedError) throw error;
    return { frontmost, target, contextUnavailableReason: error instanceof Error ? error.message : "Page context is unavailable. You can still ask a question." };
  }
}
