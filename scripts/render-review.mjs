/**
 * Rendu ciblé pour revue visuelle : une ligne par loadout, quelques frames
 * clés, sur fond gris afin que la transparence (trous) soit visible.
 *   npx tsx scripts/render-review.mjs [out.png]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateSpriteFrames } from '../src/components/sprite/spriteGenerator';
import { applyEquipmentOverlays, resolveLoadout } from '../src/components/sprite/equipOverlays';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../src/components/sprite/spriteTypes';

const SCALE = 10;
const GAP = 2;
const BG = [40, 44, 52];

const ROWS = [
  { label: 'nu', weapon: null, armor: null, accessory: null },
  { label: 'epee+cuir', weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'lucky_charm' },
  { label: 'bouclier', weapon: 'soulreaper', armor: 'guardian_shield', accessory: null },
  { label: 'heaume+couronne', weapon: null, armor: 'guardian_helm', accessory: 'eternal_crown' },
  { label: 'plastron+boots', weapon: 'heavens_edge', armor: 'aegis_plate', accessory: 'swift_boots' },
  { label: 'gantelets+collier', weapon: null, armor: 'flame_gauntlets', accessory: 'pearl_necklace' },
  { label: 'hache', weapon: 'battle_axe', armor: 'leather_vest', accessory: null },
  { label: 'baton', weapon: 'oak_staff', armor: null, accessory: null },
  { label: 'fauchoir', weapon: 'doom_scythe', armor: null, accessory: null },
  { label: 'arc', weapon: 'hunter_bow', armor: null, accessory: null },
  { label: 'spear', weapon: 'sun_spear', armor: 'leather_vest', accessory: null },
  { label: 'dague+bottes', weapon: 'flame_dagger', armor: null, accessory: 'shadowstep_boots' },
  { label: 'robes', weapon: 'wand_of_storms', armor: 'arcane_robe', accessory: 'crystal_pendant' },
  { label: 'coif+bouclier', weapon: 'glaive', armor: 'chainmail_coif', accessory: 'brass_ring' },
];

const COLS = [
  { kind: 'idle', frame: 0 },
  { kind: 'idle', frame: 4 },
  { kind: 'run', frame: 0 },
  { kind: 'run', frame: 2 },
  { kind: 'run', frame: 4 },
  { kind: 'attack', frame: 1 },
  { kind: 'attack', frame: 3 },
  { kind: 'victory', frame: 1 },
];

const SEED = { seed: 'k3f9qz1a', gender: 'male' };

function parseHex(hex) {
  if (!hex || hex === 'transparent') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
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

const cellW = SPRITE_WIDTH + GAP;
const cellH = SPRITE_HEIGHT + GAP;
const width = (COLS.length * cellW + GAP) * SCALE;
const height = (ROWS.length * cellH + GAP) * SCALE;
const rgba = new Uint8Array(width * height * 4);

function fill(rgb) {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = rgb[0];
    rgba[i + 1] = rgb[1];
    rgba[i + 2] = rgb[2];
    rgba[i + 3] = 255;
  }
}
fill(BG);

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

const frameCache = new Map();
function framesOf(kind) {
  if (!frameCache.has(kind)) {
    frameCache.set(kind, generateSpriteFrames(SEED.seed, SEED.gender, null, kind) ?? []);
  }
  return frameCache.get(kind);
}

ROWS.forEach((row, r) => {
  const loadout = resolveLoadout(row);
  COLS.forEach((col, c) => {
    const frames = framesOf(col.kind);
    const frame = frames[Math.min(col.frame, frames.length - 1)];
    if (!frame) return;
    const overlaid = applyEquipmentOverlays(frame.grid, frame.palette, loadout);
    blit(
      { grid: overlaid.grid, palette: overlaid.palette },
      (GAP + c * cellW) * SCALE,
      (GAP + r * cellH) * SCALE,
    );
  });
});

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] ?? 'review.png');
writeFileSync(out, encodePNG(rgba, width, height));
console.log(`✓ ${out} — ${width}x${height} (${ROWS.length} loadouts x ${COLS.length} frames)`);
