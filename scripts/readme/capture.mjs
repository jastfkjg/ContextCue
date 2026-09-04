import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const preview = "http://127.0.0.1:4187/scripts/readme/preview.html";
try {
  const response = await fetch(preview);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch {
  throw new Error("Start the preview first: npx vite --config scripts/readme/vite.config.mjs");
}

mkdirSync(resolve(root, "output/playwright"), { recursive: true });
mkdirSync(resolve(root, "docs/images/readme"), { recursive: true });
const cli = (...args) => execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", [
  "--yes", "--package", "@playwright/cli", "playwright-cli", "--session", "contextcue-readme", ...args
], { cwd: root, stdio: "inherit" });

try {
  cli("open", preview);
  cli("run-code", "--filename", "scripts/readme/capture-playwright.js");
  for (const locale of ["en", "zh-CN"]) {
    for (const scene of ["reply", "revise", "ask"]) {
      const name = `${scene}-${locale}.png`;
      copyFileSync(resolve(root, "output/playwright", name), resolve(root, "docs/images/readme", name));
    }
  }
} finally {
  cli("close");
}
