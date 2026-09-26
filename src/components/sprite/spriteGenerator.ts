import { PIXEL_HEADS, PIXEL_BODIES } from '../PixelAssets';
import { mulberry32, getSeedFromText } from '../../utils/randomUtils';
import type { CharacterAppearance } from '../../types/Character';
import {
  GeneratedSprite,
  HIGHLIGHT_OFFSET,
  SHADE_OFFSET,
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
  mixHex,
  shiftHex,
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
// Bases that receive a volumetric ramp: light from top-left, shadow bottom-right.
const RAMP_BASES = new Set([1, 4, 5, 6, 12]);
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
    3: '#b3392f',
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

// Anatomy pass on the composed 12x18 grid. The raw assets leave a 1-cell notch
// between the jaw and the shoulder line, which reads as a floating head. Fill
// it with a trapezius slope that inherits the shoulder colour, so neck, traps
// and head form one continuous silhouette.
function applyAnatomy(base: SpriteGrid): void {
  const NECK_Y = 9;
  for (let x = 0; x < base[NECK_Y].length; x++) {
    if (base[NECK_Y][x] !== 0) continue;
    const below = base[NECK_Y + 1]?.[x] ?? 0;
    if (below === 0 || below === 1) continue;
    const upLeft = base[NECK_Y - 1]?.[x - 1] ?? 0;
    const upRight = base[NECK_Y - 1]?.[x + 1] ?? 0;
    if (upLeft === 0 && upRight === 0) continue;
    base[NECK_Y][x] = below;
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

// Normalises a cell to its material family so a shaded or highlighted cell
// still counts as "the same material" when looking for a lit top edge.
function familyOf(v: number): number {
  if (v === 0) return 0;
  if (RAMP_BASES.has(v - SHADE_OFFSET)) return v - SHADE_OFFSET;
  if (RAMP_BASES.has(v - HIGHLIGHT_OFFSET)) return v - HIGHLIGHT_OFFSET;
  return v;
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
      // Lit top: either open sky above, or a different material above (the top
      // of a sleeve, a belt line, a shoulder under the jaw). Lighting only
      // silhouette tops left every interior form flat.
      const lit = LIGHT_BASES.has(base)
        && (emptyAt(x, y - 1) || (grid[y - 1][x] !== 0 && familyOf(grid[y - 1][x]) !== base));
      if (lit) {
        edits.push([y, x, highlightIndexOf(base)]);
        continue;
      }
      if (edge) edits.push([y, x, shadeIndexOf(base)]);
    }
  }
  for (const [y, x, v] of edits) grid[y][x] = v;
  spreadShadow(grid);
}

// Second shading pass: a lit cell directly above its own shaded family turns
// shaded too, so shadow falls downward and reads as a gradient. Restricted to
// horizontally-interior cells (both neighbours share the base) so thin 2px
// limbs are never eaten. Replaces the old checkerboard dither, which read as
// noise at this scale instead of volume.
function spreadShadow(grid: SpriteGrid): void {
  const h = grid.length;
  const w = grid[0].length;
  const spread: Array<[number, number, number]> = [];
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = grid[y][x];
      if (base === 0 || !RAMP_BASES.has(base)) continue;
      const row = grid[y];
      const left = row[x - 1];
      const right = row[x + 1];
      if (left !== base || right !== base) continue;
      if (grid[y - 1][x] === shadeIndexOf(base)) spread.push([y, x, shadeIndexOf(base)]);
    }
  }
  for (const [y, x, v] of spread) grid[y][x] = v;
}

function applyDetails(grid: SpriteGrid): void {
  for (let x = 0; x < 24; x++) {
    for (const y of [26, 27]) {
      if (grid[y][x] === 5) grid[y][x] = shadeIndexOf(5);
    }
    // Shoe volume: lit upper, dark sole — a single flat tone reads as a blob.
    for (const y of [34, 35]) {
      if (grid[y][x] === 7) grid[y][x] = y === 35 ? shadeIndexOf(7) : 7;
    }
    // Knee break so the leg reads as thigh + joint + calf instead of a bar.
    for (const y of [32]) {
      const c = grid[y][x];
      if (c === 6 || c === highlightIndexOf(6) || c === shadeIndexOf(6)) grid[y][x] = shadeIndexOf(6);
    }
    for (const y of [28, 29]) {
      // The belt line is now a lit top edge, so accept any pants tone.
      if (x !== 11 && x !== 12) continue;
      const c = grid[y][x];
      if (c === 6 || c === shadeIndexOf(6) || c === highlightIndexOf(6)) grid[y][x] = 9;
    }
    // Lower lip: a shaded bottom edge turns the mouth block into lips.
    for (const y of [13]) {
      if (grid[y][x] === 3) grid[y][x] = shadeIndexOf(3);
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

// Collar trim in logo colour. It runs across the base of the neck and onto the
// trapezius slope, so the emblem reads as a worn collar instead of a floating
// bib, while the jaw and throat above it stay skin. Falls back to the neck
// alone when a body has no shoulder slope.
function applyCollarTrim(grid: SpriteGrid): void {
  const isSkin = (v: number): boolean => v === 1 || v === shadeIndexOf(1) || v === highlightIndexOf(1);
  const isCloth = (v: number): boolean => v === 5 || v === shadeIndexOf(5) || v === highlightIndexOf(5);
  for (const y of [18, 19]) {
    const row = grid[y];
    if (!row) continue;
    let neckL = -1;
    let neckR = -1;
    for (let x = 0; x < row.length; x++) {
      if (isSkin(row[x])) {
        if (neckL < 0) neckL = x;
        neckR = x;
      }
    }
    if (neckL < 0) continue;
    let painted = false;
    for (let x = neckL; x <= neckR; x++) {
      if (isSkin(row[x])) {
        row[x] = 11;
        painted = true;
      }
    }
    for (const x of [neckL - 1, neckR + 1]) {
      if (x >= 0 && x < row.length && isCloth(row[x])) {
        row[x] = 11;
        painted = true;
      }
    }
    if (!painted) for (let x = neckL; x <= neckR; x++) if (row[x] === 11) row[x] = 11;
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
  // Eye sockets and nose: force the shadow over any skin tone. The lit-top
  // pass now highlights the row under the eye, which would read as bright
  // eye bags, so the socket has to win explicitly.
  const forceSkin = (x: number, y: number): void => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
    const c = grid[y][x];
    if (c === 1 || c === shadeIndexOf(1) || c === highlightIndexOf(1)) grid[y][x] = shadeIndexOf(1);
  };
  forceSkin(faceCx, eyeY + 2);
  for (const ex of eyeXs) {
    forceSkin(ex, eyeY + 1);
    forceSkin(ex + 1, eyeY + 1);
  }
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
  applyCollarTrim(grid);
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
  // Arm volume: shade the torso-facing side of bare arm runs so hanging
  // arms read as cylinders instead of flat pixels. Edge-anchored runs only.
  for (let y = 30; y <= 35; y++) {
    const row = grid[y] ?? [];
    let lx = -1;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 0) continue;
      if (row[x] !== 1) break;
      lx = x;
    }
    if (lx > 0) set(lx, y, shadeIndexOf(1), 1);
    let rx = -1;
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] === 0) continue;
      if (row[x] !== 1) break;
      rx = x;
    }
    if (rx >= 0 && rx !== lx) set(rx, y, shadeIndexOf(1), 1);
  }
  const shoeRow = grid[34] ?? [];
  let runStart = -1;
  for (let x = 0; x <= shoeRow.length; x++) {
    const shoe = x < shoeRow.length && (shoeRow[x] === 7 || shoeRow[x] === shadeIndexOf(7));
    if (shoe && runStart < 0) runStart = x;
    if (!shoe && runStart >= 0) {
      // One lace pixel per shoe: a 2px white block swallowed the whole shoe.
      const mid = Math.floor((runStart + x - 1) / 2);
      if (x - runStart >= 3) set(mid, 34, 2, shoeRow[mid]);
      runStart = -1;
    }
  }
}

// Per-material ramp strength. A single hard mix toward the outline turned light
// skin into a dark blob on 2px arms; skin and cloth need a gentle ramp, metal
// and shoes can take a deeper one.
const RAMP_MIX: Record<number, { shade: number; light: number }> = {
  1: { shade: 0.28, light: 1.14 },
  3: { shade: 0.4, light: 1.15 },
  4: { shade: 0.4, light: 1.2 },
  5: { shade: 0.34, light: 1.2 },
  6: { shade: 0.34, light: 1.18 },
  7: { shade: 0.45, light: 1.25 },
  9: { shade: 0.44, light: 1.3 },
  11: { shade: 0.4, light: 1.2 },
  12: { shade: 0.4, light: 1.2 },
};

function buildPalette(features: SpriteFeatures): SpritePalette {
  const colors = basePaletteOf(features);
  const palette: SpritePalette = { ...colors };
  for (const key of Object.keys(colors).map(Number)) {
    const ramp = RAMP_MIX[key];
    if (EDGE_BASES.has(key) && ramp) palette[shadeIndexOf(key)] = mixHex(colors[key], OUTLINE_HEX, ramp.shade);
  }
  for (const key of [1, 3, 4, 5, 6, 12]) {
    if (palette[key]) palette[highlightIndexOf(key)] = shiftHex(colors[key], RAMP_MIX[key].light);
  }
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

const skinFamily = new Set([1, shadeIndexOf(1), highlightIndexOf(1)]);

function takeArm(row: number[], y: number, fromLeft: boolean): LimbCell[] {
  const out: LimbCell[] = [];
  const xs = fromLeft ? row.map((_, x) => x) : row.map((_, x) => row.length - 1 - x);
  for (const x of xs) {
    if (row[x] === 0) continue;
    if (out.length >= 3 || !skinFamily.has(row[x])) break;
    out.push({ x, y, v: row[x] });
  }
  return out;
}

// Secondary motion: on the flight frame the loose hair fringe trails one
// cell down over the forehead (additive, skin-only destinations — never
// floats in the air).
function applyHairSway(base: SpriteGrid): void {
  const isHair = (v: number): boolean =>
    v === 4 || v === shadeIndexOf(4) || v === highlightIndexOf(4);
  for (let x = 0; x < 12; x++) {
    let fringe = -1;
    for (let y = 0; y <= 8; y++) {
      if (isHair(base[y]?.[x] ?? 0)) fringe = y;
    }
    if (fringe >= 0 && fringe + 1 < base.length && (base[fringe + 1]?.[x] ?? 0) === 1) {
      base[fringe + 1][x] = base[fringe][x];
    }
  }
}
function rightArmBlock(base: SpriteGrid): LimbCell[] {
  const out: LimbCell[] = [];
  for (let y = 11; y <= 14; y++) {
    for (const c of takeArm(base[y] ?? [], y, false)) out.push(c);
  }
  return out;
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

// Procedural run stride on the composed base grid (12x18 space). Arms stay
// glued during the run (the punch carries all arm motion); legs scissor and
// the neutral phase lifts rigidly (flight) — rigid or mirrored moves only,
// so nothing teleports.
function applyStride(base: SpriteGrid, phase: StridePhase): void {
  if (phase === 1) {
    const all: LimbCell[] = [];
    base.forEach((row, y) => row.forEach((v, x) => {
      if (v !== 0) all.push({ x, y, v });
    }));
    collectMove(base, all, 0, -1);
    return;
  }
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
}

// Procedural attack: windup tucks the right fist toward the body, strike
// thrusts it up-forward. Rigid block shifts only — torso and head never move,
// nothing vanishes. The weapon follows the fist via per-frame landmarks.
function applyAttackPose(base: SpriteGrid, phase: StridePhase): void {
  if (phase === 2) return;
  const fist = rightArmBlock(base);
  if (fist.length === 0) return;
  if (phase === 0) collectMove(base, fist, -1, 1);
  else collectMove(base, fist, 1, -1);
}

function finishGrid(base: SpriteGrid, features: SpriteFeatures, pose?: (grid: SpriteGrid) => void): SpriteGrid {
  applyBuild(base, features.build);
  applyAnatomy(base);
  pose?.(base);
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

// Animation frames for the run cycle / attack swing. Fully procedural from
// the static body (windup / strike / recover): same head, same colors, same
// size — torso never teleports, nothing vanishes. Works for every body type.
export function generateSpriteFrames(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
  kind: SpriteAnimKind = 'run',
): GeneratedSprite[] | null {
  const features = resolveSpriteFeatures(seed, gender, appearance);
  const palette = buildPalette(features);
  const phases: StridePhase[] = kind === 'attack' ? [0, 1, 2] : [0, 1, 2, 1];
  return phases.map((phase) => {
    const base = composeBaseGrid(features.headType, features.bodyType);
    applyBuild(base, features.build);
    applyAnatomy(base);
    if (kind === 'attack') applyAttackPose(base, phase);
    else applyStride(base, phase);
    if (kind === 'run' && phase === 1) applyHairSway(base);
    const grid = upscale(base);
    applySnes(grid);
    applyDetails(grid);
    applyFeatures(grid);
    for (let i = 0; i < SPRITE_PAD_TOP; i++) grid.unshift(Array(SPRITE_WIDTH).fill(0));
    return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
  });
}
