import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";

const [input, output, version] = process.argv.slice(2);
if (!input || !output || !/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Usage: node scripts/prepare-macos-release.mjs <artifacts-dir> <output-dir> <stable-version>");
}

async function digest(path, algorithm, encoding) {
  const hash = createHash(algorithm);
  let size = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); size += chunk.length; }
  return { hash: hash.digest(encoding), size };
}

await mkdir(output, { recursive: true });
const files = [];
for (const arch of ["x64", "arm64"]) {
  const directory = join(input, `contextcue-macos-${arch}`);
  const info = parse(await readFile(join(directory, "latest-mac.yml"), "utf8"));
  if (info.version !== version || !Array.isArray(info.files)) throw new Error(`Invalid ${arch} update metadata.`);
  for (const extension of ["zip", "dmg"]) {
    const name = `ContextCue-${version}-${arch}.${extension}`;
    const descriptor = info.files.find((file) => file.url === name);
    if (!descriptor) throw new Error(`Missing update descriptor: ${name}`);
    const actual = await digest(join(directory, name), "sha512", "base64");
    if (actual.hash !== descriptor.sha512 || actual.size !== descriptor.size) throw new Error(`Checksum or size mismatch: ${name}`);
    files.push(descriptor);
    await copyFile(join(directory, name), join(output, name));
    if (extension === "dmg") {
      // Website links keep working; never rename files referenced by update metadata.
      await copyFile(join(directory, name), join(output, `ContextCue-mac-${arch}.dmg`));
    }
    const blockmap = `${name}.blockmap`;
    if ((await readdir(directory)).includes(blockmap)) await copyFile(join(directory, blockmap), join(output, blockmap));
  }
}

// Uploading two latest-mac.yml files with merge-multiple loses one architecture.
await writeFile(join(output, "latest-mac.yml"), stringify({
  version, files, path: files[0].url, sha512: files[0].sha512,
  releaseDate: new Date().toISOString()
}));
const sums = [];
for (const name of (await readdir(output)).sort()) {
  if (name === "SHA256SUMS") continue;
  sums.push(`${(await digest(join(output, name), "sha256", "hex")).hash}  ${name}`);
}
await writeFile(join(output, "SHA256SUMS"), `${sums.join("\n")}\n`);
console.info(`Prepared ContextCue ${version}: verified DMG + ZIP files for x64 and arm64.`);
