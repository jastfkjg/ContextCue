import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";
import { parse } from "yaml";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const directory = process.env.BUILD_ARCH === "arm64" ? "mac-arm64" : "mac";
const resources = join("dist", directory, "ContextCue.app/Contents/Resources");
const metadata = JSON.parse(asar.extractFile(join(resources, "app.asar"), "package.json").toString());
if (metadata.contextcueMacAutoUpdate !== (process.env.SIGNING_ENABLED === "true")) {
  throw new Error("Packaged update mode does not match signing configuration.");
}
const feed = parse(await readFile(join(resources, "app-update.yml"), "utf8"));
if (feed.provider !== "github" || feed.owner !== "jastfkjg" || feed.repo !== "ContextCue") {
  throw new Error("Packaged update feed is incorrect.");
}
const info = parse(await readFile("dist/latest-mac.yml", "utf8"));
if (info.version !== metadata.version || !info.files.some((file) => file.url.endsWith(".zip"))) {
  throw new Error("Missing ZIP update metadata.");
}
console.info(`Verified ${metadata.version} update configuration (${metadata.contextcueMacAutoUpdate ? "automatic" : "installer"}).`);
