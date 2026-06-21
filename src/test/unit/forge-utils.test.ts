import { describe, it, expect } from 'vitest';
import {
  getEssenceYield,
  salvageItem,
  canFuse,
  performFusion,
  canUpgrade,
  performUpgrade,
} from '../../utils/forgeUtils';
import {
  ESSENCE_YIELD,
  FUSION_COST,
  FUSION_INPUT_COUNT,
  UPGRADE_COST,
  MAX_UPGRADE_LEVEL,
  LUCKY_PROC_CHANCE,
  ESSENCE_SOFT_CAP,
} from '../../data/forgeConstants';
import { PixelItemAsset } from '../../types/Item';
import { Character } from '../../types/Character';

const makeItem = (
  id: string,
  rarity: PixelItemAsset['rarity'] = 'common',
  overrides?: Partial<PixelItemAsset>
): PixelItemAsset => ({
  id,
  name: id,
  rarity,
  slot: 'weapon',
  stats: { strength: 1 },
  pixels: [[1]],
  requiredLevel: 1,
  ...overrides,
});

const makeCharacter = (overrides?: Partial<Character>): Character => ({
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
  experience: 100,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 3,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 0,
  itemUpgrades: {},
  ...overrides,
});

// ─── Constants Structure ──────────────────────────────────────────────────

describe('forgeConstants', () => {
  it('defines ESSENCE_YIELD for all rarities', () => {
    const rarities: PixelItemAsset['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const r of rarities) {
      expect(typeof ESSENCE_YIELD[r]).toBe('number');
      expect(ESSENCE_YIELD[r]).toBeGreaterThan(0);
    }
  });

  it('defines FUSION_COST for all rarities', () => {
    const rarities: PixelItemAsset['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const r of rarities) {
      expect(typeof FUSION_COST[r]).toBe('number');
      expect(FUSION_COST[r]).toBeGreaterThanOrEqual(0);
    }
  });

  it('defines FUSION_INPUT_COUNT as 3', () => {
    expect(FUSION_INPUT_COUNT).toBe(3);
  });

  it('defines UPGRADE_COST as 25', () => {
    expect(UPGRADE_COST).toBe(25);
  });

  it('defines MAX_UPGRADE_LEVEL as 5', () => {
    expect(MAX_UPGRADE_LEVEL).toBe(5);
  });

  it('defines LUCKY_PROC_CHANCE as 0.1', () => {
    expect(LUCKY_PROC_CHANCE).toBe(0.1);
  });

  it('defines ESSENCE_SOFT_CAP as 500', () => {
    expect(ESSENCE_SOFT_CAP).toBe(500);
  });
});

// ─── getEssenceYield ──────────────────────────────────────────────────────

describe('getEssenceYield', () => {
  it('returns correct essence for common item', () => {
    expect(getEssenceYield(makeItem('test', 'common'))).toBe(ESSENCE_YIELD.common);
  });

  it('returns correct essence for uncommon item', () => {
    expect(getEssenceYield(makeItem('test', 'uncommon'))).toBe(ESSENCE_YIELD.uncommon);
  });

  it('returns correct essence for rare item', () => {
    expect(getEssenceYield(makeItem('test', 'rare'))).toBe(ESSENCE_YIELD.rare);
  });

  it('returns correct essence for epic item', () => {
    expect(getEssenceYield(makeItem('test', 'epic'))).toBe(ESSENCE_YIELD.epic);
  });

  it('returns correct essence for legendary item', () => {
    expect(getEssenceYield(makeItem('test', 'legendary'))).toBe(ESSENCE_YIELD.legendary);
  });
});

// ─── salvageItem ──────────────────────────────────────────────────────────

describe('salvageItem', () => {
  it('removes item from inventory and adds essence', () => {
    const item = makeItem('rusty_sword', 'common');
    const char = makeCharacter({ inventory: ['rusty_sword'] });

    const result = salvageItem('rusty_sword', char, [item]);

    expect(result.inventory).not.toContain('rusty_sword');
    expect(result.essence).toBe(ESSENCE_YIELD.common);
  });

  it('does nothing if item not in inventory', () => {
    const item = makeItem('rusty_sword', 'common');
    const char = makeCharacter({ inventory: ['other_item'] });

    const result = salvageItem('rusty_sword', char, [item]);

    expect(result.inventory).toEqual(['other_item']);
    expect(result.essence).toBe(0);
  });

  it('caps essence at ESSENCE_SOFT_CAP', () => {
    const item = makeItem('legendary_sword', 'legendary');
    const char = makeCharacter({
      inventory: ['legendary_sword'],
      essence: ESSENCE_SOFT_CAP - ESSENCE_YIELD.legendary + 1, // just above soft cap
    });

    const result = salvageItem('legendary_sword', char, [item]);

    expect(result.essence).toBe(ESSENCE_SOFT_CAP);
  });

  it('handles non-existent item ID gracefully (returns char unchanged)', () => {
    const char = makeCharacter({ inventory: ['rusty_sword'] });
    const result = salvageItem('non_existent', char, [makeItem('rusty_sword')]);
    expect(result).toBe(char);
  });
});

// ─── canFuse ──────────────────────────────────────────────────────────────

describe('canFuse', () => {
  it('returns true when 3 same-rarity items and enough essence', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });

    expect(canFuse(items, char)).toBe(true);
  });

  it('returns false when not enough items', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b'],
      essence: FUSION_COST.common,
    });

    expect(canFuse(items, char)).toBe(false);
  });

  it('returns false when items are of different rarities', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'uncommon'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });

    expect(canFuse(items, char)).toBe(false);
  });

  it('returns false when not enough essence', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: 0,
    });

    expect(canFuse(items, char)).toBe(false);
  });

  it('returns false for legendary items (no higher tier)', () => {
    const items = [
      makeItem('a', 'legendary'),
      makeItem('b', 'legendary'),
      makeItem('c', 'legendary'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.legendary,
    });

    expect(canFuse(items, char)).toBe(false);
  });

  it('returns false if any item is not in inventory', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b'], // missing 'c'
      essence: FUSION_COST.common,
    });

    expect(canFuse(items, char)).toBe(false);
  });
});

// ─── performFusion ────────────────────────────────────────────────────────

describe('performFusion', () => {
  it('consumes 3 common items and returns an uncommon item', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const pool = [
      ...items,
      makeItem('result_item', 'uncommon'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });

    // Use deterministic RNG that never triggers lucky proc
    const rng = () => LUCKY_PROC_CHANCE;
    const { result, updatedChar } = performFusion(items, char, pool, rng);

    expect(result).not.toBeNull();
    expect(result!.rarity).toBe('uncommon');
    expect(updatedChar.essence).toBe(0); // consumed
    expect(updatedChar.inventory).toHaveLength(1); // only the result
    expect(updatedChar.inventory![0]).toBe(result!.id);
  });

  it('uses the items array as the pool for the result item', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    // Only provide an uncommon item in the pool
    const pool = [makeItem('result_item', 'uncommon', { id: 'fusion_result' })];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });

    // Use deterministic RNG that never triggers lucky proc
    const rng = () => LUCKY_PROC_CHANCE;
    const { result, updatedChar } = performFusion(items, char, pool, rng);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('fusion_result');
    expect(updatedChar.inventory).toContain('fusion_result');
  });

  it('deducts fusion cost from essence', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: 100,
    });

    const { updatedChar } = performFusion(items, char, items);

    expect(updatedChar.essence).toBe(100 - FUSION_COST.common);
  });

  it('does not mutate the original character', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: 100,
    });
    const originalInventory = [...(char.inventory ?? [])];
    const originalEssence = char.essence;

    performFusion(items, char, items);

    expect(char.inventory).toEqual(originalInventory);
    expect(char.essence).toBe(originalEssence);
  });

  it('applies lucky proc for two-tier upgrade when rng < LUCKY_PROC_CHANCE', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });
    // All items in pool that are rare (two tiers above common)
    const pool = [
      makeItem('rare_item', 'rare'),
      makeItem('uncommon_item', 'uncommon'),
    ];

    const rng = () => LUCKY_PROC_CHANCE - 0.01; // triggers lucky proc
    const { result } = performFusion(items, char, pool, rng);

    expect(result).not.toBeNull();
    expect(result!.rarity).toBe('rare');
  });

  it('does not apply lucky proc when rng >= LUCKY_PROC_CHANCE', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });
    const pool = [
      makeItem('rare_item', 'rare'),
      makeItem('uncommon_item', 'uncommon'),
    ];

    const rng = () => LUCKY_PROC_CHANCE; // no lucky proc
    const { result } = performFusion(items, char, pool, rng);

    expect(result).not.toBeNull();
    expect(result!.rarity).toBe('uncommon');
  });

  it('returns null result if pool has no items of the target rarity', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'common'),
      makeItem('c', 'common'),
    ];
    const char = makeCharacter({
      inventory: ['a', 'b', 'c'],
      essence: FUSION_COST.common,
    });
    // Only common items in pool — no uncommon available
    const pool = [makeItem('another_common', 'common')];

    const { result, updatedChar } = performFusion(items, char, pool);

    expect(result).toBeNull();
    // Items should still be consumed
    expect(updatedChar.inventory).not.toContain('a');
    expect(updatedChar.inventory).not.toContain('b');
    expect(updatedChar.inventory).not.toContain('c');
  });
});

// ─── canUpgrade ───────────────────────────────────────────────────────────

describe('canUpgrade', () => {
  it('returns true when item is in inventory and enough essence and not max level', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: {},
    });

    expect(canUpgrade('rusty_sword', char)).toBe(true);
  });

  it('returns false when item not in inventory', () => {
    const char = makeCharacter({
      inventory: [],
      essence: UPGRADE_COST,
    });

    expect(canUpgrade('rusty_sword', char)).toBe(false);
  });

  it('returns false when not enough essence', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: 0,
    });

    expect(canUpgrade('rusty_sword', char)).toBe(false);
  });

  it('returns false when item already at max upgrade level', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
    });

    expect(canUpgrade('rusty_sword', char)).toBe(false);
  });

  it('returns true for item at level 4 (one below max)', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL - 1 },
    });

    expect(canUpgrade('rusty_sword', char)).toBe(true);
  });
});

// ─── performUpgrade ───────────────────────────────────────────────────────

describe('performUpgrade', () => {
  it('increments upgrade level and consumes essence', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: {},
    });

    const result = performUpgrade('rusty_sword', char);

    expect(result.itemUpgrades?.rusty_sword).toBe(1);
    expect(result.essence).toBe(0);
  });

  it('increments from level 2 to 3', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST * 2,
      itemUpgrades: { rusty_sword: 2 },
    });

    const result = performUpgrade('rusty_sword', char);

    expect(result.itemUpgrades?.rusty_sword).toBe(3);
    expect(result.essence).toBe(UPGRADE_COST);
  });

  it('does not exceed MAX_UPGRADE_LEVEL', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
    });

    const result = performUpgrade('rusty_sword', char);

    // Should be unchanged since already at max
    expect(result.itemUpgrades?.rusty_sword).toBe(MAX_UPGRADE_LEVEL);
    expect(result.essence).toBe(UPGRADE_COST);
  });

  it('does not mutate the original character', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: {},
    });

    performUpgrade('rusty_sword', char);

    expect(char.itemUpgrades?.rusty_sword).toBeUndefined();
    expect(char.essence).toBe(UPGRADE_COST);
  });

  it('initializes itemUpgrades if undefined', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: undefined,
    });

    const result = performUpgrade('rusty_sword', char);

    expect(result.itemUpgrades?.rusty_sword).toBe(1);
  });
});
