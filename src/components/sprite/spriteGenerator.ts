import { PIXEL_HEADS, PIXEL_BODIES } from '../PixelAssets';
import { mulberry32, getSeedFromText } from '../../utils/randomUtils';
import type { CharacterAppearance } from '../../types/Character';
import {
  BROW_INDEX,
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
  SpriteAnimKind,
  highlightIndexOf,
  shadeIndexOf,
} from './spriteTypes';
import {
  EYE_TONES_16,
  HAIR_TONES_16,
  OUTLINE_HEX,
  OUTFIT_SCHEMES,
  SKIN_TONES_16,
  deepShadeHex,
  mixHex,
  shadeHex,
  shiftHex,
} from './spritePalettes';
import { pickBodyType, pickHeadType } from './headSelection';

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

// Heads where the raw cap of hair ends in a straight line. A one-row fringe
// sweep on the viewer-left gives these cuts a part instead of a helmet brim.
// Caps, helmets, masks and bald heads are excluded: moving their brim/hairline
// would break the headwear silhouette.
const FRINGE_HEAD_TYPES: ReadonlySet<string> = new Set([
  'male', 'male_beard', 'male_mohawk', 'male_sidepart', 'male_spiky',
  'male_afro', 'male_glasses', 'male_long', 'male_undercut', 'male_dreadlocks',
  'female', 'female_pigtails', 'female_braid', 'female_ponytail', 'female_short',
  'female_bob', 'female_waves', 'female_afro', 'female_pixie', 'female_bang',
  'female_bun', 'female_twintails', 'female_goth',
]);

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
    : pickHeadType(headPool, rng);
  const bodyType = appearance?.bodyType && appearance.bodyType in PIXEL_BODIES
    ? appearance.bodyType
    : pickBodyType(bodyPool, rng);
  const outfit = pick(OUTFIT_SCHEMES);
  const shirtColor = appearance?.shirtColor ?? outfit.shirt;
  return {
    skinColor: appearance?.skinColor ?? pick(SKIN_TONES_16),
    hairColor: appearance?.hairColor ?? pick(HAIR_TONES_16),
    shirtColor,
    pantsColor: appearance?.pantsColor ?? outfit.pants,
    shoesColor: '#333333',
    eyeColor: appearance?.eyeColor ?? pick(EYE_TONES_16),
    // Tonal, not a random hue: a clashing random colour turned the collar and
    // the chest emblem into two bright bars that read as a sandwich board.
    // Kept light too, otherwise the band under the chin reads as a gap.
    logoColor: mixHex(shirtColor, OUTLINE_HEX, 0.25),
    headType,
    bodyType,
    build: appearance?.build ?? fallbackBuild,
  };
}

function basePaletteOf(features: SpriteFeatures): SpritePalette {
  return {
    1: features.skinColor,
    2: '#FFFFFF',
    // Rosé dérivé du teint : le rouge brique fixe faisait une moustache sombre
    // sur tous les visages, quel que soit le phototype. Mélangé à l'ombre de la
    // peau, il reste une lèvre sans devenir un nez de clown à l'échelle 5x.
    3: mixHex(shadeHex(features.skinColor), '#6b3a2e', 0.45),
    4: features.hairColor,
    5: features.shirtColor,
    6: features.pantsColor,
    7: features.shoesColor,
    8: features.eyeColor,
    9: '#95a5a6',
    11: features.logoColor,
    12: features.hairColor,
    [BROW_INDEX]: mixHex(deepShadeHex(features.hairColor), OUTLINE_HEX, 0.22),
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
  reshapeHead(grid);
  return grid;
}

// Narrow the face (never the hair) so the head is clearly slimmer than the
// shoulders. Head and body were the same width, which is why the silhouette
// read as one brick. Hair keeps its volume; only bare skin at the row ends is
// trimmed, so pigtails and sideburns survive.
function narrowFace(base: SpriteGrid, chin: number, maxWidth: number): void {
  for (let y = 1; y <= chin; y++) {
    const row = base[y];
    let left = -1;
    let right = -1;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 0) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0) continue;
    while (right - left + 1 > maxWidth) {
      const l = row[left];
      const r = row[right];
      const lSkin = l === 1;
      const rSkin = r === 1;
      if (!lSkin && !rSkin) break;
      if (lSkin) row[left] = 0;
      if (rSkin) row[right] = 0;
      left = lSkin ? left + 1 : left;
      right = rSkin ? right - 1 : right;
    }
  }
}

// Reshape the head: cap the face width (hair keeps its volume) then taper the
// lower face into a jaw. The raw heads are hard rectangles as wide as the
// body, which is why the silhouette read as one brick rather than a person.
function reshapeHead(grid: SpriteGrid): void {
  let chin = -1;
  for (let y = 1; y <= 8; y++) {
    if (grid[y].some((c) => c !== 0)) chin = y;
  }
  if (chin < 0) return;
  narrowFace(grid, chin, 7);
  // Taper only the last row. Narrowing the mouth row too turned the face into
  // a funnel: 14px of cheek over a 6px snout, which reads as an animal.
  for (const y of [chin]) {
    const amount = 1;
    const row = grid[y];
    let left = -1;
    let right = -1;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 0) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left < 0) continue;
    for (let i = 0; i < amount; i++) {
      if (right - left + 1 - 2 * (i + 1) < 3) break;
      row[left + i] = 0;
      row[right - i] = 0;
    }
  }
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
    // Shoe volume: lit upper, dark sole — a single flat tone reads as a blob.
    for (const y of [34, 35]) {
      if (grid[y][x] === 7) grid[y][x] = y === 35 ? shadeIndexOf(7) : 7;
    }
    // Knee break so the leg reads as thigh + joint + calf instead of a bar.
    for (const y of [32]) {
      const c = grid[y][x];
      if (c === 6 || c === highlightIndexOf(6) || c === shadeIndexOf(6)) grid[y][x] = shadeIndexOf(6);
    }
  }
  // Belt: a dark band across the waist with a centred metal buckle. The old
  // single 2px grey square floated on the pants and read as a random pixel.
  for (const y of [28, 29]) {
    const row = grid[y] ?? [];
    const pantsXs: number[] = [];
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === 6 || c === shadeIndexOf(6) || c === highlightIndexOf(6)) pantsXs.push(x);
    }
    if (pantsXs.length < 3) continue;
    const left = pantsXs[0];
    const right = pantsXs[pantsXs.length - 1];
    for (let x = left; x <= right; x++) {
      const c = row[x];
      if (c === 6 || c === shadeIndexOf(6) || c === highlightIndexOf(6)) row[x] = shadeIndexOf(6);
    }
    const buckle = Math.floor((left + right) / 2);
    for (const bx of [buckle, buckle + 1]) {
      if (bx > right) continue;
      row[bx] = y === 28 ? 9 : shadeIndexOf(9);
    }
    if (y === 28) row[buckle] = highlightIndexOf(9);
  }
  // Shoulder trim: metal bodies keep a grey edge, cloth bodies get the same
  // tonal trim as the collar. Painting every shoulder grey put pauldrons on
  // plain T-shirts.
  for (const y of [20, 21]) {
    const row = grid[y];
    if (!row) continue;
    const left = row.findIndex((c) => c !== 0);
    if (left >= 0) {
      const c = row[left];
      if (c === 5 || c === shadeIndexOf(5)) row[left] = 11;
      else if (c === 9 || c === shadeIndexOf(9)) row[left] = 9;
    }
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] === 0) continue;
      const c = row[x];
      if (c === 5 || c === shadeIndexOf(5)) row[x] = 11;
      else if (c === 9 || c === shadeIndexOf(9)) row[x] = 9;
      break;
    }
  }
}

// Collar trim in logo colour. It sits on the trapezius slope beside the neck
// and never on the throat itself: painting the neck hid it completely and the
// head then looked welded to the shoulders. Falls back to the neck alone when
// a body has no shoulder slope at all.
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
    let painted = 0;
    for (const x of [neckL - 1, neckR + 1]) {
      if (x >= 0 && x < row.length && isCloth(row[x])) {
        row[x] = 11;
        painted++;
      }
    }
    if (painted === 0) {
      for (let x = neckL; x <= neckR; x++) if (isSkin(row[x])) row[x] = 11;
    }
  }
}

// A mouth box located from the actual mouth pixels, not from a hard-coded
// row: the old lip pass used y=13 while the mouth sits on 14/15, so it never
// touched the lips at all.
type MouthShape = 'neutral' | 'smile' | 'grit';

interface MouthBox {
  y0: number;
  y1: number;
  left: number;
  right: number;
}

const MOUTH_TONES = new Set([3, shadeIndexOf(3), highlightIndexOf(3)]);

function findMouth(grid: SpriteGrid): MouthBox | null {
  let y0 = -1;
  let y1 = -1;
  let left = 99;
  let right = -1;
  for (let y = 10; y <= 18 && y < grid.length; y++) {
    const row = grid[y] ?? [];
    for (let x = 0; x < row.length; x++) {
      if (!MOUTH_TONES.has(row[x])) continue;
      if (y0 < 0) y0 = y;
      y1 = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (y0 < 0 || right < left) return null;
  return { y0, y1, left, right };
}

// Lips derived from the skin tone: a muted dark upper line and a lighter lower
// lip on expressions. Neutral is a three-pixel line with no lower lip; a 2x2
// square read as a red nose at 5x scale, and the T-shaped version as a tongue.
function paintMouth(grid: SpriteGrid, shape: MouthShape, centerX?: number): void {
  const mouth = findMouth(grid);
  if (!mouth) return;
  const { y0, left: rawLeft, right: rawRight } = mouth;
  const y1 = mouth.y1 > y0 ? mouth.y1 : y0 + 1;
  const center = centerX ?? (rawLeft + rawRight) / 2;
  // Neutral lets the character rest; a three-pixel line is a mouth, not a
  // moustache.
  // Expressions widen it to 4px so the smile / teeth remain readable.
  const wide = shape !== 'neutral';
  // The nose is rounded to the nearest pixel, so centre a 3px neutral mouth on
  // that pixel instead of on the half-pixel eye axis; otherwise it sits visibly
  // left of the nose. Expressions keep the 4px block centred on the face.
  const left = wide ? Math.round(center - 2) : Math.round(center) - 1;
  const right = left + (wide ? 3 : 2);
  const row0 = grid[y0] ?? [];
  const row1 = grid[y1] ?? [];
  // Clear the union of the raw mouth and the centred mouth: the raw head is
  // one pixel off-centre, so moving the lips right leaves old lip pixels
  // behind unless both boxes are wiped.
  const clearLeft = Math.min(rawLeft, left);
  const clearRight = Math.max(rawRight, right);
  for (let x = clearLeft; x <= clearRight; x++) {
    if (MOUTH_TONES.has(row0[x])) row0[x] = 1;
    if (MOUTH_TONES.has(row1[x])) row1[x] = 1;
  }
  const mid0 = Math.floor((left + right) / 2);
  const mid1 = Math.min(right, mid0 + 1);
  if (shape === 'smile') {
    row0[left] = 3;
    row0[right] = 3;
    for (let x = mid0; x <= mid1; x++) row1[x] = highlightIndexOf(3);
    return;
  }
  // Neutral is a single dark line directly under the nose. The old bright red
  // T with a lower lip read as a nose/moustache; a muted brown one-row line
  // does not, and sitting it on the lower row made the chin look long.
  for (let x = left; x <= right; x++) row0[x] = 3;
  if (shape === 'grit') {
    for (let x = left; x <= right; x++) row1[x] = 3;
    row1[mid0] = 2;
    row1[mid1] = 2;
    return;
  }
}

// The forehead under the fringe receives one step of skin shadow. Without it
// the hair sat flat on a blank forehead like a wig.
function applyFringeShadow(grid: SpriteGrid, eyeTop: number): void {
  const isHair = (v: number): boolean =>
    v === 4 || v === shadeIndexOf(4) || v === highlightIndexOf(4);
  for (let x = 0; x < grid[0].length; x++) {
    let hairBottom = -1;
    for (let y = 1; y <= eyeTop - 3 && y < grid.length; y++) {
      if (isHair(grid[y]?.[x] ?? 0)) hairBottom = y;
    }
    if (hairBottom < 0) continue;
    const y = hairBottom + 1;
    if (grid[y]?.[x] === 1) grid[y][x] = shadeIndexOf(1);
  }
}

// Lower the hairline by one row on the viewer-left side of the forehead. The
// raw hair is a flat cap; this single asymmetric row reads as a side-swept
// fringe (and the fringe shadow below gives it depth) without cutting holes in
// the hairstyle. Destinations are skin-only, so a bang/hat is left untouched.
function styleSideFringe(grid: SpriteGrid, headType: string, eyeTop: number, faceCx: number): void {
  if (!FRINGE_HEAD_TYPES.has(headType)) return;
  const isHair = (v: number): boolean =>
    v === 4 || v === shadeIndexOf(4) || v === highlightIndexOf(4);
  const isSkin = (v: number): boolean =>
    v === 1 || v === shadeIndexOf(1) || v === highlightIndexOf(1);
  const start = Math.floor(faceCx) - 4;
  const end = Math.floor(faceCx) - 1;
  for (let x = start; x <= end; x++) {
    if (x < 0 || x >= grid[0].length) continue;
    let fringeY = -1;
    for (let y = 0; y <= eyeTop - 3 && y < grid.length; y++) {
      if (isHair(grid[y]?.[x] ?? 0)) fringeY = y;
    }
    if (fringeY < 0 || fringeY + 1 >= grid.length) continue;
    if (!isSkin(grid[fringeY + 1]?.[x] ?? 0)) continue;
    grid[fringeY + 1][x] = 4;
  }
  // A single lit cell on the outer edge of the new fringe; the rest stays the
  // hair base so the sweep is not a solid second cap.
  const litX = start;
  for (let y = 0; y <= eyeTop - 2; y++) {
    if (grid[y]?.[litX] === 4) {
      grid[y][litX] = highlightIndexOf(4);
      break;
    }
  }
}

// Raw heads paint a checkerboard of skin shade on one cheek. At 24x42 those
// patches run down the face like a long nose or a bruise, and they are not
// mirrored. Flatten the shade inside the face before adding features; the raw
// jaw row, the fringe shadow and the nose keep enough volume to avoid a mask.
function cleanFaceSkin(grid: SpriteGrid, eyeTop: number): void {
  if (eyeTop > 20) return;
  const shade = shadeIndexOf(1);
  const top = Math.max(1, eyeTop - 3);
  const bottom = Math.min(grid.length - 2, eyeTop + 5);
  for (let y = top; y <= bottom; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === shade) row[x] = 1;
    }
  }
}

function applyFeatures(grid: SpriteGrid, headType: string): void {
  const set = (x: number, y: number, v: number, onlyIf: number): void => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
    if (grid[y][x] === onlyIf) grid[y][x] = v;
  };
  // No hair-underside band. A full row of dark hair where the fringe met the
  // forehead read as a headband/visor on every light-haired head. The fringe
  // shadow below paints the forehead instead, so the hair keeps its volume
  // without looking like a helmet.
  let eyeFirstY = 99;
  const eyeXs: number[] = [];
  for (let y = 2; y <= 17; y++) {
    for (let x = 0; x < 24; x++) {
      if (grid[y][x] === 8) {
        if (y < eyeFirstY) eyeFirstY = y;
        eyeXs.push(x);
      }
    }
  }
  // Group the raw eye pixels into per-eye runs so each eye can be rebuilt.
  const eyeGroups: number[][] = [];
  {
    const sorted = [...new Set(eyeXs)].sort((a, b) => a - b);
    let run: number[] = [];
    let prev = -10;
    for (const ex of sorted) {
      if (ex !== prev + 1) {
        if (run.length) eyeGroups.push(run);
        run = [ex];
      } else {
        run.push(ex);
      }
      prev = ex;
    }
    if (run.length) eyeGroups.push(run);
  }
  // Rebuild each eye as a 3x2 block: one white sclera column, a two-pixel
  // coloured iris and a dark pupil on the lower-right. The previous 4x2 eye
  // filled two thirds of the face and read as a goggle; 3px is the pixel-art
  // sweet spot on a 12px head.
  const IRIS = 8;
  const eyeTone = shadeIndexOf(IRIS);
  const eyeTop = eyeFirstY;
  const EYE_W = 3;
  const isSkinTone = (v: number): boolean =>
    v === 1 || v === shadeIndexOf(1) || v === highlightIndexOf(1);
  // The raw eye pixels themselves are not skin; they are valid anchors for the
  // rebuilt block. Hair is the only thing we must refuse to overwrite.
  const isEyeCanvas = (v: number): boolean =>
    isSkinTone(v) || v === IRIS || v === eyeTone || v === 2 || v === BROW_INDEX;
  const clearAt = (x0: number): boolean => {
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < EYE_W; dx++) {
        const x = x0 + dx;
        const y = eyeTop + dy;
        if (x < 0 || y < 0 || y >= grid.length || x >= grid[y].length) return false;
        if (!isEyeCanvas(grid[y][x])) return false;
      }
    }
    return true;
  };
  cleanFaceSkin(grid, eyeTop);
  // After flattening the raw patches, give the face a symmetric contour. The
  // outer skin column on each side is one step darker, from the cheek down to
  // the jaw. Without it the cleaned face was a flat mask; with the old raw
  // shading it was a lopsided bruise. This is the middle ground.
  const faceShade = shadeIndexOf(1);
  for (let y = eyeTop + 2; y <= eyeTop + 5; y++) {
    const row = grid[y];
    if (!row) continue;
    let left = -1;
    let right = -1;
    for (let x = 0; x < row.length; x++) {
      if (isSkinTone(row[x])) {
        if (left < 0) left = x;
        right = x;
      }
    }
    if (left >= 0 && row[left] === 1) row[left] = faceShade;
    if (right > left && row[right] === 1) row[right] = faceShade;
  }
  const builtEyes: Array<{ x0: number; side: number }> = [];
  eyeGroups.forEach((group, side) => {
    const cx = Math.round((group[0] + group[group.length - 1]) / 2);
    // cx - 1 centres a 3px eye on the same axis as the raw 2px eye, which
    // keeps the pair symmetric around the nose (6..8 and 12..14 on a 14px
    // face). The other slots are fallbacks for narrow / hairy heads.
    const slot = [cx - 1, side === 0 ? cx - 2 : cx, cx - 2, cx + 1].find(clearAt) ?? cx - 1;
    const x0 = Math.max(0, Math.min(SPRITE_WIDTH - EYE_W, slot));
    // Wipe the raw 2x2 eye first. It is two cells tall and sits under the new
    // block; leaving it behind added a stray iris pixel above the lash line
    // (and made applyBlink mistake that row for the iris).
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < EYE_W; dx++) {
        const v = grid[eyeTop + dy][x0 + dx];
        if (v === IRIS || v === eyeTone || v === 2 || v === BROW_INDEX) {
          grid[eyeTop + dy][x0 + dx] = 1;
        }
      }
    }
    // No separate lash row: the dark brow one cell above already frames the
    // eye. Sclera + iris (base tone on top, shaded iris and dark pupil below).
    // The white column stays on the left, so the gaze is aimed at the opponent.
    grid[eyeTop + 1][x0] = 2;
    grid[eyeTop + 1][x0 + 1] = IRIS;
    grid[eyeTop + 1][x0 + 2] = IRIS;
    grid[eyeTop + 2][x0] = 2;
    grid[eyeTop + 2][x0 + 1] = eyeTone;
    grid[eyeTop + 2][x0 + 2] = BROW_INDEX;
    builtEyes.push({ x0, side });
  });
  // Nose: the row left below the eye block and above the mouth. Without it the
  // profile had no bridge at all and the face read as a flat mask.
  if (builtEyes.length > 0) {
    const first = builtEyes[0];
    const last = builtEyes[builtEyes.length - 1];
    const noseX = Math.round((first.x0 + last.x0 + EYE_W - 1) / 2);
    set(noseX, eyeTop + 3, shadeIndexOf(1), 1);
  }
  // Brows sit one row above the eye block, separated by a skin row. Two pixels
  // over the iris are enough; the old 3px bars made every character look angry.
  // Bias each brow toward the nose so the pair keeps a human gap.
  for (const { x0, side } of builtEyes) {
    const start = builtEyes.length > 1 && side > 0 ? x0 : x0 + 1;
    for (let dx = 0; dx < 2; dx++) set(start + dx, eyeTop - 1, BROW_INDEX, 1);
  }
  // Ears last, measured on their own row. Only added next to bare skin:
  // hanging one off a sideburn or a pigtail left a nub floating in the hair.
  for (const earY of [eyeTop + 1, eyeTop + 2]) {
    const earRow = grid[earY] ?? [];
    const earL = earRow.findIndex((c) => c !== 0);
    let earR = -1;
    for (let x = earRow.length - 1; x >= 0; x--) {
      if (earRow[x] !== 0) {
        earR = x;
        break;
      }
    }
    if (earL <= 0) continue;
    if (isSkinTone(earRow[earL])) earRow[earL - 1] = 1;
    if (earR >= 0 && isSkinTone(earRow[earR])) earRow[earR + 1] = 1;
  }
  // Centre the trouser shading on the hips, not on the whole upper body: an
  // attack extends an arm and would otherwise shift the leg highlight/crease
  // sideways even though the legs never move.
  let hipX0 = 99;
  let hipX1 = -1;
  for (let y = 30; y <= 33; y++) {
    const r = grid[y] ?? [];
    r.forEach((c, x) => {
      if (c !== 0) {
        if (x < hipX0) hipX0 = x;
        if (x > hipX1) hipX1 = x;
      }
    });
  }
  const hipCx = Math.round((hipX0 + hipX1) / 2);
  applyCollarTrim(grid);
  // Chest emblem: one lit pixel on the tonal badge. The old dark 2x4 logo
  // read as a chest strap; a single highlight turns it into an insignia.
  for (const y of [22, 23]) {
    const row = grid[y] ?? [];
    const logoXs = row.map((c, x) => (c === 11 ? x : -1)).filter((x) => x >= 0);
    if (logoXs.length > 0) {
      const cx = Math.round((logoXs[0] + logoXs[logoXs.length - 1]) / 2);
      set(cx, y, highlightIndexOf(11), 11);
    }
  }
  for (let y = 30; y <= 33; y++) {
    set(hipCx, y, shadeIndexOf(6), 6);
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
  const faceCx = builtEyes.length > 0
    ? (builtEyes[0].x0 + builtEyes[builtEyes.length - 1].x0 + EYE_W - 1) / 2
    : 12;
  styleSideFringe(grid, headType, eyeTop, faceCx);
  paintMouth(grid, 'neutral', faceCx);
  applyFringeShadow(grid, eyeTop);
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
  8: { shade: 0.45, light: 1.3 },
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
  for (const key of [1, 3, 4, 5, 6, 9, 11, 12]) {
    if (palette[key]) palette[highlightIndexOf(key)] = shiftHex(colors[key], RAMP_MIX[key].light);
  }
  palette[shadeIndexOf(5)] = deepShadeHex(colors[5]);
  // Iris outline: 8 is not an edge base (eyes are never auto-shaded) but the
  // rebuilt eyes need their outline tone to exist in the palette.
  if (colors[8]) palette[shadeIndexOf(8)] = mixHex(colors[8], OUTLINE_HEX, 0.45);
  return palette;
}

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

// Secondary motion: on the flight frame the OUTER locks of loose hair trail
// one cell down. The forehead columns are deliberately untouched — dragging
// the whole hairline down for a single frame covered the brows/eyes and read
// as a wig flap rather than a sway. Hats, caps and bald heads are skipped for
// the same reason the side fringe skips them: they have no loose hair.
// Base grid is 12 columns: 0-1 and 9-11 are the outer locks, 2-8 the face.
const HAIR_SWAY_COLUMNS = [0, 1, 9, 10, 11] as const;

function applyHairSway(base: SpriteGrid, headType: string): void {
  if (!FRINGE_HEAD_TYPES.has(headType)) return;
  const isHair = (v: number): boolean =>
    v === 4 || v === shadeIndexOf(4) || v === highlightIndexOf(4);
  for (const x of HAIR_SWAY_COLUMNS) {
    let fringe = -1;
    for (let y = 0; y <= 8; y++) {
      if (isHair(base[y]?.[x] ?? 0)) fringe = y;
    }
    if (fringe < 0) continue;
    const below = base[fringe + 1]?.[x] ?? -1;
    // Skin keeps the lock rooted to the head; an empty cell lets a ponytail
    // tip swing past the silhouette. Never paint over the face or gear.
    if (below === 0 || below === 1) {
      base[fringe + 1][x] = base[fringe][x];
    }
  }
}
function armCellsOf(base: SpriteGrid, fromLeft: boolean): LimbCell[] {
  const out: LimbCell[] = [];
  for (let y = 11; y <= 14; y++) {
    for (const c of takeArm(base[y] ?? [], y, fromLeft)) out.push(c);
  }
  return out;
}

function fistWidth(base: SpriteGrid, x: number, y: number, fromLeft: boolean): number {
  const row = base[y] ?? [];
  let width = 0;
  if (fromLeft) {
    for (let i = x; i < row.length && skinFamily.has(row[i]); i++) width++;
  } else {
    for (let i = x; i >= 0 && skinFamily.has(row[i]); i--) width++;
  }
  return width;
}

// A clenched fist: the two bottom cells of each arm grow one pixel toward the
// body into a compact 2x2 block, marking the end of the limb without pushing
// the hand anchors (and every held weapon) outward.
function applyFists(base: SpriteGrid): void {
  for (const fromLeft of [true, false]) {
    const cells = armCellsOf(base, fromLeft);
    if (cells.length === 0) continue;
    const lowest = Math.max(...cells.map((c) => c.y));
    const step = fromLeft ? 1 : -1;
    for (const y of [lowest - 1, lowest]) {
      const rowCells = cells.filter((c) => c.y === y);
      if (rowCells.length === 0) continue;
      const outer = fromLeft
        ? Math.min(...rowCells.map((c) => c.x))
        : Math.max(...rowCells.map((c) => c.x));
      const row = base[y];
      if (!row) continue;
      if (fistWidth(base, outer, y, fromLeft) >= 2) continue;
      const x = outer + step;
      if (x < 0 || x >= row.length) continue;
      row[x] = 1;
    }
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

// Procedural run stride on the composed base grid (12x18 space). Arms stay
// glued during the run (the punch carries all arm motion); legs scissor and
// the pass phase lifts rigidly (flight) — rigid or mirrored moves only, so
// nothing teleports. Six phases: contact/down/pass per side.
type RunPhase = 0 | 1 | 2 | 3 | 4 | 5;

function liftSkeleton(base: SpriteGrid): void {
  const all: LimbCell[] = [];
  base.forEach((row, y) => row.forEach((v, x) => {
    if (v !== 0) all.push({ x, y, v });
  }));
  collectMove(base, all, 0, -1);
}

function scissorLegs(base: SpriteGrid, mirror: number, liftTrailing: boolean): void {
  const legRuns = runsInRow(base[16] ?? [], (v) => v !== 0).filter(([a, b]) => {
    const below = base[17] ?? [];
    return below.slice(Math.max(0, a - 1), b + 2).some((c) => c !== 0);
  });
  if (legRuns.length >= 2) {
    // Thighs (row 15) stay planted — only shins + feet swing, so legs bend
    // instead of melting into the body. The trailing foot lifts clear of the
    // ground on contact frames; the down frame plants it again.
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
    collectMove(base, shinCells(right), mirror, liftTrailing ? -1 : 0);
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

// Pass / flight: the trailing shin tucks straight up (no sideways slide, which
// would push the leg under an arm column and read as a broken limb), then the
// whole skeleton lifts. The two sides tuck opposite legs, so the two pass
// frames of the cycle stay distinct.
function tuckTrailingShin(base: SpriteGrid, mirror: number): void {
  const legRuns = runsInRow(base[16] ?? [], (v) => v !== 0).filter(([a, b]) => {
    const below = base[17] ?? [];
    return below.slice(Math.max(0, a - 1), b + 2).some((c) => c !== 0);
  });
  if (legRuns.length < 2) return;
  const run = mirror === 1 ? legRuns[legRuns.length - 1] : legRuns[0];
  const cells: LimbCell[] = [];
  for (const y of [16, 17]) {
    for (let x = run[0]; x <= run[1]; x++) {
      const v = base[y]?.[x] ?? 0;
      if (v !== 0) cells.push({ x, y, v });
    }
  }
  collectMove(base, cells, 0, -1);
}

function applyStride(base: SpriteGrid, phase: RunPhase): void {
  const step = phase % 3;
  const mirror = phase < 3 ? 1 : -1;
  if (step === 2) {
    tuckTrailingShin(base, mirror);
    liftSkeleton(base);
    return;
  }
  scissorLegs(base, mirror, step === 0);
}

// Procedural attack, five beats: ready, wrist cock, chamber, drive, guard. The
// forearm and fist translate together; the torso stays planted so a held
// weapon never sweeps through the head. Restoring the body cells that the
// fist had grown over keeps the shirt/waist intact when the arm leaves the
// silhouette.
//
// La grille ne fait que 24 px de large et l'arme est tenue sur le bord droit :
// chaque pixel gagné vers la droite par le poing est un pixel perdu pour la
// rotation de l'arme (mesuré : la pointe de l'épée ne peut sortir de 5 px de
// plus que la paume). L'ancienne allonge poussait donc le poing de 4 px et ne
// laissait à l'arme que 8° d'amplitude — la frappe ne se voyait pas. Le poing
// ne gagne maintenant que 2 px, l'arme balaie tout ce que la grille permet
// (voir WEAPON_STRIKE_ANGLE) et la dernière frame revient à la garde : la pose
// tenue après l'impact est la posture de repos, plus un poing figé en l'air.
export const ATTACK_IMPACT_FRAME = 3;

const ATTACK_POSES: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [0, 0],
];

function forearmBlock(base: SpriteGrid): LimbCell[] {
  const out: LimbCell[] = [];
  for (let y = 13; y <= 14; y++) {
    for (const c of takeArm(base[y] ?? [], y, false)) out.push(c);
  }
  return out;
}

// Move a limb and put the body back where the limb used to be. `body` is a
// snapshot taken before applyFists grew the 2x2 hands into the torso; without
// it a punch leaves a transparent notch in the shirt.
function moveLimbRestoringBody(
  base: SpriteGrid,
  body: SpriteGrid,
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
  for (const { x, y } of cells) {
    const original = body[y]?.[x] ?? 0;
    if (original !== 0 && original !== 1) base[y][x] = original;
  }
}

function applyAttackPose(base: SpriteGrid, phase: number, body: SpriteGrid): void {
  const pose = ATTACK_POSES[phase] ?? [0, 0];
  if (pose[0] === 0 && pose[1] === 0) return;
  const fist = forearmBlock(base);
  if (fist.length === 0) return;
  moveLimbRestoringBody(base, body, fist, pose[0], pose[1]);
}

// Respiration d'attente : le buste (tête + torse + bras) monte de 2 px de
// sprite puis redescend, les pieds et les mains restent fixes. Le mouvement
// est appliqué APRÈS le rendu (voir applyIdleBreathingPx), sur la grille
// upscalée : on peut ainsi découper la montée en deux paliers de 1 px au lieu
// d'un saut d'une cellule entière. L'ancien saut de 2 px toutes les 3,2 s
// faisait léviter le personnage ; ce souffle monte, tient, redescend, puis
// marque un vrai repos.
//
// 10 frames de 400 ms par respiration (4 s, ~15/min) : 0→1→2, maintien en
// haut, 2→1→0, puis 4 frames au repos. Deux respirations par boucle (8 s).
const IDLE_BREATH_PX: readonly number[] = [0, 1, 2, 2, 2, 1, 0, 0, 0, 0];

// Dernière rangée du buste qui suit la respiration : le pan de chemise, juste
// au-dessus de la ceinture. La ceinture, le bassin et les jambes ne bougent pas
// d'un pixel — l'ombrage du pantalon est dérivé de la silhouette, donc bouger
// le bassin faisait clignoter le haut du pantalon.
const IDLE_BODY_BOTTOM = 12;

// Décale le buste déjà ombré de `px` pixels de sprite vers le haut. On agit
// sur la grille upscalée (24×36 avant le padding haut) pour autoriser le
// demi-pas : un déplacement de 2 px se fait en deux paliers de 1 px, sans
// rééchantillonnage. La rangée charnière est dupliquée pour combler le vide,
// comme le faisait la version cellule entière ; les rangées du bas (≥ 32 une
// fois le padding appliqué) restent intactes.
function applyIdleBreathingPx(grid: SpriteGrid, phase: number): void {
  const px = IDLE_BREATH_PX[phase % IDLE_BREATH_PX.length] ?? 0;
  if (px <= 0) return;
  const bottom = IDLE_BODY_BOTTOM * 2 + 1;
  const seam = [...(grid[bottom] ?? [])];
  for (let y = 0; y <= bottom; y++) {
    const src = y + px;
    const row = src <= bottom ? grid[src] : seam;
    for (let x = 0; x < grid[y].length; x++) grid[y][x] = row[x] ?? 0;
  }
}

// Blink: the rebuilt eye has a skin gap, an iris row and a pupil row. To close
// it, clear all three rows back to skin and draw a two-pixel lid on the lower
// row. The gap is cleared too so the brow never floats above a blank socket.
function applyBlink(grid: SpriteGrid): void {
  const eyeTone = shadeIndexOf(8);
  let irisTop = -1;
  for (let y = 0; y < grid.length && irisTop < 0; y++) {
    if (grid[y].some((c) => c === 8)) irisTop = y;
  }
  if (irisTop < 1) return;
  const eyeCols = new Set<number>();
  for (const y of [irisTop, irisTop + 1]) {
    const row = grid[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 8 || row[x] === eyeTone || row[x] === 2) eyeCols.add(x);
    }
  }
  const sorted = [...eyeCols].sort((a, b) => a - b);
  const runs: number[][] = [];
  let run: number[] = [];
  for (const x of sorted) {
    if (run.length > 0 && x !== run[run.length - 1] + 1) {
      runs.push(run);
      run = [];
    }
    run.push(x);
  }
  if (run.length > 0) runs.push(run);
  for (const group of runs) {
    const x0 = group[0];
    const x1 = group[group.length - 1];
    for (let y = irisTop - 1; y <= irisTop + 1; y++) {
      const row = grid[y];
      if (!row) continue;
      for (let x = x0; x <= x1; x++) {
        if (row[x] === 8 || row[x] === eyeTone || row[x] === 2 || row[x] === BROW_INDEX) row[x] = 1;
      }
    }
    const lidY = irisTop + 1;
    const lidStart = x1 - x0 + 1 >= 4 ? x0 + 1 : x0;
    for (const x of [lidStart, lidStart + 1]) {
      if (x <= x1) grid[lidY][x] = eyeTone;
    }
  }
}

// Facial reactions ride on top of the neutral face painted by applyFeatures.
// They are deliberately limited to the mouth and the eyes: moving the face
// with the pose would break the equipment head anchors.
function applyFaceExpression(grid: SpriteGrid, kind: SpriteAnimKind, phase: number): void {
  if (kind === 'hit') {
    if (phase === 0) {
      applyBlink(grid);
      paintMouth(grid, 'grit');
    } else if (phase === 1) {
      paintMouth(grid, 'grit');
    }
    return;
  }
  if (kind === 'victory') {
    if (phase === 0) return;
    if (phase === 1 || phase === 2) applyBlink(grid);
    paintMouth(grid, 'smile');
    return;
  }
  if (kind === 'attack' && (phase === 2 || phase === 3)) {
    paintMouth(grid, 'grit');
  }
}
function applyHitReaction(base: SpriteGrid, phase: number): void {
  if (phase === 2) return;
  const upper: LimbCell[] = [];
  for (let y = 0; y <= 14; y++) {
    for (let x = 0; x < 12; x++) {
      const v = base[y]?.[x] ?? 0;
      if (v !== 0) upper.push({ x, y, v });
    }
  }
  const dx = -1;
  const dy = phase === 0 ? 1 : 0;
  collectMove(base, upper, dx, dy);
  for (let x = 0; x < 12; x++) {
    const below = base[15]?.[x] ?? 0;
    if (below !== 0 && (base[14]?.[x] ?? 0) === 0) {
      base[14][x] = below;
    }
  }
}

// Procedural victory celebration: anticipation dip, then the fist pumps while
// the finished frame hops. Only the forearm moves relative to the body: moving
// the full arm block detached it from the shoulder and left a skin bar floating
// beside the shirt. The hop is applied after detailing (see generateSpriteFrames)
// so the belt, laces and collar travel with the body.
function applyVictoryPose(base: SpriteGrid, phase: number, body: SpriteGrid): void {
  if (phase === 0) {
    const upper: LimbCell[] = [];
    for (let y = 0; y <= 14; y++) {
      for (let x = 0; x < 12; x++) {
        const v = base[y]?.[x] ?? 0;
        if (v !== 0) upper.push({ x, y, v });
      }
    }
    collectMove(base, upper, 0, 1);
    return;
  }
  const fistPose: readonly [number, number] = phase === 1 ? [1, -1] : phase === 2 ? [2, -1] : [1, 0];
  const fist = forearmBlock(base);
  if (fist.length > 0) moveLimbRestoringBody(base, body, fist, fistPose[0], fistPose[1]);
}

function finishGrid(base: SpriteGrid, features: SpriteFeatures, pose?: (grid: SpriteGrid) => void): SpriteGrid {
  applyBuild(base, features.build);
  applyAnatomy(base);
  applyFists(base);
  pose?.(base);
  const grid = upscale(base);
  applySnes(grid);
  applyDetails(grid);
  applyFeatures(grid, features.headType);
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

export type { SpriteAnimKind } from './spriteTypes';

/**
 * Mirror a sprite grid horizontally (left column <-> right column).
 *
 * PvP only: every procedural pose faces the same way as the PvE runner (to the
 * right), so the opponent standing on the right side of the arena must be
 * mirrored to face the player. Mirroring the pixels — rather than applying a CSS
 * `scaleX(-1)` — also swaps the equipped weapon into the opponent's other hand,
 * and cannot be cancelled by the CSS animations that drive `.pixel-character`.
 */
export function mirrorSpriteGrid(grid: SpriteGrid): SpriteGrid {
  return grid.map((row) => row.slice().reverse());
}

interface FramePlan {
  phase: number;
  blink?: boolean;
  hairSway?: boolean;
  /** Durée propre à cette frame (ms). Sinon la cadence de l'animation. */
  ms?: number;
}

// L'idle fait DEUX respirations par boucle (20 frames = 8 s) : le clignement
// n'arrive donc qu'une fois toutes les 8 s, et il dure 140 ms. Cligner à
// chaque cycle de 1,7 s (ancien réglage) donnait un personnage qui papillonne.
// Chaque respiration est découpée en paliers d'un pixel de sprite (une
// demi-cellule, voir IDLE_BREATH_PX) pour un souffle progressif plutôt qu'un
// saut de cellule.
export const IDLE_BREATH_FRAMES = 10;
export const IDLE_BLINK_FRAME = 10;
export const IDLE_BLINK_MS = 140;

// Secondary motion rides the very same frame list as the body: the hair reacts
// one beat after the body's extreme, and idle blinks once per loop, at the
// start of the second breath.
function framePlanOf(kind: SpriteAnimKind): FramePlan[] {
  if (kind === 'attack') {
    return [0, 1, 2, 3, 4].map((phase) => ({ phase }));
  }
  if (kind === 'run') {
    return [0, 1, 2, 3, 4, 5].map((phase) => ({
      phase,
      hairSway: phase === 2 || phase === 5,
    }));
  }
  if (kind === 'idle') {
    return Array.from({ length: IDLE_BREATH_FRAMES * 2 }, (_, phase) => ({
      phase,
      // The breathing already carries the head/hair up and down. A one-frame
      // lock twitch every breath only read as a glitch, so idle has none.
      blink: phase === IDLE_BLINK_FRAME,
      ms: phase === IDLE_BLINK_FRAME ? IDLE_BLINK_MS : undefined,
    }));
  }
  if (kind === 'hit') return [{ phase: 0 }, { phase: 1 }, { phase: 2 }];
  return [{ phase: 0 }, { phase: 1 }, { phase: 2, hairSway: true }, { phase: 3 }]; // victory
}

// Animation frames for run cycle, attack swing, idle breathing + blink, hit
// recoil, and victory celebration. Fully procedural from the composed body.
export function generateSpriteFrames(
  seed: string,
  gender: 'male' | 'female',
  appearance?: CharacterAppearance | null,
  kind: SpriteAnimKind = 'run',
): GeneratedSprite[] | null {
  const features = resolveSpriteFeatures(seed, gender, appearance);
  const palette = buildPalette(features);
  return framePlanOf(kind).map(({ phase, blink, hairSway, ms }) => {
    const base = composeBaseGrid(features.headType, features.bodyType);
    applyBuild(base, features.build);
    applyAnatomy(base);
    // Body snapshot before the fists grow inward: it lets a moving hand leave
    // the shirt/waist behind instead of a transparent notch.
    const body = base.map((row) => row.slice());
    applyFists(base);
    if (kind === 'attack') applyAttackPose(base, phase, body);
    else if (kind === 'run') applyStride(base, phase as RunPhase);
    else if (kind === 'hit') applyHitReaction(base, phase);
    else if (kind === 'victory') applyVictoryPose(base, phase, body);

    if (hairSway) applyHairSway(base, features.headType);
    const grid = upscale(base);
    applySnes(grid);
    applyDetails(grid);
    applyFeatures(grid, features.headType);
    // Le souffle déplace le buste déjà ombré : l'ombrage n'est pas recalculé
    // sur une grille décalée d'un demi-pixel, et le clignement suit la tête.
    if (kind === 'idle') applyIdleBreathingPx(grid, phase);
    applyFaceExpression(grid, kind, phase);
    if (blink) applyBlink(grid);
    for (let i = 0; i < SPRITE_PAD_TOP; i++) grid.unshift(Array(SPRITE_WIDTH).fill(0));
    // Victory hop: shift the finished frame so the laces, belt and collar move
    // with the body instead of being repainted on stale rows.
    if (kind === 'victory' && (phase === 1 || phase === 2)) {
      const hop = 2;
      for (let y = 0; y < SPRITE_HEIGHT; y++) {
        grid[y] = y + hop < SPRITE_HEIGHT ? grid[y + hop].slice() : Array(SPRITE_WIDTH).fill(0);
      }
    }
    return { grid, palette, width: SPRITE_WIDTH, height: SPRITE_HEIGHT, ms };
  });
}
