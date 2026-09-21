import { PIXEL_HEADS, PIXEL_BODIES, PIXEL_BODIES_RUN } from '../PixelAssets';
import { mulberry32, getSeedFromText } from '../../utils/randomUtils';
import type { CharacterAppearance } from '../../types/Character';
import {
  GeneratedSprite,
  SPRITE_HEIGHT,
  SPRITE_PAD_TOP,
  SPRITE_WIDTH,
  SpriteBuild,
  SPRITE_BUILDS,
  SpriteGrid,
  SpritePalette,
  highlightIndexOf,
  shadeIndexOf,
} from './spriteTypes';
import {
  CLOTH_TONES_16,
  EYE_TONES_16,
  HAIR_TONES_16,
  OUTLINE_HEX,
  PANTS_TONES_16,
  SKIN_TONES_16,
  deepShadeHex,
  highlightHex,
  mixHex,
} from './spritePalettes';

export interface SpriteFeatures {
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
  shoesColor: string;
  eyeColor: string;
  logoColor: string;
  headType: string;
  bodyType: string;
  build: SpriteBuild;
}

const EDGE_BASES = new Set([1, 3, 4, 5, 6, 7, 9, 11, 12]);
const DITHER_BASES = new Set([4, 5, 6]);
const LIGHT_BASES = new Set([1, 4, 5, 6]);

export function resolveSpriteFeatures(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
): SpriteFeatures {
  const seedNum = getSeedFromText(seed);
  const rng = mulberry32(seedNum);
  const pick = <T,>(arr: readonly T[] | T[]): T => arr[Math.floor(rng() * arr.length)];
  const headPool = Object.keys(PIXEL_HEADS).filter((k) =>
    gender === 'male' ? k.startsWith('male') : k.startsWith('female'),
  );
  const bodyPool = Object.keys(PIXEL_BODIES);
  const fallbackBuild: SpriteBuild = SPRITE_BUILDS[seedNum % SPRITE_BUILDS.length];
  const headType = appearance?.headType && appearance.headType in PIXEL_HEADS
    ? appearance.headType
    : pick(headPool);
  const bodyType = appearance?.bodyType && appearance.bodyType in PIXEL_BODIES
    ? appearance.bodyType
    : pick(bodyPool);
  return {
    skinColor: appearance?.skinColor ?? pick(SKIN_TONES_16),
    hairColor: appearance?.hairColor ?? pick(HAIR_TONES_16),
    shirtColor: appearance?.shirtColor ?? pick(CLOTH_TONES_16),
    pantsColor: appearance?.pantsColor ?? pick(PANTS_TONES_16),
    shoesColor: '#333333',
    eyeColor: appearance?.eyeColor ?? pick(EYE_TONES_16),
    logoColor: pick(CLOTH_TONES_16),
    headType,
    bodyType,
    build: appearance?.build ?? fallbackBuild,
  };
}

function basePaletteOf(features: SpriteFeatures): SpritePalette {
  return {
    1: features.skinColor,
    2: '#FFFFFF',
    3: '#aa0000',
    4: features.hairColor,
    5: features.shirtColor,
    6: features.pantsColor,
    7: features.shoesColor,
    8: features.eyeColor,
    9: '#95a5a6',
    11: features.logoColor,
    12: features.hairColor,
  };
}

function composeBaseGrid(headType: string, bodyType: string, bodyGrid?: number[][]): SpriteGrid {
  const grid: SpriteGrid = Array.from({ length: 18 }, () => Array(12).fill(0));
  const body = bodyGrid
    ?? (PIXEL_BODIES as Record<string, number[][]>)[bodyType]
    ?? PIXEL_BODIES.basic;
  const head = (PIXEL_HEADS as Record<string, number[][]>)[headType] ?? PIXEL_HEADS.male;
  for (let y = 0; y < body.length && y + 9 < 18; y++) {
    for (let x = 0; x < body[y].length && x < 12; x++) {
      grid[y + 9][x] = body[y][x];
    }
  }
  for (let y = 0; y < head.length && y + 1 < 18; y++) {
    for (let x = 0; x < head[y].length && x < 12; x++) {
      if (head[y][x] !== 0) grid[y + 1][x] = head[y][x];
    }
  }
  return grid;
}

function applyBuild(grid: SpriteGrid, build: SpriteBuild): void {
  if (build === 'standard') return;
  for (let y = 9; y < 18; y++) {
    const row = grid[y];
    if (build === 'slim') {
      const left = row.findIndex((c) => c !== 0);
      if (left >= 0) row[left] = 0;
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] !== 0) {
          row[x] = 0;
          break;
        }
      }
    } else {
      const left = row.findIndex((c) => c !== 0);
      if (left > 0) row[left - 1] = row[left];
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] !== 0) {
          if (x + 1 < row.length) row[x + 1] = row[x];
          break;
        }
      }
    }
  }
}

function upscale(grid: SpriteGrid): SpriteGrid {
  const out: SpriteGrid = [];
  for (const row of grid) {
    const doubled = row.flatMap((c) => [c, c]);
    out.push([...doubled], [...doubled]);
  }
  return out;
}

function applySnes(grid: SpriteGrid): void {
  const h = grid.length;
  const w = grid[0].length;
  const emptyAt = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= w || y >= h || grid[y][x] === 0;
  const edits: Array<[number, number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = grid[y][x];
      if (base === 0 || !EDGE_BASES.has(base)) continue;
      const edge = emptyAt(x - 1, y) || emptyAt(x + 1, y) || emptyAt(x, y - 1) || emptyAt(x, y + 1);
      if (LIGHT_BASES.has(base) && emptyAt(x, y - 1)) {
        edits.push([y, x, highlightIndexOf(base)]);
        continue;
      }
      if (edge) {
        edits.push([y, x, shadeIndexOf(base)]);
        continue;
      }
      if (DITHER_BASES.has(base) && (x + y) % 2 === 0) {
        edits.push([y, x, shadeIndexOf(base)]);
      }
    }
  }
  for (const [y, x, v] of edits) grid[y][x] = v;
}

function applyDetails(grid: SpriteGrid): void {
  for (let x = 0; x < 24; x++) {
    for (const y of [26, 27]) {
      if (grid[y][x] === 5) grid[y][x] = shadeIndexOf(5);
    }
    for (const y of [34, 35]) {
      if (grid[y][x] === 7) grid[y][x] = shadeIndexOf(7);
    }
    for (const y of [28, 29]) {
      if ((x === 11 || x === 12) && (grid[y][x] === 6 || grid[y][x] === shadeIndexOf(6))) {
        grid[y][x] = 9;
      }
    }
  }
  for (const y of [20, 21]) {
    const row = grid[y];
    const left = row.findIndex((c) => c !== 0);
    if (left >= 0 && (row[left] === 5 || row[left] === shadeIndexOf(5))) row[left] = 9;
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] !== 0) {
        if (row[x] === 5 || row[x] === shadeIndexOf(5)) row[x] = 9;
        break;
      }
    }
  }
}

function applyFeatures(grid: SpriteGrid): void {
  const set = (x: number, y: number, v: number, onlyIf: number): void => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
    if (grid[y][x] === onlyIf) grid[y][x] = v;
  };
  let eyeSumX = 0;
  let eyeCount = 0;
  let eyeY = 10;
  let eyeFirstY = 99;
  const eyeXs: number[] = [];
  for (let y = 2; y <= 17; y++) {
    for (let x = 0; x < 24; x++) {
      if (grid[y][x] === 8) {
        eyeSumX += x;
        eyeCount++;
        eyeY = y;
        if (y < eyeFirstY) eyeFirstY = y;
        eyeXs.push(x);
      }
    }
  }
  const faceCx = eyeCount > 0 ? Math.round(eyeSumX / eyeCount) : 11;
  const row = grid[eyeY] ?? [];
  const lx = row.findIndex((c) => c !== 0);
  let rx = -1;
  for (let x = row.length - 1; x >= 0; x--) {
    if (row[x] !== 0) {
      rx = x;
      break;
    }
  }
  if (lx >= 0) {
    if (grid[eyeY]?.[lx - 1] === 0) grid[eyeY][lx - 1] = 1;
    if (grid[eyeY]?.[rx + 1] === 0) grid[eyeY][rx + 1] = 1;
  }
  set(faceCx, eyeY + 2, shadeIndexOf(1), 1);
  for (const ex of eyeXs) set(ex, eyeFirstY - 2, shadeIndexOf(4), 1);
  let torsoX0 = 99;
  let torsoX1 = -1;
  for (let y = 18; y <= 29; y++) {
    const r = grid[y] ?? [];
    r.forEach((c, x) => {
      if (c !== 0) {
        if (x < torsoX0) torsoX0 = x;
        if (x > torsoX1) torsoX1 = x;
      }
    });
  }
  const torsoCx = Math.round((torsoX0 + torsoX1) / 2);
  for (let x = torsoCx - 1; x <= torsoCx + 1; x++) {
    set(x, 18, 11, 1);
    set(x, 19, 11, 1);
  }
  for (let y = 22; y <= 26; y++) {
    set(torsoCx - 3, y, shadeIndexOf(5), 5);
    set(torsoCx + 3, y, shadeIndexOf(5), 5);
  }
  for (let y = 30; y <= 33; y++) {
    set(torsoCx, y, shadeIndexOf(6), 6);
    const row = grid[y] ?? [];
    const left = row.findIndex((c) => c === 6 || c === shadeIndexOf(6));
    if (left >= 0) set(left, y, highlightIndexOf(6), row[left]);
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] === 6 || row[x] === shadeIndexOf(6)) {
        set(x, y, highlightIndexOf(6), row[x]);
        break;
      }
    }
  }
  const shoeRow = grid[34] ?? [];
  let runStart = -1;
  for (let x = 0; x <= shoeRow.length; x++) {
    const shoe = x < shoeRow.length && (shoeRow[x] === 7 || shoeRow[x] === shadeIndexOf(7));
    if (shoe && runStart < 0) runStart = x;
    if (!shoe && runStart >= 0) {
      const mid = Math.floor((runStart + x - 1) / 2);
      set(mid, 34, 2, shoeRow[mid]);
      if (x - runStart > 3) set(mid + 1, 34, 2, shoeRow[mid + 1]);
      runStart = -1;
    }
  }
}

function buildPalette(features: SpriteFeatures): SpritePalette {
  const colors = basePaletteOf(features);
  const palette: SpritePalette = { ...colors };
  for (const key of Object.keys(colors).map(Number)) {
    if (EDGE_BASES.has(key)) palette[shadeIndexOf(key)] = mixHex(colors[key], OUTLINE_HEX, 0.55);
  }
  palette[highlightIndexOf(4)] = highlightHex(colors[4]);
  palette[highlightIndexOf(1)] = highlightHex(colors[1]);
  palette[highlightIndexOf(5)] = highlightHex(colors[5]);
  palette[highlightIndexOf(6)] = highlightHex(colors[6]);
  palette[shadeIndexOf(5)] = deepShadeHex(colors[5]);
  return palette;
}

export type StridePhase = 0 | 1 | 2;

interface LimbCell {
  x: number;
  y: number;
  v: number;
}

function collectMove(
  base: SpriteGrid,
  cells: LimbCell[],
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return;
  for (const { x, y } of cells) {
    if (y >= 0 && y < base.length && x >= 0 && x < base[y].length) base[y][x] = 0;
  }
  for (const { x, y, v } of cells) {
    const px = x + dx;
    const py = y + dy;
    if (py < 0 || py >= base.length || px < 0 || px >= base[py].length) continue;
    base[py][px] = v;
  }
}

function runsInRow(row: number[], allowed: (v: number) => boolean): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  for (let x = 0; x <= row.length; x++) {
    const on = x < row.length && allowed(row[x]);
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      runs.push([start, x - 1]);
      start = -1;
    }
  }
  return runs;
}

// Procedural run stride on the composed base grid (12x18 space: arms rows
// 12-14, legs rows 15-16, feet row 17). Both legs stay visible every frame —
// phase 1 is neutral, phases 0/2 mirror the scissor — so nothing teleports.
function applyStride(base: SpriteGrid, phase: StridePhase): void {
  if (phase === 1) return;
  const mirror = phase === 2 ? -1 : 1;
  const isCloth = (v: number): boolean => v !== 0;
  const legRuns = runsInRow(base[16] ?? [], isCloth).filter(([a, b]) => {
    const below = base[17] ?? [];
    return below.slice(Math.max(0, a - 1), b + 2).some((c) => c !== 0);
  });
  if (legRuns.length >= 2) {
    // Thighs (row 15) stay planted — only shins + feet swing, so legs bend
    // instead of melting into the body. One foot lifts clear of the ground.
    const left = legRuns[0];
    const right = legRuns[legRuns.length - 1];
    const shinCells = (run: [number, number]): LimbCell[] => {
      const out: LimbCell[] = [];
      for (const y of [16, 17]) {
        for (let x = run[0]; x <= run[1]; x++) {
          const v = base[y]?.[x] ?? 0;
          if (v !== 0) out.push({ x, y, v });
        }
      }
      return out;
    };
    collectMove(base, shinCells(left), -mirror, 0);
    collectMove(base, shinCells(right), mirror, -1);
  } else {
    for (const y of [15, 16, 17]) {
      const rowCells: LimbCell[] = [];
      (base[y] ?? []).forEach((v, x) => {
        if (v !== 0) rowCells.push({ x, y, v });
      });
      collectMove(base, rowCells, -mirror, 0);
    }
  }
  // Arms pump by STRETCHING, never sliding: the shoulder row stays put and
  // the arm duplicates one row down/up, so the joint never opens a gap.
  // Read order runs opposite to the stretch so painted cells are never
  // re-read within the same pass (no cascade).
  const skinFamily = new Set([1, shadeIndexOf(1), highlightIndexOf(1)]);
  const takeArm = (row: number[], fromLeft: boolean): LimbCell[] => {
    const out: LimbCell[] = [];
    const xs = fromLeft ? row.map((_, x) => x) : row.map((_, x) => row.length - 1 - x);
    for (const x of xs) {
      if (row[x] === 0) continue;
      if (out.length >= 3 || !skinFamily.has(row[x])) break;
      out.push({ x, y: 0, v: row[x] });
    }
    return out;
  };
  const stretch = mirror === 1 ? 1 : -1;
  const pump = (fromLeft: boolean, dy: number): void => {
    const ys = dy > 0 ? [14, 13, 12] : [12, 13, 14];
    for (const y of ys) {
      const row = base[y] ?? [];
      for (const c of takeArm(row, fromLeft)) {
        const py = y + dy;
        if (py >= 0 && py < base.length) base[py][c.x] = c.v;
      }
    }
  };
  pump(true, stretch);
  pump(false, -stretch);
}

function finishGrid(base: SpriteGrid, features: SpriteFeatures, phase: StridePhase = 1): SpriteGrid {
  applyBuild(base, features.build);
  applyStride(base, phase);
  const grid = upscale(base);
  applySnes(grid);
  applyDetails(grid);
  applyFeatures(grid);
  for (let i = 0; i < SPRITE_PAD_TOP; i++) grid.unshift(Array(SPRITE_WIDTH).fill(0));
  return grid;
}

export function generateSprite16(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
): GeneratedSprite {
  const features = resolveSpriteFeatures(seed, gender, appearance);
  const grid = finishGrid(composeBaseGrid(features.headType, features.bodyType), features);
  const palette = buildPalette(features);
  return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
}

export type SpriteAnimKind = 'run' | 'attack';

const ANIM_KEYS: Record<SpriteAnimKind, ['run1' | 'attack1', 'run2' | 'attack2', 'run3' | 'attack3']> = {
  run: ['run1', 'run2', 'run3'],
  attack: ['attack1', 'attack2', 'attack3'],
};

// Animation frames for the run cycle / attack swing. Same head, same colors,
// same size — only the limbs move. Bodies unknown to PIXEL_BODIES_RUN fall
// back to null (caller keeps the static sprite).
export function generateSpriteFrames(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
  kind: SpriteAnimKind = 'run',
): GeneratedSprite[] | null {
  const features = resolveSpriteFeatures(seed, gender, appearance);
  const palette = buildPalette(features);
  if (kind === 'run') {
    const phases: StridePhase[] = [0, 1, 2];
    return phases.map((phase) => {
      const grid = finishGrid(composeBaseGrid(features.headType, features.bodyType), features, phase);
      return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
    });
  }
  const runBody = (PIXEL_BODIES_RUN as Record<string, Record<string, number[][]>>)[features.bodyType];
  if (!runBody) return null;
  return ANIM_KEYS[kind].map((key) => {
    const bodyGrid = runBody[key];
    if (!bodyGrid) return null;
    const grid = finishGrid(composeBaseGrid(features.headType, features.bodyType, bodyGrid), features);
    return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
  }).filter((s): s is GeneratedSprite => s !== null);
}
