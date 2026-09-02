import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";
import { afterEach, expect, it } from "vitest";

const execute = promisify(execFile);
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

async function fixture(corrupt = false) {
  const root = await mkdtemp(join(tmpdir(), "contextcue-release-")); roots.push(root);
  for (const arch of ["arm64", "x64"]) {
    const dir = join(root, "input", `contextcue-macos-${arch}`); await mkdir(dir, { recursive: true });
    const files = [];
    for (const ext of ["dmg", "zip"]) {
      const url = `ContextCue-0.2.0-${arch}.${ext}`;
      const data = Buffer.from(url);
      await writeFile(join(dir, url), corrupt && arch === "arm64" ? "broken" : data);
      files.push({ url, size: data.length, sha512: createHash("sha512").update(data).digest("base64") });
    }
    await writeFile(join(dir, "latest-mac.yml"), stringify({ version: "0.2.0", files }));
  }
  return root;
}

it("merges both architectures and keeps website aliases without changing feed filenames", async () => {
  const root = await fixture();
  await execute(process.execPath, [resolve("scripts/prepare-macos-release.mjs"), join(root, "input"), join(root, "output"), "0.2.0"]);
  const info = parse(await readFile(join(root, "output/latest-mac.yml"), "utf8"));
  expect(info.files).toHaveLength(4);
  for (const arch of ["arm64", "x64"]) {
    expect(info.files.filter((file: { url: string }) => file.url.includes(arch))).toHaveLength(2);
    expect(await readFile(join(root, `output/ContextCue-mac-${arch}.dmg`))).toEqual(await readFile(join(root, `output/ContextCue-0.2.0-${arch}.dmg`)));
  }
  expect(await readFile(join(root, "output/SHA256SUMS"), "utf8")).toContain("latest-mac.yml");
});

it("refuses to publish corrupted build artifacts", async () => {
  const root = await fixture(true);
  await expect(execute(process.execPath, [resolve("scripts/prepare-macos-release.mjs"), join(root, "input"), join(root, "output"), "0.2.0"])).rejects.toThrow("Checksum or size mismatch");
});
