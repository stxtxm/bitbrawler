/**
 * BitBrawler brand icon generator v2 — pure Node (no deps).
 * Artwork: TWO CROSSED SWORDS (gold x steel) with a clash spark, on a dark
 * radial background. Expert-style pixel rules: 45-degree Bresenham diagonals,
 * per-side edge highlighting, coherent shadows, maskable-safe margins.
 *
 * Sizes <= 48px use a simplified flat palette so favicons stay readable.
 *
 * Run: node scripts/gen-icons.mjs
 */
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = resolve(ROOT, 'public');

const GRID = 32;

// ── Palette ──
const P = {
  bgEdge: [10, 6, 3],       // #0a0603
  bgCenter: [36, 24, 17],   // #241811 warm glow behind the cross
  shadow: [20, 12, 7],      // #140c07 soft drop under blades
  outline: [30, 21, 2],     // #1e1502

  // Steel blade (right sword)
  sHi: [233, 240, 250],     // #e9f0fa
  sCore: [174, 189, 212],   // #aebdd4
  sLo: [109, 127, 155],     // #6d7f9b

  // Gold blade (left sword)
  gHi: [255, 224, 102],     // #ffe066
  gCore: [255, 204, 0],     // #ffcc00
  gLo: [199, 145, 0],       // #c79100

  guard: [255, 204, 0],
  guardD: [160, 116, 0],

  grip: [122, 74, 34],      // #7a4a22
  gripHi: [148, 94, 46],
  pommel: [255, 224, 102],

  sparkW: [255, 250, 235],
  sparkG: [255, 224, 102],

  // Simplified (small sizes)
  flatSteel: [207, 216, 230],
  flatGold: [255, 204, 0],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function buildArtwork(simple = false) {
  const g = Array.from({ length: GRID }, () => Array(GRID).fill('bg'));

  // Radial warm glow behind the cross
  const cx = 15.5, cy = 15.5;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = Math.hypot(x - cx, y - cy) / 18;
      const k = clamp(1 - d, 0, 1) * 0.85;
      g[y][x] = {
        r: Math.round(P.bgEdge[0] + (P.bgCenter[0] - P.bgEdge[0]) * k),
        g: Math.round(P.bgEdge[1] + (P.bgCenter[1] - P.bgEdge[1]) * k),
        b: Math.round(P.bgEdge[2] + (P.bgCenter[2] - P.bgEdge[2]) * k),
      };
    }
  }

  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    // Normalize ANY input to a plain {r,g,b}: palette arrays, named keys,
    // or accidental array-spreads that become numeric-key objects.
    let rgb = c;
    if (Array.isArray(rgb)) rgb = { r: rgb[0], g: rgb[1], b: rgb[2] };
    else if (typeof rgb === 'string') rgb = { ...P[rgb] };
    else if (rgb.r === undefined && rgb[0] !== undefined) rgb = { r: rgb[0], g: rgb[1], b: rgb[2] };
    else rgb = { ...rgb };
    g[y][x] = rgb;
  };

  /**
   * Diagonal blade from handle-side (hx,hy) going UP with horizontal sign sx.
   * length = number of steps. Sides: hi/lo perpendicular neighbours.
   */
  function sword(hx, hy, sx, len, pal) {
    // Drop shadow (offset +1,+1), full length
    for (let i = 0; i < len + 1; i++) {
      put(hx + sx * i + 1, hy - i + 1, P.shadow);
    }
    // Blade: core line + hi/lo side cells
    for (let i = 0; i < len; i++) {
      const x = hx + sx * i, y = hy - i;
      put(x, y, pal.core);
      put(x + sx, y, pal.hi);   // outer edge (towards nearest corner)
      put(x - sx, y, pal.lo);   // inner edge
    }
    // Tip: bright cap + 1 extension pixel
    const tx = hx + sx * len, ty = hy - len;
    put(tx, ty, pal.hi);
    put(tx + sx, ty - 1, simple ? pal.hi : P.sparkW);

    // Crossguard: short bar perpendicular to the blade at i = 4
    const gx = hx + sx * 4, gy = hy - 4;
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      put(gx + k, gy + k, k === 0 ? P.guard : simple ? P.guard : P.guardD);
      put(gx + k, gy + k, simple ? P.flatGold : (Math.abs(k) === 2 ? P.guardD : P.guard));
    }
    put(gx, gy, P.guard);

    // Grip towards the handle corner + pommel
    for (let i = 1; i <= 4; i++) {
      put(hx - sx * i, hy + i, i % 2 ? P.grip : P.gripHi);
    }
    put(hx - sx * 5, hy + 5, P.pommel);
  }

  const steelPal = simple
    ? { core: P.flatSteel, hi: P.flatSteel, lo: P.flatSteel }
    : { core: P.sCore, hi: P.sHi, lo: P.sLo };
  const goldPal = simple
    ? { core: P.flatGold, hi: P.flatGold, lo: P.flatGold }
    : { core: P.gCore, hi: P.gHi, lo: P.gLo };

  // Right sword: steel, handle bottom-right -> tip top-left
  sword(25, 26, -1, 18, steelPal);
  // Left sword: gold, handle bottom-left -> tip top-right (drawn last = on top)
  sword(6, 26, 1, 18, goldPal);

  // Clash spark at the crossing point
  put(16, 16, P.sparkW);
  put(15, 16, P.sparkG); put(17, 16, P.sparkG);
  put(16, 15, P.sparkG); put(16, 17, P.sparkG);
  if (!simple) {
    put(14, 14, P.sparkG); put(18, 14, P.sparkG);
    put(14, 18, P.sparkG); put(18, 18, P.sparkG);
  }

  return g;
}

/** Render artwork at `size` px → RGBA buffer (full-bleed, nearest neighbour). */
function renderRGBA(art, size) {
  const buf = Buffer.alloc(size * size * 4);
  const cell = size / GRID;
  for (let py = 0; py < size; py++) {
    const gy = clamp(Math.floor(py / cell), 0, GRID - 1);
    for (let px = 0; px < size; px++) {
      const gx = clamp(Math.floor(px / cell), 0, GRID - 1);
      const c = art[gy][gx];
      const i = (py * size + px) * 4;
      buf[i] = c.r ?? c[0];
      buf[i + 1] = c.g ?? c[1];
      buf[i + 2] = c.b ?? c[2];
      buf[i + 3] = 255;
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
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Emit assets ──
const detailed = buildArtwork(false);
const simple = buildArtwork(true);

const targets = [
  ['icon-512.png', 512, detailed],
  ['icon-192.png', 192, detailed],
  ['apple-touch-icon-180.png', 180, detailed],
  ['apple-touch-icon-167.png', 167, detailed],
  ['apple-touch-icon-152.png', 152, detailed],
  ['apple-touch-icon-120.png', 120, simple],
  ['badge-96.png', 96, simple],
  ['favicon-32.png', 32, simple],
  ['favicon-16.png', 16, simple],
];
for (const [name, size, art] of targets) {
  writeFileSync(resolve(PUB, name), encodePNG(renderRGBA(art, size), size));
  console.log('✓', name);
}

// ── Master icon.svg (rect-per-pixel, crispEdges) ──
const S = 32;
const hex = n => n.toString(16).padStart(2, '0');
const css = c => Array.isArray(c) ? `#${hex(c[0])}${hex(c[1])}${hex(c[2])}` : `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`,
  `<rect width="${GRID * S}" height="${GRID * S}" fill="${css(detailed[0][0])}"/>`,
];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const c = detailed[y][x];
    if (y === 0 && x === 0) continue;
    parts.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="${css(c)}"/>`);
  }
}
parts.push('</svg>');
writeFileSync(resolve(PUB, 'icon.svg'), parts.join('\n'));
console.log('✓ icon.svg');

// ── badge.svg: flat gold swords silhouette on transparent ──
const badgeArt = buildArtwork(true);
const bp = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const c = badgeArt[y][x];
    const isBg = c.r !== undefined && c.r === P.bgEdge[0] && c.g === P.bgEdge[1];
    const isShadowLike = !Array.isArray(c) && c.r !== undefined && c.r < 40 && c.b < 20;
    if (isBg || isShadowLike) continue;
    const goldish = (c[1] ?? c.g) > 150 && (c[2] ?? c.b) < 120; // gold family only
    if (!goldish) continue;
    bp.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#ffcc00"/>`);
  }
}
bp.push('</svg>');
writeFileSync(resolve(PUB, 'badge.svg'), bp.join('\n'));
console.log('✓ badge.svg');
