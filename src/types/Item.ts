export type ItemSlot = 'weapon' | 'armor' | 'accessory';

export type ItemRarity = 'common' | 'uncommon';

export interface ItemStats {
  strength?: number;
  vitality?: number;
  dexterity?: number;
  luck?: number;
  intelligence?: number;
  focus?: number;
  hp?: number;
}

export interface PixelItemAsset {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  stats: ItemStats;
  pixels: number[][];
}
