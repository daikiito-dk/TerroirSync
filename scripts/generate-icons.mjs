#!/usr/bin/env node
/**
 * Generates TerroirSync PWA icons deterministically — no dependencies.
 *
 * Motif: cream grape cluster + vine-green leaf on a deep-burgundy
 * gradient, drawn with distance/coverage tests and 4x4 supersampling.
 * The motif stays inside the 80% maskable-safe zone.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/* --- palette (matches app/globals.css) --- */
const CREAM = [0xfa, 0xf6, 0xee];
const VINE = [0x3f, 0x6b, 0x4a];
const BURGUNDY_TOP = [0x72, 0x25, 0x35];
const BURGUNDY_BOTTOM = [0x47, 0x13, 0x20];

const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/* --- motif geometry (unit square, y grows downward) --- */
const GRAPES = [
  [0.46, 0.6],
  [0.58, 0.6],
  [0.52, 0.715],
];
const GRAPE_R = 0.093;
const STEM = { x1: 0.52, y1: 0.6, x2: 0.6, y2: 0.345, w: 0.036 };
const LEAF = {
  cx: 0.635,
  cy: 0.405,
  rx: 0.165,
  ry: 0.09,
  rot: (-35 * Math.PI) / 180,
};

function segDist(px, py, { x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
}

function inEllipse(px, py, { cx, cy, rx, ry, rot }) {
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const x = (px - cx) * cos - (py - cy) * sin;
  const y = (px - cx) * sin + (py - cy) * cos;
  return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
}

function shapeColor(u, v) {
  for (const [gx, gy] of GRAPES) {
    if (Math.hypot(u - gx, v - gy) <= GRAPE_R) return CREAM;
  }
  if (segDist(u, v, STEM) <= STEM.w / 2) return CREAM;
  if (inEllipse(u, v, LEAF)) return VINE;
  return null;
}

function render(size) {
  const SS = 4;
  const samples = SS * SS;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const bg = mix(BURGUNDY_TOP, BURGUNDY_BOTTOM, y / (size - 1));
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = shapeColor(u, v) ?? bg;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 4;
      data[i] = Math.round(r / samples);
      data[i + 1] = Math.round(g / samples);
      data[i + 2] = Math.round(b / samples);
      data[i + 3] = 255;
    }
  }
  return data;
}

/* --- minimal PNG encoder (8-bit RGBA, filter 0) --- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(
    crc32(Buffer.concat([Buffer.from(type, "ascii"), data])),
    8 + data.length,
  );
  return out;
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const [size, name] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
]) {
  writeFileSync(join(outDir, name), encodePng(size, render(size)));
  console.log(`wrote public/${name} (${size}x${size})`);
}
