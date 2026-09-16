import { ITEM_ASSETS } from '../../data/itemAssets';
import { ELEMENT_COLORS, ItemRarity, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { ACCENT_INDEX, SpriteGrid, SpritePalette, TRIM_INDEX } from './spriteTypes';
import { RARITY_TRIM } from './spritePalettes';

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

function paintWeapon(grid: SpriteGrid): void {
  for (let y = 18; y <= 32; y++) {
    paint(grid, 20, y, 9);
    paint(grid, 21, y, 9);
  }
  for (let y = 18; y <= 20; y++) {
    paint(grid, 19, y, TRIM_INDEX);
    paint(grid, 22, y, TRIM_INDEX);
  }
  paint(grid, 20, 17, TRIM_INDEX);
  paint(grid, 21, 17, TRIM_INDEX);
  paint(grid, 20, 33, ACCENT_INDEX);
  paint(grid, 21, 33, ACCENT_INDEX);
}

function paintArmor(grid: SpriteGrid): void {
  for (let y = 20; y <= 28; y++) {
    paint(grid, 6, y, TRIM_INDEX);
    paint(grid, 17, y, TRIM_INDEX);
  }
  for (let x = 10; x <= 13; x++) {
    for (let y = 23; y <= 25; y++) {
      paint(grid, x, y, 9);
    }
  }
  paint(grid, 11, 22, ACCENT_INDEX);
  paint(grid, 12, 22, ACCENT_INDEX);
}

function paintAccessory(grid: SpriteGrid): void {
  for (let x = 7; x <= 16; x++) {
    if (grid[6][x] !== 0) paint(grid, x, 6, TRIM_INDEX);
  }
  paint(grid, 11, 4, ACCENT_INDEX);
  paint(grid, 12, 4, ACCENT_INDEX);
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
  };
  if (loadout.weapon) paintWeapon(out);
  if (loadout.armor) paintArmor(out);
  if (loadout.accessory) paintAccessory(out);
  return { grid: out, palette: next };
}
