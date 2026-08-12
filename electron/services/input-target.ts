import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import type { AssistAction, InputTarget } from "../../src/shared/types";

const execFileAsync = promisify(execFile);
const EDITABLE_ROLES = new Set(["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"]);

interface RawMacTarget {
  appId?: unknown;
  applicationName?: unknown;
  windowTitle?: unknown;
  nativeRole?: unknown;
  subrole?: unknown;
  title?: unknown;
  description?: unknown;
  help?: unknown;
  placeholder?: unknown;
  value?: unknown;
  selectedText?: unknown;
  position?: unknown;
  size?: unknown;
}

const MAC_TARGET_SCRIPT = String.raw`
const systemEvents = Application("System Events");
const processes = systemEvents.applicationProcesses.whose({ frontmost: true })();
if (!processes.length) throw new Error("No frontmost application");
const process = processes[0];
function attribute(element, name) {
  try {
    const item = element.attributes.byName(name);
    if (!item.exists()) return null;
    return item.value();
  } catch (_) { return null; }
}
function text(value) {
  return typeof value === "string" ? value : (value == null ? "" : String(value));
}
const focused = attribute(process, "AXFocusedUIElement");
if (!focused) throw new Error("No focused control");
let appId = "";
let windowTitle = "";
try { appId = text(process.bundleIdentifier()); } catch (_) {}
try { windowTitle = process.windows.length ? text(process.windows[0].name()) : ""; } catch (_) {}
JSON.stringify({
  appId,
  applicationName: text(process.name()),
  windowTitle,
  nativeRole: text(attribute(focused, "AXRole")),
  subrole: text(attribute(focused, "AXSubrole")),
  title: text(attribute(focused, "AXTitle")),
  description: text(attribute(focused, "AXDescription")),
  help: text(attribute(focused, "AXHelp")),
  placeholder: text(attribute(focused, "AXPlaceholderValue")),
  value: text(attribute(focused, "AXValue")),
  selectedText: text(attribute(focused, "AXSelectedText")),
  position: attribute(focused, "AXPosition"),
  size: attribute(focused, "AXSize")
});
`;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const first = Number(value[0]);
  const second = Number(value[1]);
  return Number.isFinite(first) && Number.isFinite(second) ? [first, second] : undefined;
}

function roleFor(nativeRole: string): InputTarget["role"] {
  if (nativeRole === "AXTextArea") return "text-area";
  if (nativeRole === "AXComboBox") return "combo-box";
  if (nativeRole === "AXTextField" || nativeRole === "AXSearchField") return "text-field";
  return "unknown";
}

export function normalizeMacInputTarget(raw: RawMacTarget): InputTarget | null {
  const nativeRole = stringValue(raw.nativeRole);
  if (!EDITABLE_ROLES.has(nativeRole)) return null;

  const applicationName = stringValue(raw.applicationName);
  const windowTitle = stringValue(raw.windowTitle);
  const appId = stringValue(raw.appId) || applicationName;
  const label = (stringValue(raw.title) || stringValue(raw.description) || stringValue(raw.help)).slice(0, 500);
  const placeholder = stringValue(raw.placeholder).slice(0, 500);
  const position = pair(raw.position);
  const size = pair(raw.size);
  const bounds = position && size
    ? { x: position[0], y: position[1], width: size[0], height: size[1] }
    : undefined;
  const sensitiveText = `${raw.subrole ?? ""} ${label} ${placeholder}`;
  const sensitive = /secure|password|passcode|验证码|verification code|one[- ]time|otp|银行卡|card number|cvv/i.test(sensitiveText);
  const fingerprint = JSON.stringify([appId, windowTitle, nativeRole, label, placeholder, bounds]);

  return {
    platform: "darwin",
    appId,
    applicationName,
    windowTitle,
    controlId: createHash("sha256").update(fingerprint).digest("hex").slice(0, 20),
    role: roleFor(nativeRole),
    nativeRole,
    label: label || undefined,
    placeholder: placeholder || undefined,
    currentText: typeof raw.value === "string" ? raw.value.slice(-4000) : undefined,
    selectedText: typeof raw.selectedText === "string" ? raw.selectedText.slice(0, 4000) : undefined,
    multiline: nativeRole === "AXTextArea",
    sensitive,
    bounds
  };
}

export async function getFocusedInputTarget(): Promise<InputTarget | null> {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", "-e", MAC_TARGET_SCRIPT]);
    return normalizeMacInputTarget(JSON.parse(stdout.trim()) as RawMacTarget);
  } catch {
    return null;
  }
}

export function sameInputTarget(expected: InputTarget, current: InputTarget | null): boolean {
  if (!current || expected.appId !== current.appId || expected.nativeRole !== current.nativeRole) return false;
  if (expected.controlId === current.controlId) return true;
  if (!expected.bounds || !current.bounds) return false;
  const close = (left: number, right: number) => Math.abs(left - right) <= 4;
  return close(expected.bounds.x, current.bounds.x)
    && close(expected.bounds.y, current.bounds.y)
    && close(expected.bounds.width, current.bounds.width)
    && close(expected.bounds.height, current.bounds.height);
}

export async function writeMacInputTarget(text: string, action: AssistAction): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  const script = String.raw`
on run argv
  set replacementText to item 1 of argv
  set actionName to item 2 of argv
  tell application "System Events"
    set frontProcess to first application process whose frontmost is true
    set focusedElement to value of attribute "AXFocusedUIElement" of frontProcess
    if actionName is "replace-all" then
      set value of attribute "AXValue" of focusedElement to replacementText
    else
      set value of attribute "AXSelectedText" of focusedElement to replacementText
    end if
  end tell
end run`;
  try {
    await execFileAsync("/usr/bin/osascript", ["-e", script, "--", text, action]);
    return true;
  } catch {
    return false;
  }
}
