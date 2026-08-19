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
 * Prices rebalanced from real QA bot data (issue #726, 2026-08-18):
 * - avg essence income = 4.4-4.75/run (49 runs with data) → old prices
 *   (150-350) required 30+ days of saving → 0/87 purchase rate (0%)
 * - Target: first purchase in ~3-5 days → cheapest offer ≈ 20 (≈4.2 days)
 * - Coffre mystère EV ≈ 43 (LOOTBOX_RARITY_WEIGHTS × ESSENCE_YIELD) → 35
 *   keeps a slight expected-profit angle as a daily gamble
 * - Pièce rare (rare/epic, EV 50+) at 40, Objet épique (epic, EV 80) at 60
 * - Epic items only unlock for LVL >= 10 (EPIC_UNLOCK_LEVEL): low-level
 *   players (LVL 2-5 = 93% of runs) were offered 50% epic at epic prices
 */
export const SHOP_OFFERS: ShopOfferConfig[] = [
  { type: 'item', price: 20, label: 'Marchandise', rarityPool: ['common', 'uncommon', 'rare'] },
  { type: 'item', price: 40, label: 'Pièce rare', rarityPool: ['rare', 'epic'] },
  { type: 'lootbox', price: 35, label: 'Coffre mystère', rarityPool: null },
  { type: 'item', price: 60, label: 'Objet épique', rarityPool: ['epic'] },
];

/** Cost to reroll today's shop offers (≈2 days of essence income). */
export const REROLL_COST = 10;

/** Minimum character level for epic items to appear in shop offers. */
export const EPIC_UNLOCK_LEVEL = 10;

export const SHOP_OFFER_COUNT = SHOP_OFFERS.length;

/**
 * Returns the price for a given shop offer index.
 */
export function getShopPrice(index: number): number {
  const offer = SHOP_OFFERS[index];
  if (!offer) throw new Error(`Invalid shop offer index: ${index}`);
  return offer.price;
}
