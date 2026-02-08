import { describe, it, expect } from 'vitest';
import { canRollLootbox, rollLootbox } from '../../utils/lootboxUtils';
import { ITEM_ASSETS } from '../../data/itemAssets';

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
});
