export type ItemSlot = 'weapon' | 'armor' | 'accessory';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type Element = 'fire' | 'water' | 'wind' | 'earth' | 'light' | 'dark';

export const ELEMENTS: Element[] = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];

export const ELEMENT_LABELS: Record<Element, string> = {
  fire: 'Fire',
  water: 'Water',
  wind: 'Wind',
  earth: 'Earth',
  light: 'Light',
  dark: 'Dark',
};

export const ELEMENT_COLORS: Record<Element, string> = {
  fire: '#ff4d4d',
  water: '#4dd0ff',
  wind: '#4cd964',
  earth: '#8b5a2b',
  light: '#ffcc00',
  dark: '#9b59b6',
};

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
  requiredLevel: number;
  element?: Element;
}
