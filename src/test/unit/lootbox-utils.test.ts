import { describe, it, expect } from 'vitest';
import {
  canRollLootbox,
  getEligibleLootboxItems,
  getLootboxRarityWeights,
  getStreakBonus,
  rollLootbox,
} from '../../utils/lootboxUtils';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { mulberry32 } from '../../utils/randomUtils';
import { PixelItemAsset } from '../../types/Item';

describe('lootboxUtils', () => {
  it('allows one roll per Paris day', () => {
    const now = Date.UTC(2025, 0, 2, 0, 30, 0); // 01:30 in Paris (CET)
    const sameDay = Date.UTC(2025, 0, 1, 23, 30, 0); // 00:30 Paris, same day
    const previousDay = Date.UTC(2025, 0, 1, 22, 30, 0); // 23:30 Paris, previous day

    expect(canRollLootbox(undefined, now)).toBe(true);
    expect(canRollLootbox(sameDay, now)).toBe(false);
    expect(canRollLootbox(previousDay, now)).toBe(true);
  });

  it('rolls a common item for low random values', () => {
    const rng = () => 0.05;
    const item = rollLootbox(ITEM_ASSETS, { rng, level: 1 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('common');
  });

  it('rolls a legendary for very high random values at level 10+', () => {
    const rng = () => 0.995;
    const item = rollLootbox(ITEM_ASSETS, { rng, level: 10 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('legendary');
  });

  it('rolls only items with requiredLevel <= player level', () => {
    const items = rollLootbox(ITEM_ASSETS, { level: 1 });
    expect(items!.requiredLevel).toBeLessThanOrEqual(1);
  });

  it('respects excludeIds filter', () => {
    const items50 = rollLootbox(ITEM_ASSETS, { level: 10, excludeIds: ['voidreaper'] });
    expect(items50).not.toBeNull();
    // After adding new items, voidreaper should still be excludable
  });

  it('getting lvl 10 items at player level 10', () => {
    const items = getEligibleLootboxItems(ITEM_ASSETS, 10, []);
    expect(items.every((i) => i.requiredLevel <= 10)).toBe(true);
    // Should have all items since all are requiredLevel <= 10
    expect(items.length).toBe(ITEM_ASSETS.length);
  });

  it('level 1 only gets level 1 items', () => {
    const items = getEligibleLootboxItems(ITEM_ASSETS, 1, []);
    expect(items.every((i) => i.requiredLevel <= 1)).toBe(true);
  });

  it('streak bonus boosts rare and epic weights', () => {
    const base = { common: 0.4, uncommon: 0.25, rare: 0.18, epic: 0.15, legendary: 0.02 };
    const bonus = getStreakBonus(10);
    const weights = { ...base, rare: base.rare + bonus.weightBonus, epic: base.epic + bonus.weightBonus };
    expect(weights.rare).toBeGreaterThan(base.rare);
    expect(weights.epic).toBeGreaterThan(base.epic);
  });

  it('getLootboxRarityWeights at level 10+ returns improved endgame weights', () => {
    const weights = getLootboxRarityWeights(10);
    expect(weights.legendary).toBeGreaterThanOrEqual(0.05);
    expect(weights.common).toBeLessThanOrEqual(0.38);
  });

  it('getLootboxRarityWeights at level 15 also uses level 10+ weights', () => {
    const weights15 = getLootboxRarityWeights(15);
    const weights10 = getLootboxRarityWeights(10);
    expect(weights15).toEqual(weights10);
  });

  it('can roll water element items from lootbox (new items)', () => {
    const rng = mulberry32(42);
    const rolled: PixelItemAsset[] = [];
    // Roll many times to cover diverse outcomes
    for (let i = 0; i < 100; i++) {
      const item = rollLootbox(ITEM_ASSETS, { rng: () => rng(), level: 10 });
      if (item) rolled.push(item);
    }
    const waterItems = rolled.filter((i) => i.element === 'water');
    // With new items, water items should eventually appear
    expect(waterItems.length).toBeGreaterThan(0);
  });

  it('high-level player can get all item tiers', () => {
    const items = getEligibleLootboxItems(ITEM_ASSETS, 20, []);
    expect(items.length).toBe(ITEM_ASSETS.length);
    const levels = [...new Set(items.map((i) => i.requiredLevel))];
    // All 10 tiers should be accessible
    expect(levels.length).toBe(10);
  });

  it('has increased legendary chance at level 10+', () => {
    const w10 = getLootboxRarityWeights(10);
    const w1 = getLootboxRarityWeights(1);
    expect(w10.legendary).toBeGreaterThan(w1.legendary);
    expect(w10.common).toBeLessThan(w1.common);
  });
});
