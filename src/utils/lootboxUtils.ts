import { ItemRarity, PixelItemAsset } from '../types/Item';
import { GAME_RULES } from '../config/gameRules';
import { getDailyResetKey } from './dailyReset';

export const LOOTBOX_RARITY_WEIGHTS: Record<ItemRarity, number> = {
  common: 0.43,
  uncommon: 0.20,
  rare: 0.17,
  epic: 0.15,
  legendary: 0.05,
};

/** Number of consecutive lootboxes without a legendary before pity forces one. */
export const PITY_THRESHOLD = GAME_RULES.LOOTBOX.LEGENDARY_WITHIN;

export const LOOTBOX_PITY = {
  EPIC_WITHIN: GAME_RULES.LOOTBOX.EPIC_WITHIN,
  LEGENDARY_WITHIN: GAME_RULES.LOOTBOX.LEGENDARY_WITHIN,
} as const;

export const EPIC_BOOST_PER_COMMON = GAME_RULES.LOOTBOX.EPIC_BOOST_PER_COMMON;
export const EPIC_BOOST_CAP = GAME_RULES.LOOTBOX.EPIC_BOOST_CAP;

export function getEpicPityRemaining(epicPityCount: number): number {
  const current = Number.isFinite(epicPityCount) ? Math.max(0, epicPityCount) : 0;
  return Math.max(0, LOOTBOX_PITY.EPIC_WITHIN - current);
}

export function getLegendaryPityRemaining(pityCount: number): number {
  const current = Number.isFinite(pityCount) ? Math.max(0, pityCount) : 0;
  return Math.max(0, LOOTBOX_PITY.LEGENDARY_WITHIN - current);
}

export function getEpicBoostBonus(commonStreak: number): number {
  const current = Number.isFinite(commonStreak) ? Math.max(0, commonStreak) : 0;
  return Math.min(current * EPIC_BOOST_PER_COMMON, EPIC_BOOST_CAP);
}

export interface EpicPityState {
  epicPityCount: number;
  commonStreak: number;
}

function pityStorageKey(characterId: string): string {
  return `bitbrawler_lootbox_pity_${characterId}`;
}

function sanitizePityValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function loadEpicPityState(characterId: string): EpicPityState {
  const fallback: EpicPityState = { epicPityCount: 0, commonStreak: 0 };
  try {
    const raw = localStorage.getItem(pityStorageKey(characterId));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    const record = parsed as Partial<Record<keyof EpicPityState, unknown>>;
    return {
      epicPityCount: sanitizePityValue(record.epicPityCount),
      commonStreak: sanitizePityValue(record.commonStreak),
    };
  } catch {
    return fallback;
  }
}

export function saveEpicPityState(characterId: string, state: EpicPityState): void {
  try {
    localStorage.setItem(pityStorageKey(characterId), JSON.stringify({
      epicPityCount: sanitizePityValue(state.epicPityCount),
      commonStreak: sanitizePityValue(state.commonStreak),
    }));
  } catch {
    return;
  }
}

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
    return { common: 0.38, uncommon: 0.25, rare: 0.18, epic: 0.14, legendary: 0.08 };
  }
  if (level >= 7) {
    return { common: 0.435, uncommon: 0.25, rare: 0.17, epic: 0.12, legendary: 0.05 };
  }
  if (level >= 4) {
    return { common: 0.488, uncommon: 0.24, rare: 0.15, epic: 0.10, legendary: 0.05 };
  }
  if (level >= 3) {
    return { common: 0.42, uncommon: 0.24, rare: 0.17, epic: 0.14, legendary: 0.05 };
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
  pityCount?: number; // Current pity counter (consecutive non-legendary rolls)
  epicPityCount?: number; // Consecutive rolls without epic or better
  commonStreak?: number; // Consecutive common rolls (progressive epic boost)
  consecutiveLosses?: number;
}

export interface RollLootboxResult {
  item: PixelItemAsset | null;
  pityCount: number;
  pityTriggered: boolean;
  epicPityCount: number;
  epicPityTriggered: boolean;
  commonStreak: number;
  epicBoost: number;
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

/**
 * Forces a legendary roll when pity threshold is reached.
 * Picks a random legendary item from the eligible pool.
 */
function forceLegendaryRoll(eligibleItems: PixelItemAsset[], rng: () => number): PixelItemAsset | null {
  const legendaryItems = eligibleItems.filter((i) => i.rarity === 'legendary');
  if (!legendaryItems.length) return null;
  return pickRandomItem(legendaryItems, rng);
}

function isEpicOrBetter(item: PixelItemAsset | null): boolean {
  return item !== null && (item.rarity === 'epic' || item.rarity === 'legendary');
}

function forceEpicMinimumRoll(
  eligibleItems: PixelItemAsset[],
  weights: Record<ItemRarity, number>,
  rng: () => number
): PixelItemAsset | null {
  const epicItems = eligibleItems.filter((i) => i.rarity === 'epic');
  const legendaryItems = eligibleItems.filter((i) => i.rarity === 'legendary');
  if (!epicItems.length && !legendaryItems.length) return null;
  if (epicItems.length && !legendaryItems.length) return pickRandomItem(epicItems, rng);
  if (legendaryItems.length && !epicItems.length) return pickRandomItem(legendaryItems, rng);
  const epicWeight = weights.epic ?? 0;
  const legendaryWeight = weights.legendary ?? 0;
  const total = epicWeight + legendaryWeight;
  if (total <= 0) return pickRandomItem(epicItems, rng);
  return rng() * total <= epicWeight
    ? pickRandomItem(epicItems, rng)
    : pickRandomItem(legendaryItems, rng);
}

/**
 * Computes the new pity count after a lootbox roll.
 * Resets to 0 on legendary, increments otherwise.
 */
function computePity(item: PixelItemAsset | null, currentPity: number): number {
  if (!item) return currentPity + 1;
  return item.rarity === 'legendary' ? 0 : currentPity + 1;
}

function computeEpicPity(item: PixelItemAsset | null, currentEpicPity: number): number {
  if (!item) return currentEpicPity + 1;
  return isEpicOrBetter(item) ? 0 : currentEpicPity + 1;
}

function computeCommonStreak(item: PixelItemAsset | null, currentCommonStreak: number): number {
  if (!item) return currentCommonStreak + 1;
  return item.rarity === 'common' ? currentCommonStreak + 1 : 0;
}

/**
 * Simplified lootbox roll — no streak bonus, no pity, no double roll.
 * Used by the shop for the Coffre Mystère purchase.
 * Uses level-based rarity weights and a simple single roll.
 */
export function rollSimpleLootbox(
  items: PixelItemAsset[],
  level: number,
  rng?: () => number,
): PixelItemAsset | null {
  const rand = rng ?? Math.random;
  const eligible = items.filter((item) => item.requiredLevel <= level);
  if (!eligible.length) return null;

  const weights = getLootboxRarityWeights(level);
  const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  const itemsByRarity = rarities.reduce<Record<ItemRarity, PixelItemAsset[]>>((acc, r) => {
    acc[r] = eligible.filter((item) => item.rarity === r);
    return acc;
  }, {} as Record<ItemRarity, PixelItemAsset[]>);

  const available = rarities.filter((r) => itemsByRarity[r].length > 0 && (weights[r] ?? 0) > 0);
  if (!available.length) return null;

  const totalWeight = available.reduce((sum, r) => sum + (weights[r] ?? 0), 0);
  const roll = rand() * totalWeight;
  let cursor = 0;

  for (const rarity of available) {
    cursor += weights[rarity] ?? 0;
    if (roll <= cursor) {
      const pool = itemsByRarity[rarity];
      return pool[Math.floor(rand() * pool.length)];
    }
  }

  return null;
}

export function rollLootbox(
  items: PixelItemAsset[],
  options: RollLootboxOptions = {}
): RollLootboxResult {
  const emptyResult = (epicPity: number, commons: number): RollLootboxResult => ({
    item: null,
    pityCount: 0,
    pityTriggered: false,
    epicPityCount: epicPity,
    epicPityTriggered: false,
    commonStreak: commons,
    epicBoost: getEpicBoostBonus(commons),
  });
  if (!items.length) return emptyResult(0, 0);

  const rng = options.rng ?? Math.random;
  const level = Math.max(1, options.level ?? 1);
  const excludeIds = options.excludeIds ?? [];
  const streak = Math.max(0, options.streak ?? 0);
  const currentPity = Math.max(0, options.pityCount ?? 0);
  const currentEpicPity = Math.max(0, options.epicPityCount ?? 0);
  const currentCommonStreak = Math.max(0, options.commonStreak ?? 0);
  const eligibleItems = getEligibleLootboxItems(items, level, excludeIds);
  if (!eligibleItems.length) {
    return {
      item: null,
      pityCount: currentPity + 1,
      pityTriggered: false,
      epicPityCount: currentEpicPity + 1,
      epicPityTriggered: false,
      commonStreak: currentCommonStreak + 1,
      epicBoost: getEpicBoostBonus(currentCommonStreak + 1),
    };
  }

  const bonus = getStreakBonus(streak);
  const baseWeights = getLootboxRarityWeights(level);
  const epicBoost = getEpicBoostBonus(currentCommonStreak);
  const boostedBase = { ...baseWeights, epic: (baseWeights.epic ?? 0) + epicBoost };
  const weights = applyStreakWeights(boostedBase, bonus.weightBonus);

  // ─── Pity check: force legendary if threshold reached ─────────────────
  let pitySaturated = false;
  if (currentPity >= PITY_THRESHOLD) {
    const forcedItem = forceLegendaryRoll(eligibleItems, rng);
    if (forcedItem) {
      return {
        item: forcedItem,
        pityCount: 0,
        pityTriggered: true,
        epicPityCount: 0,
        epicPityTriggered: currentEpicPity >= LOOTBOX_PITY.EPIC_WITHIN,
        commonStreak: 0,
        epicBoost: 0,
      };
    }
    // No legendary items available — keep pity at threshold
    // so it triggers when player levels up and legendaries become available
    pitySaturated = true;
  }

  // ─── Epic pity: force epic minimum after EPIC_WITHIN - 1 misses ───────
  let epicSaturated = false;
  if (currentEpicPity >= LOOTBOX_PITY.EPIC_WITHIN - 1) {
    const forcedEpic = forceEpicMinimumRoll(eligibleItems, weights, rng);
    if (forcedEpic) {
      return {
        item: forcedEpic,
        pityCount: forcedEpic.rarity === 'legendary' ? 0 : computePity(forcedEpic, currentPity),
        pityTriggered: currentPity >= PITY_THRESHOLD,
        epicPityCount: 0,
        epicPityTriggered: true,
        commonStreak: 0,
        epicBoost: 0,
      };
    }
    epicSaturated = true;
  }
  const lossFloorActive = (options.consecutiveLosses ?? 0) >= 3;
  const lossFloor: ItemRarity | null = lossFloorActive ? 'uncommon' : null;
  const rankOf = (r: ItemRarity | null): number => (r === null ? -1 : RARITY_RANK[r]);
  const effectiveMinRarity = rankOf(bonus.minRarity) >= rankOf(lossFloor) ? bonus.minRarity : lossFloor;

  let item: PixelItemAsset | null;

  if (bonus.doubleRoll) {
    const first = rollSingle(eligibleItems, weights, rng, effectiveMinRarity);
    const second = rollSingle(eligibleItems, weights, rng, effectiveMinRarity);
    if (!first && !second) {
      item = null;
    } else if (!first) {
      item = second;
    } else if (!second) {
      item = first;
    } else {
      item = pickBetterItem(first, second);
    }
  } else {
    item = rollSingle(eligibleItems, weights, rng, effectiveMinRarity);
  }

  const pityCount = pitySaturated ? PITY_THRESHOLD : computePity(item, currentPity);
  const pityTriggered = currentPity >= PITY_THRESHOLD;
  const epicPityCount = epicSaturated
    ? LOOTBOX_PITY.EPIC_WITHIN - 1
    : computeEpicPity(item, currentEpicPity);
  const commonStreak = computeCommonStreak(item, currentCommonStreak);

  return {
    item,
    pityCount,
    pityTriggered,
    epicPityCount,
    epicPityTriggered: false,
    commonStreak,
    epicBoost,
  };
}
