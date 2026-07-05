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
 * Prices are deliberately high — player must save several days to afford even the cheapest.
 */
export const SHOP_OFFERS: ShopOfferConfig[] = [
  { type: 'item', price: 200, label: 'Marchandise', rarityPool: ['common', 'uncommon', 'rare'] },
  { type: 'item', price: 350, label: 'Pièce rare', rarityPool: ['rare', 'epic'] },
  { type: 'lootbox', price: 500, label: 'Coffre mystère', rarityPool: null },
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
