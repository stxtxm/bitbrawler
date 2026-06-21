import { Character } from '../types/Character';
import { PixelItemAsset, ItemRarity } from '../types/Item';
import {
  ESSENCE_YIELD,
  FUSION_COST,
  FUSION_INPUT_COUNT,
  UPGRADE_BASE_COST,
  UPGRADE_COST_SCALING,
  MAX_UPGRADE_LEVEL,
  LUCKY_PROC_CHANCE,
  ESSENCE_SOFT_CAP,
} from '../data/forgeConstants';
import { RARITY_RANK } from './lootboxUtils';

// ─── Essence Helpers ───────────────────────────────────────────────────────

/**
 * Returns the essence yield for a given item based on its rarity.
 */
export const getEssenceYield = (item: PixelItemAsset): number => {
  return ESSENCE_YIELD[item.rarity];
};

/**
 * Returns the total essence yield from multiple items.
 */
export const salvageItems = (items: PixelItemAsset[]): number => {
  return items.reduce((total, item) => total + getEssenceYield(item), 0);
};

/**
 * Clamp essence to soft cap.
 */
const clampEssence = (value: number): number => {
  return Math.min(value, ESSENCE_SOFT_CAP);
};

// ─── Salvage ───────────────────────────────────────────────────────────────

/**
 * Salvages an item from the character's inventory, removing it and adding
 * essence to the character. Returns a new Character object (does not mutate).
 * If the item is not in inventory or not found in allItems, returns the
 * character unchanged.
 */
export const salvageItem = (
  itemId: string,
  character: Character,
  allItems: PixelItemAsset[]
): Character => {
  const inventory = character.inventory ?? [];
  if (!inventory.includes(itemId)) {
    return character;
  }

  const item = allItems.find((i) => i.id === itemId);
  if (!item) {
    return character;
  }

  const essenceGain = getEssenceYield(item);
  const newInventory = inventory.filter((id) => id !== itemId);
  const newEssence = clampEssence((character.essence ?? 0) + essenceGain);

  return {
    ...character,
    inventory: newInventory,
    essence: newEssence,
  };
};

// ─── Fusion ────────────────────────────────────────────────────────────────

/**
 * Checks if the given items can be fused:
 * - Exactly 3 items
 * - All same rarity
 * - All items are in the character's inventory
 * - Character has enough essence for the fusion cost
 * - Rarity is not legendary (no higher tier)
 */
export const canFuse = (items: PixelItemAsset[], character: Character): boolean => {
  if (items.length !== FUSION_INPUT_COUNT) {
    return false;
  }

  const firstRarity = items[0].rarity;
  if (firstRarity === 'legendary') {
    return false;
  }

  // All items must be the same rarity
  if (!items.every((item) => item.rarity === firstRarity)) {
    return false;
  }

  // All items must be in the character's inventory
  const inventory = character.inventory ?? [];
  if (!items.every((item) => inventory.includes(item.id))) {
    return false;
  }

  // Must have enough essence
  const cost = FUSION_COST[firstRarity];
  if ((character.essence ?? 0) < cost) {
    return false;
  }

  return true;
};

/**
 * Returns the ItemRarity for a given rank.
 */
const rarityFromRank = (rank: number): ItemRarity | null => {
  const entries = Object.entries(RARITY_RANK) as [ItemRarity, number][];
  for (const [rarity, r] of entries) {
    if (r === rank) return rarity;
  }
  return null;
};

/**
 * Performs fusion on 3 items of the same rarity.
 *
 * @param items - The 3 items being fused (all same rarity)
 * @param character - The current character state
 * @param pool - All items in the game (used to pick the result)
 * @param rng - Optional RNG function (defaults to Math.random)
 * @returns The result item (or null if no items of target rarity exist in pool)
 *          and the updated character.
 */
export const performFusion = (
  items: PixelItemAsset[],
  character: Character,
  pool: PixelItemAsset[],
  rng: () => number = Math.random
): { result: PixelItemAsset | null; updatedChar: Character } => {
  if (!canFuse(items, character)) {
    return { result: null, updatedChar: character };
  }

  const baseRarity = items[0].rarity;
  const cost = FUSION_COST[baseRarity];
  const baseRank = RARITY_RANK[baseRarity];

  // Determine target rank (lucky proc gives +2 instead of +1)
  const lucky = rng() < LUCKY_PROC_CHANCE;
  const targetRank = lucky ? baseRank + 2 : baseRank + 1;

  const targetRarity = rarityFromRank(targetRank);

  // If no valid target rarity (shouldn't happen since legendary is blocked by canFuse)
  if (!targetRarity) {
    // Fallback: give one rank up
    const fallbackRank = baseRank + 1;
    const fallbackRarity = rarityFromRank(fallbackRank);
    if (!fallbackRarity) {
      return { result: null, updatedChar: character };
    }
  }

  const finalTargetRarity = rarityFromRank(targetRank) ?? rarityFromRank(baseRank + 1)!;

  // Find eligible items in the pool
  const eligible = pool.filter((item) => item.rarity === finalTargetRarity);
  const resultItem = eligible.length > 0
    ? eligible[Math.floor(rng() * eligible.length)]
    : null;

  // Remove the 3 input items from inventory
  const inputIds = new Set(items.map((i) => i.id));
  const newInventory = (character.inventory ?? []).filter((id) => !inputIds.has(id));

  // Add result item to inventory if found
  const finalInventory = resultItem ? [...newInventory, resultItem.id] : newInventory;

  // Deduct essence cost and clamp
  const newEssence = clampEssence((character.essence ?? 0) - cost);

  return {
    result: resultItem,
    updatedChar: {
      ...character,
      inventory: finalInventory,
      essence: newEssence,
    },
  };
};

// ─── Fusion Lucky Proc ─────────────────────────────────────────────────────

/**
 * Checks if a fusion lucky proc should trigger (10% chance).
 * When lucky, fusion skips one rarity tier.
 *
 * @param rng - Optional RNG function (defaults to Math.random)
 */
export const isFusionLucky = (rng: () => number = Math.random): boolean => {
  return rng() < LUCKY_PROC_CHANCE;
};

// ─── Upgrade ───────────────────────────────────────────────────────────────

/**
 * Calculates the essence cost to upgrade an item.
 * Cost scales with the item's current upgrade level.
 *
 * @param _item - The item being upgraded (used for potential future rarity-based scaling)
 * @param level - The current upgrade level of the item (default: 0)
 * @returns The essence cost for the upgrade attempt
 */
export const getUpgradeCost = (_item: PixelItemAsset, level: number = 0): number => {
  return UPGRADE_BASE_COST + level * UPGRADE_COST_SCALING;
};

/**
 * Checks if an item can be upgraded:
 * - Item is in the character's inventory
 * - Character has enough essence (uses dynamic cost based on current upgrade level)
 * - Item is not already at max upgrade level
 */
export const canUpgrade = (itemId: string, character: Character): boolean => {
  const inventory = character.inventory ?? [];
  if (!inventory.includes(itemId)) {
    return false;
  }

  const currentLevel = character.itemUpgrades?.[itemId] ?? 0;
  if (currentLevel >= MAX_UPGRADE_LEVEL) {
    return false;
  }

  // Use dynamic cost based on current level
  // We don't have the item object here, so calculate cost from level alone
  // cost = UPGRADE_BASE_COST + currentLevel * UPGRADE_COST_SCALING
  const cost = UPGRADE_BASE_COST + currentLevel * UPGRADE_COST_SCALING;
  if ((character.essence ?? 0) < cost) {
    return false;
  }

  return true;
};

/**
 * Performs an upgrade on an item, incrementing its upgrade level by 1 and
 * consuming essence. Returns a new Character object (does not mutate).
 * Uses dynamic upgrade cost based on current upgrade level.
 */
export const performUpgrade = (itemId: string, character: Character): Character => {
  if (!canUpgrade(itemId, character)) {
    return character;
  }

  const currentUpgrades = character.itemUpgrades ?? {};
  const currentLevel = currentUpgrades[itemId] ?? 0;

  // Calculate dynamic cost
  const cost = UPGRADE_BASE_COST + currentLevel * UPGRADE_COST_SCALING;

  return {
    ...character,
    itemUpgrades: {
      ...currentUpgrades,
      [itemId]: currentLevel + 1,
    },
    essence: clampEssence((character.essence ?? 0) - cost),
  };
};
