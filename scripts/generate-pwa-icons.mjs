import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUTPUT = path.resolve("apps/client/public");

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeIcon(size) {
  const scale = 3;
  const width = size * scale;
  const pixels = Buffer.alloc(width * width * 4);
  const petals = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    return {
      x: width / 2 + Math.cos(angle) * width * 0.17,
      y: width / 2 + Math.sin(angle) * width * 0.17,
      angle
    };
  });
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / width;
      const corner = 0.22;
      const dx = Math.max(Math.abs(nx - 0.5) - (0.5 - corner), 0);
      const dy = Math.max(Math.abs(ny - 0.5) - (0.5 - corner), 0);
      const outside = Math.hypot(dx, dy) > corner;
      let color = outside ? [0, 0, 0, 0] : [36, 18, 24, 255];
      const cx = x - width / 2;
      const cy = y - width / 2;
      if (Math.hypot(cx, cy) < width * 0.34) color = [216, 95, 126, 255];
      for (const petal of petals) {
        const px = x - petal.x;
        const py = y - petal.y;
        const cos = Math.cos(petal.angle);
        const sin = Math.sin(petal.angle);
        const localX = px * cos + py * sin;
        const localY = -px * sin + py * cos;
        if ((localX / (width * 0.16)) ** 2 + (localY / (width * 0.1)) ** 2 <= 1) {
          color = [251, 231, 236, 255];
        }
      }
      if (Math.hypot(cx, cy) < width * 0.082) color = [126, 48, 74, 255];
      const offset = (y * width + x) * 4;
      pixels.set(color, offset);
    }
  }

  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    rows[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const source = ((y * scale + sy) * width + x * scale + sx) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += pixels[source + channel];
        }
      }
      const target = y * (size * 4 + 1) + 1 + x * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        rows[target + channel] = Math.round(sums[channel] / (scale * scale));
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(OUTPUT, `sakura-icon-${size}.png`), makeIcon(size));
}
fs.copyFileSync(
  path.join(OUTPUT, "sakura-icon-512.png"),
  path.join(OUTPUT, "sakura-icon-maskable-512.png")
);
