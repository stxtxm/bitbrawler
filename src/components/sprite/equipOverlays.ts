import { ITEM_ASSETS, ITEM_PALETTE } from '../../data/itemAssets';
import { ELEMENT_COLORS, ItemRarity, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { ACCENT_INDEX, ITEM_BLIT_OFFSET, SpriteGrid, SpritePalette, TRIM_INDEX } from './spriteTypes';
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

function findHand(grid: SpriteGrid): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  for (let y = 24; y <= 31; y++) {
    const row = grid[y];
    if (!row) continue;
    for (let x = row.length - 1; x >= 0; x--) {
      if (row[x] !== 0) {
        if (!best || x > best.x) best = { x, y };
        break;
      }
    }
  }
  return best;
}

function blitWeapon(grid: SpriteGrid, item: PixelItemAsset): void {
  const hand = findHand(grid) ?? { x: 17, y: 27 };
  const art = item.pixels;
  const oy = hand.y - art.length + 2;
  const ox = hand.x - Math.floor((art[0]?.length ?? 8) / 2);
  for (let y = 0; y < art.length; y++) {
    for (let x = 0; x < art[y].length; x++) {
      const cell = art[y][x];
      if (!cell) continue;
      paint(grid, ox + x, oy + y, ITEM_BLIT_OFFSET + cell);
    }
  }
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
  for (const key of Object.keys(ITEM_PALETTE).map(Number)) {
    if (key === 0) continue;
    next[ITEM_BLIT_OFFSET + key] = ITEM_PALETTE[key];
  }
  if (loadout.weapon) blitWeapon(out, loadout.weapon);
  if (loadout.armor) paintArmor(out);
  if (loadout.accessory) paintAccessory(out);
  return { grid: out, palette: next };
}
