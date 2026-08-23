/**
 * BitBrawler brand icon generator — pure Node (no deps).
 * Renders the 16x16 pixel "gold fist on dark" artwork to every PNG size used
 * by the PWA / favicons, plus the master icon.svg (rect-per-pixel).
 *
 * Run: node scripts/gen-icons.mjs
 */
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = resolve(ROOT, 'public');

// ── Pixel palette (matches app theme: dark + $accent-gold) ──
const C = {
  bgTop: [26, 18, 11],      // #1a120b
  bgBottom: [10, 6, 3],     // #0a0603
  outline: [43, 31, 0],     // #2b1f00
  gold: [255, 204, 0],      // #ffcc00
  light: [255, 224, 102],   // #ffe066
  shade: [199, 145, 0],     // #c79100
  glint: [255, 247, 214],   // #fff7d6
};

const GRID = 16;

function hex(n) { return n.toString(16).padStart(2, '0'); }

/** Build the 16x16 artwork as a color-index grid. */
function buildArtwork() {
  const g = Array.from({ length: GRID }, () => Array(GRID).fill('bg'));

  const inBody = (x, y) => {
    // Rounded square: cols 3..12, rows 2..12, corner radius 2
    if (x < 3 || x > 12 || y < 2 || y > 12) return false;
    const dx = x < 5 ? 5 - x : x > 10 ? x - 10 : 0;
    const dy = y < 4 ? 4 - y : y > 10 ? y - 10 : 0;
    return dx * dx + dy * dy <= 4;
  };

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!inBody(x, y)) continue;
      let c = 'gold';
      if (y === 3) c = 'light';                       // top highlight
      if (y === 12 || (x === 11 && y >= 5)) c = 'shade'; // right/bottom shading
      if (y === 4 && x === 5) c = 'glint';            // single knuckle glint
      g[y][x] = c;
    }
  }

  // Outline: any bg cell touching the body (4-neighbourhood)
  const out = g.map(r => [...r]);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (g[y][x] !== 'bg') continue;
      const touch =
        (x > 0 && g[y][x - 1] !== 'bg') || (x < GRID - 1 && g[y][x + 1] !== 'bg') ||
        (y > 0 && g[y - 1][x] !== 'bg') || (y < GRID - 1 && g[y + 1][x] !== 'bg');
      if (touch) out[y][x] = 'outline';
    }
  }
  return out;
}

const ART = buildArtwork();

/** Render artwork at `size` px → RGBA buffer (full-bleed dark gradient). */
function renderRGBA(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cell = size / GRID;
  for (let py = 0; py < size; py++) {
    const gy = Math.min(GRID - 1, Math.floor(py / cell));
    const t = py / (size - 1);
    const bgR = Math.round(C.bgTop[0] + (C.bgBottom[0] - C.bgTop[0]) * t);
    const bgG = Math.round(C.bgTop[1] + (C.bgBottom[1] - C.bgTop[1]) * t);
    const bgB = Math.round(C.bgTop[2] + (C.bgBottom[2] - C.bgTop[2]) * t);
    for (let px = 0; px < size; px++) {
      const gx = Math.min(GRID - 1, Math.floor(px / cell));
      const name = ART[gy][gx];
      const [r, g, b] = name === 'bg' ? [bgR, bgG, bgB] : C[name];
      const i = (py * size + px) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return buf;
}

// ── Minimal PNG encoder (color type 6, filter 0) ──
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Emit every PNG asset ──
const targets = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon-180.png', 180],
  ['apple-touch-icon-167.png', 167],
  ['apple-touch-icon-152.png', 152],
  ['apple-touch-icon-120.png', 120],
  ['badge-96.png', 96],
  ['favicon-32.png', 32],
  ['favicon-16.png', 16],
];
for (const [name, size] of targets) {
  writeFileSync(resolve(PUB, name), encodePNG(renderRGBA(size), size));
  console.log('✓', name);
}

// ── Master icon.svg (same artwork, crisp vector rects) ──
const S = 64; // px per grid cell in the SVG viewBox (viewBox 1024)
const svgParts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`,
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">`,
  `<stop offset="0" stop-color="#${hex(C.bgTop[0])}${hex(C.bgTop[1])}${hex(C.bgTop[2])}"/>`,
  `<stop offset="1" stop-color="#${hex(C.bgBottom[0])}${hex(C.bgBottom[1])}${hex(C.bgBottom[2])}"/>`,
  `</linearGradient></defs>`,
  `<rect width="${GRID * S}" height="${GRID * S}" fill="url(#bg)"/>`,
];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const n = ART[y][x];
    if (n === 'bg') continue;
    const [r, g, b] = C[n];
    svgParts.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#${hex(r)}${hex(g)}${hex(b)}"/>`);
  }
}
svgParts.push('</svg>');
writeFileSync(resolve(PUB, 'icon.svg'), svgParts.join('\n'));
console.log('✓ icon.svg');

// ── badge.svg: flat gold fist silhouette on transparent (small status-bar use)
const badgeParts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const n = ART[y][x];
    if (n === 'bg' || n === 'outline') continue;
    badgeParts.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#ffcc00"/>`);
  }
}
badgeParts.push('</svg>');
writeFileSync(resolve(PUB, 'badge.svg'), badgeParts.join('\n'));
console.log('✓ badge.svg');
