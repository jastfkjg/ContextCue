// Opens only synthetic local windows. Never calls a model or sends screenshots.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { build } from "esbuild";

if (process.platform !== "darwin") throw new Error("This native smoke test currently runs on macOS.");
const require = createRequire(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "contextcue-window-test-"));
try {
  const bundle = join(directory, "capture.cjs");
  await build({
    stdin: { contents: 'export { getFrontmostWindow } from "./electron/services/front-window"; export { captureQuickSource } from "./electron/services/capture";', resolveDir: resolve(".") },
    bundle: true, platform: "node", format: "cjs", external: ["electron"], outfile: bundle
  });
  const entry = join(directory, "probe.cjs");
  await writeFile(entry, String.raw`
const { app, BrowserWindow, systemPreferences, nativeImage } = require("electron");
const { getFrontmostWindow, captureQuickSource } = require("./capture.cjs");
app.setPath("userData", require("node:path").join(__dirname, "profile"));
const assert = require("node:assert/strict");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    const makeWindow = async (text, x) => {
      const window = new BrowserWindow({ width: 500, height: 320, x, y: 160, show: false });
      await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent("<title>Same conversation title</title><main style='padding:32px;font:20px system-ui'><h1>ContextCue local test</h1><p>" + text + "</p><textarea placeholder='Optional input'></textarea></main>"));
      return window;
    };
    const first = await makeWindow("Synthetic window A", 160);
    const second = await makeWindow("Synthetic window B", 680);
    for (const [label, window] of [["A", first], ["B", second]]) {
      window.show(); window.focus(); app.focus({ steal: true });
      const expectedId = window.getMediaSourceId().split(":")[1];
      let native;
      for (let attempt = 0; attempt < 8; attempt++) {
        // -1 models the caller living in a separate process from this fixture.
        native = await getFrontmostWindow(-1);
        if (native.windowId === expectedId) break;
        await pause(100);
      }
      assert.equal(native.windowId, expectedId, "Native lookup must choose the focused fixture window");
      assert.equal(native.processId, process.pid);
      console.info("PASS: same-title window " + label + " selected by native ID");
      if (systemPreferences.getMediaAccessStatus("screen") === "granted") {
        const screenshot = await captureQuickSource("window:" + native.windowId + ":0");
        assert.equal(nativeImage.createFromDataURL(screenshot).isEmpty(), false);
        console.info("PASS: window " + label + " captured locally; screenshot discarded");
      } else {
        console.info("SKIP screenshot: Screen Recording permission is not granted to this test process");
      }
    }
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => { console.error("Native window test timed out"); app.exit(1); }, 20000).unref();
`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const status = await new Promise((resolveStatus, reject) => {
    const child = spawn(require("electron"), [entry], { env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolveStatus(code ?? 1));
  });
  process.exitCode = status;
} finally { await rm(directory, { recursive: true, force: true }); }
