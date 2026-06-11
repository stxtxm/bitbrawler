import { describe, it, expect } from 'vitest';
import {
  canRollLootbox,
  computeNextStreak,
  getEligibleLootboxItems,
  getLootboxRarityWeights,
  getStreakBonus,
  RARITY_RANK,
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

  it('rolls an uncommon item for high random values', () => {
    // At level 4 with all rarities available, weights are:
    // common=0.58, uncommon=0.25, rare=0.12, epic=0.05
    // rng=0.7 lands in the uncommon bucket [0.58, 0.83)
    const rng = () => 0.7;
    const item = rollLootbox(ITEM_ASSETS, { rng, level: 4 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('uncommon');
  });

  it('falls back to the available pool when the target rarity is empty', () => {
    const uncommonOnly = ITEM_ASSETS
      .filter((item) => item.rarity === 'uncommon')
      .map((item) => ({ ...item, requiredLevel: 1 }));
    const rng = () => 0.05; // would target common
    const item = rollLootbox(uncommonOnly, { rng, level: 1 });

    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('uncommon');
  });

  it('excludes already owned items from the roll', () => {
    const makeItem = (id: string): PixelItemAsset => ({
      id,
      name: id,
      rarity: 'common',
      slot: 'weapon',
      stats: { strength: 1 },
      pixels: [[1]],
      requiredLevel: 1
    });
    const items = [makeItem('owned'), makeItem('fresh')];
    const rng = () => 0.01;
    const item = rollLootbox(items, { rng, excludeIds: ['owned'], level: 1 });

    expect(item).not.toBeNull();
    expect(item?.id).toBe('fresh');
  });

  it('returns null when all items are excluded', () => {
    const makeItem = (id: string): PixelItemAsset => ({
      id,
      name: id,
      rarity: 'common',
      slot: 'weapon',
      stats: { strength: 1 },
      pixels: [[1]],
      requiredLevel: 1
    });
    const items = [makeItem('only')];
    const item = rollLootbox(items, { rng: () => 0.2, excludeIds: ['only'], level: 1 });
    expect(item).toBeNull();
  });

  it('respects rarity weights over many rolls', () => {
    const rng = mulberry32(424242);
    let uncommonCount = 0;
    const totalRolls = 1000;

    for (let i = 0; i < totalRolls; i++) {
      const item = rollLootbox(ITEM_ASSETS, { rng, level: 4 });
      if (item?.rarity === 'uncommon') uncommonCount += 1;
    }

    const ratio = uncommonCount / totalRolls;
    expect(ratio).toBeGreaterThan(0.15);
    expect(ratio).toBeLessThan(0.35);
  });

  it('handles timestamp-like last roll values', () => {
    const now = Date.UTC(2024, 0, 2, 10, 0, 0);
    const sameDaySeconds = Math.floor(Date.UTC(2024, 0, 2, 1, 0, 0) / 1000);
    const timestampLike = { seconds: sameDaySeconds, nanoseconds: 0 };

    expect(canRollLootbox(timestampLike, now)).toBe(false);

    const toMillisLike = { toMillis: () => Date.UTC(2024, 0, 2, 2, 0, 0) };
    expect(canRollLootbox(toMillisLike, now)).toBe(false);
  });

  it('filters eligible items by required level', () => {
    const items: PixelItemAsset[] = [
      { id: 'low', name: 'Low', slot: 'weapon', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'high', name: 'High', slot: 'weapon', rarity: 'rare', stats: { strength: 3 }, pixels: [[1]], requiredLevel: 5 },
    ];
    const eligible = getEligibleLootboxItems(items, 3);
    expect(eligible.map((item) => item.id)).toEqual(['low']);
  });

  it('increases rare chances at higher levels', () => {
    const low = getLootboxRarityWeights(1);
    const mid = getLootboxRarityWeights(4);
    const high = getLootboxRarityWeights(10);
    expect(high.rare).toBeGreaterThan(low.rare);
    expect(high.epic).toBeGreaterThan(mid.epic);
  });

  it('has adjusted base weights at level 1 (common 0.50)', () => {
    const weights = getLootboxRarityWeights(1);
    expect(weights.common).toBe(0.50);
  });

  it('has adjusted base weights at level 1 (rare 0.17)', () => {
    const weights = getLootboxRarityWeights(1);
    expect(weights.rare).toBe(0.17);
  });

  it('has adjusted base weights at level 1 (epic 0.13)', () => {
    const weights = getLootboxRarityWeights(1);
    expect(weights.epic).toBe(0.13);
  });

  it('sum of weights at level 1 equals 1.002 (includes legendary)', () => {
    const weights = getLootboxRarityWeights(1);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.002, 5);
  });

  // ─── Legendary Rarity Tests ──────────────────────────────────────────────

  it('includes legendary in RARITY_RANK', () => {
    expect(RARITY_RANK.legendary).toBe(4);
  });

  it('includes legendary in getLootboxRarityWeights at level 10+', () => {
    const weights = getLootboxRarityWeights(10);
    expect(weights.legendary).toBeGreaterThan(0);
    expect(weights.legendary).toBe(0.05);
  });

  it('includes legendary in getLootboxRarityWeights at level 7-9', () => {
    const weights = getLootboxRarityWeights(7);
    expect(weights.legendary).toBeGreaterThan(0);
    expect(weights.legendary).toBe(0.02);
  });

  it('includes legendary at level 1 with 0.002 weight', () => {
    const weights = getLootboxRarityWeights(1);
    expect(weights.legendary).toBe(0.002);
  });

  it('includes legendary at level 2 with 0.002 weight', () => {
    const weights = getLootboxRarityWeights(2);
    expect(weights.legendary).toBe(0.002);
  });

  it('includes legendary at level 3 with 0.002 weight', () => {
    const weights = getLootboxRarityWeights(3);
    expect(weights.legendary).toBe(0.002);
  });

  it('sum of weights at level 3 equals 1.0', () => {
    const weights = getLootboxRarityWeights(3);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('includes legendary at level 4-6', () => {
    const weights = getLootboxRarityWeights(4);
    expect(weights.legendary).toBe(0.01);
  });

  it('keeps legendary at 0.01 for level 6 (upper edge of tier)', () => {
    const weights = getLootboxRarityWeights(6);
    expect(weights.legendary).toBe(0.01);
  });

  it('reduces common from 0.53 to 0.52 at level 4-6 to compensate for legendary', () => {
    const weights = getLootboxRarityWeights(4);
    expect(weights.common).toBe(0.52);
  });

  it('sum of weights at level 4 equals 1.0', () => {
    const weights = getLootboxRarityWeights(4);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('rolls a legendary item at level 3 with favorable RNG', () => {
    // At level 3: legendary weight = 0.002, total = 1.0
    // legendary is the last bucket, so rng > 0.998 should hit it
    const customItems: PixelItemAsset[] = [
      { id: 'leg', name: 'Test Legendary', slot: 'weapon', rarity: 'legendary', stats: { strength: 5 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'common1', name: 'Common', slot: 'weapon', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
    ];
    const rng = () => 0.999;
    const item = rollLootbox(customItems, { rng, level: 3 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('legendary');
  });

  it('rolls a legendary item at level 4 with favorable RNG', () => {
    // At level 4: legendary weight = 0.01, total = 1.0
    // legendary is the last bucket, so rng > 0.99 should hit it
    // Use custom pool with a legendary item available at level 4
    const customItems: PixelItemAsset[] = [
      { id: 'leg', name: 'Test Legendary', slot: 'weapon', rarity: 'legendary', stats: { strength: 5 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'common1', name: 'Common', slot: 'weapon', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
    ];
    const rng = () => 0.995;
    const item = rollLootbox(customItems, { rng, level: 4 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('legendary');
  });

  it('rolls legendary approximately at expected rate at level 4', () => {
    // Custom pool with legendary available at level 4
    const customItems: PixelItemAsset[] = [
      { id: 'leg', name: 'Test Legendary', slot: 'weapon', rarity: 'legendary', stats: { strength: 5 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'common1', name: 'Common 1', slot: 'weapon', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'common2', name: 'Common 2', slot: 'armor', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
    ];
    const rng = mulberry32(98765);
    let legendaryCount = 0;
    const totalRolls = 2000;

    for (let i = 0; i < totalRolls; i++) {
      const item = rollLootbox(customItems, { rng, level: 4 });
      if (item?.rarity === 'legendary') legendaryCount += 1;
    }

    const ratio = legendaryCount / totalRolls;
    // Expected ~1%, allow some variance
    expect(ratio).toBeGreaterThan(0.001);
    expect(ratio).toBeLessThan(0.03);
  });

  it('rolls a legendary item at high level with favorable RNG', () => {
    // At level 10: legendary weight = 0.05
    // Total weight at level 10: 0.38+0.25+0.18+0.14+0.05 = 1.0
    // legendary is the last bucket, so rng > 0.95 should hit it
    const rng = () => 0.99;
    const item = rollLootbox(ITEM_ASSETS, { rng, level: 10 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('legendary');
  });

  it('rolls a legendary item at level 1 with favorable RNG', () => {
    // At level 1: legendary weight = 0.002, total = 1.002
    // legendary is the last bucket, so rng > (1.002 - 0.002)/1.002 ≈ 0.998 should hit it
    const customItems: PixelItemAsset[] = [
      { id: 'leg', name: 'Test Legendary', slot: 'weapon', rarity: 'legendary', stats: { strength: 5 }, pixels: [[1]], requiredLevel: 1 },
      { id: 'common1', name: 'Common', slot: 'weapon', rarity: 'common', stats: { strength: 1 }, pixels: [[1]], requiredLevel: 1 },
    ];
    const rng = () => 0.999;
    const item = rollLootbox(customItems, { rng, level: 1 });
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('legendary');
  });

  it('rolls legendary approximately at expected rate at level 10', () => {
    const rng = mulberry32(123456);
    let legendaryCount = 0;
    const totalRolls = 2000;

    for (let i = 0; i < totalRolls; i++) {
      const item = rollLootbox(ITEM_ASSETS, { rng, level: 10 });
      if (item?.rarity === 'legendary') legendaryCount += 1;
    }

    const ratio = legendaryCount / totalRolls;
    // Expected ~5%, allow some variance
    expect(ratio).toBeGreaterThan(0.01);
    expect(ratio).toBeLessThan(0.10);
  });

  // ─── Streak System Tests ─────────────────────────────────────────────────

  describe('getStreakBonus', () => {
    it('returns base bonus for streak 0', () => {
      const bonus = getStreakBonus(0);
      expect(bonus.weightBonus).toBe(0);
      expect(bonus.minRarity).toBeNull();
      expect(bonus.doubleRoll).toBe(false);
    });

    it('returns base bonus for streak 1-3', () => {
      expect(getStreakBonus(1).weightBonus).toBe(0);
      expect(getStreakBonus(3).weightBonus).toBe(0);
    });

    it('returns +10% bonus for streak 4-7', () => {
      expect(getStreakBonus(4).weightBonus).toBe(0.02);
      expect(getStreakBonus(7).weightBonus).toBe(0.02);
    });

    it('returns +25% bonus for streak 8-14', () => {
      const bonus = getStreakBonus(8);
      expect(bonus.weightBonus).toBe(0.05);
      expect(bonus.minRarity).toBe('uncommon');

      const bonus14 = getStreakBonus(14);
      expect(bonus14.weightBonus).toBe(0.05);
      expect(bonus14.minRarity).toBe('uncommon');
    });

    it('returns +50% bonus for streak 15-30', () => {
      const bonus = getStreakBonus(15);
      expect(bonus.weightBonus).toBe(0.08);
      expect(bonus.minRarity).toBe('rare');

      const bonus30 = getStreakBonus(30);
      expect(bonus30.weightBonus).toBe(0.08);
      expect(bonus30.minRarity).toBe('rare');
    });

    it('returns double roll for streak 31+', () => {
      const bonus = getStreakBonus(31);
      expect(bonus.doubleRoll).toBe(true);
      expect(bonus.weightBonus).toBe(0);
      expect(bonus.minRarity).toBeNull();

      const bonus100 = getStreakBonus(100);
      expect(bonus100.doubleRoll).toBe(true);
    });
  });

  describe('computeNextStreak', () => {
    it('returns 1 when never rolled', () => {
      expect(computeNextStreak(null, 0, Date.now())).toBe(1);
      expect(computeNextStreak(undefined, 0, Date.now())).toBe(1);
    });

    it('returns current streak when already rolled today', () => {
      const now = Date.UTC(2025, 0, 2, 10, 0, 0);
      const todayRoll = Date.UTC(2025, 0, 2, 1, 0, 0);
      expect(computeNextStreak(todayRoll, 5, now)).toBe(5);
    });

    it('increments streak when last roll was yesterday', () => {
      const now = Date.UTC(2025, 0, 2, 10, 0, 0);
      const yesterdayRoll = Date.UTC(2025, 0, 1, 10, 0, 0);
      expect(computeNextStreak(yesterdayRoll, 5, now)).toBe(6);
    });

    it('resets to 1 when last roll was before yesterday', () => {
      const now = Date.UTC(2025, 0, 5, 10, 0, 0);
      const oldRoll = Date.UTC(2025, 0, 2, 10, 0, 0);
      expect(computeNextStreak(oldRoll, 5, now)).toBe(1);
    });

    it('handles streak increment from 0', () => {
      const now = Date.UTC(2025, 0, 2, 10, 0, 0);
      const yesterdayRoll = Date.UTC(2025, 0, 1, 10, 0, 0);
      expect(computeNextStreak(yesterdayRoll, 0, now)).toBe(1);
    });
  });

  describe('rollLootbox with streak', () => {
    it('adds weight bonus to rare/epic for streak 4-7', () => {
      // With streak=5, weightBonus is 0.02
      // At level 4: rare=0.12, epic=0.05 -> with bonus: rare=0.14, epic=0.07
      // Common=0.58, uncommon=0.25
      // Total: 0.58+0.25+0.14+0.07 = 1.04
      // rare threshold starts at 0.58+0.25 = 0.83, ends at 0.97
      // So rng=0.9 should hit rare
      const rng = () => 0.9;
      const item = rollLootbox(ITEM_ASSETS, { rng, level: 4, streak: 5 });
      expect(item).not.toBeNull();
      expect(item?.rarity).toBe('rare');
    });

    it('never returns common for streak 8-14 (minRarity uncommon)', () => {
      // Run many deterministic rolls and verify no common
      const rng = mulberry32(12345);
      for (let i = 0; i < 200; i++) {
        const item = rollLootbox(ITEM_ASSETS, { rng, level: 1, streak: 10 });
        if (item) {
          expect(item.rarity).not.toBe('common');
        }
      }
    });

    it('never returns common or uncommon for streak 15-30 (minRarity rare)', () => {
      const rng = mulberry32(67890);
      for (let i = 0; i < 200; i++) {
        const item = rollLootbox(ITEM_ASSETS, { rng, level: 10, streak: 20 });
        if (item) {
          expect(item.rarity === 'common' || item.rarity === 'uncommon').toBe(false);
        }
      }
    });

    it('double roll picks the better item for streak 31+', () => {
      // With a deterministic rng that returns sequential values,
      // double roll should pick the better of two rolls
      let callCount = 0;
      const rng = () => {
        callCount++;
        // First roll: rng=0.05 (common), Second roll: rng=0.9 (rare or epic)
        // The second roll should be picked
        return callCount <= 2 ? 0.05 : 0.9;
      };

      const item = rollLootbox(ITEM_ASSETS, { rng, level: 4, streak: 35 });
      expect(item).not.toBeNull();
      // The double roll should result in a better rarity than common
      expect(item?.rarity === 'common').toBe(false);
    });
  });
});
