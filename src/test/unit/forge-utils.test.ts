import { describe, it, expect } from 'vitest';
import {
  getEssenceYield,
  salvageItem,
  salvageItems,
  canFuse,
  performFusion,
  canUpgrade,
  performUpgrade,
  canSalvageItem,
  getItemUpgradeLevel,
  isFusionLucky,
  getUpgradeCost,
} from '../../utils/forgeUtils';
import {
  ESSENCE_YIELD,
  SALVAGE_YIELD,
  FUSION_COST,
  FUSION_ESSENCE_COST,
  FUSION_INPUT_COUNT,
  UPGRADE_COST,
  UPGRADE_BASE_COST,
  MAX_UPGRADE_LEVEL,
  LUCKY_PROC_CHANCE,
  ESSENCE_SOFT_CAP,
  UPGRADE_COST_SCALING,
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
  describe('ESSENCE_YIELD / SALVAGE_YIELD', () => {
    it('defines correct salvage values per rarity', () => {
      expect(ESSENCE_YIELD.common).toBe(5);
      expect(ESSENCE_YIELD.uncommon).toBe(20);
      expect(ESSENCE_YIELD.rare).toBe(75);
      expect(ESSENCE_YIELD.epic).toBe(250);
      expect(ESSENCE_YIELD.legendary).toBe(1000);
    });

    it('SALVAGE_YIELD is an alias for ESSENCE_YIELD', () => {
      expect(SALVAGE_YIELD).toBe(ESSENCE_YIELD);
    });
  });

  describe('FUSION_COST / FUSION_ESSENCE_COST', () => {
    it('defines correct fusion costs per rarity', () => {
      expect(FUSION_COST.common).toBe(10);
      expect(FUSION_COST.uncommon).toBe(40);
      expect(FUSION_COST.rare).toBe(150);
      expect(FUSION_COST.epic).toBe(500);
      expect(FUSION_COST.legendary).toBe(0);
    });

    it('FUSION_ESSENCE_COST is an alias for FUSION_COST', () => {
      expect(FUSION_ESSENCE_COST).toBe(FUSION_COST);
    });
  });

  it('defines FUSION_INPUT_COUNT as 3', () => {
    expect(FUSION_INPUT_COUNT).toBe(3);
  });

  describe('UPGRADE_COST / UPGRADE_BASE_COST', () => {
    it('defines UPGRADE_COST as 25', () => {
      expect(UPGRADE_COST).toBe(25);
    });

    it('UPGRADE_BASE_COST is an alias for UPGRADE_COST', () => {
      expect(UPGRADE_BASE_COST).toBe(UPGRADE_COST);
    });
  });

  it('defines UPGRADE_COST_SCALING as 10', () => {
    expect(UPGRADE_COST_SCALING).toBe(10);
  });

  it('defines MAX_UPGRADE_LEVEL as 5', () => {
    expect(MAX_UPGRADE_LEVEL).toBe(5);
  });

  it('defines LUCKY_PROC_CHANCE as 0.1', () => {
    expect(LUCKY_PROC_CHANCE).toBe(0.1);
  });
  it('defines ESSENCE_SOFT_CAP as 250', () => {

    expect(ESSENCE_SOFT_CAP).toBe(250);
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

// ─── canSalvageItem ────────────────────────────────────────────────────────

describe('canSalvageItem', () => {
  it('returns true when item is in inventory and not equipped', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      equippedItems: { weapon: null, armor: null, accessory: null },
    });
    expect(canSalvageItem('rusty_sword', char)).toBe(true);
  });

  it('returns false when item is not in inventory', () => {
    const char = makeCharacter({
      inventory: [],
      equippedItems: { weapon: null, armor: null, accessory: null },
    });
    expect(canSalvageItem('rusty_sword', char)).toBe(false);
  });

  it('returns false when item is equipped in weapon slot', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
    });
    expect(canSalvageItem('rusty_sword', char)).toBe(false);
  });

  it('returns false when item is equipped in armor slot', () => {
    const char = makeCharacter({
      inventory: ['worn_bracers'],
      equippedItems: { weapon: null, armor: 'worn_bracers', accessory: null },
    });
    expect(canSalvageItem('worn_bracers', char)).toBe(false);
  });

  it('returns false when item is equipped in accessory slot', () => {
    const char = makeCharacter({
      inventory: ['lucky_charm'],
      equippedItems: { weapon: null, armor: null, accessory: 'lucky_charm' },
    });
    expect(canSalvageItem('lucky_charm', char)).toBe(false);
  });

  it('handles undefined equippedItems gracefully', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      equippedItems: undefined,
    });
    expect(canSalvageItem('rusty_sword', char)).toBe(true);
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

  it('returns true with duplicate item IDs when enough copies exist', () => {
    const item = makeItem('rusty_sword', 'common');
    const items = [item, item, item]; // 3 references to same item
    const char = makeCharacter({
      inventory: ['rusty_sword', 'rusty_sword', 'rusty_sword'], // 3 copies
      essence: FUSION_COST.common,
    });

    expect(canFuse(items, char)).toBe(true);
  });

  it('returns false with duplicate item IDs when not enough copies', () => {
    const item = makeItem('rusty_sword', 'common');
    const items = [item, item, item]; // need 3
    const char = makeCharacter({
      inventory: ['rusty_sword', 'rusty_sword'], // only 2 copies
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

    // Use controlled RNG to prevent flaky lucky proc
    const rng = () => 0.5;
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

    const rng = () => LUCKY_PROC_CHANCE; // ensure no lucky proc
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

  it('handles duplicate item IDs correctly (removes exactly 3 copies)', () => {
    const item = makeItem('rusty_sword', 'common');
    const items = [item, item, item];
    const pool = [...items, makeItem('result_rare', 'uncommon')];
    const char = makeCharacter({
      inventory: ['rusty_sword', 'rusty_sword', 'rusty_sword', 'rusty_sword'], // 4 copies
      essence: FUSION_COST.common,
    });

    // Use deterministic RNG that never triggers lucky proc
    const rng = () => LUCKY_PROC_CHANCE;
    const { result, updatedChar } = performFusion(items, char, pool, rng);

    expect(result).not.toBeNull();
    // Should have 2 items left: 1 result + 1 remaining copy
    expect(updatedChar.inventory).toHaveLength(2);
    expect(updatedChar.inventory!.filter((id) => id === 'rusty_sword')).toHaveLength(1);
    expect(updatedChar.inventory).toContain(result!.id);
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

  it('returns true when item is equipped (not in inventory) and enough essence', () => {
    const char = makeCharacter({
      inventory: [],
      essence: UPGRADE_COST,
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
    });

    expect(canUpgrade('rusty_sword', char)).toBe(true);
  });

  it('returns false when equipped item is already at max upgrade level', () => {
    const char = makeCharacter({
      inventory: [],
      essence: UPGRADE_COST,
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
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
      essence: UPGRADE_BASE_COST + (MAX_UPGRADE_LEVEL - 1) * UPGRADE_COST_SCALING, // cost at level 4
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL - 1 },
    });

    expect(canUpgrade('rusty_sword', char)).toBe(true);
  });

  it('returns false when enough essence for base cost but not for scaled cost at higher level', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_BASE_COST, // 25, enough for level 0 but not level 1 (35)
      itemUpgrades: { rusty_sword: 1 },
    });

    // cost at level 1 = 25 + 1*10 = 35, essence is 25, not enough
    expect(canUpgrade('rusty_sword', char)).toBe(false);
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
      essence: 100,
      itemUpgrades: { rusty_sword: 2 },
    });

    const result = performUpgrade('rusty_sword', char);
    // cost = UPGRADE_BASE_COST + level * UPGRADE_COST_SCALING = 25 + 2*10 = 45
    // essence after = 100 - 45 = 55

    expect(result.itemUpgrades?.rusty_sword).toBe(3);
    expect(result.essence).toBe(55);
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

  it('performs upgrade with exact essence amount', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: {},
    });

    const result = performUpgrade('rusty_sword', char);

    expect(result.essence).toBe(0);
    expect(result.itemUpgrades?.rusty_sword).toBe(1);
  });

  it('does nothing when item is at max upgrade level and returns character unchanged', () => {
    const char = makeCharacter({
      inventory: ['rusty_sword'],
      essence: UPGRADE_COST,
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
    });

    const result = performUpgrade('rusty_sword', char);

    expect(result).toBe(char);
  });
});

// ─── getItemUpgradeLevel ──────────────────────────────────────────────────

describe('getItemUpgradeLevel', () => {
  it('returns current upgrade level for an item', () => {
    const char = makeCharacter({ itemUpgrades: { rusty_sword: 3 } });
    expect(getItemUpgradeLevel('rusty_sword', char)).toBe(3);
  });

  it('returns 0 for item with no upgrade', () => {
    const char = makeCharacter({ itemUpgrades: {} });
    expect(getItemUpgradeLevel('rusty_sword', char)).toBe(0);
  });

  it('returns 0 when itemUpgrades is undefined', () => {
    const char = makeCharacter({ itemUpgrades: undefined });
    expect(getItemUpgradeLevel('rusty_sword', char)).toBe(0);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('forgeUtils edge cases', () => {
  describe('salvageItem edge cases', () => {
    it('salvaging the last item leaves inventory empty', () => {
      const item = makeItem('only_item', 'common');
      const char = makeCharacter({
        inventory: ['only_item'],
        essence: 0,
      });

      const result = salvageItem('only_item', char, [item]);

      expect(result.inventory).toEqual([]);
      expect(result.inventory!.length).toBe(0);
      expect(result.essence).toBe(ESSENCE_YIELD.common);
    });

    it('cannot salvage an item that is currently equipped', () => {
      const item = makeItem('rusty_sword', 'common');
      const char = makeCharacter({
        inventory: ['rusty_sword'],
        equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
        essence: 0,
      });

      const result = salvageItem('rusty_sword', char, [item]);

      expect(result).toBe(char);
      expect(result.inventory).toContain('rusty_sword');
      expect(result.essence).toBe(0);
    });

    it('salvaging an item when near soft cap caps the essence', () => {
      const commonItem = makeItem('common_item', 'common');
      const char = makeCharacter({
        inventory: ['common_item'],
        essence: ESSENCE_SOFT_CAP - 1, // just below cap
      });

      const result = salvageItem('common_item', char, [commonItem]);
      // Essence should be capped at ESSENCE_SOFT_CAP
      expect(result.essence).toBe(ESSENCE_SOFT_CAP);
      expect(result.inventory).toHaveLength(0);
    });
  });

  describe('canFuse edge cases', () => {
    it('cannot fuse items not all in the same rarity group', () => {
      const items = [
        makeItem('a', 'common'),
        makeItem('b', 'uncommon'),
        makeItem('c', 'common'),
      ];
      const char = makeCharacter({
        inventory: ['a', 'b', 'c'],
        essence: 100,
      });

      expect(canFuse(items, char)).toBe(false);
    });

    it('cannot fuse legendary items', () => {
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

    it('cannot fuse when character has zero essence', () => {
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
  });

  describe('performFusion edge cases', () => {
    it('handles fusion with identical item IDs across different instances', () => {
      const itemA = makeItem('rusty_sword', 'common');
      const itemB = makeItem('rusty_sword', 'common');
      const itemC = makeItem('rusty_sword', 'common');
      // All 3 items have the same ID but are different object instances
      const items = [itemA, itemB, itemC];
      const pool = [...items, makeItem('result_item', 'uncommon')];
      const char = makeCharacter({
        inventory: ['rusty_sword', 'rusty_sword', 'rusty_sword'],
        essence: FUSION_COST.common,
      });

      const { result, updatedChar } = performFusion(items, char, pool, () => 0.5);

      expect(result).not.toBeNull();
      expect(result!.rarity).toBe('uncommon');
      // 3 consumed, 1 result added → 1 item total
      expect(updatedChar.inventory).toHaveLength(1);
    });

    it('returns character unchanged when canFuse fails (essence too low)', () => {
      const items = [
        makeItem('a', 'common'),
        makeItem('b', 'common'),
        makeItem('c', 'common'),
      ];
      const char = makeCharacter({
        inventory: ['a', 'b', 'c'],
        essence: 0, // not enough for fusion
      });

      const { result, updatedChar } = performFusion(items, char, items);

      expect(result).toBeNull();
      expect(updatedChar).toBe(char);
    });

    it('returns null result when pool has no items of target rarity', () => {
      const items = [
        makeItem('a', 'common'),
        makeItem('b', 'common'),
        makeItem('c', 'common'),
      ];
      const char = makeCharacter({
        inventory: ['a', 'b', 'c'],
        essence: FUSION_COST.common,
      });
      // Pool only has common items, no uncommon
      const pool = [
        makeItem('common1', 'common'),
        makeItem('common2', 'common'),
      ];

      const { result, updatedChar } = performFusion(items, char, pool);

      expect(result).toBeNull();
      // Items are still consumed
      expect(updatedChar.inventory).not.toContain('a');
      expect(updatedChar.inventory).not.toContain('b');
      expect(updatedChar.inventory).not.toContain('c');
    });
  });

  describe('performUpgrade edge cases', () => {
    it('does nothing when item at max level and returns char unchanged', () => {
      const char = makeCharacter({
        inventory: ['rusty_sword'],
        essence: UPGRADE_COST,
        itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
      });

      const result = performUpgrade('rusty_sword', char);

      expect(result).toBe(char);
      expect(result.itemUpgrades?.rusty_sword).toBe(MAX_UPGRADE_LEVEL);
    });

    it('does nothing when item not in inventory', () => {
      const char = makeCharacter({
        inventory: [],
        essence: UPGRADE_COST,
      });

      const result = performUpgrade('rusty_sword', char);

      expect(result).toBe(char);
    });

    it('does nothing when not enough essence', () => {
      const char = makeCharacter({
        inventory: ['rusty_sword'],
        essence: 0,
      });

      const result = performUpgrade('rusty_sword', char);

      expect(result).toBe(char);
    });
  });

  describe('canUpgrade edge cases', () => {
    it('returns false when item is not in inventory', () => {
      const char = makeCharacter({
        inventory: [],
        essence: UPGRADE_COST,
      });

      expect(canUpgrade('rusty_sword', char)).toBe(false);
    });

    it('returns false when essence is zero', () => {
      const char = makeCharacter({
        inventory: ['rusty_sword'],
        essence: 0,
      });

      expect(canUpgrade('rusty_sword', char)).toBe(false);
    });

    it('returns false when item is already at max level', () => {
      const char = makeCharacter({
        inventory: ['rusty_sword'],
        essence: UPGRADE_COST,
        itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
      });

      expect(canUpgrade('rusty_sword', char)).toBe(false);
    });
  });
});

// ─── salvageItems ──────────────────────────────────────────────────────────

describe('salvageItems', () => {
  it('returns total essence from multiple items', () => {
    const items = [
      makeItem('a', 'common'),
      makeItem('b', 'uncommon'),
      makeItem('c', 'rare'),
    ];
    const expected = ESSENCE_YIELD.common + ESSENCE_YIELD.uncommon + ESSENCE_YIELD.rare;
    expect(salvageItems(items)).toBe(expected);
  });

  it('returns 0 for empty array', () => {
    expect(salvageItems([])).toBe(0);
  });

  it('handles single item', () => {
    const items = [makeItem('legendary_ring', 'legendary')];
    expect(salvageItems(items)).toBe(ESSENCE_YIELD.legendary);
  });

  it('handles items of the same rarity', () => {
    const items = [
      makeItem('a', 'epic'),
      makeItem('b', 'epic'),
      makeItem('c', 'epic'),
    ];
    expect(salvageItems(items)).toBe(ESSENCE_YIELD.epic * 3);
  });
});

// ─── isFusionLucky ─────────────────────────────────────────────────────────

describe('isFusionLucky', () => {
  it('returns true when rng < LUCKY_PROC_CHANCE', () => {
    const rng = () => LUCKY_PROC_CHANCE - 0.01;
    expect(isFusionLucky(rng)).toBe(true);
  });

  it('returns false when rng >= LUCKY_PROC_CHANCE', () => {
    const rng = () => LUCKY_PROC_CHANCE;
    expect(isFusionLucky(rng)).toBe(false);
  });

  it('returns false when rng is 1', () => {
    const rng = () => 1;
    expect(isFusionLucky(rng)).toBe(false);
  });

  it('returns true when rng is 0', () => {
    const rng = () => 0;
    expect(isFusionLucky(rng)).toBe(true);
  });

  it('uses Math.random by default', () => {
    // Cannot control Math.random, just verify it runs without error
    expect(typeof isFusionLucky()).toBe('boolean');
  });
});

// ─── getUpgradeCost ────────────────────────────────────────────────────────

describe('getUpgradeCost', () => {
  it('returns base cost for a level 0 item', () => {
    const item = makeItem('test', 'common');
    expect(getUpgradeCost(item)).toBe(UPGRADE_BASE_COST);
  });

  it('calculates cost based on item level', () => {
    const item = makeItem('test', 'rare', {
      stats: { strength: 1 },
    });
    // For a PixelItemAsset without a level property, cost should be base
    expect(getUpgradeCost(item)).toBe(UPGRADE_BASE_COST);
  });

  it('scales with upgrade level parameter', () => {
    // cost = UPGRADE_BASE_COST + level * UPGRADE_COST_SCALING
    const item = makeItem('test', 'epic');
    const cost0 = getUpgradeCost(item, 0);
    expect(cost0).toBe(UPGRADE_BASE_COST);
  });

  it('cost increases with level', () => {
    const item = makeItem('test', 'legendary');
    const cost0 = getUpgradeCost(item, 0);
    const cost3 = getUpgradeCost(item, 3);
    expect(cost3).toBeGreaterThan(cost0);
    expect(cost3).toBe(UPGRADE_BASE_COST + 3 * UPGRADE_COST_SCALING);
  });

  it('returns cost for max level item (should still charge base + scaling)', () => {
    const item = makeItem('test', 'common');
    const cost = getUpgradeCost(item, MAX_UPGRADE_LEVEL - 1);
    expect(cost).toBe(UPGRADE_BASE_COST + (MAX_UPGRADE_LEVEL - 1) * UPGRADE_COST_SCALING);
  });
});
