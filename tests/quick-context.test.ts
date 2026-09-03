import { describe, expect, it, vi } from "vitest";
import { prepareQuickContext } from "../electron/services/quick-context";
import { normalizeMacInputTarget } from "../electron/services/input-target";

const front = { windowId: "7788", processId: 55, appId: "test.browser", applicationName: "Browser", windowTitle: "Fahmi • Discord" };
function fixture() {
  return {
    getWindow: vi.fn(async () => front),
    getTarget: vi.fn(async () => normalizeMacInputTarget({ appId: front.appId, applicationName: front.applicationName, windowTitle: front.windowTitle, nativeRole: "AXButton" })),
    capture: vi.fn(async () => "data:image/jpeg;base64,snapshot")
  };
}

describe("quick suggestions and Ask AI page preparation", () => {
  it.each([false, true])("captures arbitrary windows without an editable control (Ask AI=%s)", async (ask) => {
    const deps = fixture();
    const result = await prepareQuickContext(deps, ask);
    expect(result).toMatchObject({ target: null, source: { id: "window:7788:0", channel: "other" }, screenshot: "data:image/jpeg;base64,snapshot" });
    expect(deps.capture).toHaveBeenCalledExactlyOnceWith("window:7788:0");
  });

  it("does not require accessibility metadata to generate from a screenshot", async () => {
    const deps = fixture();
    deps.getTarget.mockRejectedValue(new Error("Accessibility unavailable"));
    expect((await prepareQuickContext(deps, false)).screenshot).toBeTruthy();
  });

  it("keeps a matching editable target but drops a target read from another app", async () => {
    const deps = fixture();
    const target = normalizeMacInputTarget({ appId: front.appId, windowTitle: front.windowTitle, nativeRole: "AXTextArea", value: "draft" })!;
    deps.getTarget.mockResolvedValueOnce(target);
    expect((await prepareQuickContext(deps, false)).target).toEqual(target);
    deps.getTarget.mockResolvedValueOnce({ ...target, appId: "another.app" });
    expect((await prepareQuickContext(deps, false)).target).toBeNull();
  });

  it.each([false, true])("blocks sensitive fields before any screenshot (Ask AI=%s)", async (ask) => {
    const deps = fixture();
    deps.getTarget.mockResolvedValue(normalizeMacInputTarget({ appId: front.appId, nativeRole: "AXTextField", subrole: "AXSecureTextField" }));
    await expect(prepareQuickContext(deps, ask)).rejects.toThrow("sensitive fields");
    expect(deps.capture).not.toHaveBeenCalled();
  });

  it("lets Ask AI open without context when capture fails; suggestions report the actual failure", async () => {
    const deps = fixture();
    deps.capture.mockRejectedValue(new Error("Allow Screen Recording"));
    expect(await prepareQuickContext(deps, true)).toMatchObject({ contextUnavailableReason: "Allow Screen Recording" });
    expect((await prepareQuickContext(deps, true)).source).toBeUndefined();
    await expect(prepareQuickContext(deps, false)).rejects.toThrow("Allow Screen Recording");
  });

  it("lets Ask AI open when no native foreground window is available", async () => {
    const deps = fixture();
    deps.getWindow.mockRejectedValue(new Error("No window"));
    expect((await prepareQuickContext(deps, true)).contextUnavailableReason).toContain("foreground window");
    expect(deps.capture).not.toHaveBeenCalled();
  });

  it.each(["window", "tab"])("discards a screenshot when the %s changes during capture, without selecting a replacement", async (change) => {
    const deps = fixture();
    deps.getWindow.mockResolvedValueOnce(front).mockResolvedValueOnce({ ...front, ...(change === "window" ? { windowId: "9999" } : { windowTitle: "Other tab" }) });
    await expect(prepareQuickContext(deps, false)).rejects.toThrow("changed");
    expect(deps.capture).toHaveBeenCalledExactlyOnceWith("window:7788:0");
  });

  it("does not open Ask AI against the old window when the page changes during capture", async () => {
    const deps = fixture();
    deps.getWindow.mockResolvedValueOnce(front).mockResolvedValueOnce({ ...front, windowTitle: "Other tab" });
    await expect(prepareQuickContext(deps, true)).rejects.toThrow("changed");
  });
});
