import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const asset = (path: string) => readFileSync(resolve(process.cwd(), path));
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

function expectPng(png: Buffer, size: number): void {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(size);
  expect(png.readUInt32BE(20)).toBe(size);
  expect(png[25]).toBe(6); // RGBA: native icons must retain transparent padding.
}

describe("ContextCue brand assets", () => {
  it("keeps the website and app SVG identical", () => {
    expect(asset("website/public/contextcue-icon.svg")).toEqual(asset("build/icon.svg"));
  });

  it("uses the same two monogram paths in the color and menu-bar icons", () => {
    const paths = (path: string) => asset(path).toString().match(/<path d="[^"]+"\/>/g);
    expect(paths("build/icon.svg")).toHaveLength(2);
    expect(paths("build/tray-icon.svg")).toEqual(paths("build/icon.svg"));
  });

  it.each(sizes)("has a transparent %ipx PNG export", size => {
    expectPng(asset(`build/icons/${size}x${size}.png`), size);
  });

  it("uses the 1024px export as the main PNG", () => {
    expect(asset("build/icon.png")).toEqual(asset("build/icons/1024x1024.png"));
  });

  it("embeds matching 1x and 2x menu-bar PNGs", () => {
    const data = JSON.parse(asset("build/tray-icon-data.json").toString());
    for (const [key, filename, size] of [["png1x", "tray-icon.png", 18], ["png2x", "tray-icon@2x.png", 36]] as const) {
      const png = Buffer.from(data[key], "base64");
      expect(png).toEqual(asset(`build/${filename}`));
      expectPng(png, size);
    }
  });

  it("includes the correct images in the Windows ICO directory", () => {
    const data = asset("build/icon.ico");
    const icoSizes = sizes.filter(size => size <= 256);
    expect(data.readUInt16LE(0)).toBe(0);
    expect(data.readUInt16LE(2)).toBe(1);
    expect(data.readUInt16LE(4)).toBe(icoSizes.length);
    let end = 6 + icoSizes.length * 16;
    icoSizes.forEach((size, index) => {
      const entry = 6 + index * 16;
      expect(data[entry] || 256).toBe(size);
      expect(data[entry + 1] || 256).toBe(size);
      expect(data.readUInt16LE(entry + 6)).toBe(32);
      const length = data.readUInt32LE(entry + 8);
      const offset = data.readUInt32LE(entry + 12);
      expect(offset).toBe(end);
      expect(data.subarray(offset, offset + length)).toEqual(asset(`build/icons/${size}x${size}.png`));
      end = offset + length;
    });
    expect(end).toBe(data.length);
  });

  it("includes valid macOS icon and Retina chunks", () => {
    const data = asset("build/icon.icns");
    expect(data.toString("ascii", 0, 4)).toBe("icns");
    expect(data.readUInt32BE(4)).toBe(data.length);
    const expected: Record<string, number> = { icp4: 16, icp5: 32, icp6: 64, ic07: 128, ic08: 256, ic09: 512, ic10: 1024, ic11: 32, ic12: 64, ic13: 256, ic14: 512 };
    const seen: string[] = [];
    let offset = 8;
    while (offset < data.length) {
      const type = data.toString("ascii", offset, offset + 4);
      const length = data.readUInt32BE(offset + 4);
      expect(length).toBeGreaterThan(8);
      expect(data.subarray(offset + 8, offset + length)).toEqual(asset(`build/icons/${expected[type]}x${expected[type]}.png`));
      seen.push(type);
      offset += length;
    }
    expect(offset).toBe(data.length);
    expect(seen.sort()).toEqual(Object.keys(expected).sort());
  });
});
