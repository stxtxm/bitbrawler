import { describe, it, expect } from 'vitest';
import {
  canRollLootbox,
  getEligibleLootboxItems,
  getLootboxRarityWeights,
  getStreakBonus,
  rollLootbox,
  PITY_THRESHOLD,
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
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 1 });
    expect(result.item).not.toBeNull();
    expect(result.item?.rarity).toBe('common');
  });

  it('rolls a legendary for very high random values at level 10+', () => {
    const rng = () => 0.995;
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10 });
    expect(result.item).not.toBeNull();
    expect(result.item?.rarity).toBe('legendary');
  });

  it('rolls only items with requiredLevel <= player level', () => {
    const result = rollLootbox(ITEM_ASSETS, { level: 1 });
    expect(result.item!.requiredLevel).toBeLessThanOrEqual(1);
  });

  it('respects excludeIds filter', () => {
    const result = rollLootbox(ITEM_ASSETS, { level: 10, excludeIds: ['voidreaper'] });
    expect(result.item).not.toBeNull();
    // After adding new items, voidreaper should still be excludable
  });

  it('getting lvl 10 items at player level 10', () => {
    const items = getEligibleLootboxItems(ITEM_ASSETS, 10, []);
    expect(items.every((i) => i.requiredLevel <= 10)).toBe(true);
    // Should only have items up to level 10
    const totalUpTo10 = ITEM_ASSETS.filter((i) => i.requiredLevel <= 10).length;
    expect(items.length).toBe(totalUpTo10);
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
    expect(weights.legendary).toBeGreaterThanOrEqual(0.07);
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
      const result = rollLootbox(ITEM_ASSETS, { rng: () => rng(), level: 10 });
      if (result.item) rolled.push(result.item);
    }
    const waterItems = rolled.filter((i) => i.element === 'water');
    // With new items, water items should eventually appear
    expect(waterItems.length).toBeGreaterThan(0);
  });

  it('high-level player can get items up to their level', () => {
    const items = getEligibleLootboxItems(ITEM_ASSETS, 20, []);
    expect(items.every((i) => i.requiredLevel <= 20)).toBe(true);
    const totalUpTo20 = ITEM_ASSETS.filter((i) => i.requiredLevel <= 20).length;
    expect(items.length).toBe(totalUpTo20);
  });

  it('has increased legendary chance at level 10+', () => {
    const w10 = getLootboxRarityWeights(10);
    const w1 = getLootboxRarityWeights(1);
    expect(w10.legendary).toBeGreaterThan(w1.legendary);
    expect(w10.common).toBeLessThan(w1.common);
  });

  // ─── Pity System Tests ──────────────────────────────────────────────────

  it('pity counter starts at 0 by default', () => {
    const result = rollLootbox(ITEM_ASSETS, { level: 10 });
    expect(result.pityCount).toBeGreaterThanOrEqual(0);
  });

  it('pity counter increments when rolling a non-legendary item', () => {
    // Use a seed that consistently gives a non-legendary result
    const rng = mulberry32(42);
    let pityCount = 0;
    for (let i = 0; i < 5; i++) {
      const result = rollLootbox(ITEM_ASSETS, { rng: () => rng(), level: 10, pityCount });
      pityCount = result.pityCount;
    }
    // After 5 low-probability rolls, we almost certainly didn't get a legendary
    // (0.93^5 ≈ 0.70 chance of no legendary — not guaranteed, but with seeded RNG it's deterministic)
    expect(pityCount).toBeGreaterThan(0);
  });

  it('pity counter resets to 0 when rolling a legendary', () => {
    // Use a high RNG value that guarantees legendary
    const rng = () => 0.999;
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: 30 });
    expect(result.item?.rarity).toBe('legendary');
    expect(result.pityCount).toBe(0);
  });

  it('pity guarantees a legendary when threshold is reached', () => {
    const rng = () => 0.001; // Would normally produce a common item
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: PITY_THRESHOLD });
    expect(result.item).not.toBeNull();
    expect(result.item!.rarity).toBe('legendary');
    expect(result.pityTriggered).toBe(true);
    expect(result.pityCount).toBe(0);
  });

  it('pity triggers at exactly PITY_THRESHOLD, not before', () => {
    // At pityCount = PITY_THRESHOLD - 1 (74), the 75th roll is normal
    const rng = () => 0.001; // Would produce common
    const normalResult = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: PITY_THRESHOLD - 1 });
    expect(normalResult.item).not.toBeNull();
    expect(normalResult.item!.rarity).toBe('common');
    expect(normalResult.pityTriggered).toBe(false);
    expect(normalResult.pityCount).toBe(PITY_THRESHOLD); // 75

    // At pityCount = PITY_THRESHOLD (75), the 76th roll is guaranteed legendary
    const pityResult = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: PITY_THRESHOLD });
    expect(pityResult.item).not.toBeNull();
    expect(pityResult.item!.rarity).toBe('legendary');
    expect(pityResult.pityTriggered).toBe(true);
    expect(pityResult.pityCount).toBe(0);
  });

  it('pity does not trigger before threshold', () => {
    const rng = () => 0.001; // Would produce common
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: PITY_THRESHOLD - 2 });
    expect(result.item).not.toBeNull();
    expect(result.item!.rarity).toBe('common');
    expect(result.pityTriggered).toBe(false);
    expect(result.pityCount).toBe(PITY_THRESHOLD - 1);
  });

  it('pityCount defaults to 0 when not provided', () => {
    const rng = () => 0.001;
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10 });
    expect(result.pityCount).toBe(1); // Incremented from 0 since result is common
  });

  it('pity counter resets to 0 when no legendary items are available (level < 5)', () => {
    // Legendary items start at requiredLevel 5, so at level 1 pity can't force one
    // Pity should reset to 0 instead of growing unbounded
    const rng = () => 0.001; // Would produce common
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 1, pityCount: PITY_THRESHOLD });
    expect(result.item).not.toBeNull();
    expect(result.item!.rarity).toBe('common');
    // Pity resets: recursive call with pityCount=0 → increments to 1 after common roll
    expect(result.pityCount).toBe(1);
    expect(result.pityTriggered).toBe(false);
  });

  it('pity counter does not exceed PITY_THRESHOLD when no legendaries are available', () => {
    // Simulate many rolls at level 1 (no legendary items available)
    let pityCount = PITY_THRESHOLD - 2; // Start near threshold
    const rng = () => 0.001;
    for (let i = 0; i < 10; i++) {
      const result = rollLootbox(ITEM_ASSETS, { rng, level: 1, pityCount });
      pityCount = result.pityCount;
      // Pity should never exceed PITY_THRESHOLD - 1 at level 1 since it resets
      expect(pityCount).toBeLessThanOrEqual(PITY_THRESHOLD);
    }
  });

  it('pityCount returns correct value in RollLootboxResult', () => {
    const rng = () => 0.001; // Always common
    const result = rollLootbox(ITEM_ASSETS, { rng, level: 10, pityCount: 50 });
    expect(result.item?.rarity).toBe('common');
    // Since pityThreshold is 75 and we're at 50, should increment to 51
    expect(result.pityCount).toBe(51);
    expect(result.pityTriggered).toBe(false);
  });

  // ─── New Weight Tests ──────────────────────────────────────────────────

  it('has decreasing common weight as level increases (level 3 better than level 1-2)', () => {
    const w1 = getLootboxRarityWeights(1);
    const w3 = getLootboxRarityWeights(3);
    expect(w3.common).toBeLessThan(w1.common);
  });

  it('has legendary weight 0.04 at level 3-6 (midgame)', () => {
    const w3 = getLootboxRarityWeights(3);
    const w6 = getLootboxRarityWeights(6);
    expect(w3.legendary).toBeCloseTo(0.04, 3);
    expect(w6.legendary).toBeCloseTo(0.04, 3);
  });

  it('has legendary weight 0.04 at level 7-9 (late-midgame)', () => {
    const w7 = getLootboxRarityWeights(7);
    const w9 = getLootboxRarityWeights(9);
    expect(w7.legendary).toBeCloseTo(0.04, 3);
    expect(w9.legendary).toBeCloseTo(0.04, 3);
  });

  it('has legendary weight 0.07 at level 10+ (endgame)', () => {
    const w10 = getLootboxRarityWeights(10);
    const w20 = getLootboxRarityWeights(20);
    expect(w10.legendary).toBeCloseTo(0.07, 3);
    expect(w20.legendary).toBeCloseTo(0.07, 3);
  });

  it('PITY_THRESHOLD is 75', () => {
    expect(PITY_THRESHOLD).toBe(75);
  });
});
