import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface ApplicationIdentity {
  processId?: number;
  appId?: string;
  applicationName: string;
}

const execFileAsync = promisify(execFile);

// Window owner names may describe a helper (e.g. 飞书会议), not an installed app.
// Activate the actual running process, checking its bundle ID against PID reuse.
export const MAC_ACTIVATE_APPLICATION_SCRIPT = String.raw`
ObjC.import("AppKit");
function run(argv) {
  const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(Number(argv[0]));
  if (!app || app.isNil() || app.terminated) return "unavailable";
  const expectedId = argv[1] || "";
  if (expectedId && (ObjC.unwrap(app.bundleIdentifier) || "") !== expectedId) return "unavailable";
  return app.activateWithOptions(2) ? "activated" : "unavailable";
}`;

export async function activateApplication(
  target: ApplicationIdentity,
  platform: NodeJS.Platform = process.platform,
  run: (file: string, args: string[]) => Promise<{ stdout: string }> =
    (file, args) => execFileAsync(file, args, { timeout: 3000 })
): Promise<void> {
  const { processId, appId, applicationName } = target;
  if (!processId && !appId && !applicationName) return;
  try {
    if (platform === "darwin") {
      if (Number.isInteger(processId) && processId! > 0) {
        try {
          const { stdout } = await run("/usr/bin/osascript", [
            "-l", "JavaScript", "-e", MAC_ACTIVATE_APPLICATION_SCRIPT,
            "--", String(processId), appId || ""
          ]);
          if (stdout.trim() === "activated") return;
        } catch {
          // Launch Services can still resolve a bundle if its process has exited.
        }
      }
      if (appId) {
        await run("/usr/bin/open", ["-b", appId]);
      } else if (applicationName) {
        await run("/usr/bin/open", ["-a", applicationName]);
      } else {
        throw new Error("No application identifier is available.");
      }
      return;
    }
    if (!applicationName) return;
    if (platform === "win32") {
      await run("powershell.exe", [
        "-NoProfile", "-Command",
        `(New-Object -ComObject WScript.Shell).AppActivate('${applicationName.replace(/'/g, "''")}') | Out-Null`
      ]);
      return;
    }
    await run("xdotool", ["search", "--name", applicationName, "windowactivate"]);
  } catch (cause) {
    throw new Error(`Could not switch to ${applicationName || appId || "the original application"}. Return to its window and try again.`, { cause });
  }
}
