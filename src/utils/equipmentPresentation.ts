import type { ItemRarity, ItemSlot, ItemStats, PixelItemAsset } from '../types/Item';

export const ITEM_PIXEL_GRID_SIZE = 8;

export const EQUIPMENT_SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory'];

export type EquipmentStatKey = keyof ItemStats;

export const EQUIPMENT_STAT_ORDER: EquipmentStatKey[] = [
  'strength',
  'vitality',
  'dexterity',
  'luck',
  'intelligence',
  'focus',
  'hp',
];

export const RARITY_FRAME_CLASS: Record<ItemRarity, string> = {
  common: 'rarity-common',
  uncommon: 'rarity-uncommon',
  rare: 'rarity-rare',
  epic: 'rarity-epic',
  legendary: 'rarity-legendary',
};

export function getRarityFrameClass(rarity: ItemRarity): string {
  return RARITY_FRAME_CLASS[rarity];
}

export function getIntegerIconScale(size: number): number {
  if (!Number.isFinite(size)) return 1;
  return Math.max(1, Math.round(size / ITEM_PIXEL_GRID_SIZE));
}

export function getIconRenderSize(size: number): number {
  return getIntegerIconScale(size) * ITEM_PIXEL_GRID_SIZE;
}

export function getEquippedItemForSlot(
  equippedItems: PixelItemAsset[],
  slot: ItemSlot,
): PixelItemAsset | null {
  return equippedItems.find((item) => item.slot === slot) ?? null;
}

export interface StatComparisonEntry {
  key: EquipmentStatKey;
  preview: number;
  equipped: number;
  delta: number;
}

export function buildEquipmentComparison(
  previewItem: PixelItemAsset | null,
  equippedItem: PixelItemAsset | null,
): StatComparisonEntry[] {
  if (!previewItem || !equippedItem) return [];

  return EQUIPMENT_STAT_ORDER.flatMap((key) => {
    const preview = previewItem.stats[key] ?? 0;
    const equipped = equippedItem.stats[key] ?? 0;
    if (preview === 0 && equipped === 0) return [];
    return [{ key, preview, equipped, delta: preview - equipped }];
  });
}
