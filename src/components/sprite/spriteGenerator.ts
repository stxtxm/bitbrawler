import { PIXEL_HEADS, PIXEL_BODIES } from '../PixelAssets';
import { mulberry32, getSeedFromText } from '../../utils/randomUtils';
import type { CharacterAppearance } from '../../types/Character';
import {
  GeneratedSprite,
  SPRITE_HEIGHT,
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
  PANTS_TONES_16,
  SKIN_TONES_16,
  deepShadeHex,
  highlightHex,
  shadeHex,
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

const SHADED_BASES = new Set([1, 3, 4, 5, 6, 7, 9, 11, 12]);
const HIGHLIGHT_BASES = new Set([1, 4, 5, 9, 11]);

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

function composeBaseGrid(headType: string, bodyType: string): SpriteGrid {
  const grid: SpriteGrid = Array.from({ length: 18 }, () => Array(12).fill(0));
  const body = (PIXEL_BODIES as Record<string, number[][]>)[bodyType] ?? PIXEL_BODIES.basic;
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

function applyShading(grid: SpriteGrid): void {
  const h = grid.length;
  const w = grid[0].length;
  const edits: Array<[number, number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = grid[y][x];
      if (base === 0 || !SHADED_BASES.has(base)) continue;
      const rightEmpty = x + 1 >= w || grid[y][x + 1] === 0;
      const bottomEmpty = y + 1 >= h || grid[y + 1][x] === 0;
      const topEmpty = y - 1 < 0 || grid[y - 1][x] === 0;
      if (rightEmpty || bottomEmpty) {
        edits.push([y, x, shadeIndexOf(base)]);
      } else if (topEmpty && HIGHLIGHT_BASES.has(base)) {
        edits.push([y, x, highlightIndexOf(base)]);
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
  }
}

export function generateSprite16(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
): GeneratedSprite {
  const features = resolveSpriteFeatures(seed, gender, appearance);
  const base = composeBaseGrid(features.headType, features.bodyType);
  applyBuild(base, features.build);
  const grid = upscale(base);
  applyShading(grid);
  applyDetails(grid);
  const colors = basePaletteOf(features);
  const palette: SpritePalette = { ...colors };
  for (const key of Object.keys(colors).map(Number)) {
    if (SHADED_BASES.has(key)) palette[shadeIndexOf(key)] = shadeHex(colors[key]);
    if (HIGHLIGHT_BASES.has(key)) palette[highlightIndexOf(key)] = highlightHex(colors[key]);
  }
  palette[shadeIndexOf(5)] = deepShadeHex(colors[5]);
  return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT };
}
