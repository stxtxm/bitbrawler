import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';
import { ELEMENT_COLORS, ItemRarity, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, SpriteGrid, SpritePalette, TRIM_INDEX, highlightIndexOf, shadeIndexOf } from './spriteTypes';
import { OUTLINE_HEX, RARITY_TRIM, highlightHex, mixHex } from './spritePalettes';

export const PLATE_INDEX = 62;
export const PLATE_STEEL = '#a8b4c0';
export const TRIM_DARK = 90;
export const ACCENT_DARK = 91;
export const PLATE_DARK = 92;
export const PLATE_LIGHT = 102;

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

function extremeHand(grid: SpriteGrid, side: 'left' | 'right'): { x: number; y: number } {
  let best: { x: number; y: number } | null = null;
  for (let y = 24; y <= 31; y++) {
    const row = grid[y];
    if (!row) continue;
    if (side === 'right') {
      for (let x = row.length - 1; x >= 0; x--) {
        if (row[x] !== 0) {
          if (!best || x > best.x) best = { x, y };
          break;
        }
      }
    } else {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 0) {
          if (!best || x < best.x) best = { x, y };
          break;
        }
      }
    }
  }
  return best ?? (side === 'right' ? { x: 17, y: 27 } : { x: 6, y: 27 });
}

export function computeLandmarks(grid: SpriteGrid): BodyLandmarks {
  return {
    head: boxOf(grid, 0, 17),
    torso: boxOf(grid, 18, 33),
    handR: extremeHand(grid, 'right'),
    handL: extremeHand(grid, 'left'),
  };
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

function artGrip(art: number[][]): { x: number; y: number } {
  let y = art.length - 1;
  while (y > 0 && !art[y].some((c) => c !== 0)) y--;
  let min = 99;
  let max = -1;
  art[y].forEach((c, x) => {
    if (c !== 0) {
      if (x < min) min = x;
      if (x > max) max = x;
    }
  });
  return { x: Math.floor((min + max) / 2), y };
}

function weaponStyle(name: string): 'blade' | 'pole' {
  const n = name.toLowerCase();
  if (n.includes('bow') || n.includes('staff') || n.includes('wand') || n.includes('spear') || n.includes('lance') || n.includes('hammer') || n.includes('mace') || n.includes('orb') || n.includes('scepter')) return 'pole';
  return 'blade';
}

function paint(grid: SpriteGrid, x: number, y: number, v: number): void {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = v;
}

function paintBlade(grid: SpriteGrid, item: PixelItemAsset, hand: { x: number; y: number }): void {
  const grip = artGrip(item.pixels);
  for (const { x, y, v } of artCells(item.pixels)) {
    const dx = x - grip.x;
    const dy = y - grip.y;
    const rx = Math.round((dx - dy) / Math.SQRT2);
    const ry = Math.round((dx + dy) / Math.SQRT2);
    paint(grid, hand.x + rx, hand.y + ry, ITEM_BLIT_OFFSET + v);
  }
}

function paintPole(grid: SpriteGrid, item: PixelItemAsset, hand: { x: number; y: number }): void {
  const grip = artGrip(item.pixels);
  for (const { x, y, v } of artCells(item.pixels)) {
    paint(grid, hand.x + (x - grip.x), hand.y + (y - grip.y), ITEM_BLIT_OFFSET + v);
  }
}

function paintShield(grid: SpriteGrid, item: PixelItemAsset, hand: { x: number; y: number }): void {
  const cells = artCells(item.pixels);
  if (cells.length === 0) return;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const { x, y, v } of cells) {
    const sx = Math.round((x - cx) * 2 + hand.x);
    const sy = Math.round((y - cy) * 2 + hand.y);
    paint(grid, sx, sy, ITEM_BLIT_OFFSET + v);
  }
  paint(grid, hand.x, hand.y, ACCENT_INDEX);
}

function paintChestplate(grid: SpriteGrid, torso: Box): void {
  const y0 = Math.max(20, torso.y0);
  const y1 = Math.min(29, torso.y1);
  const cx = Math.round((torso.x0 + torso.x1) / 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = torso.x0; x <= torso.x1; x++) {
      const cell = grid[y]?.[x] ?? 0;
      if (cell !== 5 && cell !== shadeIndexOf(5)) continue;
      const edge =
        grid[y - 1]?.[x] === 0 || grid[y + 1]?.[x] === 0 ||
        grid[y][x - 1] === 0 || grid[y][x + 1] === 0;
      if (edge) {
        grid[y][x] = TRIM_INDEX;
      } else if (x === cx - 1 || x === cx) {
        grid[y][x] = PLATE_LIGHT;
      } else if ((x + y) % 2 === 0) {
        grid[y][x] = PLATE_DARK;
      } else {
        grid[y][x] = PLATE_INDEX;
      }
    }
  }
  const gy = Math.min(24, y1);
  paint(grid, cx - 1, gy - 1, ACCENT_INDEX);
  paint(grid, cx, gy - 1, ACCENT_INDEX);
  paint(grid, cx - 1, gy, ACCENT_INDEX);
  paint(grid, cx, gy, ACCENT_INDEX);
}

function paintHeadgear(grid: SpriteGrid, head: Box): void {
  const bandY = head.y0 + 4;
  const cx = Math.round((head.x0 + head.x1) / 2);
  for (let y = head.y0; y <= Math.min(9, head.y1); y++) {
    for (let x = head.x0; x <= head.x1; x++) {
      const cell = grid[y]?.[x] ?? 0;
      if (cell !== 4 && cell !== shadeIndexOf(4) && cell !== highlightIndexOf(4)) continue;
      grid[y][x] = y <= bandY ? TRIM_INDEX : PLATE_INDEX;
    }
  }
  paint(grid, cx - 1, head.y0 + 1, ACCENT_INDEX);
  paint(grid, cx, head.y0 + 1, ACCENT_INDEX);
}

function paintBoots(grid: SpriteGrid): void {
  for (const y of [34, 35]) {
    for (let x = 0; x < 24; x++) {
      if (grid[y][x] !== 0) grid[y][x] = TRIM_INDEX;
    }
  }
}

function paintArmbands(grid: SpriteGrid): void {
  for (let y = 24; y <= 29; y++) {
    const row = grid[y];
    if (!row) continue;
    const left = row.findIndex((c) => c !== 0);
    if (left >= 0) row[left] = TRIM_INDEX;
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] !== 0) {
        row[x] = TRIM_INDEX;
        break;
      }
    }
  }
}

function paintNeckGem(grid: SpriteGrid, gem: number, torso: Box): void {
  const cx = Math.round((torso.x0 + torso.x1) / 2);
  const ny = Math.max(20, torso.y0);
  paint(grid, cx - 1, ny, TRIM_INDEX);
  paint(grid, cx, ny, TRIM_INDEX);
  paint(grid, cx - 1, ny + 1, TRIM_INDEX);
  paint(grid, cx, ny + 1, TRIM_INDEX);
  paint(grid, cx - 1, ny + 2, gem);
  paint(grid, cx, ny + 2, gem);
  paint(grid, cx - 1, ny + 3, gem);
  paint(grid, cx, ny + 3, gem);
}

function paintBrooch(grid: SpriteGrid, torso: Box): void {
  const cx = Math.round((torso.x0 + torso.x1) / 2);
  const y = Math.min(22, torso.y1);
  if (grid[y]?.[cx] !== ACCENT_INDEX) paint(grid, cx, y, TRIM_INDEX);
  if (grid[y]?.[cx - 1] !== ACCENT_INDEX) paint(grid, cx - 1, y, TRIM_INDEX);
}

function paintFloatingOrb(grid: SpriteGrid, item: PixelItemAsset, head: Box): void {
  const cells = artCells(item.pixels);
  if (cells.length === 0) return;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const ox = head.x1 + 1 - Math.min(...xs);
  const oy = head.y0 + 1 - Math.min(...ys);
  let top: { x: number; y: number } | null = null;
  for (const { x, y, v } of cells) {
    const px = ox + x;
    const py = oy + y;
    paint(grid, px, py, ITEM_BLIT_OFFSET + v);
    if (!top || py < top.y) top = { x: px, y: py };
  }
  if (top) paint(grid, top.x, top.y - 1, ACCENT_INDEX);
}

function armorKind(name: string): 'helm' | 'boots' | 'shield' | 'arms' | 'chest' {
  const n = name.toLowerCase();
  if (n.includes('helm') || n.includes('crown') || n.includes('hood') || n.includes('mask')) return 'helm';
  if (n.includes('boot') || n.includes('shoe')) return 'boots';
  if (n.includes('shield')) return 'shield';
  if (n.includes('bracer') || n.includes('gauntlet') || n.includes('wrap') || n.includes('glove')) return 'arms';
  return 'chest';
}

function accessoryKind(name: string): 'head' | 'boots' | 'neck' | 'brooch' | 'orb' {
  const n = name.toLowerCase();
  if (n.includes('crown') || n.includes('helm') || n.includes('hood') || n.includes('mask')) return 'head';
  if (n.includes('boot')) return 'boots';
  if (n.includes('pendant') || n.includes('amulet') || n.includes('talisman') || n.includes('charm') || n.includes('medal') || n.includes('necklace')) return 'neck';
  if (n.includes('orb')) return 'orb';
  return 'brooch';
}

export function applyEquipmentOverlays(
  grid: SpriteGrid,
  palette: SpritePalette,
  loadout: ResolvedLoadout,
): { grid: SpriteGrid; palette: SpritePalette } {
  const out = grid.map((row) => [...row]);
  const equipped = [loadout.weapon, loadout.armor, loadout.accessory].filter(
    (i): i is PixelItemAsset => i !== null,
  );
  if (equipped.length === 0) return { grid: out, palette };
  const top = equipped.reduce((a, b) => (RARITY_RANK[b.rarity] > RARITY_RANK[a.rarity] ? b : a));
  const trim = RARITY_TRIM[top.rarity];
  const accent = top.element ? ELEMENT_COLORS[top.element] : trim;
  const next: SpritePalette = {
    ...palette,
    [TRIM_INDEX]: trim,
    [ACCENT_INDEX]: accent,
    [PLATE_INDEX]: PLATE_STEEL,
    [TRIM_DARK]: mixHex(trim, OUTLINE_HEX, 0.5),
    [ACCENT_DARK]: mixHex(accent, OUTLINE_HEX, 0.5),
    [PLATE_DARK]: mixHex(PLATE_STEEL, OUTLINE_HEX, 0.5),
    [PLATE_LIGHT]: highlightHex(PLATE_STEEL),
  };
  for (const key of Object.keys(ITEM_PALETTE).map(Number)) {
    if (key === 0) continue;
    next[ITEM_BLIT_OFFSET + key] = ITEM_PALETTE[key];
  }
  const marks = computeLandmarks(out);
  let boots = false;
  if (loadout.weapon) {
    if (weaponStyle(loadout.weapon.name) === 'blade') paintBlade(out, loadout.weapon, marks.handR);
    else paintPole(out, loadout.weapon, marks.handR);
  }
  if (loadout.armor) {
    const kind = armorKind(loadout.armor.name);
    if (kind === 'helm') paintHeadgear(out, marks.head);
    else if (kind === 'boots') boots = true;
    else if (kind === 'shield') paintShield(out, loadout.armor, marks.handL);
    else if (kind === 'arms') paintArmbands(out);
    else paintChestplate(out, marks.torso);
  }
  if (loadout.accessory) {
    const kind = accessoryKind(loadout.accessory.name);
    if (kind === 'head') paintHeadgear(out, marks.head);
    else if (kind === 'boots') boots = true;
    else if (kind === 'neck') paintNeckGem(out, ACCENT_INDEX, marks.torso);
    else if (kind === 'orb') paintFloatingOrb(out, loadout.accessory, marks.head);
    else paintBrooch(out, marks.torso);
  }
  tintOverlayEdges(out);
  if (boots) paintBoots(out);
  return { grid: out, palette: next };
}

function tintOverlayEdges(grid: SpriteGrid): void {
  const darkOf: Record<number, number> = {
    [TRIM_INDEX]: TRIM_DARK,
    [PLATE_INDEX]: PLATE_DARK,
  };
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const dark = darkOf[grid[y][x]];
      if (dark === undefined) continue;
      const edge =
        grid[y - 1]?.[x] === 0 || grid[y + 1]?.[x] === 0 ||
        grid[y][x - 1] === 0 || grid[y][x + 1] === 0;
      if (edge) grid[y][x] = dark;
    }
  }
}
