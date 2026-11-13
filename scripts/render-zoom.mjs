/**
 * Gros plan : quelques sprites à grande échelle pour inspecter pieds, mains,
 * trous et overlays.   npx tsx scripts/render-zoom.mjs [out.png]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSpriteFrames } from '../src/components/sprite/spriteGenerator';
import { applyEquipmentOverlays, resolveLoadout } from '../src/components/sprite/equipOverlays';

const SCALE = 22;
const GAP = 4;
const BG = [40, 44, 52];

// [label, kind, frameIndex, loadout]
const CELLS = [
  ['nu idle0', 'idle', 0, null],
  ['nu idle4', 'idle', 4, null],
  ['epee idle0', 'idle', 0, { weapon: 'rusty_sword', armor: null, accessory: null }],
  ['bouclier idle0', 'idle', 0, { weapon: null, armor: 'guardian_shield', accessory: null }],
  ['bouclier run2', 'run', 2, { weapon: null, armor: 'guardian_shield', accessory: null }],
  ['plastron idle0', 'idle', 0, { weapon: 'heavens_edge', armor: 'aegis_plate', accessory: null }],
  ['heaume idle0', 'idle', 0, { weapon: null, armor: 'guardian_helm', accessory: null }],
  ['hache attack3', 'attack', 3, { weapon: 'battle_axe', armor: null, accessory: null }],
  ['arc run0', 'run', 0, { weapon: 'hunter_bow', armor: null, accessory: null }],
];

function parseHex(hex) {
  if (!hex || hex === 'transparent') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

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
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const cols = 3;
const rows = Math.ceil(CELLS.length / cols);
const cellW = 24 + GAP;
const cellH = 42 + GAP;
const width = (cols * cellW + GAP) * SCALE;
const height = (rows * cellH + GAP) * SCALE;
const rgba = new Uint8Array(width * height * 4);
for (let i = 0; i < rgba.length; i += 4) {
  rgba[i] = BG[0];
  rgba[i + 1] = BG[1];
  rgba[i + 2] = BG[2];
  rgba[i + 3] = 255;
}

function blit(sprite, x0, y0) {
  for (let y = 0; y < sprite.grid.length; y++) {
    for (let x = 0; x < sprite.grid[y].length; x++) {
      const rgb = parseHex(sprite.palette[sprite.grid[y][x]]);
      if (!rgb) continue;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const px = x0 + x * SCALE + dx;
          const py = y0 + y * SCALE + dy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const i = (py * width + px) * 4;
          rgba[i] = rgb[0];
          rgba[i + 1] = rgb[1];
          rgba[i + 2] = rgb[2];
          rgba[i + 3] = 255;
        }
      }
    }
  }
}

CELLS.forEach(([label, kind, frameIdx, loadoutSpec], idx) => {
  const frames = generateSpriteFrames('k3f9qz1a', 'male', null, kind) ?? [];
  const frame = frames[Math.min(frameIdx, frames.length - 1)];
  if (!frame) return;
  const loadout = resolveLoadout(loadoutSpec);
  const overlaid = applyEquipmentOverlays(frame.grid, frame.palette, loadout);
  const c = idx % cols;
  const r = Math.floor(idx / cols);
  blit(
    { grid: overlaid.grid, palette: overlaid.palette },
    (GAP + c * cellW) * SCALE,
    (GAP + r * cellH) * SCALE,
  );
  console.log(`${idx} [${r},${c}] ${label}`);
});

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] ?? 'zoom.png');
writeFileSync(out, encodePNG(rgba, width, height));
console.log(`✓ ${out} — ${width}x${height}`);
