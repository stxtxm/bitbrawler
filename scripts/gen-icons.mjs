/**
 * BitBrawler brand icon generator v3 — pure Node (no deps).
 *
 * Artwork: BRAWLER BUST over CROSSED SWORDS.
 *   - Background: dark radial warm glow
 *   - Two crossed swords (gold x steel) framing the composition
 *   - Front-facing brawler: spiky hair, GOLD HEADBAND with knot tails,
 *     glowing cyan eyes, determined brows, jaw shading, steel shoulders
 *     with gold trim
 *   - Clash sparkles in the upper corners
 *
 * Sizes <= 48px use a simplified flat palette so favicons stay readable.
 * Run: node scripts/gen-icons.mjs
 */
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = resolve(ROOT, 'public');

const GRID = 32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── Palette ──
const P = {
  bgEdge: [10, 6, 3],
  bgCenter: [40, 26, 18],
  shadow: [16, 10, 6],

  sHi: [233, 240, 250], sCore: [174, 189, 212], sLo: [109, 127, 155], // steel
  gHi: [255, 224, 102], gCore: [255, 204, 0], gLo: [199, 145, 0],     // gold
  guardD: [160, 116, 0],
  grip: [122, 74, 34], gripHi: [148, 94, 46],
  sparkW: [255, 250, 235],

  outline: [12, 9, 14],      // near-black cool outline for the figure
  hair: [43, 43, 58],        // #2b2b3a dark blue-black spikes
  hairHi: [90, 90, 120],
  band: [255, 204, 0],       // gold headband
  bandD: [199, 145, 0],
  skin: [232, 184, 138],     // #e8b88a
  skinHi: [245, 205, 165],
  skinSh: [201, 149, 95],    // #c9955f
  brow: [30, 24, 34],
  eyeW: [240, 248, 255],
  eyeCyan: [89, 215, 255],   // glowing iris
  mouth: [120, 62, 48],
  scar: [214, 80, 60],
  armor: [74, 85, 104],      // #4a5568 steel shoulders
  armorHi: [110, 124, 148],
  armorLo: [52, 60, 76],
};

function buildArtwork(simple = false) {
  const g = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => ({ ...P.bgEdge })));
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
    if (c === undefined || c === null) return;
    let rgb = c;
    if (Array.isArray(rgb)) rgb = { r: rgb[0], g: rgb[1], b: rgb[2] };
    else if (typeof rgb === 'string') rgb = { ...(P[rgb] ?? P.gCore) };
    else if (rgb.r === undefined && rgb[0] !== undefined) rgb = { r: rgb[0], g: rgb[1], b: rgb[2] };
    else rgb = { ...rgb };
    g[y][x] = rgb;
  };

  const cx = 15.5, cy = 15.5;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = Math.hypot(x - cx, y - cy) / 18;
      const k = clamp(1 - d, 0, 1) * 0.9;
      put(x, y, {
        r: Math.round(P.bgEdge[0] + (P.bgCenter[0] - P.bgEdge[0]) * k),
        g: Math.round(P.bgEdge[1] + (P.bgCenter[1] - P.bgEdge[1]) * k),
        b: Math.round(P.bgEdge[2] + (P.bgCenter[2] - P.bgEdge[2]) * k),
      });
    }
  }

  const flat = c => (simple ? (c === P.sHi || c === P.sCore || c === P.sLo ? P.flatSteel : null) : null);

  // ── Crossed swords (BEHIND the bust) ────────────────────────────────
  function sword(hx, hy, sx, len, pal) {
    for (let i = 0; i < len + 1; i++) put(hx + sx * i + 1, hy - i + 1, P.shadow);
    for (let i = 0; i < len; i++) {
      const x = hx + sx * i, y = hy - i;
      put(x, y, pal.core);
      put(x + sx, y, pal.hi);
      put(x - sx, y, pal.lo);
    }
    put(hx + sx * len, hy - len, pal.hi);
    if (!simple) put(hx + sx * (len + 1), hy - len - 1, P.sparkW);
    const gx = hx + sx * 3, gy = hy - 3;
    for (let k = -2; k <= 2; k++) if (k !== 0) put(gx + k, gy + k, Math.abs(k) === 2 ? P.guardD : P.gCore);
    put(gx, gy, P.gCore);
    for (let i = 1; i <= 3; i++) put(hx - sx * i, hy + i, i % 2 ? P.grip : P.gripHi);
    put(hx - sx * 4, hy + 4, P.pommel);
  }
  const steelPal = simple ? { core: P.flatSteel, hi: P.flatSteel, lo: P.flatSteel } : { core: P.sCore, hi: P.sHi, lo: P.sLo };
  const goldPal = simple ? { core: P.flatGold, hi: P.flatGold, lo: P.flatGold } : { core: P.gCore, hi: P.gHi, lo: P.gLo };
  sword(27, 27, -1, 20, steelPal); // handle bottom-right -> tip top-left
  sword(4, 27, 1, 20, goldPal);    // handle bottom-left  -> tip top-right

  // ── Figure outline pass helper ──────────────────────────────────────
  const figureCells = new Map(); // key "x,y" -> color key name
  const F = (x, y, key) => { if (x >= 8 && x <= 23 && y >= 4 && y <= 26) figureCells.set(`${x},${y}`, key); };

  // Hair spikes (rows 4-7)
  const hairTop = [[11, 4], [13, 4], [17, 4], [19, 4], [10, 5], [15, 4], [20, 5]];
  for (const [x, y] of hairTop) F(x, y, 'hair');
  for (let x = 9; x <= 22; x++) F(x, 5, 'hair');
  for (let x = 9; x <= 22; x++) F(x, 6, 'hair');
  for (let x = 10; x <= 21; x++) F(x, 7, x === 12 || x === 19 ? 'hairHi' : 'hair');

  // Gold headband (row 8) + knot tails flying right (rows 7-9)
  for (let x = 9; x <= 22; x++) F(x, 8, x === 22 ? 'bandD' : 'band');
  F(23, 7, 'band'); F(24, 6, 'band'); F(23, 9, 'bandD'); F(25, 8, 'bandD');

  // Face (rows 9-19), ears
  for (let y = 9; y <= 18; y++) {
    for (let x = 10; x <= 21; x++) {
      if ((y === 18 && (x < 12 || x > 19))) continue; // jaw taper
      if ((y === 17 && (x < 11 || x > 20)) && false) continue;
      F(x, y, 'skin');
    }
  }
  F(9, 13, 'skin'); F(9, 14, 'skinSh'); F(22, 13, 'skin'); F(22, 14, 'skinSh'); // ears
  // Face shading: right side + jaw
  for (let y = 9; y <= 17; y++) F(21, y, 'skinSh');
  for (let x = 12; x <= 19; x++) F(x, 17, 'skinSh');
  for (let x = 13; x <= 18; x++) F(x, 18, 'skinSh');
  F(16, 16, 'skinSh'); // nose hint

  // Brows (angled, determined)
  F(12, 11, 'brow'); F(13, 11, 'brow'); F(14, 12, 'brow');
  F(19, 11, 'brow'); F(18, 11, 'brow'); F(17, 12, 'brow');

  // Glowing cyan eyes (rows 13-14): sclera + iris
  for (const ex of [12, 13, 18, 19]) { F(ex, 13, 'eyeW'); F(ex, 14, 'eyeW'); }
  F(13, 13, 'eyeCyan'); F(13, 14, 'eyeCyan');
  F(18, 13, 'eyeCyan'); F(18, 14, 'eyeCyan');

  // Scar on left cheek
  F(11, 15, 'scar'); F(12, 16, 'scar');

  // Mouth (grim line)
  F(15, 17, 'mouth'); F(16, 17, 'mouth');

  // Chin/jaw shadow row 19 partial
  for (let x = 13; x <= 18; x++) F(x, 19, 'skinSh');

  // Neck
  for (let x = 14; x <= 17; x++) F(x, 20, 'skinSh');

  // Shoulders / armor trapezoid (rows 21-26)
  for (let x = 8; x <= 23; x++) F(x, 26, 'armorLo');
  for (let x = 9; x <= 22; x++) F(x, 25, 'armor');
  for (let x = 10; x <= 21; x++) F(x, 24, 'armor');
  for (let x = 10; x <= 21; x++) F(x, 23, x % 4 === 2 ? 'armorLo' : 'armor');
  for (let x = 11; x <= 20; x++) F(x, 22, 'armorHi'); // gold-trim catchlight row
  for (let x = 12; x <= 19; x++) F(x, 21, x === 12 || x === 19 ? 'guardD' : 'armor');
  // Gold trim line on chest top
  for (let x = 13; x <= 18; x++) F(x, 22, x % 2 ? P.gCore : P.gHi);

  // ── Outline the whole figure ────────────────────────────────────────
  const finalGrid = g.map(r => [...r]);
  for (const [key, colorKey] of figureCells) {
    const [x, y] = key.split(',').map(Number);
    put(x, y, P[colorKey]);
  }
  for (const [key] of figureCells) {
    const [x, y] = key.split(',').map(Number);
    const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nbs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      if (figureCells.has(`${nx},${ny}`)) continue;
      const cur = finalGrid[ny][nx];
      // Only outline where background/shadow — keep sword pixels visible
      const isSword = (cur.r !== undefined && cur.b > 60 && cur.g > 90) || false;
      if (!isSword && (cur.r < 70 && cur.b < 70)) put(nx, ny, P.outline);
      else if (!isSword) put(nx, ny, P.outline);
    }
  }

  return g;
}

/** Render artwork at `size` px → RGBA buffer. */
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

// ── Minimal PNG encoder ──
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

// ── Emit ──
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

// ── icon.svg ──
const S = 32;
const hex = n => Number.isFinite(n) ? n.toString(16).padStart(2, '0') : '00';
const css = c => Array.isArray(c) ? `#${hex(c[0])}${hex(c[1])}${hex(c[2])}` : `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`,
];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    parts.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="${css(detailed[y][x])}"/>`);
  }
}
parts.push('</svg>');
writeFileSync(resolve(PUB, 'icon.svg'), parts.join('\n'));
console.log('✓ icon.svg');

// ── badge.svg: gold-only silhouette (band, swords, trim, pommels) ──
const badgeArt = buildArtwork(true);
const bp = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID * S} ${GRID * S}" shape-rendering="crispEdges">`];
for (let y = 0; y < GRID; y++) {
  for (let x = 0; x < GRID; x++) {
    const c = badgeArt[y][x];
    const isGoldish = (Array.isArray(c) ? c[1] : c.g) > 150 && (Array.isArray(c) ? c[2] : c.b) < 140;
    if (!isGoldish) continue;
    bp.push(`<rect x="${x * S}" y="${y * S}" width="${S}" height="${S}" fill="#ffcc00"/>`);
  }
}
bp.push('</svg>');
writeFileSync(resolve(PUB, 'badge.svg'), bp.join('\n'));
console.log('✓ badge.svg');
