import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';
import { ELEMENT_COLORS, ItemRarity, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, SpriteGrid, SpritePalette, TRIM_INDEX, highlightIndexOf, shadeIndexOf } from './spriteTypes';
import { RARITY_TRIM } from './spritePalettes';

export const PLATE_INDEX = 62;
export const PLATE_STEEL = '#a8b4c0';

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

function paint(grid: SpriteGrid, x: number, y: number, v: number): void {
  if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return;
  grid[y][x] = v;
}

function findSideHand(grid: SpriteGrid, side: 'left' | 'right'): { x: number; y: number } | null {
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
  return best;
}

function blitArt(grid: SpriteGrid, art: number[][], ox: number, oy: number, scale: number): void {
  for (let y = 0; y < art.length; y++) {
    for (let x = 0; x < art[y].length; x++) {
      const cell = art[y][x];
      if (!cell) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          paint(grid, ox + x * scale + dx, oy + y * scale + dy, ITEM_BLIT_OFFSET + cell);
        }
      }
    }
  }
}

function paintWeapon(grid: SpriteGrid, item: PixelItemAsset): void {
  const hand = findSideHand(grid, 'right') ?? { x: 17, y: 27 };
  const art = item.pixels;
  const w = art[0]?.length ?? 8;
  const h = art.length;
  blitArt(grid, art, hand.x - w + 1, hand.y - h * 2 + 4, 2);
}

function paintShield(grid: SpriteGrid, item: PixelItemAsset): void {
  const hand = findSideHand(grid, 'left') ?? { x: 6, y: 27 };
  const art = item.pixels;
  const w = art[0]?.length ?? 8;
  blitArt(grid, art, hand.x - w + 1, hand.y - art.length * 2 + 4, 2);
}

function paintChestplate(grid: SpriteGrid): void {
  for (let y = 20; y <= 29; y++) {
    for (let x = 6; x <= 17; x++) {
      const cell = grid[y][x];
      if (cell !== 5 && cell !== shadeIndexOf(5)) continue;
      const edge =
        x === 6 || x === 17 ||
        grid[y - 1]?.[x] === 0 || grid[y + 1]?.[x] === 0 ||
        grid[y][x - 1] === 0 || grid[y][x + 1] === 0;
      grid[y][x] = edge ? TRIM_INDEX : PLATE_INDEX;
    }
  }
  paint(grid, 11, 23, ACCENT_INDEX);
  paint(grid, 12, 23, ACCENT_INDEX);
  paint(grid, 11, 24, ACCENT_INDEX);
  paint(grid, 12, 24, ACCENT_INDEX);
}

function paintHeadgear(grid: SpriteGrid): void {
  for (let y = 2; y <= 9; y++) {
    for (let x = 0; x < 24; x++) {
      const cell = grid[y][x];
      if (cell !== 4 && cell !== shadeIndexOf(4) && cell !== highlightIndexOf(4)) continue;
      grid[y][x] = y <= 4 ? TRIM_INDEX : PLATE_INDEX;
    }
  }
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

function paintNeckGem(grid: SpriteGrid, gem: number): void {
  paint(grid, 11, 18, gem);
  paint(grid, 12, 18, gem);
  paint(grid, 11, 19, gem);
  paint(grid, 12, 19, gem);
}

function paintBrooch(grid: SpriteGrid): void {
  if (grid[22][12] !== ACCENT_INDEX) paint(grid, 12, 22, TRIM_INDEX);
  if (grid[22][11] !== ACCENT_INDEX) paint(grid, 11, 22, TRIM_INDEX);
}

function paintFloatingOrb(grid: SpriteGrid, item: PixelItemAsset): void {
  blitArt(grid, item.pixels, 17, 6, 1);
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
  const next: SpritePalette = {
    ...palette,
    [TRIM_INDEX]: RARITY_TRIM[top.rarity],
    [ACCENT_INDEX]: top.element ? ELEMENT_COLORS[top.element] : RARITY_TRIM[top.rarity],
    [PLATE_INDEX]: PLATE_STEEL,
  };
  for (const key of Object.keys(ITEM_PALETTE).map(Number)) {
    if (key === 0) continue;
    next[ITEM_BLIT_OFFSET + key] = ITEM_PALETTE[key];
  }
  if (loadout.weapon) paintWeapon(out, loadout.weapon);
  if (loadout.armor) {
    const kind = armorKind(loadout.armor.name);
    if (kind === 'helm') paintHeadgear(out);
    else if (kind === 'boots') paintBoots(out);
    else if (kind === 'shield') paintShield(out, loadout.armor);
    else if (kind === 'arms') paintArmbands(out);
    else paintChestplate(out);
  }
  if (loadout.accessory) {
    const kind = accessoryKind(loadout.accessory.name);
    if (kind === 'head') paintHeadgear(out);
    else if (kind === 'boots') paintBoots(out);
    else if (kind === 'neck') paintNeckGem(out, ACCENT_INDEX);
    else if (kind === 'orb') paintFloatingOrb(out, loadout.accessory);
    else paintBrooch(out);
  }
  return { grid: out, palette: next };
}
