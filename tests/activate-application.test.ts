import { describe, expect, it, vi } from "vitest";
import { activateApplication } from "../electron/services/activate-application";

describe("application activation", () => {
  const meeting = { processId: 123, appId: "com.example.meeting", applicationName: "飞书会议" };

  it("activates a window owner by PID without resolving its display name", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "activated\n" });
    await activateApplication(meeting, "darwin", run);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][0]).toBe("/usr/bin/osascript");
    expect(run.mock.calls[0][1].slice(-3)).toEqual(["--", "123", meeting.appId]);
  });

  it.each(["unavailable", "script failure"])("uses bundle ID after %s", async (outcome) => {
    const run = vi.fn();
    if (outcome === "script failure") run.mockRejectedValueOnce(new Error("failure"));
    else run.mockResolvedValueOnce({ stdout: outcome });
    run.mockResolvedValueOnce({ stdout: "" });
    await activateApplication(meeting, "darwin", run);
    expect(run).toHaveBeenLastCalledWith("/usr/bin/open", ["-b", meeting.appId]);
  });

  it("supports a bundle ID without a PID", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "" });
    await activateApplication({ appId: meeting.appId, applicationName: meeting.applicationName }, "darwin", run);
    expect(run).toHaveBeenCalledExactlyOnceWith("/usr/bin/open", ["-b", meeting.appId]);
  });

  it("keeps name lookup for legacy targets without native identifiers", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "" });
    await activateApplication({ applicationName: "Lark" }, "darwin", run);
    expect(run).toHaveBeenCalledExactlyOnceWith("/usr/bin/open", ["-a", "Lark"]);
  });

  it("reports the failed operation without retrying a misleading display name", async () => {
    const run = vi.fn().mockResolvedValueOnce({ stdout: "unavailable" }).mockRejectedValueOnce(new Error("Command failed"));
    await expect(activateApplication(meeting, "darwin", run)).rejects.toThrow("Could not switch to 飞书会议");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a target", async () => {
    const run = vi.fn();
    await activateApplication({ applicationName: "" }, "darwin", run);
    expect(run).not.toHaveBeenCalled();
  });
});
