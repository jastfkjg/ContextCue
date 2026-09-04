import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { MAC_TARGET_SCRIPT, normalizeMacInputTarget, sameInputTarget } from "../electron/services/input-target";

describe("macOS input target", () => {
  it("normalizes an editable accessibility control", () => {
    const target = normalizeMacInputTarget({
      appId: "com.apple.Notes",
      applicationName: "Notes",
      windowTitle: "Project",
      nativeRole: "AXTextArea",
      title: "Notes body",
      value: "Existing draft",
      selectedText: "draft",
      position: [120, 240],
      size: [520, 180]
    });

    expect(target).toMatchObject({
      appId: "com.apple.Notes",
      role: "text-area",
      multiline: true,
      label: "Notes body",
      selectedText: "draft",
      sensitive: false,
      bounds: { x: 120, y: 240, width: 520, height: 180 }
    });
  });

  it("rejects non-editable controls and marks secure fields", () => {
    expect(normalizeMacInputTarget({ nativeRole: "AXButton" })).toBeNull();
    expect(normalizeMacInputTarget({
      appId: "browser",
      applicationName: "Browser",
      nativeRole: "AXTextField",
      subrole: "AXSecureTextField",
      placeholder: "Password"
    })?.sensitive).toBe(true);
  });

  it("matches the same control with small accessibility coordinate drift", () => {
    const first = normalizeMacInputTarget({
      appId: "browser",
      applicationName: "Browser",
      windowTitle: "Form",
      nativeRole: "AXTextField",
      title: "Company",
      position: [100, 200],
      size: [300, 40]
    })!;
    const second = { ...first, controlId: "new-id", bounds: { x: 102, y: 198, width: 301, height: 40 } };
    expect(sameInputTarget(first, second)).toBe(true);
  });

  it("reads the requested process and the focused control's window without activating it", () => {
    let selected: unknown;
    const element = (attributes: Record<string, unknown>) => ({ attributes: { byName: (key: string) => ({ exists: () => key in attributes, value: () => attributes[key] }) } });
    const focused = element({ AXRole: "AXTextField", AXSubrole: "AXSecureTextField", AXWindow: element({ AXTitle: "Original page" }) });
    const process = { ...element({ AXFocusedUIElement: focused }), bundleIdentifier: () => "app.source", name: () => "Source" };
    const raw = JSON.parse(runInNewContext(`${MAC_TARGET_SCRIPT}\nrun(["101"]);`, {
      Application: () => ({ applicationProcesses: { whose: (filter: unknown) => { selected = filter; return () => [process]; } } })
    }));
    expect(selected).toEqual({ unixId: 101 });
    expect(normalizeMacInputTarget(raw)).toMatchObject({ appId: "app.source", windowTitle: "Original page", sensitive: true });
  });
});
