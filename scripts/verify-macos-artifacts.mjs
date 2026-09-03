import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyMacSignature } from "./verify-macos-signature.mjs";

const arch = process.env.BUILD_ARCH;
if (!["arm64", "x64"].includes(arch)) throw new Error("BUILD_ARCH must be arm64 or x64.");
const output = resolve(process.env.BUILD_OUTPUT_DIR || "dist");
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const developerId = process.env.SIGNING_ENABLED === "true";
const root = await mkdtemp(join(tmpdir(), "contextcue-verify-artifacts-"));
const mount = join(root, "dmg");
let mounted = false;
try {
  const zip = join(root, "zip");
  await mkdir(zip);
  execFileSync("ditto", ["-x", "-k", join(output, `ContextCue-${version}-${arch}.zip`), zip], { stdio: "pipe" });
  verifyMacSignature(join(zip, "ContextCue.app"), developerId);
  await mkdir(mount);
  execFileSync("hdiutil", ["attach", "-readonly", "-nobrowse", "-mountpoint", mount, join(output, `ContextCue-${version}-${arch}.dmg`)], { stdio: "pipe" });
  mounted = true;
  verifyMacSignature(join(mount, "ContextCue.app"), developerId);
} finally {
  // Never remove a directory while its disk image is still mounted.
  if (mounted) execFileSync("hdiutil", ["detach", mount], { stdio: "pipe" });
  await rm(root, { recursive: true, force: true });
}
