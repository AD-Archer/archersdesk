// Generates public/icons/icon-192.png and icon-512.png with zero deps:
// a hand-rolled PNG encoder drawing the desk clock mark (10:08, of course).
// Run: pnpm icons

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── tiny png encoder ─────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // rgba
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── drawing helpers (signed distance + smooth edges) ─────────────────
const smooth = (d, aa) => Math.max(0, Math.min(1, 0.5 - d / aa));

function roundedRectDist(x, y, half, r) {
  const qx = Math.abs(x) - (half - r);
  const qy = Math.abs(y) - (half - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function segmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const aa = 1.25;

  // palette
  const bgTop = [18, 15, 12];
  const bgBot = [10, 9, 8];
  const cream = [242, 236, 223];
  const amber = [232, 161, 60];

  const ringR = size * 0.335;
  const ringW = size * 0.02;
  const hourAngle = ((10 % 12) / 12 + 8 / 60 / 12) * Math.PI * 2 - Math.PI / 2;
  const minAngle = (8 / 60) * Math.PI * 2 - Math.PI / 2;
  const hourLen = ringR * 0.52;
  const minLen = ringR * 0.74;
  const handW = size * 0.026;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c + 0.5;
      const dy = y - c + 0.5;

      const shape = smooth(roundedRectDist(dx, dy, c, size * 0.22), aa);
      if (shape <= 0) continue;

      // vertical gradient + soft amber glow low in the tile
      const t = y / size;
      let r = bgTop[0] + (bgBot[0] - bgTop[0]) * t;
      let g = bgTop[1] + (bgBot[1] - bgTop[1]) * t;
      let b = bgTop[2] + (bgBot[2] - bgTop[2]) * t;
      const glow = Math.exp(-(dx * dx + (dy - size * 0.42) ** 2) / (2 * (size * 0.34) ** 2)) * 0.35;
      r += amber[0] * glow * 0.35;
      g += amber[1] * glow * 0.3;
      b += amber[2] * glow * 0.2;

      // ring
      const ring = smooth(Math.abs(Math.hypot(dx, dy) - ringR) - ringW, aa);
      // hands
      const hAx = Math.cos(hourAngle);
      const hAy = Math.sin(hourAngle);
      const mAx = Math.cos(minAngle);
      const mAy = Math.sin(minAngle);
      const hour = smooth(segmentDist(dx, dy, 0, 0, hAx * hourLen, hAy * hourLen) - handW, aa);
      const minute = smooth(segmentDist(dx, dy, 0, 0, mAx * minLen, mAy * minLen) - handW * 0.8, aa);
      const dot = smooth(Math.hypot(dx, dy) - size * 0.036, aa);

      if (ring > 0) {
        r = r + (cream[0] - r) * ring;
        g = g + (cream[1] - g) * ring;
        b = b + (cream[2] - b) * ring;
      }
      const hand = Math.max(hour, minute, dot);
      if (hand > 0) {
        r = r + (amber[0] - r) * hand;
        g = g + (amber[1] - g) * hand;
        b = b + (amber[2] - b) * hand;
      }

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(Math.min(255, r));
      rgba[i + 1] = Math.round(Math.min(255, g));
      rgba[i + 2] = Math.round(Math.min(255, b));
      rgba[i + 3] = Math.round(shape * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(join(ROOT, "public/icons"), { recursive: true });
for (const size of [192, 512]) {
  const png = draw(size);
  writeFileSync(join(ROOT, `public/icons/icon-${size}.png`), png);
  console.log(`icon-${size}.png (${png.length} bytes)`);
}
