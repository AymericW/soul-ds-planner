#!/usr/bin/env node
/**
 * Generates the original app icons (no external art) as PNG files using only
 * Node's built-in modules: a gold shield with a star on a navy background.
 *
 *   node scripts/generate-icons.mjs
 *
 * Output: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon,favicon}.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const NAVY = [10, 22, 48];
const NAVY_INNER = [22, 44, 92];
const GOLD = [232, 183, 58];
const GOLD_BRIGHT = [255, 211, 107];

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- geometry (unit square coordinates 0..1) ----------
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function shieldPolygon(cx, top, width, height) {
  const pts = [];
  const half = width / 2;
  const shoulder = top + height * 0.12;
  pts.push([cx - half, shoulder]);
  pts.push([cx - half * 0.55, top + height * 0.02]);
  pts.push([cx, top]);
  pts.push([cx + half * 0.55, top + height * 0.02]);
  pts.push([cx + half, shoulder]);
  // right side curving down to the tip
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = cx + half * Math.cos((t * Math.PI) / 2) ** 0.9;
    const y = shoulder + (top + height - shoulder) * Math.sin((t * Math.PI) / 2) ** 1.4;
    pts.push([x, y]);
  }
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const x = cx - half * Math.cos((t * Math.PI) / 2) ** 0.9;
    const y = shoulder + (top + height - shoulder) * Math.sin((t * Math.PI) / 2) ** 1.4;
    pts.push([x, y]);
  }
  return pts;
}

function starPolygon(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function roundedRectContains(x, y, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

const OUTER_SHIELD = shieldPolygon(0.5, 0.12, 0.7, 0.78);
const INNER_SHIELD = shieldPolygon(0.5, 0.18, 0.58, 0.64);
const STAR = starPolygon(0.5, 0.47, 0.2, 0.085);

/** Returns the colour of the design at (x, y) or null for transparent. */
function sample(x, y, { scale, cornerRadius }) {
  if (cornerRadius > 0 && !roundedRectContains(x, y, cornerRadius)) return null;
  // map into the content box (scale < 1 keeps the maskable safe zone)
  const u = 0.5 + (x - 0.5) / scale;
  const v = 0.5 + (y - 0.5) / scale;
  if (pointInPolygon(u, v, STAR)) return v < 0.43 ? GOLD_BRIGHT : GOLD;
  if (pointInPolygon(u, v, INNER_SHIELD)) return NAVY_INNER;
  if (pointInPolygon(u, v, OUTER_SHIELD)) return GOLD;
  return NAVY;
}

function render(size, options) {
  const ss = 4; // supersampling for smooth edges
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size, options);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
      }
      buf[i + 3] = Math.round((a / (ss * ss)) * 255);
    }
  }
  return encodePng(size, size, buf);
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1, cornerRadius: 0.18 },
  { file: 'icon-512.png', size: 512, scale: 1, cornerRadius: 0.18 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78, cornerRadius: 0 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.9, cornerRadius: 0 },
  { file: 'favicon.png', size: 64, scale: 1, cornerRadius: 0.18 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const t of targets) {
  writeFileSync(join(OUT_DIR, t.file), render(t.size, t));
  console.log(`wrote public/icons/${t.file}`);
}
