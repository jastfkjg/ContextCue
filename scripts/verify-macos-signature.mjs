import { execFileSync, spawnSync } from "node:child_process";
import { accessSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyMacSignature(appPath, developerId = false) {
  // Verify the whole bundle, including nested helpers and sealed resources.
  // Checking only the executable accepts Electron's incomplete linker signature.
  accessSync(join(appPath, "Contents/_CodeSignature/CodeResources"));
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { stdio: "pipe" });
  // codesign writes signature details to stderr even on success.
  const details = spawnSync("codesign", ["--display", "--verbose=4", appPath], { encoding: "utf8" });
  if (details.error) throw details.error;
  if (details.status !== 0) throw new Error(`Cannot inspect app signature: ${details.stderr}`);
  const signature = details.stderr;
  if (!/^Identifier=ai\.contextcue\.desktop$/m.test(signature)) {
    throw new Error("The app signature does not bind the ContextCue bundle identifier.");
  }
  if (developerId) {
    if (!/^Authority=Developer ID Application:/m.test(signature) || !/^TeamIdentifier=[A-Z0-9]+$/m.test(signature)) {
      throw new Error("Automatic updates require a Developer ID Application signature, not a development or ad-hoc signature.");
    }
    execFileSync("xcrun", ["stapler", "validate", appPath], { stdio: "pipe" });
    execFileSync("spctl", ["--assess", "--type", "execute", "--verbose=4", appPath], { stdio: "pipe" });
  } else if (!/^Signature=adhoc$/m.test(signature)) {
    throw new Error("The beta build must have a complete ad-hoc signature.");
  }
  console.info(`Verified ${developerId ? "Developer ID, notarization and Gatekeeper" : "ad-hoc bundle signature (not Apple notarization)"}: ${appPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [appPath, mode] = process.argv.slice(2);
  if (!appPath || !["beta", "developer-id"].includes(mode)) {
    throw new Error("Usage: node scripts/verify-macos-signature.mjs <ContextCue.app> <beta|developer-id>");
  }
  verifyMacSignature(appPath, mode === "developer-id");
}
