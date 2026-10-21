import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';
import { ELEMENT_COLORS, ItemRarity, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, SPRITE_HEIGHT, SPRITE_PAD_TOP, SpriteGrid, SpritePalette, TRIM_INDEX, highlightIndexOf, shadeIndexOf } from './spriteTypes';
import { OUTLINE_HEX, RARITY_TRIM, highlightHex, mixHex } from './spritePalettes';
import { WEAPON_REST_ANGLE } from './weaponPoses';

export const PLATE_INDEX = 62;
export const PLATE_STEEL = '#a8b4c0';
export const TRIM_DARK = 90;
export const ACCENT_DARK = 91;
export const PLATE_DARK = 92;
export const PLATE_LIGHT = 102;
export const TINT_INDEX = 63;
export const TINT_DARK = 93;
export const TINT2_INDEX = 64;
export const TINT2_DARK = 94;
export const BLADE_INDEX = 65;
export const BLADE_DARK = 95;
export const WOOD_INDEX = 66;
export const WHEAD_INDEX = 67;
export const WHEAD_DARK = 98;
export const FIELD_INDEX = 68;
export const FIELD_DARK = 99;
export const FIELD_LIGHT = 100;
export const STRING_INDEX = 101;
export const RIM_INDEX = 96;
export const RIM_DARK = 97;
export const BLADE_LIGHT = 103;
export const WOOD_LIGHT = 104;
export const WHEAD_LIGHT = 105;
export const TRIM_LIGHT = 106;
export const TINT_LIGHT = 107;
export const TINT2_LIGHT = 108;
export const WOOD_DARK = 109;
// Contour sombre ajouté autour de l'arme visible. Sans lui, une garde dorée
// posée sur le plastron gris ou une garde brune posée sur la peau se lisaient
// comme un simple mélange de pixels au lieu d'un objet tenu devant le corps.
export const WEAPON_OUTLINE_INDEX = 110;

const GRID_W = 24;
const GRID_H = SPRITE_HEIGHT;
const PAD = SPRITE_PAD_TOP;

const DEFAULT_BLADE = '#c0c0c0';
const DEFAULT_WOOD = '#8b5a2b';

export interface ResolvedLoadout {
  weapon: PixelItemAsset | null;
  armor: PixelItemAsset | null;
  accessory: PixelItemAsset | null;
}

export function resolveLoadout(equipped?: {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
} | null): ResolvedLoadout {
  return {
    weapon: equipped?.weapon ? getItemById(equipped.weapon, ITEM_ASSETS) ?? null : null,
    armor: equipped?.armor ? getItemById(equipped.armor, ITEM_ASSETS) ?? null : null,
    accessory: equipped?.accessory ? getItemById(equipped.accessory, ITEM_ASSETS) ?? null : null,
  };
}

const RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BodyLandmarks {
  head: Box;
  torso: Box;
  handR: { x: number; y: number };
  handL: { x: number; y: number };
  faceCx: number;
  eyeY: number;
  palmR: { x: number; y: number };
  palmL: { x: number; y: number };
  neck: { x: number; y: number };
  chest: { x: number; y: number };
}

function boxOf(grid: SpriteGrid, y0: number, y1: number): Box {
  let x0 = 99;
  let x1 = -1;
  let top = -1;
  let bottom = -1;
  for (let y = y0; y <= y1 && y < grid.length; y++) {
    const row = grid[y];
    if (!row) continue;
    row.forEach((c, x) => {
      if (c === 0) return;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (top < 0) top = y;
      bottom = y;
    });
  }
  if (x1 < 0) return { x0: 0, y0, x1: 0, y1: y0 };
  return { x0, y0: top, x1, y1: bottom };
}

const SKIN_INDICES = new Set([1, shadeIndexOf(1), highlightIndexOf(1)]);

function extremeHand(grid: SpriteGrid, side: 'left' | 'right'): { x: number; y: number } {
  for (let y = 24 + PAD; y <= 31 + PAD; y++) {
    const row = grid[y];
    if (!row) continue;
    let x = -1;
    if (side === 'right') {
      for (let i = row.length - 1; i >= 0; i--) {
        if (SKIN_INDICES.has(row[i])) {
          x = i;
          break;
        }
      }
    } else {
      for (let i = 0; i < row.length; i++) {
        if (SKIN_INDICES.has(row[i])) {
          x = i;
          break;
        }
      }
    }
    if (x < 0) continue;
    let width = 0;
    if (side === 'right') {
      for (let i = x; i >= 0 && SKIN_INDICES.has(row[i]); i--) width++;
    } else {
      for (let i = x; i < row.length && SKIN_INDICES.has(row[i]); i++) width++;
    }
    if (width >= 4) return { x, y };
  }
  return side === 'right' ? { x: 17, y: 27 + PAD } : { x: 6, y: 27 + PAD };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

export function computeLandmarks(grid: SpriteGrid): BodyLandmarks {
  const head = boxOf(grid, 0, 17 + PAD);
  const torso = boxOf(grid, 18 + PAD, 33 + PAD);
  const handR = extremeHand(grid, 'right');
  const handL = extremeHand(grid, 'left');
  let eyeSumX = 0;
  let eyeSumY = 0;
  let eyeCount = 0;
  for (let y = head.y0; y <= head.y1; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = head.x0; x <= head.x1; x++) {
      if (row[x] === 8) {
        eyeSumX += x;
        eyeSumY += y;
        eyeCount++;
      }
    }
  }
  const faceCx = eyeCount > 0
    ? clamp(eyeSumX / eyeCount, 0, GRID_W - 1)
    : clamp((head.x0 + head.x1) / 2, 0, GRID_W - 1);
  const eyeY = eyeCount > 0 ? Math.round(eyeSumY / eyeCount) : head.y0 + 8;
  const palmR = { x: clamp(handR.x - 1, 0, GRID_W - 1), y: handR.y };
  const palmL = { x: clamp(handL.x + 1, 0, GRID_W - 1), y: handL.y };
  const neck = { x: clamp(faceCx, torso.x0, torso.x1), y: torso.y0 };
  const chest = { x: neck.x, y: clamp(torso.y0 + 5, torso.y0, torso.y1) };
  return { head, torso, handR, handL, faceCx, eyeY, palmR, palmL, neck, chest };
}

interface ArtCell {
  x: number;
  y: number;
  v: number;
}

function artCells(art: number[][]): ArtCell[] {
  const cells: ArtCell[] = [];
  for (let y = 0; y < art.length; y++) {
    for (let x = 0; x < art[y].length; x++) {
      if (art[y][x] !== 0) cells.push({ x, y, v: art[y][x] });
    }
  }
  return cells;
}

function paint(grid: SpriteGrid, x: number, y: number, v: number): void {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = v;
}

type WeaponPalm = { x: number; y: number };

/**
 * Inverse-map every world pixel into the weapon's local space. Local x runs
 * across the weapon (grip at 0), local y runs from the grip toward the tip.
 *
 * Sampling in this direction is intentional. Forward-projecting hundreds of
 * local samples into the 24px grid overdraws the same world pixel from several
 * local rows: on a diagonal shaft that alternates the light and dark edge cells
 * and reads as a wavy rubber prop. Inverse sampling gives every world pixel
 * exactly one local coordinate, so a rotated shaft is a clean parallelogram and
 * a rotated blade is a clean, straight taper.
 */
function paintLocalShape(
  grid: SpriteGrid,
  palm: WeaponPalm,
  angle: number,
  colorAt: (lx: number, ly: number) => number,
): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const dx = x - palm.x;
      const dy = y - palm.y;
      const lx = dx * c + dy * s;
      const ly = dx * s - dy * c;
      const value = colorAt(lx, ly);
      if (value !== 0) paint(grid, x, y, value);
    }
  }
}

function shaftAt(
  lx: number,
  ly: number,
  from: number,
  to: number,
  center: number,
): number {
  // A single flat colour avoids the light/dark stripe that used to crawl up
  // diagonal shafts and read as a twisted rubber band.
  if (ly < from || ly > to || Math.abs(lx) > 1) return 0;
  return center;
}

function bandAt(
  lx: number,
  ly: number,
  bandLy: number,
  halfWidth: number,
  value: number,
): number {
  return Math.abs(ly - bandLy) <= 0.6 && Math.abs(lx) <= halfWidth ? value : 0;
}

function maskValueAt(
  rows: readonly number[][],
  centerLy: number,
  lx: number,
  ly: number,
): number {
  const cols = rows[0]?.length ?? 0;
  const halfCols = Math.floor(cols / 2);
  const topLy = centerLy + Math.floor(rows.length / 2);
  const row = topLy - Math.round(ly);
  const col = Math.round(lx) + halfCols;
  if (row < 0 || row >= rows.length || col < 0 || col >= cols) return 0;
  return rows[row][col];
}

function freqOf(art: number[][], y0: number, y1: number, allowed?: Set<number>): Map<number, number> {
  const freq = new Map<number, number>();
  for (let y = Math.max(0, y0); y <= Math.min(art.length - 1, y1); y++) {
    const row = art[y] ?? [];
    for (let x = 0; x < row.length; x++) {
      const v = row[x];
      if (v === 0 || v === 1) continue;
      if (allowed && !allowed.has(v)) continue;
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
  }
  return freq;
}

function topOf(freq: Map<number, number>): number | null {
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, count] of freq) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

function hexOfArtValue(v: number | null, fallback: string): string {
  if (v === null) return fallback;
  return ITEM_PALETTE[v] ?? fallback;
}

function dominantArtValue(art: number[][]): number | null {
  return topOf(freqOf(art, 0, art.length - 1));
}

function bladeHexOf(art: number[][]): string {
  return hexOfArtValue(topOf(freqOf(art, 0, Math.floor(art.length / 2) - 1)), DEFAULT_BLADE);
}

function woodHexOf(art: number[][]): string {
  const WOOD_SET = new Set([3, 9]);
  return hexOfArtValue(
    topOf(freqOf(art, Math.floor(art.length / 2), art.length - 1, WOOD_SET)) ??
    topOf(freqOf(art, 0, art.length - 1, WOOD_SET)),
    DEFAULT_WOOD,
  );
}

function headTopHexOf(art: number[][], fallback: string): string {
  return hexOfArtValue(topOf(freqOf(art, 0, 2)), fallback);
}

export type ArmorVisualKind = 'shield' | 'helm' | 'boots' | 'bracers' | 'robe' | 'chest';
export type AccessoryVisualKind = 'crown' | 'boots' | 'necklace' | 'orb' | 'ring' | 'brooch';
export type WeaponVisualKind = 'bow' | 'fist' | 'staff' | 'scepter' | 'scythe' | 'haft' | 'spear' | 'dagger' | 'blade';

export function armorVisualKind(name: string): ArmorVisualKind {
  const n = name.toLowerCase();
  if (n.includes('shield')) return 'shield';
  if (n.includes('helm') || n.includes('coif') || n.includes('hood') || n.includes('mask') || n.includes('crown')) return 'helm';
  if (n.includes('boot') || n.includes('greave') || n.includes('sabatons')) return 'boots';
  if (n.includes('bracer') || n.includes('gauntlet') || n.includes('glove') || n.includes('vambrace')) return 'bracers';
  if (n.includes('robe') || n.includes('cloak') || n.includes('mantle') || n.includes('shroud') || n.includes('vestment')) return 'robe';
  return 'chest';
}

export function accessoryVisualKind(name: string): AccessoryVisualKind {
  const n = name.toLowerCase();
  if (n.includes('crown')) return 'crown';
  if (n.includes('boot')) return 'boots';
  if (
    n.includes('pendant') || n.includes('amulet') || n.includes('talisman') ||
    n.includes('charm') || n.includes('necklace') || n.includes('bead') ||
    n.includes('tear') || n.includes('locket')
  ) return 'necklace';
  if (n.includes('orb') || n.includes('crystal') || n.includes('stone') || n.includes('idol')) return 'orb';
  if (n.includes('ring') || n.includes('band')) return 'ring';
  return 'brooch';
}

export function weaponVisualKind(item: PixelItemAsset): WeaponVisualKind {
  const n = item.name.toLowerCase();
  if (n.includes('bow')) return 'bow';
  if (n.includes('knuckle')) return 'fist';
  if (n.includes('wand')) return 'scepter';
  if (n.includes('staff')) return 'staff';
  if (n.includes('spear') || n.includes('glaive') || n.includes('halberd') || n.includes('pike')) return 'spear';
  if (n.includes('scythe') || n.includes('reaper')) return 'scythe';
  if (
    n.includes('axe') || n.includes('hammer') || n.includes('mace') ||
    n.includes('club') || n.includes('maul') || n.includes('pick')
  ) return 'haft';
  if (n.includes('dagger') || n.includes('knife') || n.includes('fang') || n.includes('rapier') || n.includes('stiletto')) return 'dagger';
  return 'blade';
}

function blitRaw(
  grid: SpriteGrid,
  art: number[][],
  ox: number,
  oy: number,
  remap?: (v: number) => number,
): { minX: number; maxX: number; minY: number; maxY: number; count: number; tip: { x: number; y: number } | null } {
  const toIndex = remap ?? ((v: number) => ITEM_BLIT_OFFSET + v);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let count = 0;
  let tip: { x: number; y: number } | null = null;
  for (const { x, y, v } of artCells(art)) {
    const px = ox + x;
    const py = oy + y;
    if (py < 0 || py >= grid.length || px < 0 || px >= grid[0].length) continue;
    grid[py][px] = toIndex(v);
    count++;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    if (!tip || py < tip.y) tip = { x: px, y: py };
  }
  if (count === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, count, tip };
  return { minX, maxX, minY, maxY, count, tip };
}

// ---------------------------------------------------------------------------
// Chunky procedural painters — bold 2px shapes at the sprite's own density,
// colors sampled from each item's pixel art.
// ---------------------------------------------------------------------------

// Bas de la poignée dans le repère de la paume (0 = centre du poing, +y vers
// le haut). La main mesure ~5px de haut : une poignée qui s'arrêtait à -3.2
// disparaissait entièrement derrière le poing une fois que la main recouvre
// l'arme, et l'arme semblait flotter sans manche. Les 2px qui dépassent sous
// le poing donnent un pommeau/cul-de-manche visible, donc une prise crédible.
const HANDLE_BOTTOM = -5.4;

function paintBlade(
  grid: SpriteGrid,
  palm: WeaponPalm,
  angle: number,
  length: number,
  glint: boolean,
  gem: number,
): void {
  const guardLy = 2;
  const bladeTop = guardLy + length;
  const taperStart = bladeTop - 2.5;
  const bladeAngle = angle * 0.7;
  paintLocalShape(grid, palm, bladeAngle, (lx, ly) => {
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;

    const guard = Math.abs(ly - guardLy) <= 0.6 && Math.abs(lx) <= 2.1;
    if (guard) {
      if (Math.round(lx) >= 1) return gem;
      return Math.abs(lx) > 1.25 ? BLADE_DARK : BLADE_INDEX;
    }

    if (ly >= guardLy - 0.35 && ly <= bladeTop) {
      // Keep a one-pixel point at the very tip; a taper that reaches exactly
      // zero can miss the world-pixel sampling grid and leave the sword blunt.
      if (ly > bladeTop - 1.1 && Math.abs(lx) <= 0.55) {
        return glint ? ACCENT_INDEX : BLADE_LIGHT;
      }
      const halfWidth = ly <= taperStart ? 1 : Math.max(0.55, 1 - (ly - taperStart) / 2.5);
      if (Math.abs(lx) <= halfWidth + 0.01) {
        if (Math.abs(lx) > 0.55) return BLADE_DARK;
        return BLADE_LIGHT;
      }
      return 0;
    }

    if (ly >= HANDLE_BOTTOM && ly < guardLy && Math.abs(lx) <= 1) {
      return Math.abs(lx) < 0.4 ? WOOD_INDEX : WOOD_DARK;
    }
    return 0;
  });
}

type HaftShape = 'axe' | 'mace' | 'hammer' | 'club' | 'pick';

function haftShapeOf(name: string): HaftShape {
  const n = name.toLowerCase();
  if (n.includes('mace')) return 'mace';
  if (n.includes('hammer') || n.includes('maul')) return 'hammer';
  if (n.includes('club')) return 'club';
  if (n.includes('pick')) return 'pick';
  return 'axe';
}

function paintHaft(
  grid: SpriteGrid,
  palm: WeaponPalm,
  angle: number,
  rivet: number,
  shape: HaftShape = 'axe',
): void {
  const headCenterY = 9;
  const masks: Record<HaftShape, number[][]> = {
    axe: [
      [0, 0, 5, 5, 2],
      [0, 5, 1, 1, 2],
      [5, 1, 1, 3, 4],
      [0, 5, 1, 1, 2],
      [0, 0, 5, 5, 2],
    ],
    mace: [
      [0, 5, 5, 5, 0],
      [5, 4, 1, 1, 5],
      [2, 1, 1, 1, 2],
      [5, 1, 3, 1, 5],
      [0, 5, 4, 5, 0],
    ],
    hammer: [
      [2, 2, 2, 2, 2],
      [5, 1, 1, 1, 5],
      [5, 1, 3, 1, 5],
      [5, 1, 1, 1, 5],
      [0, 5, 5, 5, 0],
    ],
    club: [
      [0, 0, 5, 0, 0],
      [0, 5, 1, 5, 0],
      [5, 1, 3, 1, 5],
      [0, 5, 1, 5, 0],
      [0, 0, 1, 0, 0],
    ],
    pick: [
      [0, 0, 0, 5, 4],
      [0, 5, 5, 2, 0],
      [5, 1, 3, 0, 0],
      [0, 5, 2, 0, 0],
      [0, 0, 5, 0, 0],
    ],
  };
  const head = masks[shape];
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    const mv = maskValueAt(head, headCenterY, lx, ly);
    if (mv !== 0) {
      if (mv === 1) return WHEAD_INDEX;
      if (mv === 2) return BLADE_INDEX;
      if (mv === 3) return rivet;
      if (mv === 4) return BLADE_LIGHT;
      return WHEAD_DARK;
    }
    if (bandAt(lx, ly, 7, 1, BLADE_INDEX)) return BLADE_INDEX;
    if (bandAt(lx, ly, 0, 1, WHEAD_DARK)) return WHEAD_DARK;
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;
    return shaftAt(lx, ly, HANDLE_BOTTOM, headCenterY, WOOD_INDEX);
  });
}

function paintStaff(grid: SpriteGrid, palm: WeaponPalm, angle: number): void {
  const headCenterY = 13;
  const head = [
    [0, 5, 5, 5, 0],
    [5, 1, 1, 1, 5],
    [5, 1, 2, 1, 5],
    [5, 1, 1, 1, 5],
    [0, 5, 5, 5, 0],
  ];
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    const mv = maskValueAt(head, headCenterY, lx, ly);
    if (mv === 5) return WHEAD_DARK;
    if (mv === 2) return ACCENT_INDEX;
    if (mv !== 0) return WHEAD_INDEX;
    if (bandAt(lx, ly, 0, 1, WOOD_DARK)) return WOOD_DARK;
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;
    return shaftAt(lx, ly, HANDLE_BOTTOM, 12, WOOD_INDEX);
  });
}

function paintSpear(grid: SpriteGrid, palm: WeaponPalm, angle: number): void {
  const headCenterY = 11;
  const head = [
    [0, 4, 0],
    [5, 2, 5],
    [5, 1, 5],
    [0, 5, 0],
    [0, 5, 0],
  ];
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    const mv = maskValueAt(head, headCenterY, lx, ly);
    if (mv === 5) return BLADE_DARK;
    if (mv === 4) return BLADE_LIGHT;
    if (mv !== 0) return BLADE_INDEX;
    if (bandAt(lx, ly, 8, 1, BLADE_INDEX)) return BLADE_INDEX;
    if (bandAt(lx, ly, 0, 1, WOOD_DARK)) return WOOD_DARK;
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;
    return shaftAt(lx, ly, HANDLE_BOTTOM, 10, WOOD_INDEX);
  });
}

function paintScepter(grid: SpriteGrid, palm: WeaponPalm, angle: number): void {
  const headCenterY = 5;
  const head = [
    [0, 5, 5, 5, 0],
    [5, 1, 1, 1, 5],
    [5, 1, 2, 1, 5],
    [5, 1, 1, 1, 5],
    [0, 5, 5, 5, 0],
  ];
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    const mv = maskValueAt(head, headCenterY, lx, ly);
    if (mv === 5) return WHEAD_DARK;
    if (mv === 2) return ACCENT_INDEX;
    if (mv !== 0) return WHEAD_INDEX;
    if (bandAt(lx, ly, 0, 1, WOOD_DARK)) return WOOD_DARK;
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;
    return shaftAt(lx, ly, HANDLE_BOTTOM, 4, WOOD_INDEX);
  });
}

function paintScythe(grid: SpriteGrid, palm: WeaponPalm, angle: number, glint: boolean): void {
  const headCenterY = 11;
  // A scythe blade is a leftward crescent, not a centred mace head. The
  // seven-column local shape wraps around the shaft and reads as a blade even
  // at the 6px display scale.
  const head = [
    [0, 0, 0, 0, 5, 5, 4],
    [0, 0, 5, 5, 2, 2, 5],
    [0, 5, 2, 2, 2, 5, 0],
    [5, 2, 2, 2, 5, 0, 0],
    [0, 5, 5, 5, 0, 0, 0],
  ];
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    const mv = maskValueAt(head, headCenterY, lx, ly);
    if (mv === 5) return BLADE_DARK;
    if (mv === 4) return BLADE_LIGHT;
    if (mv !== 0) return BLADE_INDEX;
    // Bound the glint to the scythe's upper-left tip. Without the local box
    // this condition painted every cell in the half-plane above and left of
    // the head, which looked like a giant purple flag behind the character.
    if (glint && ly > 12.4 && ly < 14.6 && lx < -0.2 && lx > -2.8) return ACCENT_INDEX;
    if (bandAt(lx, ly, 0, 1, WOOD_DARK)) return WOOD_DARK;
    if (Math.abs(ly - HANDLE_BOTTOM) <= 0.6 && Math.abs(lx) <= 1.2) return BLADE_INDEX;
    return shaftAt(lx, ly, HANDLE_BOTTOM, 10, WOOD_INDEX);
  });
}

function paintBow(grid: SpriteGrid, palm: WeaponPalm, angle: number): void {
  const top = 6;
  const bottom = -5;
  const span = top - bottom;
  paintLocalShape(grid, palm, angle, (lx, ly) => {
    if (ly < bottom || ly > top) return 0;
    if (Math.abs(ly) <= 0.6 && Math.abs(lx) <= 1) return BLADE_INDEX;
    if (ly >= top - 0.6 && Math.abs(lx - 2) <= 1) return WOOD_LIGHT;
    if (ly <= bottom + 0.6 && Math.abs(lx - 2) <= 1) return WOOD_LIGHT;
    if (Math.abs(lx) < 0.45) return STRING_INDEX;
    const bend = Math.round(2 * Math.sin(Math.PI * (top - ly) / span));
    if (Math.abs(lx - (2 + bend)) <= 1 || Math.abs(lx - (3 + bend)) <= 1) {
      return lx < 2.5 + bend ? WOOD_INDEX : WOOD_DARK;
    }
    return 0;
  });
}

function paintFist(grid: SpriteGrid, palm: { x: number; y: number }): void {
  for (let y = palm.y - 1; y <= palm.y + 1; y++) {
    for (let x = palm.x - 1; x <= palm.x + 2; x++) paint(grid, x, y, WHEAD_INDEX);
  }
  paint(grid, palm.x, palm.y, BLADE_INDEX);
  paint(grid, palm.x + 1, palm.y, BLADE_INDEX);
}

export interface OverlayOptions {
  // Legacy horizontal offset for the held weapon. The UI keeps it at zero:
  // animation pivots around the grip instead of sliding the hilt through the
  // fist. Kept so older callers/tests can still exercise the anchor.
  swayX?: number;
  // Angle of the whole weapon around the palm, in radians. Positive leans the
  // tip outboard (to the right for the player fighter). The grip itself never
  // moves through the hand: every weapon part rotates together.
  weaponAngle?: number;
  // Pendulum swing of hanging jewelry (necklaces, brooches, orb pendants).
  // Worn gear (armor, helms, rings, shields) correctly stays put.
  swingX?: number;
  // 0 = none. Positive = strike frame: how many 1px steps of after-image to
  // leave along the swing arc, which is what makes a 1px arm read as a punch.
  punchTrail?: number;
}

function paintHeldWeapon(
  grid: SpriteGrid,
  item: PixelItemAsset,
  palm: { x: number; y: number },
  swayX = 0,
  angle = WEAPON_REST_ANGLE,
): void {
  const kind = weaponVisualKind(item);
  const glint = item.rarity === 'epic' || item.rarity === 'legendary';
  const gem = item.element ? ACCENT_INDEX : TRIM_INDEX;
  // Keep the grip centred in the fist. Head clearance comes from drawing the
  // weapon behind the body (see clipWeaponFromHead), not from sliding it out.
  const grip = { x: palm.x + swayX, y: palm.y };
  if (kind === 'bow') {
    paintBow(grid, grip, angle);
    paintFistGrip(grid, palm);
    return;
  }
  if (kind === 'fist') {
    paintFist(grid, grip);
    return;
  }
  if (kind === 'staff') {
    paintStaff(grid, grip, angle);
    paintFistGrip(grid, palm);
    return;
  }
  if (kind === 'spear') {
    paintSpear(grid, grip, angle);
    paintFistGrip(grid, palm);
    return;
  }
  if (kind === 'scepter') {
    paintScepter(grid, grip, angle);
    paintFistGrip(grid, palm);
    return;
  }
  if (kind === 'scythe') {
    paintScythe(grid, grip, angle, glint);
    paintFistGrip(grid, palm);
    return;
  }
  if (kind === 'haft') {
    paintHaft(grid, grip, angle, item.element ? ACCENT_INDEX : WHEAD_INDEX, haftShapeOf(item.name));
    paintFistGrip(grid, palm);
    return;
  }
  paintBlade(grid, grip, angle, kind === 'dagger' ? 6 : 11, glint, gem);
  paintFistGrip(grid, palm);
}

// Fingers wrapped OVER the handle: repaints the fist on top of the grip so
// the weapon reads as HELD instead of floating beside the hand. Axis-aligned
// (the fist is body), also on sway frames where the grip shifts underneath.
function paintFistGrip(grid: SpriteGrid, palm: { x: number; y: number }): void {
  paint(grid, palm.x, palm.y, 1);
  paint(grid, palm.x + 1, palm.y, 1);
  paint(grid, palm.x, palm.y + 1, shadeIndexOf(1));
  paint(grid, palm.x + 1, palm.y + 1, shadeIndexOf(1));
}

/**
 * Stamps the left forearm back over the shield. The shield is drawn in depth
 * mode (torso occludes it), which also eats the arm cells it overlaps, so the
 * limb has to be restored or the shield looks detached from the body.
 */
function paintShieldArm(grid: SpriteGrid, palmL: { x: number; y: number }): void {
  const skin = [1, shadeIndexOf(1), highlightIndexOf(1)];
  const x = palmL.x;
  for (let y = Math.max(0, palmL.y - 6); y <= Math.min(GRID_H - 1, palmL.y + 1); y++) {
    for (let dx = 0; dx <= 1; dx++) {
      if (skin.includes(grid[y][x + dx])) grid[y][x + dx] = dx === 1 ? shadeIndexOf(1) : 1;
    }
  }
}

function paintShield(grid: SpriteGrid, palmL: { x: number; y: number }): void {
  // Outboard of the hand, not inboard. Anchoring at palmL.x + 1 put the
  // shield's centre two pixels *inside* the torso, so it read as a slab
  // painted across the chest instead of a shield held at the side.
  const fc = clamp(palmL.x - 2, 3, GRID_W - 4);
  const top = clamp(palmL.y - 4, 18 + PAD, GRID_H - 9);
  const bottom = top + 7;
  for (let y = top; y <= bottom; y++) {
    const narrow = y >= bottom - 1 ? 1 : 0;
    for (let x = fc - 2 + narrow; x <= fc + 3 - narrow; x++) {
      const border = x === fc - 2 + narrow || x === fc + 3 - narrow || y === top || y === bottom;
      paint(grid, x, y, border ? TRIM_INDEX : FIELD_INDEX);
    }
  }
  for (let y = top + 2; y <= bottom - 2; y++) {
    paint(grid, fc, y, FIELD_LIGHT);
    paint(grid, fc + 1, y, FIELD_LIGHT);
  }
  paint(grid, fc, top + 3, ACCENT_INDEX);
  paint(grid, fc + 1, top + 3, ACCENT_INDEX);
  paint(grid, fc, top + 4, ACCENT_INDEX);
  paint(grid, fc + 1, top + 4, ACCENT_INDEX);
  // The hand wraps the boss: without this the shield reads as hovering beside
  // the fist instead of being gripped.
  paintFistGrip(grid, { x: fc + 3, y: clamp(palmL.y - 1, 0, GRID_H - 1) });
}

const HAIR_SET = new Set<number>([4]);
const SHIRT_SET = new Set<number>([5, 9, 11]);

function isHair(base: number): boolean {
  return HAIR_SET.has(base) || shadeIndexOf(4) === base || highlightIndexOf(4) === base;
}

function isShirt(base: number): boolean {
  return SHIRT_SET.has(base) || shadeIndexOf(5) === base;
}

function paintHelm(grid: SpriteGrid, head: Box, faceCx: number, eyeY: number, rim: number): void {
  // Stop at the brow line. Repainting hair all the way down to the chin left
  // the whole head in field colour, and the rarity trim sat on the TOP rows —
  // it read as a gold bar floating above the skull rather than a helmet.
  const brimY = Math.min(Math.max(eyeY - 2, head.y0 + 2), head.y1);
  for (let y = head.y0; y <= brimY; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = head.x0; x <= head.x1; x++) {
      if (!isHair(row[x])) continue;
      row[x] = FIELD_INDEX;
    }
  }
  // Light catches the crown, the rarity trim rides the brim.
  for (let x = head.x0; x <= head.x1; x++) {
    if (grid[head.y0][x] !== 0) grid[head.y0][x] = FIELD_LIGHT;
    if (grid[brimY][x] !== 0) grid[brimY][x] = rim;
  }
  // Gem at the front of the brim, never on the forehead.
  paint(grid, clamp(faceCx, head.x0, head.x1), brimY, ACCENT_INDEX);
}

const ARMOR_TOP = 19 + PAD;
const ARMOR_WAIST = 29 + PAD;
const ARMOR_BAND_TOP = ARMOR_WAIST - 2;

function paintChest(grid: SpriteGrid, torso: Box, cx: number): void {
  const ccx = clamp(cx, torso.x0 + 4, torso.x1 - 4);
  // Layer 1 — plastron: the armour field replaces the player's shirt from the
  // chest down to the waist; skin, hair and legs are never touched.
  for (let y = ARMOR_TOP; y <= ARMOR_WAIST; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = torso.x0; x <= torso.x1; x++) {
      if (!isShirt(row[x])) continue;
      row[x] = FIELD_INDEX;
    }
  }
  // Layer 2 — pauldrons: two rarity-trim cells on each shoulder, over the
  // plastron edge, so the armour reads as worn rather than poured on.
  for (const y of [torso.y0 + 2, torso.y0 + 3]) {
    const row = grid[y];
    if (!row) continue;
    // Pauldrons sit on the plastron/shirt, not on bare skin. A sleeveless or
    // monk body has a skin arm in the outer column; painting the trim over it
    // turned the shoulder into a metal amputee and hid the player's skin.
    const isArmourField = (c: number): boolean => c === FIELD_INDEX || isShirt(c);
    const left = row.findIndex(isArmourField);
    for (let i = 0; i < 2 && left >= 0; i++) {
      const x = left + i;
      if (x < row.length && isArmourField(row[x])) row[x] = TRIM_INDEX;
    }
    let right = -1;
    for (let x = row.length - 1; x >= 0; x--) {
      if (isArmourField(row[x])) {
        right = x;
        break;
      }
    }
    for (let i = 0; i < 2 && right >= 0; i++) {
      const x = right - i;
      if (x >= 0 && isArmourField(row[x])) row[x] = TRIM_INDEX;
    }
  }
  // Ridge and clasp run down the plastron; the clasp faces the viewer.
  // Ridge/clasp are armour details, so they only overwrite the plastron.
  // Painting them unconditionally punched a steel line through the skin of
  // open-chest bodies (monk/sleeveless).
  for (let y = torso.y0 + 3; y <= torso.y0 + 8; y++) {
    const row = grid[y];
    if (!row) continue;
    for (const x of [ccx - 1, ccx]) {
      if (row[x] === FIELD_INDEX) row[x] = FIELD_LIGHT;
    }
  }
  const cy = clamp(torso.y0 + 5, torso.y0, torso.y1);
  for (const x of [ccx - 1, ccx]) {
    const cell = grid[cy]?.[x];
    if (cell === FIELD_INDEX || cell === FIELD_LIGHT) grid[cy][x] = ACCENT_INDEX;
  }
  // Layer 3 — waist band: a tinted cloth layer over the lower plastron, using
  // the item's tint ramp. It stops at the hip line so the pants and shoes of
  // the player survive untouched.
  for (let y = ARMOR_BAND_TOP; y <= ARMOR_WAIST; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = torso.x0; x <= torso.x1; x++) {
      if (row[x] === FIELD_INDEX) row[x] = TINT2_INDEX;
    }
  }
}

function stampHeadgear(grid: SpriteGrid, item: PixelItemAsset, head: Box, faceCx: number): void {
  const art = item.pixels;
  const ox = clamp(faceCx - 4, 0, GRID_W - 8);
  const oy = Math.max(0, head.y0 - 2);
  for (const { x, y, v } of artCells(art)) {
    const px = ox + x;
    const py = oy + y;
    if (py < 0 || py >= grid.length || px < 0 || px >= grid[0].length) continue;
    if (px < head.x0 - 2 || px > head.x1 + 2 || py < head.y0 - 2 || py > head.y1) continue;
    const base = grid[py][px];
    if (!(base === 0 || isHair(base))) continue;
    grid[py][px] = ITEM_BLIT_OFFSET + v;
  }
  paint(grid, faceCx, head.y0 + 1, ACCENT_INDEX);
  paint(grid, clamp(faceCx + 1, 0, GRID_W - 1), head.y0 + 1, ACCENT_INDEX);
}

function paintBoots(grid: SpriteGrid): void {
  for (const y of [34 + PAD, 35 + PAD]) {
    for (let x = 0; x < GRID_W; x++) {
      const cell = grid[y]?.[x] ?? 0;
      if (cell === 7 || cell === shadeIndexOf(7)) grid[y][x] = TINT_INDEX;
    }
  }
}

function paintBracers(grid: SpriteGrid): void {
  for (let y = 24 + PAD; y <= 29 + PAD; y++) {
    const row = grid[y];
    if (!row) continue;
    const left = row.findIndex((c) => c !== 0);
    if (left >= 0) row[left] = TINT2_INDEX;
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] !== 0) {
        row[x] = TINT2_INDEX;
        break;
      }
    }
  }
}

function firstContentRow(art: number[][]): number {
  for (let y = 0; y < art.length; y++) {
    if (art[y].some((v) => v !== 0)) return y;
  }
  return 0;
}

function paintCollarSupport(grid: SpriteGrid, neck: { x: number; y: number }): void {
  const x0 = clamp(neck.x - 3, 0, GRID_W - 1);
  const x1 = clamp(neck.x + 3, 0, GRID_W - 1);
  for (let x = x0; x <= x1; x++) paint(grid, x, neck.y, TRIM_INDEX);
  paint(grid, neck.x, neck.y, ACCENT_INDEX);
}

function paintSupportStrand(
  grid: SpriteGrid,
  neck: { x: number; y: number },
  cx: number,
  topY: number,
): void {
  const x = clamp(cx, 0, GRID_W - 1);
  for (let y = neck.y + 1; y <= topY; y++) paint(grid, x, y, TRIM_INDEX);
}

function paintNecklace(
  grid: SpriteGrid,
  item: PixelItemAsset,
  neck: { x: number; y: number },
  chest: { x: number; y: number },
  swingX = 0,
): void {
  const art = item.pixels;
  const artW = art[0]?.length ?? 8;
  const artH = art.length;
  const cx = clamp(neck.x + swingX, 0, GRID_W - 1);
  const oy = clamp(chest.y - 3, 0, GRID_H - artH);
  const ox = clamp(cx - Math.floor(artW / 2), 0, GRID_W - artW);
  paintCollarSupport(grid, neck);
  paintSupportStrand(grid, neck, cx, oy + firstContentRow(art));
  blitRaw(grid, art, ox, oy);
}

function paintRing(grid: SpriteGrid, palmR: { x: number; y: number }): void {
  const fx = clamp(palmR.x, 0, GRID_W - 2);
  const fy = clamp(palmR.y + 1, 0, GRID_H - 2);
  if ((grid[fy]?.[fx] ?? 0) !== 0) paint(grid, fx, fy, TRIM_INDEX);
  if ((grid[fy]?.[fx + 1] ?? 0) !== 0) paint(grid, fx + 1, fy, TRIM_INDEX);
  if ((grid[fy + 1]?.[fx] ?? 0) !== 0) paint(grid, fx, fy + 1, ACCENT_INDEX);
  if ((grid[fy + 1]?.[fx + 1] ?? 0) !== 0) paint(grid, fx + 1, fy + 1, ACCENT_INDEX);
}

function mini44(art: number[][]): number[][] {
  const out: number[][] = [];
  for (let by = 0; by < 4; by++) {
    const row: number[] = [];
    for (let bx = 0; bx < 4; bx++) {
      const freq = new Map<number, number>();
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const v = art[by * 2 + dy]?.[bx * 2 + dx] ?? 0;
          if (v !== 0) freq.set(v, (freq.get(v) ?? 0) + 1);
        }
      }
      let best = 0;
      let bestCount = 0;
      for (const [v, count] of freq) {
        if (count > bestCount) {
          best = v;
          bestCount = count;
        }
      }
      row.push(best);
    }
    out.push(row);
  }
  return out;
}

function paintBrooch(
  grid: SpriteGrid,
  item: PixelItemAsset,
  neck: { x: number; y: number },
  chest: { x: number; y: number },
  swingX = 0,
): void {
  const cx = clamp(chest.x + swingX, 0, GRID_W - 1);
  paintCollarSupport(grid, neck);
  paintSupportStrand(grid, neck, cx, chest.y - 2);
  const mini = mini44(item.pixels);
  const ox = clamp(chest.x - 2 + swingX, 0, GRID_W - 4);
  const oy = clamp(chest.y - 2, 0, GRID_H - 4);
  blitRaw(grid, mini, ox, oy);
}

function paintOrbPendant(
  grid: SpriteGrid,
  item: PixelItemAsset,
  neck: { x: number; y: number },
  chest: { x: number; y: number },
  swingX = 0,
): void {
  const cx = clamp(chest.x + swingX, 0, GRID_W - 1);
  paintCollarSupport(grid, neck);
  paintSupportStrand(grid, neck, cx, chest.y - 2);
  const mini = mini44(item.pixels);
  const ox = clamp(chest.x - 2 + swingX, 0, GRID_W - 4);
  const oy = clamp(chest.y - 2, 0, GRID_H - 4);
  blitRaw(grid, mini, ox, oy);
}

// After-image of the weapon along the swing arc. Strictly additive: it only
// ever writes into empty cells, so it can never open a gap in the body. The
// arm itself may only travel 1px before it detaches from the shoulder, so the
// trail is what sells the thrust. `before` is the pre-weapon snapshot, which
// keeps the ghost limited to the weapon instead of the whole kit.
function paintSwingTrail(grid: SpriteGrid, before: SpriteGrid, steps: number): void {
  const h = grid.length;
  const w = grid[0].length;
  const isWeapon = (v: number): boolean =>
    v === TRIM_INDEX || v === ACCENT_INDEX || (v >= ITEM_BLIT_OFFSET && v < ITEM_BLIT_OFFSET + 10);
  const cells: Array<[number, number, number]> = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y][x] === before[y][x]) continue;
      if (isWeapon(grid[y][x])) cells.push([x, y, grid[y][x]]);
    }
  }
  for (let step = 1; step <= steps; step++) {
    for (const [x, y, v] of cells) {
      // Trail sweeps up-and-back into the empty air above the shoulder; the
      // down-back direction is inside the body silhouette and never shows.
      const tx = x - step;
      const ty = y - step;
      if (tx < 0 || ty < 0 || ty >= h || tx >= w) continue;
      if (grid[ty][tx] !== 0) continue;
      grid[ty][tx] = v;
    }
  }
}

const WEAPON_CELLS = new Set<number>([
  TRIM_INDEX, TRIM_DARK, TRIM_LIGHT,
  ACCENT_INDEX, ACCENT_DARK,
  BLADE_INDEX, BLADE_DARK, BLADE_LIGHT,
  WOOD_INDEX, WOOD_DARK, WOOD_LIGHT,
  WHEAD_INDEX, WHEAD_DARK, WHEAD_LIGHT,
  STRING_INDEX,
]);

/** Peau nue (base, ombre, lumière) : les seules cellules qui recouvrent l'arme. */
const SKIN_CELLS = new Set<number>([1, shadeIndexOf(1), highlightIndexOf(1)]);

function clipWeaponFromHead(grid: SpriteGrid, before: SpriteGrid, head: Box): void {
  const y0 = Math.max(0, head.y0);
  const y1 = Math.min(grid.length - 1, head.y1);
  for (let y = y0; y <= y1; y++) {
    const row = grid[y];
    const w = row?.length ?? 0;
    const x0 = Math.max(0, head.x0);
    const x1 = Math.min(w - 1, head.x1);
    for (let x = x0; x <= x1; x++) {
      // Restore only pixels that were actually occupied by the body. The old
      // pass restored the whole head bounding box, including empty air, which
      // sliced rectangular notches out of maces and axes raised beside the
      // head. Empty cells inside the box are background: the weapon may pass
      // there without covering the face.
      if (WEAPON_CELLS.has(row[x]) && before[y][x] !== 0) row[x] = before[y][x];
    }
  }
}

// Le poing se referme sur la poignée. La poignée tourne autour de la paume :
// son extrémité basse sortait du poing et repeignait l'avant-bras en brun, et
// la garde traversait le dos de la main. C'était le « l'arme se mélange avec
// le personnage ». On restaure donc la peau de la main (peau, ombre, lumière
// — le gantelet/bracelet est restauré tel quel depuis `before`) sur tout pixel
// d'arme posé dessus, dans une boîte qui couvre le poing dans toutes les
// postures (mesurée : au pire -4..+1 en x, -4..+3 en y autour de la paume).
// La manche, elle, reste derrière l'arme : une lame au-dessus du poing ne
// perd pas de longueur, et le manche dépasse sous le poing (HANDLE_BOTTOM).
const FIST_RESTORE_X = 4;
const FIST_RESTORE_UP = 4;
const FIST_RESTORE_DOWN = 3;

function restoreFistOverWeapon(
  grid: SpriteGrid,
  before: SpriteGrid,
  skin: boolean[][],
  palm: { x: number; y: number },
): void {
  const y0 = Math.max(0, palm.y - FIST_RESTORE_UP);
  const y1 = Math.min(grid.length - 1, palm.y + FIST_RESTORE_DOWN);
  for (let y = y0; y <= y1; y++) {
    const row = grid[y];
    const w = row?.length ?? 0;
    const x0 = Math.max(0, palm.x - FIST_RESTORE_X);
    const x1 = Math.min(w - 1, palm.x + FIST_RESTORE_X);
    for (let x = x0; x <= x1; x++) {
      if (!skin[y]?.[x]) continue;
      if (WEAPON_CELLS.has(row[x])) row[x] = before[y][x];
    }
  }
}

// Un contour d'un pixel autour de l'arme découpe sa silhouette sur le fond.
// Il n'est écrit que dans le vide : poser un liseré sombre sur le corps ferait
// croire que l'arme est devant alors que la boîte du poing vient justement de
// la passer derrière la main.
function outlineWeapon(grid: SpriteGrid): void {
  const h = grid.length;
  const w = grid[0].length;
  const snapshot = grid.map((row) => [...row]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!WEAPON_CELLS.has(snapshot[y][x])) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (snapshot[ny][nx] === 0) grid[ny][nx] = WEAPON_OUTLINE_INDEX;
      }
    }
  }
}

export function applyEquipmentOverlays(
  grid: SpriteGrid,
  palette: SpritePalette,
  loadout: ResolvedLoadout,
  opts?: OverlayOptions,
): { grid: SpriteGrid; palette: SpritePalette } {
  const out = grid.map((row) => [...row]);
  const equipped = [loadout.weapon, loadout.armor, loadout.accessory].filter(
    (i): i is PixelItemAsset => i !== null,
  );
  if (equipped.length === 0) return { grid: out, palette };
  const top = equipped.reduce((a, b) => (RARITY_RANK[b.rarity] > RARITY_RANK[a.rarity] ? b : a));
  const trim = RARITY_TRIM[top.rarity];
  const accent = top.element ? ELEMENT_COLORS[top.element] : trim;
  const armorKind = loadout.armor ? armorVisualKind(loadout.armor.name) : null;
  const accessoryKind = loadout.accessory ? accessoryVisualKind(loadout.accessory.name) : null;
  const tintSource =
    loadout.accessory && accessoryKind === 'boots'
      ? loadout.accessory
      : loadout.armor && armorKind === 'boots'
        ? loadout.armor
        : null;
  const tint2Source =
    loadout.armor && (armorKind === 'bracers' || armorKind === 'robe') ? loadout.armor : null;
  const tintHex = tintSource
    ? hexOfArtValue(dominantArtValue(tintSource.pixels), trim)
    : trim;
  const tint2Hex = tint2Source
    ? hexOfArtValue(dominantArtValue(tint2Source.pixels), trim)
    : trim;
  const bladeBase = loadout.weapon ? bladeHexOf(loadout.weapon.pixels) : trim;
  const bladeElement = loadout.weapon?.element ? ELEMENT_COLORS[loadout.weapon.element] : null;
  const bladeHex = bladeElement ? mixHex(bladeBase, bladeElement, 0.3) : bladeBase;
  const woodHex = loadout.weapon ? woodHexOf(loadout.weapon.pixels) : DEFAULT_WOOD;
  const wheadHex = loadout.weapon ? headTopHexOf(loadout.weapon.pixels, bladeHex) : bladeHex;
  const fieldSource =
    loadout.armor && (armorKind === 'shield' || armorKind === 'chest' || armorKind === 'robe' || armorKind === 'helm')
      ? loadout.armor
      : null;
  const fieldHex = fieldSource
    ? hexOfArtValue(dominantArtValue(fieldSource.pixels), PLATE_STEEL)
    : PLATE_STEEL;
  let rimHex: string | null = null;
  if (fieldSource && armorKind === 'helm') {
    const freq = freqOf(fieldSource.pixels, 0, fieldSource.pixels.length - 1);
    const fieldVal = dominantArtValue(fieldSource.pixels);
    freq.delete(fieldVal ?? -1);
    freq.delete(0);
    const second = topOf(freq);
    if (second !== null) rimHex = ITEM_PALETTE[second] ?? null;
  }
  const next: SpritePalette = {
    ...palette,
    [TRIM_INDEX]: trim,
    [ACCENT_INDEX]: accent,
    [PLATE_INDEX]: PLATE_STEEL,
    [TINT_INDEX]: tintHex,
    [TINT2_INDEX]: tint2Hex,
    [BLADE_INDEX]: bladeHex,
    [WOOD_INDEX]: woodHex,
    [WHEAD_INDEX]: wheadHex,
    [FIELD_INDEX]: fieldHex,
    [FIELD_LIGHT]: highlightHex(fieldHex),
    [STRING_INDEX]: '#e8edf2',
    [RIM_INDEX]: rimHex ?? trim,
    [RIM_DARK]: mixHex(rimHex ?? trim, OUTLINE_HEX, 0.5),
    [TRIM_DARK]: mixHex(trim, OUTLINE_HEX, 0.5),
    [ACCENT_DARK]: mixHex(accent, OUTLINE_HEX, 0.5),
    [PLATE_DARK]: mixHex(PLATE_STEEL, OUTLINE_HEX, 0.5),
    [PLATE_LIGHT]: highlightHex(PLATE_STEEL),
    [TINT_DARK]: mixHex(tintHex, OUTLINE_HEX, 0.5),
    [TINT2_DARK]: mixHex(tint2Hex, OUTLINE_HEX, 0.5),
    [BLADE_DARK]: mixHex(bladeHex, OUTLINE_HEX, 0.5),
    [BLADE_LIGHT]: highlightHex(bladeHex),
    [WOOD_LIGHT]: highlightHex(woodHex),
    [WOOD_DARK]: mixHex(woodHex, OUTLINE_HEX, 0.5),
    [WHEAD_DARK]: mixHex(wheadHex, OUTLINE_HEX, 0.5),
    [WHEAD_LIGHT]: highlightHex(wheadHex),
    [FIELD_DARK]: mixHex(fieldHex, OUTLINE_HEX, 0.5),
    [TRIM_LIGHT]: highlightHex(trim),
    [TINT_LIGHT]: highlightHex(tintHex),
    [TINT2_LIGHT]: highlightHex(tint2Hex),
    [WEAPON_OUTLINE_INDEX]: OUTLINE_HEX,
  };
  for (const key of Object.keys(ITEM_PALETTE).map(Number)) {
    if (key === 0) continue;
    next[ITEM_BLIT_OFFSET + key] = ITEM_PALETTE[key];
  }
  const marks = computeLandmarks(out);
  const bootsItem =
    (loadout.accessory && accessoryKind === 'boots' ? loadout.accessory : null) ??
    (loadout.armor && armorKind === 'boots' ? loadout.armor : null);
  if (bootsItem) paintBoots(out);
  if (loadout.armor && armorKind === 'bracers') paintBracers(out);
  if (loadout.armor && (armorKind === 'chest' || armorKind === 'robe')) {
    paintChest(out, marks.torso, marks.faceCx);
  }
  if (loadout.armor && armorKind === 'helm') {
    paintHelm(out, marks.head, marks.faceCx, marks.eyeY, rimHex !== null ? RIM_INDEX : TRIM_INDEX);
  }
  if (loadout.accessory && accessoryKind === 'crown') {
    stampHeadgear(out, loadout.accessory, marks.head, marks.faceCx);
  }
  if (loadout.accessory && accessoryKind === 'brooch') {
    paintBrooch(out, loadout.accessory, marks.neck, marks.chest, opts?.swingX ?? 0);
  }
  if (loadout.accessory && accessoryKind === 'necklace') {
    paintNecklace(out, loadout.accessory, marks.neck, marks.chest, opts?.swingX ?? 0);
  }
  if (loadout.armor && armorKind === 'shield') {
    // Shield first, then the arm on top: the limb crossing the shield face is
    // what makes the grip read as a grip instead of a prop sliding around.
    paintShield(out, marks.palmL);
    paintShieldArm(out, marks.palmL);
  }
  if (loadout.accessory && accessoryKind === 'orb') {
    paintOrbPendant(out, loadout.accessory, marks.neck, marks.chest, opts?.swingX ?? 0);
  }
  // Tint armour and accessories before stamping the weapon. The old generic
  // edge pass turned every stair-step on a diagonal blade into a light or dark
  // cell, producing a wavy "rubber band" highlight along the weapon. Weapon
  // painters shade themselves explicitly below.
  tintOverlayEdges(out);
  if (loadout.weapon) {
    const trailSteps = opts?.punchTrail ?? 0;
    const weaponAngle = opts?.weaponAngle ?? WEAPON_REST_ANGLE;
    const preWeapon = out.map((row) => [...row]);
    paintHeldWeapon(out, loadout.weapon, marks.palmR, opts?.swayX ?? 0, weaponAngle);
    if (trailSteps > 0) paintSwingTrail(out, preWeapon, trailSteps);
    clipWeaponFromHead(out, preWeapon, marks.head);
    // Les knuckles sont portés PAR le poing : restaurer la main effacerait
    // l'arme elle-même. Toutes les autres familles passent sous la main.
    if (weaponVisualKind(loadout.weapon) !== 'fist') {
      const skin = grid.map((row) => row.map((v) => SKIN_CELLS.has(v)));
      restoreFistOverWeapon(out, preWeapon, skin, marks.palmR);
    }
    outlineWeapon(out);
  }
  if (loadout.accessory && accessoryKind === 'ring') paintRing(out, marks.palmR);
  return { grid: out, palette: next };
}

function tintOverlayEdges(grid: SpriteGrid): void {
  const darkOf: Record<number, number> = {
    [TRIM_INDEX]: TRIM_DARK,
    [PLATE_INDEX]: PLATE_DARK,
    [TINT_INDEX]: TINT_DARK,
    [TINT2_INDEX]: TINT2_DARK,
    [BLADE_INDEX]: BLADE_DARK,
    [WHEAD_INDEX]: WHEAD_DARK,
    [FIELD_INDEX]: FIELD_DARK,
    [RIM_INDEX]: RIM_DARK,
    [WOOD_INDEX]: WOOD_DARK,
  };
  const lightOf: Record<number, number> = {
    [BLADE_INDEX]: BLADE_LIGHT,
    [WOOD_INDEX]: WOOD_LIGHT,
    [WHEAD_INDEX]: WHEAD_LIGHT,
    [TRIM_INDEX]: TRIM_LIGHT,
    [FIELD_INDEX]: FIELD_LIGHT,
    [TINT_INDEX]: TINT_LIGHT,
    [TINT2_INDEX]: TINT2_LIGHT,
  };
  const at = (x: number, y: number): number => grid[y]?.[x] ?? 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const v = grid[y][x];
      const light = lightOf[v];
      if (light !== undefined && at(x, y - 1) === 0) {
        grid[y][x] = light;
        continue;
      }
      const dark = darkOf[v];
      if (dark === undefined) continue;
      const edge =
        at(x, y - 1) === 0 || at(x, y + 1) === 0 ||
        at(x - 1, y) === 0 || at(x + 1, y) === 0;
      if (edge) grid[y][x] = dark;
    }
  }
}
