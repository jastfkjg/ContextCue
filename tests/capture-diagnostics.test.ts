import { describe, expect, it, vi } from "vitest";
import { testWindowCapture } from "../electron/services/capture-diagnostics";

const frontmost = { applicationName: "Safari", windowTitle: "Project notes", windowId: "123", processId: 42 };
function fixture() {
  return { getWindow: vi.fn().mockResolvedValue(frontmost), capture: vi.fn().mockResolvedValue("data:image/jpeg;base64,preview"), isOwnWindow: vi.fn().mockReturnValue(false) };
}

describe("local window capture diagnostic", () => {
  it("captures the identified foreground window, returning its name and capture time", async () => {
    const deps = fixture();
    const result = await testWindowCapture(deps);
    expect(deps.capture).toHaveBeenCalledExactlyOnceWith("window:123:0");
    expect(result).toEqual({ name: "Project notes", imageDataUrl: "data:image/jpeg;base64,preview", capturedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(result.capturedAt))).toBe(false);
  });
  it("does not silently test ContextCue when the user has not switched windows", async () => {
    const deps = fixture(); deps.isOwnWindow.mockReturnValue(true);
    await expect(testWindowCapture(deps)).rejects.toThrow("ContextCue is still in front");
    expect(deps.capture).not.toHaveBeenCalled();
  });
  it("does not fall back to an entire display when the target cannot be identified", async () => {
    const deps = fixture(); deps.getWindow.mockResolvedValue({ applicationName: "Safari" });
    await expect(testWindowCapture(deps)).rejects.toThrow("Could not locate");
    expect(deps.capture).not.toHaveBeenCalled();
  });
  it("rejects a preview if the window or tab changed during capture", async () => {
    const deps = fixture();
    deps.getWindow.mockResolvedValueOnce(frontmost).mockResolvedValueOnce({ ...frontmost, windowTitle: "Another page" });
    await expect(testWindowCapture(deps)).rejects.toThrow("changed during capture");
    expect(deps.capture).toHaveBeenCalledTimes(1);
  });
  it("preserves actionable permission errors", async () => {
    const deps = fixture(); deps.capture.mockRejectedValue(new Error("Allow Screen Recording"));
    await expect(testWindowCapture(deps)).rejects.toThrow("Allow Screen Recording");
  });
  it("rejects a preview when focus returns to Settings before capture finishes", async () => {
    const deps = fixture(); deps.isOwnWindow.mockReturnValueOnce(false).mockReturnValueOnce(true);
    await expect(testWindowCapture(deps)).rejects.toThrow("changed during capture");
  });
});
