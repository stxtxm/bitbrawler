/**
 * BitBrawler sprite-sheet renderer — pure Node PNG (zlib), no extra dependency.
 *
 * Renders every animation state of the real sprite pipeline (idle, run, attack,
 * hit, victory) against several production-like seeds and loadouts, upscaled
 * x12 with nearest-neighbour, into a single reviewable image.
 *
 * The script imports the shipped TypeScript renderer through tsx:
 *   npm run art:sheet   →   sprite-sheet.png (gitignored)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateSpriteFrames } from '../src/components/sprite/spriteGenerator';
import { applyEquipmentOverlays, resolveLoadout } from '../src/components/sprite/equipOverlays';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../src/components/sprite/spriteTypes';

export const SHEET_DEFAULT_SCALE = 12;
export const SHEET_GAP = 1;

export const SHEET_KINDS = ['idle', 'run', 'attack', 'hit', 'victory'];

export const SHEET_SEEDS = [
  { seed: 'k3f9qz1a', gender: 'male' },
  { seed: 'v7m2xp4c', gender: 'female' },
  { seed: 'r8t5wd0b', gender: 'male' },
];

export const SHEET_LOADOUTS = [
  { label: 'unarmed', weapon: null, armor: null, accessory: null },
  { label: 'starter', weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'lucky_charm' },
  { label: 'legendary', weapon: 'doom_scythe', armor: 'aegis_plate', accessory: 'eternal_crown' },
];

const kindFrames = new Map();
for (const kind of SHEET_KINDS) {
  const first = SHEET_SEEDS[0];
  const frames = generateSpriteFrames(first.seed, first.gender, null, kind) ?? [];
  kindFrames.set(kind, frames.length);
}

export function frameCountOfKind(kind) {
  const count = kindFrames.get(kind);
  if (!count) throw new Error(`Unknown animation kind: ${kind}`);
  return count;
}

export function sheetDimensions(opts = {}) {
  const scale = opts.scale ?? SHEET_DEFAULT_SCALE;
  const gap = opts.gap ?? SHEET_GAP;
  const rows = SHEET_SEEDS.length * SHEET_LOADOUTS.length * SHEET_KINDS.length;
  const cols = SHEET_KINDS.reduce((max, k) => Math.max(max, frameCountOfKind(k)), 0);
  const width = (cols * (SPRITE_WIDTH + gap) + gap) * scale;
  const height = (rows * (SPRITE_HEIGHT + gap) + gap) * scale;
  return { width, height, rows, cols, scale, gap };
}

function parseHex(hex) {
  if (!hex || hex === 'transparent') return null;
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  if (full.length !== 6) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function blitSprite(rgba, sheetWidth, sheetHeight, sprite, x0, y0, scale) {
  for (let y = 0; y < sprite.grid.length; y++) {
    for (let x = 0; x < sprite.grid[y].length; x++) {
      const rgb = parseHex(sprite.palette[sprite.grid[y][x]]);
      if (!rgb) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = x0 + x * scale + dx;
          const py = y0 + y * scale + dy;
          if (px < 0 || py < 0 || px >= sheetWidth || py >= sheetHeight) continue;
          const i = (py * sheetWidth + px) * 4;
          rgba[i] = rgb[0];
          rgba[i + 1] = rgb[1];
          rgba[i + 2] = rgb[2];
          rgba[i + 3] = 255;
        }
      }
    }
  }
}

export function composeSheet(opts = {}) {
  const { width, height, scale, gap } = sheetDimensions(opts);
  const rgba = new Uint8Array(width * height * 4);
  const sprites = [];
  const cellW = SPRITE_WIDTH + gap;
  const cellH = SPRITE_HEIGHT + gap;
  let row = 0;
  for (const seedSpec of SHEET_SEEDS) {
    for (const loadoutSpec of SHEET_LOADOUTS) {
      const loadout = resolveLoadout(loadoutSpec);
      for (const kind of SHEET_KINDS) {
        const frames = generateSpriteFrames(seedSpec.seed, seedSpec.gender, null, kind) ?? [];
        for (let col = 0; col < frames.length; col++) {
          const frame = frames[col];
          const overlaid = applyEquipmentOverlays(frame.grid, frame.palette, loadout);
          const sprite = {
            grid: overlaid.grid,
            palette: overlaid.palette,
            width: frame.width,
            height: frame.height,
          };
          const x = (gap + col * cellW) * scale;
          const y = (gap + row * cellH) * scale;
          blitSprite(rgba, width, height, sprite, x, y, scale);
          sprites.push({
            row,
            col,
            seed: seedSpec.seed,
            gender: seedSpec.gender,
            loadout: loadoutSpec.label,
            kind,
            frame: col,
            x,
            y,
            width: SPRITE_WIDTH * scale,
            height: SPRITE_HEIGHT * scale,
          });
        }
        row++;
      }
    }
  }
  return { width, height, rgba, sprites };
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
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4)
      .copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderSheet(opts = {}) {
  const { rgba, width, height, sprites } = composeSheet(opts);
  return { png: encodePNG(rgba, width, height), width, height, sprites };
}

const isMain = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { png, width, height, sprites } = renderSheet();
  writeFileSync(resolve(root, 'sprite-sheet.png'), png);
  console.log(`✓ sprite-sheet.png — ${width}x${height}, ${sprites.length} sprites`);
}
