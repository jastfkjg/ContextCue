import { randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, data])) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, data, checksum]);
}

/** A synthetic randomized image; neither private screenshots nor the answer go in the prompt. */
export function createVisionProbe() {
  const palette = [
    { name: "red", rgb: [235, 35, 35] },
    { name: "green", rgb: [20, 170, 50] },
    { name: "blue", rgb: [30, 65, 235] }
  ];
  const colors = Array.from({ length: 6 }, () => palette[randomInt(palette.length)]);
  const width = 360, height = 96;
  const raw = Buffer.alloc((width * 3 + 1) * height, 255);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const rgb = y >= 16 && y < 80 && x % 60 >= 6 && x % 60 < 54 ? colors[Math.floor(x / 60)].rgb : [255, 255, 255];
      for (let channel = 0; channel < 3; channel++) raw[row + 1 + x * 3 + channel] = rgb[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return { imageDataUrl: `data:image/png;base64,${png.toString("base64")}`, expectedAnswer: colors.map((color) => color.name).join(" ") };
}
