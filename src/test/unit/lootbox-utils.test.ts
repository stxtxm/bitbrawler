import { describe, it, expect } from 'vitest';
import { canRollLootbox, rollLootbox } from '../../utils/lootboxUtils';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { mulberry32 } from '../../utils/randomUtils';

describe('lootboxUtils', () => {
  it('allows one roll per UTC day', () => {
    const now = Date.UTC(2024, 0, 2, 10, 0, 0);
    const sameDay = Date.UTC(2024, 0, 2, 1, 0, 0);
    const previousDay = Date.UTC(2024, 0, 1, 23, 59, 0);

    expect(canRollLootbox(undefined, now)).toBe(true);
    expect(canRollLootbox(sameDay, now)).toBe(false);
    expect(canRollLootbox(previousDay, now)).toBe(true);
  });

  it('rolls a common item for low random values', () => {
    const rng = () => 0.05;
    const item = rollLootbox(ITEM_ASSETS, rng);
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('common');
  });

  it('rolls an uncommon item for high random values', () => {
    const rng = () => 0.95;
    const item = rollLootbox(ITEM_ASSETS, rng);
    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('uncommon');
  });

  it('falls back to the available pool when the target rarity is empty', () => {
    const uncommonOnly = ITEM_ASSETS.filter((item) => item.rarity === 'uncommon');
    const rng = () => 0.05; // would target common
    const item = rollLootbox(uncommonOnly, rng);

    expect(item).not.toBeNull();
    expect(item?.rarity).toBe('uncommon');
  });

  it('respects rarity weights over many rolls', () => {
    const rng = mulberry32(424242);
    let uncommonCount = 0;
    const totalRolls = 1000;

    for (let i = 0; i < totalRolls; i++) {
      const item = rollLootbox(ITEM_ASSETS, rng);
      if (item?.rarity === 'uncommon') uncommonCount += 1;
    }

    const ratio = uncommonCount / totalRolls;
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.28);
  });

  it('handles timestamp-like last roll values', () => {
    const now = Date.UTC(2024, 0, 2, 10, 0, 0);
    const sameDaySeconds = Math.floor(Date.UTC(2024, 0, 2, 1, 0, 0) / 1000);
    const timestampLike = { seconds: sameDaySeconds, nanoseconds: 0 };

    expect(canRollLootbox(timestampLike, now)).toBe(false);

    const toMillisLike = { toMillis: () => Date.UTC(2024, 0, 2, 2, 0, 0) };
    expect(canRollLootbox(toMillisLike, now)).toBe(false);
  });
});
