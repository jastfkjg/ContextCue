import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface FrontmostWindow {
  windowId?: string;
  processId?: number;
  appId?: string;
  applicationName: string;
  windowTitle: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

const execFileAsync = promisify(execFile);

// CoreGraphics supplies the z-ordered native window IDs. NSWorkspace identifies
// the owning foreground process without System Events / browser title matching.
export const MAC_FRONT_WINDOW_SCRIPT = String.raw`
ObjC.import("AppKit");
ObjC.import("CoreGraphics");
function run(argv) {
  const excludedPid = Number(argv[0]);
  const front = $.NSWorkspace.sharedWorkspace.frontmostApplication;
  const pid = Number(front.processIdentifier);
  const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0)));
  const windows = list.filter(function(w) {
    const b = w.kCGWindowBounds;
    return w.kCGWindowOwnerPID !== excludedPid && w.kCGWindowLayer === 0
      && w.kCGWindowAlpha !== 0 && b && b.Width > 1 && b.Height > 1;
  });
  // A tray/main-window invocation can leave ContextCue as the active process
  // briefly after its windows are hidden. Only then use the frontmost external window.
  const window = windows.find(function(w) { return pid === excludedPid || w.kCGWindowOwnerPID === pid; });
  if (!window) return JSON.stringify({ applicationName: ObjC.unwrap(front.localizedName) || "", windowTitle: "" });
  const owner = $.NSRunningApplication.runningApplicationWithProcessIdentifier(window.kCGWindowOwnerPID);
  const b = window.kCGWindowBounds;
  return JSON.stringify({
    windowId: String(window.kCGWindowNumber), processId: window.kCGWindowOwnerPID,
    appId: ObjC.unwrap(owner.bundleIdentifier) || "",
    applicationName: window.kCGWindowOwnerName || "",
    windowTitle: window.kCGWindowName || "",
    bounds: { x: b.X, y: b.Y, width: b.Width, height: b.Height }
  });
}`;

const WINDOWS_FRONT_WINDOW_SCRIPT = String.raw`
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Foreground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder text, int length);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
'@
$handle = [Foreground]::GetForegroundWindow()
$ownerPid = [uint32]0
[Foreground]::GetWindowThreadProcessId($handle, [ref]$ownerPid) | Out-Null
$title = New-Object System.Text.StringBuilder 4096
[Foreground]::GetWindowText($handle, $title, $title.Capacity) | Out-Null
$owner = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
@{ windowId=$handle.ToInt64().ToString(); processId=$ownerPid; applicationName=$owner.ProcessName; windowTitle=$title.ToString() } | ConvertTo-Json -Compress
`;

export function normalizeFrontmostWindow(raw: Record<string, unknown>, excludedPid: number): FrontmostWindow {
  const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const windowId = text(raw.windowId);
  const processId = Number(raw.processId);
  const ownWindow = processId === excludedPid;
  const b = raw.bounds as FrontmostWindow["bounds"];
  return {
    applicationName: ownWindow ? "" : text(raw.applicationName),
    windowTitle: ownWindow ? "" : text(raw.windowTitle),
    appId: ownWindow ? undefined : text(raw.appId) || undefined,
    processId: !ownWindow && Number.isInteger(processId) && processId > 0 ? processId : undefined,
    windowId: !ownWindow && /^[1-9]\d*$/.test(windowId) ? windowId : undefined,
    bounds: !ownWindow && b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0 ? b : undefined
  };
}

export async function getFrontmostWindow(excludedPid = process.pid): Promise<FrontmostWindow> {
  try {
    if (process.platform === "darwin") {
      const { stdout } = await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", "-e", MAC_FRONT_WINDOW_SCRIPT, "--", String(excludedPid)], { timeout: 2000 });
      return normalizeFrontmostWindow(JSON.parse(stdout), excludedPid);
    }
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_FRONT_WINDOW_SCRIPT], { timeout: 3000 });
      return normalizeFrontmostWindow(JSON.parse(stdout), excludedPid);
    }
    if (process.platform === "linux") {
      const { stdout } = await execFileAsync("xdotool", ["getactivewindow"], { timeout: 1500 });
      const windowId = stdout.trim();
      if (!/^[1-9]\d*$/.test(windowId)) throw new Error("Invalid active window ID");
      const [title, pid] = await Promise.all([
        execFileAsync("xdotool", ["getwindowname", windowId], { timeout: 1500 }),
        execFileAsync("xdotool", ["getwindowpid", windowId], { timeout: 1500 })
      ]);
      return normalizeFrontmostWindow({ windowId, processId: Number(pid.stdout.trim()), applicationName: "", windowTitle: title.stdout.trim() }, excludedPid);
    }
  } catch (error) {
    // No titles or page content in logs; an empty result must not select another app.
    console.warn("[window] native foreground lookup failed", (error as NodeJS.ErrnoException).code ?? "unavailable");
  }
  return { applicationName: "", windowTitle: "" };
}

export function sameFrontmostWindow(expected: FrontmostWindow, current: FrontmostWindow): boolean {
  if (!expected.windowId || expected.windowId !== current.windowId) return false;
  if (expected.processId && expected.processId !== current.processId) return false;
  // Window identity survives a tab change; invalidate cached context when its title changes.
  return !expected.windowTitle || !current.windowTitle || expected.windowTitle === current.windowTitle;
}
