import { PixelItemAsset } from '../types/Item';

export const LOOTBOX_RARITY_WEIGHTS: Record<PixelItemAsset['rarity'], number> = {
  common: 0.8,
  uncommon: 0.2,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getUtcDayKey = (timestamp: number) => Math.floor(timestamp / DAY_MS);

type TimestampLike = {
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
};

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value && typeof value === 'object') {
    const maybe = value as TimestampLike;
    if (typeof maybe.toMillis === 'function') {
      const millis = maybe.toMillis();
      return Number.isFinite(millis) ? millis : null;
    }
    if (typeof maybe.seconds === 'number') {
      const nanos = typeof maybe.nanoseconds === 'number' ? maybe.nanoseconds : 0;
      return Math.floor(maybe.seconds * 1000 + nanos / 1_000_000);
    }
  }

  return null;
};

export function canRollLootbox(lastRoll: unknown, now: number = Date.now()): boolean {
  const normalized = normalizeTimestamp(lastRoll);
  if (normalized === null) return true;
  return getUtcDayKey(normalized) !== getUtcDayKey(now);
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
