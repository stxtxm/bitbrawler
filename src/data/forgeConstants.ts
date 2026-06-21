import { ItemRarity } from '../types/Item';

/**
 * Essence yield when salvaging an item, based on its rarity.
 */
export const ESSENCE_YIELD: Record<ItemRarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 40,
  epic: 100,
  legendary: 250,
};

/**
 * Essence cost to fuse 3 items of a given rarity into 1 of the next tier.
 */
export const FUSION_COST: Record<ItemRarity, number> = {
  common: 5,
  uncommon: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
};

/**
 * Number of items required for a single fusion.
 */
export const FUSION_INPUT_COUNT = 3;

/**
 * Essence cost to upgrade an item by one level.
 */
export const UPGRADE_COST = 25;

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
export const ESSENCE_SOFT_CAP = 500;
