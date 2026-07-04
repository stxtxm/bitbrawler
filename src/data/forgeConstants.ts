import { ItemRarity } from '../types/Item';

/**
 * Essence yield when salvaging an item, based on its rarity.
 */
export const ESSENCE_YIELD: Record<ItemRarity, number> = {
  common: 5,
  uncommon: 20,
  rare: 75,
  epic: 250,
  legendary: 1000,
};

/**
 * Alias for ESSENCE_YIELD — used in the forge UI.
 */
export const SALVAGE_YIELD = ESSENCE_YIELD;

/**
 * Essence cost to fuse 3 items of a given rarity into 1 of the next tier.
 * legendary has cost 0 because legendary items cannot be fused.
 */
export const FUSION_COST: Record<ItemRarity, number> = {
  common: 10,
  uncommon: 40,
  rare: 150,
  epic: 500,
  legendary: 0,
};

/**
 * Alias for FUSION_COST.
 */
export const FUSION_ESSENCE_COST = FUSION_COST;

/**
 * Number of items required for a single fusion.
 */
export const FUSION_INPUT_COUNT = 3;

/**
 * Base essence cost to upgrade an item by one level.
 */
export const UPGRADE_COST = 25;

/**
 * Alias for UPGRADE_COST.
 */
export const UPGRADE_BASE_COST = UPGRADE_COST;

/**
 * Essence cost scaling per upgrade level.
 * Final cost = UPGRADE_BASE_COST + level * UPGRADE_COST_SCALING
 */
export const UPGRADE_COST_SCALING = 10;

/**
 * Maximum upgrade level for an item (0-5).
 */
export const MAX_UPGRADE_LEVEL = 5;

/**
 * Chance (0-1) for a lucky proc that upgrades two rarity tiers instead of one on fusion.
 */
export const LUCKY_PROC_CHANCE = 0.1;

/**
 * Soft cap for essence — excess beyond this is discarded.
 */
export const ESSENCE_SOFT_CAP = 250;
