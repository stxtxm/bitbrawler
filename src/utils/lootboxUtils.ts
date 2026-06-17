import { ItemRarity, PixelItemAsset } from '../types/Item';
import { getDailyResetKey } from './dailyReset';

export const LOOTBOX_RARITY_WEIGHTS: Record<ItemRarity, number> = {
  common: 0.458,
  uncommon: 0.20,
  rare: 0.17,
  epic: 0.15,
  legendary: 0.022,
};

export interface StreakBonus {
  weightBonus: number;      // Extra weight added to rare/epic
  minRarity: ItemRarity | null;  // Minimum guaranteed rarity (null = no minimum)
  doubleRoll: boolean;      // Roll twice, pick best
  label: string;            // Display label for the tier
}

export const STREAK_TIERS: { minDays: number; maxDays: number; bonus: StreakBonus }[] = [
  { minDays: 1, maxDays: 3, bonus: { weightBonus: 0, minRarity: null, doubleRoll: false, label: 'BASE' } },
  { minDays: 4, maxDays: 7, bonus: { weightBonus: 0.02, minRarity: null, doubleRoll: false, label: '+10%' } },
  { minDays: 8, maxDays: 14, bonus: { weightBonus: 0.05, minRarity: 'uncommon', doubleRoll: false, label: '+25%' } },
  { minDays: 15, maxDays: 30, bonus: { weightBonus: 0.08, minRarity: 'rare', doubleRoll: false, label: '+50%' } },
  { minDays: 31, maxDays: Infinity, bonus: { weightBonus: 0, minRarity: null, doubleRoll: true, label: '+100%' } },
];

export function getStreakBonus(streak: number): StreakBonus {
  if (streak <= 0) return { weightBonus: 0, minRarity: null, doubleRoll: false, label: 'BASE' };
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.minDays && streak <= tier.maxDays) {
      return tier.bonus;
    }
  }
  return { weightBonus: 0, minRarity: null, doubleRoll: false, label: 'BASE' };
}

export const RARITY_RANK: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

/**
 * Computes the next streak value when a lootbox roll occurs.
 * - If `lastRoll` is null/undefined (never rolled), streak starts at 1.
 * - If last roll was on a previous consecutive day, streak increments by 1.
 * - If last roll was today, streak is unchanged.
 * - If last roll was more than 1 day ago, streak resets to 1.
 */
export function computeNextStreak(
  lastRoll: unknown,
  currentStreak: number,
  now: number = Date.now()
): number {
  const normalized = normalizeTimestamp(lastRoll);

  // Never rolled before — start streak
  if (normalized === null) return 1;

  const lastKey = getDailyResetKey(normalized);
  const todayKey = getDailyResetKey(now);

  // Already rolled today — keep current streak
  if (lastKey === todayKey) return currentStreak;

  // Compute yesterday's reset key
  const yesterdayDate = new Date(now - 86400000);
  const yesterdayKey = getDailyResetKey(yesterdayDate.getTime());

  // Last roll was yesterday (consecutive) — increment streak
  if (lastKey === yesterdayKey) {
    return currentStreak + 1;
  }

  // Gap of more than 1 day — reset streak
  return 1;
}

export const getLootboxRarityWeights = (level: number): Record<ItemRarity, number> => {
  if (level >= 10) {
    return { common: 0.38, uncommon: 0.25, rare: 0.18, epic: 0.14, legendary: 0.05 };
  }
  if (level >= 7) {
    return { common: 0.435, uncommon: 0.25, rare: 0.17, epic: 0.12, legendary: 0.025 };
  }
  if (level >= 4) {
    return { common: 0.495, uncommon: 0.24, rare: 0.15, epic: 0.10, legendary: 0.015 };
  }
  if (level >= 3) {
    return { common: 0.512, uncommon: 0.20, rare: 0.15, epic: 0.13, legendary: 0.008 };
  }
  return { ...LOOTBOX_RARITY_WEIGHTS };
};

/**
 * Applies streak weight bonus to the base rarity weights.
 * Adds `weightBonus` to rare and epic weights.
 * Clamps weightBonus to a valid non-negative number to avoid NaN propagation.
 */
export function applyStreakWeights(
  baseWeights: Record<ItemRarity, number>,
  weightBonus: number
): Record<ItemRarity, number> {
  const safeBonus = Number.isFinite(weightBonus) ? Math.max(0, weightBonus) : 0;
  return {
    ...baseWeights,
    rare: (baseWeights.rare ?? 0) + safeBonus,
    epic: (baseWeights.epic ?? 0) + safeBonus,
  };
}

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

export interface RollLootboxOptions {
  rng?: () => number;
  excludeIds?: string[];
  level?: number;
  streak?: number; // Current streak for bonus application
}

function pickRandomItem(pool: PixelItemAsset[], rng: () => number): PixelItemAsset {
  const pick = Math.floor(rng() * pool.length);
  return pool[pick];
}

function rollSingle(
  eligibleItems: PixelItemAsset[],
  weights: Record<ItemRarity, number>,
  rng: () => number,
  minRarity: ItemRarity | null
): PixelItemAsset | null {
  const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  // Filter by minimum rarity if set
  const availableRarities = minRarity
    ? rarities.filter((r) => RARITY_RANK[r] >= RARITY_RANK[minRarity])
    : rarities;

  const itemsByRarity = availableRarities.reduce<Record<ItemRarity, PixelItemAsset[]>>((acc, rarity) => {
    acc[rarity] = eligibleItems.filter((item) => item.rarity === rarity);
    return acc;
  }, {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: []
  });

  const availableWithItems = availableRarities.filter((rarity) => itemsByRarity[rarity].length > 0);
  if (!availableWithItems.length) return null;

  // Determine which rarities have positive configured weights
  const weightedRarities = availableWithItems.filter((rarity) => (weights[rarity] ?? 0) > 0);

  if (weightedRarities.length > 0) {
    // Standard case: use configured weights for rarity selection
    const totalWeight = weightedRarities.reduce((sum, rarity) => sum + (weights[rarity] ?? 0), 0);
    if (totalWeight <= 0) return null;

    const roll = rng() * totalWeight;
    let cursor = 0;
    let chosen: ItemRarity = weightedRarities[0];

    for (const rarity of weightedRarities) {
      const weight = weights[rarity] ?? 0;
      if (weight <= 0) continue;
      cursor += weight;
      if (roll <= cursor) {
        chosen = rarity;
        break;
      }
    }

    const pool = itemsByRarity[chosen];
    if (!pool.length) return null;
    return pickRandomItem(pool, rng);
  }

  // Fallback: no positive weights — give equal probability to all available rarities
  const equalWeight = 1;
  const totalWeight = availableWithItems.length * equalWeight;
  const roll = rng() * totalWeight;
  let cursor = 0;
  let chosen: ItemRarity = availableWithItems[0];

  for (const rarity of availableWithItems) {
    cursor += equalWeight;
    if (roll <= cursor) {
      chosen = rarity;
      break;
    }
  }

  const pool = itemsByRarity[chosen];
  if (!pool.length) return null;
  return pickRandomItem(pool, rng);
}

/**
 * Picks the better of two items for double roll.
 * Higher rarity wins; if same rarity, higher total stats wins.
 */
function pickBetterItem(a: PixelItemAsset, b: PixelItemAsset): PixelItemAsset {
  const rankA = RARITY_RANK[a.rarity];
  const rankB = RARITY_RANK[b.rarity];
  if (rankA !== rankB) return rankA > rankB ? a : b;

  const statsA = Object.values(a.stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
  const statsB = Object.values(b.stats).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
  return statsA >= statsB ? a : b;
}

export function rollLootbox(
  items: PixelItemAsset[],
  options: RollLootboxOptions = {}
): PixelItemAsset | null {
  if (!items.length) return null;

  const rng = options.rng ?? Math.random;
  const level = Math.max(1, options.level ?? 1);
  const excludeIds = options.excludeIds ?? [];
  const streak = Math.max(0, options.streak ?? 0);
  const eligibleItems = getEligibleLootboxItems(items, level, excludeIds);
  if (!eligibleItems.length) return null;

  // Compute streak bonus
  const bonus = getStreakBonus(streak);
  const baseWeights = getLootboxRarityWeights(level);
  const weights = applyStreakWeights(baseWeights, bonus.weightBonus);

  // Handle double roll
  if (bonus.doubleRoll) {
    const first = rollSingle(eligibleItems, weights, rng, bonus.minRarity);
    const second = rollSingle(eligibleItems, weights, rng, bonus.minRarity);
    if (!first && !second) return null;
    if (!first) return second;
    if (!second) return first;
    return pickBetterItem(first, second);
  }

  // Single roll with streak bonuses
  return rollSingle(eligibleItems, weights, rng, bonus.minRarity);
}
