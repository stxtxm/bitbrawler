import { PixelItemAsset } from '../types/Item';

export const LOOTBOX_RARITY_WEIGHTS: Record<PixelItemAsset['rarity'], number> = {
  common: 0.8,
  uncommon: 0.2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getUtcDayKey = (timestamp: number) => Math.floor(timestamp / DAY_MS);

export function canRollLootbox(lastRoll: number | undefined, now: number = Date.now()): boolean {
  if (!lastRoll) return true;
  return getUtcDayKey(lastRoll) !== getUtcDayKey(now);
}

export function rollLootbox(
  items: PixelItemAsset[],
  rng: () => number = Math.random
): PixelItemAsset | null {
  if (!items.length) return null;

  const commons = items.filter((item) => item.rarity === 'common');
  const uncommons = items.filter((item) => item.rarity === 'uncommon');

  const roll = rng();
  const targetRarity = roll < LOOTBOX_RARITY_WEIGHTS.common ? 'common' : 'uncommon';
  const pool = targetRarity === 'common' ? commons : uncommons;
  const fallbackPool = targetRarity === 'common' ? uncommons : commons;
  const finalPool = pool.length ? pool : fallbackPool;
  if (!finalPool.length) return null;
  const pick = Math.floor(rng() * finalPool.length);
  return finalPool[pick];
}
