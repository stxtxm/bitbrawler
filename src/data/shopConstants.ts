import { ItemRarity } from '../types/Item';

export interface ShopOfferConfig {
  type: 'item' | 'lootbox';
  price: number;
  label: string;
  rarityPool: ItemRarity[] | null;
}

/**
 * Three shop offers available per day.
 * - Marchandise: item of common/uncommon/rare rarity
 * - Pièce rare: item of rare/epic rarity
 * - Coffre mystère: lootbox (simple roll, no streak/pity)
 *
 * Prices adjusted based on QA data analysis (2026-07-09):
 * - Essence economy tuned: ESSENCE_YIELD reduced (rare 75→50, epic 250→80, legendary 1000→400)
 * - Avg essence per lootbox: 18.5 → 13.1 (ratio 0.708)
 * - Shop purchase rate: 0% (no data collected) → below 10% threshold → prices reduced proportionally
 * - Prices maintain purchasing power relative to new essence economy
 */
export const SHOP_OFFERS: ShopOfferConfig[] = [
<<<<<<< HEAD
  { type: 'item', price: 150, label: 'Marchandise', rarityPool: ['common', 'uncommon', 'rare'] },
  { type: 'item', price: 250, label: 'Pièce rare', rarityPool: ['rare', 'epic'] },
  { type: 'lootbox', price: 350, label: 'Coffre mystère', rarityPool: null },
=======
  { type: 'item', price: 200, label: 'Marchandise', rarityPool: ['common', 'uncommon', 'rare'] },
  { type: 'item', price: 350, label: 'Pièce rare', rarityPool: ['rare', 'epic'] },
  { type: 'lootbox', price: 500, label: 'Coffre mystère', rarityPool: null },
  { type: 'item', price: 450, label: 'Objet épique', rarityPool: ['epic'] },
>>>>>>> 63fcaa4 (feat: guarantee 1 epic item per day in shop rotation)
];

export const SHOP_OFFER_COUNT = SHOP_OFFERS.length;

/**
 * Returns the price for a given shop offer index.
 */
export function getShopPrice(index: number): number {
  const offer = SHOP_OFFERS[index];
  if (!offer) throw new Error(`Invalid shop offer index: ${index}`);
  return offer.price;
}
