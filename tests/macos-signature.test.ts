import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(sign = true) {
  const root = mkdtempSync(join(tmpdir(), "contextcue-signature-test-"));
  roots.push(root);
  const app = join(root, "ContextCue.app");
  mkdirSync(join(app, "Contents/MacOS"), { recursive: true });
  mkdirSync(join(app, "Contents/Resources"));
  copyFileSync("/usr/bin/true", join(app, "Contents/MacOS/ContextCue"));
  writeFileSync(join(app, "Contents/Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0"><dict><key>CFBundleIdentifier</key><string>ai.contextcue.desktop</string>
    <key>CFBundleExecutable</key><string>ContextCue</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`);
  writeFileSync(join(app, "Contents/Resources/example.txt"), "original resource");
  if (sign) execFileSync("codesign", ["--force", "--sign", "-", app], { stdio: "pipe" });
  return app;
}

const verify = (app: string, mode = "beta") => execFileSync(process.execPath, [resolve("scripts/verify-macos-signature.mjs"), app, mode], { stdio: "pipe" });

describe.skipIf(process.platform !== "darwin")("macOS release signature verification", () => {
  it("accepts a fully sealed ad-hoc bundle", () => {
    expect(verify(fixture()).toString()).toContain("Verified ad-hoc bundle signature");
  });
  it("rejects an executable-only signature without bundle resources", () => {
    expect(() => verify(fixture(false))).toThrow();
  });
  it("rejects resources modified after signing", () => {
    const app = fixture();
    writeFileSync(join(app, "Contents/Resources/example.txt"), "changed after signing");
    expect(() => verify(app)).toThrow();
  });
  it("never accepts an ad-hoc beta as a Developer ID release", () => {
    expect(() => verify(fixture(), "developer-id")).toThrow(/Developer ID Application/);
  });
});
