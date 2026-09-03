import { describe, expect, it, vi } from "vitest";
import { prepareQuickWindows } from "../electron/services/quick-windows";

function window(focused = false) {
  return { isFocused: () => focused, hide: vi.fn() };
}

describe("quick actions preserve the macOS main window", () => {
  it("leaves the background main window visible and does not change the user's foreground app", async () => {
    const main = window(), overlay = window();
    const activateExternal = vi.fn(async () => {});
    await prepareQuickWindows({ platform: "darwin", main, overlay, activateExternal });
    expect(main.hide).not.toHaveBeenCalled();
    expect(activateExternal).not.toHaveBeenCalled();
    expect(overlay.hide).toHaveBeenCalledOnce();
  });

  it.each(["main", "overlay"])("activates the target when the %s owns focus without hiding the main window", async (focused) => {
    const main = window(focused === "main"), overlay = window(focused === "overlay");
    const activateExternal = vi.fn(async () => { expect(overlay.hide).toHaveBeenCalledOnce(); });
    await prepareQuickWindows({ platform: "darwin", main, overlay, activateExternal });
    expect(activateExternal).toHaveBeenCalledOnce();
    expect(main.hide).not.toHaveBeenCalled();
  });

  it("preserves the main window even when the external app cannot be activated", async () => {
    const main = window(true);
    await expect(prepareQuickWindows({ platform: "darwin", main, overlay: window(), activateExternal: async () => { throw new Error("Unavailable"); } })).rejects.toThrow("Unavailable");
    expect(main.hide).not.toHaveBeenCalled();
  });

  it("works before either ContextCue window has been created", async () => {
    const activateExternal = vi.fn();
    await prepareQuickWindows({ platform: "darwin", main: null, overlay: null, activateExternal });
    expect(activateExternal).not.toHaveBeenCalled();
  });

  it.each(["win32", "linux"] as const)("keeps the existing %s handoff", async (platform) => {
    const main = window(true), overlay = window();
    const activateExternal = vi.fn();
    await prepareQuickWindows({ platform, main, overlay, activateExternal });
    expect(main.hide).toHaveBeenCalledOnce();
    expect(overlay.hide).toHaveBeenCalledOnce();
    expect(activateExternal).not.toHaveBeenCalled();
  });
});
