import { ItemRarity, PixelItemAsset } from '../types/Item';
import { getDailyResetKey } from './dailyReset';

export const LOOTBOX_RARITY_WEIGHTS: Record<ItemRarity, number> = {
  common: 0.8,
  uncommon: 0.2,
  rare: 0,
  epic: 0,
};

export const getLootboxRarityWeights = (level: number): Record<ItemRarity, number> => {
  if (level >= 10) {
    return { common: 0.45, uncommon: 0.3, rare: 0.18, epic: 0.07 };
  }
  if (level >= 7) {
    return { common: 0.5, uncommon: 0.3, rare: 0.15, epic: 0.05 };
  }
  if (level >= 4) {
    return { common: 0.65, uncommon: 0.25, rare: 0.1, epic: 0 };
  }
  return { ...LOOTBOX_RARITY_WEIGHTS };
};

export const getEligibleLootboxItems = (
  items: PixelItemAsset[],
  level: number,
  excludeIds: string[] = []
) => {
  const excluded = new Set(excludeIds);
  return items.filter((item) => item.requiredLevel <= level && !excluded.has(item.id));
};

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
  return getDailyResetKey(normalized) !== getDailyResetKey(now);
}

export function rollLootbox(
  items: PixelItemAsset[],
  options: { rng?: () => number; excludeIds?: string[]; level?: number } = {}
): PixelItemAsset | null {
  if (!items.length) return null;

  const rng = options.rng ?? Math.random;
  const level = options.level ?? 1;
  const excludeIds = options.excludeIds ?? [];
  const eligibleItems = getEligibleLootboxItems(items, level, excludeIds);
  if (!eligibleItems.length) return null;

  const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic'];
  const itemsByRarity = rarities.reduce<Record<ItemRarity, PixelItemAsset[]>>((acc, rarity) => {
    acc[rarity] = eligibleItems.filter((item) => item.rarity === rarity);
    return acc;
  }, {
    common: [],
    uncommon: [],
    rare: [],
    epic: []
  });

  const weights = getLootboxRarityWeights(level);
  const availableRarities = rarities.filter((rarity) => itemsByRarity[rarity].length > 0);
  if (!availableRarities.length) return null;

  const weightedRarities = availableRarities.filter((rarity) => (weights[rarity] ?? 0) > 0);
  const selectionRarities = weightedRarities.length ? weightedRarities : availableRarities;
  const totalWeight = selectionRarities.reduce((sum, rarity) => sum + (weights[rarity] ?? 1), 0);

  const roll = rng() * totalWeight;
  let cursor = 0;
  let chosen: ItemRarity = selectionRarities[0];
  for (const rarity of selectionRarities) {
    const weight = weights[rarity] ?? 1;
    cursor += weight;
    if (roll <= cursor) {
      chosen = rarity;
      break;
    }
  }

  const pool = itemsByRarity[chosen];
  if (!pool.length) return null;
  const pick = Math.floor(rng() * pool.length);
  return pool[pick];
}
