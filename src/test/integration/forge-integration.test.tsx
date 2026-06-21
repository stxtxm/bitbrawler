import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { PixelItemAsset, ItemRarity } from '../../types/Item';
import { createQueryBuilder, characterToSupabaseRow } from '../../test/utils/supabaseMock';
import { INVENTORY_CAPACITY } from '../../utils/persistenceUtils';
import {
  ESSENCE_SOFT_CAP,
  FUSION_COST,
  UPGRADE_COST,
  MAX_UPGRADE_LEVEL,
  ESSENCE_YIELD,
  LUCKY_PROC_CHANCE,
} from '../../data/forgeConstants';
import { RARITY_RANK } from '../../utils/lootboxUtils';

// ─── Supabase Mock ───────────────────────────────────────────────────────────

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {},
}));

vi.mock('../../utils/matchmakingUtils', () => ({
  findOpponent: vi.fn(),
}));

vi.mock('../../utils/lootboxUtils', () => ({
  canRollLootbox: vi.fn(),
  computeNextStreak: vi.fn(() => 1),
  rollLootbox: vi.fn(),
  RARITY_RANK: {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
  },
}));

import { canRollLootbox, rollLootbox } from '../../utils/lootboxUtils';

// ─── Item Factory ────────────────────────────────────────────────────────────

const makeItem = (
  id: string,
  rarity: ItemRarity = 'common',
  overrides?: Partial<PixelItemAsset>,
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

// ─── Testing Strategy ────────────────────────────────────────────────────────
// The forge operations rely on `essence` and `item_upgrades` fields on the
// Character. However, the `characterToSupabaseRow` mock and the
// `convertFromSupabase` function do not propagate these fields through the
// Supabase sync on mount. To preserve these fields during testing, we make
// the initial Supabase SELECT fail (non-PGRST116 error) so the GameProvider
// falls back to the localStorage character data, which retains all fields.
//
// After mount, we reconfigure the builder to succeed so forge operations
// (which call UPDATE) work correctly.

function setupCharacterWithLocalFallback(char: any) {
  // Set up localStorage with the full character (includes essence, item_upgrades)
  (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
  // Create a builder that errors on initial SELECT so the provider uses local data
  const builder = createQueryBuilder({ data: null, error: new Error('Sync unavailable') });
  mockSupabaseFrom.mockReturnValue(builder);
  return builder;
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

// ─── Character Factory ───────────────────────────────────────────────────────

const baseCharacter: Character = {
  name: 'Forge Tester',
  gender: 'male',
  seed: 'forge-seed',
  level: 5,
  hp: 150,
  maxHp: 150,
  strength: 14,
  vitality: 12,
  dexterity: 10,
  luck: 8,
  intelligence: 11,
  focus: 10,
  experience: 500,
  wins: 10,
  losses: 3,
  fightsLeft: 2,
  lastFightReset: Date.now() - 86400000,
  id: 'forge-char-id',
  statPoints: 0,
  inventory: [],
  lastLootRoll: 0,
  essence: 0,
  itemUpgrades: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wait for the hook to finish loading and then reconfigure the supabase builder
 * so that forge operations (which use UPDATE) succeed.
 */
async function waitForLoadAndEnableDb(result: any, builder: any) {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  // Reconfigure builder so forge UPDATE operations resolve successfully
  const char = result.current.activeCharacter;
  if (char) {
    const row = characterToSupabaseRow(char);
    builder._setResult(row, null);
  }
  builder.update.mockClear();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Forge Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Full Flow Test ──────────────────────────────────────────────────────

  it('full forge flow: lootbox → salvage → fuse → upgrade', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: 30,
      lastLootRoll: 0,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Step 1: Roll lootbox → get an item
    const lootboxItem = makeItem('hunter_bow', 'uncommon');
    (canRollLootbox as any).mockReturnValue(true);
    (rollLootbox as any).mockReturnValue(lootboxItem);

    let rolledItem: PixelItemAsset | null = null;
    await act(async () => {
      rolledItem = await result.current.rollLootbox();
    });

    expect(rolledItem).not.toBeNull();
    expect(rolledItem!.id).toBe('hunter_bow');
    expect(result.current.activeCharacter?.inventory).toContain('hunter_bow');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: expect.arrayContaining(['hunter_bow']) }),
    );
    expect(result.current.activeCharacter?.essence).toBe(30);
    builder.update.mockClear();

    // Step 2: Salvage the lootbox item → earn essence
    await act(async () => {
      await result.current.salvageItems('hunter_bow');
    });

    const expectedSalvageEssence = 30 + ESSENCE_YIELD.uncommon;
    expect(result.current.activeCharacter?.essence).toBe(expectedSalvageEssence);
    expect(result.current.activeCharacter?.inventory).not.toContain('hunter_bow');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: expectedSalvageEssence,
      }),
    );
    builder.update.mockClear();

    // Step 3: Fuse 3 common items → upgrade to uncommon
    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    let fuseResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
    await act(async () => {
      fuseResult = await result.current.fuseItems(commonItems);
    });

    expect(fuseResult).not.toBeNull();
    expect(fuseResult!.result).not.toBeNull();
    expect(fuseResult!.result!.rarity).toBe('uncommon');
    expect(fuseResult!.updatedChar).not.toBeNull();
    const expectedFusionEssence = expectedSalvageEssence - FUSION_COST.common;
    expect(result.current.activeCharacter?.essence).toBe(expectedFusionEssence);
    expect(result.current.activeCharacter?.inventory).toEqual([fuseResult!.result!.id]);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: expectedFusionEssence,
        inventory: [fuseResult!.result!.id],
        item_upgrades: {},
      }),
    );
    builder.update.mockClear();

    // Step 4: Upgrade the fused result item
    await act(async () => {
      await result.current.upgradeItem(fuseResult!.result!.id);
    });

    const expectedUpgradeEssence = expectedFusionEssence - UPGRADE_COST;
    expect(result.current.activeCharacter?.essence).toBe(expectedUpgradeEssence);
    expect(result.current.activeCharacter?.itemUpgrades?.[fuseResult!.result!.id]).toBe(1);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: expectedUpgradeEssence,
        item_upgrades: { [fuseResult!.result!.id]: 1 },
      }),
    );

    // Verify localStorage saves happened after each operation
    const setItemCalls = (localStorage.setItem as any).mock.calls;
    const forgeSaves = setItemCalls.filter(
      ([key]: [string]) => key === 'bitbrawler_active_char',
    );
    // At least 4 saves: lootbox, salvage, fuse, upgrade
    expect(forgeSaves.length).toBeGreaterThanOrEqual(4);
  });

  // ─── Inventory Capacity Edge Case ────────────────────────────────────────

  it('should handle forge operations when inventory is at capacity', async () => {
    // Fill inventory to capacity (24 items), with 3 common items for fusion
    const fullInventory: string[] = [];
    for (let i = 0; i < INVENTORY_CAPACITY; i++) {
      fullInventory.push(`item_${i}`);
    }
    // Place 3 common items at known positions
    fullInventory[0] = 'rusty_sword';
    fullInventory[1] = 'lucky_charm';
    fullInventory[2] = 'worn_bracers';
    // Place one item to salvage at known position
    fullInventory[3] = 'hunter_bow';

    const char: Character = {
      ...baseCharacter,
      inventory: fullInventory,
      essence: 50,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Salvage an item → inventory goes from 24 to 23, essence increases
    await act(async () => {
      await result.current.salvageItems('hunter_bow');
    });

    expect(result.current.activeCharacter?.inventory).toHaveLength(INVENTORY_CAPACITY - 1);
    expect(result.current.activeCharacter?.inventory).not.toContain('hunter_bow');
    expect(result.current.activeCharacter?.essence).toBe(50 + ESSENCE_YIELD.uncommon);
    builder.update.mockClear();

    // Fusion with near-full inventory (removes 3, adds 1 → net -2)
    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    await act(async () => {
      await result.current.fuseItems(commonItems);
    });

    // Starting inventory was 23 after salvage; fusion removes 3 adds 1 → 21
    expect(result.current.activeCharacter?.inventory).toHaveLength(INVENTORY_CAPACITY - 3);
    expect(result.current.activeCharacter?.essence).toBe(50 + ESSENCE_YIELD.uncommon - FUSION_COST.common);
  });

  // ─── Essence Cap Behavior ────────────────────────────────────────────────

  it('should clamp essence at soft cap when salvaging near limit', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'hunter_bow'],
      essence: ESSENCE_SOFT_CAP - 10, // 490 — just below cap
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Salvage a common item (yields 5 essence) → 490 + 5 = 495, under cap
    await act(async () => {
      await result.current.salvageItems('rusty_sword');
    });

    expect(result.current.activeCharacter?.essence).toBe(ESSENCE_SOFT_CAP - 10 + ESSENCE_YIELD.common);
    expect(result.current.activeCharacter?.inventory).not.toContain('rusty_sword');
    builder.update.mockClear();

    // Now salvage hunter_bow (uncommon, yields 15) → 495 + 15 = 510 → clamped to 500
    await act(async () => {
      await result.current.salvageItems('hunter_bow');
    });

    expect(result.current.activeCharacter?.essence).toBe(ESSENCE_SOFT_CAP);
    expect(result.current.activeCharacter?.inventory).not.toContain('hunter_bow');
  });

  it('should not exceed soft cap on fusion essence deduction', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: ESSENCE_SOFT_CAP, // at cap
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    await act(async () => {
      await result.current.fuseItems(commonItems);
    });

    // Fusion cost deducted: 500 - 5 = 495
    expect(result.current.activeCharacter?.essence).toBe(ESSENCE_SOFT_CAP - FUSION_COST.common);
  });

  // ─── Lucky Proc on Fusion ────────────────────────────────────────────────

  it('should apply lucky proc (jump two rarity tiers) when rng is favorable', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: FUSION_COST.common,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Mock Math.random to trigger lucky proc (0.05 < 0.1)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(LUCKY_PROC_CHANCE - 0.05);

    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    let fuseResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
    await act(async () => {
      fuseResult = await result.current.fuseItems(commonItems);
    });

    expect(fuseResult).not.toBeNull();
    expect(fuseResult!.result).not.toBeNull();
    // Lucky proc: common (rank 0) → two tiers up → rare (rank 2)
    expect(fuseResult!.result!.rarity).toBe('rare');
    expect(RARITY_RANK[fuseResult!.result!.rarity]).toBe(RARITY_RANK.common + 2);
    // Essence was deducted
    expect(result.current.activeCharacter?.essence).toBe(0);

    randomSpy.mockRestore();
  });

  it('should NOT apply lucky proc when rng exceeds threshold', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: FUSION_COST.common,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Mock Math.random to NOT trigger lucky proc (0.5 >= 0.1)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(LUCKY_PROC_CHANCE + 0.4);

    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    let fuseResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
    await act(async () => {
      fuseResult = await result.current.fuseItems(commonItems);
    });

    expect(fuseResult).not.toBeNull();
    expect(fuseResult!.result).not.toBeNull();
    // Normal fusion: common (rank 0) → one tier up → uncommon (rank 1)
    expect(fuseResult!.result!.rarity).toBe('uncommon');
    expect(RARITY_RANK[fuseResult!.result!.rarity]).toBe(RARITY_RANK.common + 1);
    // Essence was deducted
    expect(result.current.activeCharacter?.essence).toBe(0);

    randomSpy.mockRestore();
  });

  // ─── Error Cases ─────────────────────────────────────────────────────────

  it('should return null when fusing with insufficient essence', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: 0, // not enough for any fusion
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    let fuseResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
    await act(async () => {
      fuseResult = await result.current.fuseItems(commonItems);
    });

    // canFuse returns false → performFusion returns unchanged character
    // GameContext sees updatedChar === activeCharacter → returns null
    expect(fuseResult).toEqual({ result: null, updatedChar: null });
    // Character state should be unchanged
    expect(result.current.activeCharacter?.essence).toBe(0);
    expect(result.current.activeCharacter?.inventory).toEqual([
      'rusty_sword',
      'lucky_charm',
      'worn_bracers',
    ]);
  });

  it('should return null when upgrading with insufficient essence', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: 0, // not enough for upgrade (needs 25)
      itemUpgrades: {},
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    let upgradeResult: Character | null = null;
    await act(async () => {
      upgradeResult = await result.current.upgradeItem('hunter_bow');
    });

    expect(upgradeResult).toBeNull();
    expect(result.current.activeCharacter?.essence).toBe(0);
    expect(result.current.activeCharacter?.itemUpgrades?.hunter_bow).toBeUndefined();
  });

  it('should return null when upgrading an item at max level', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: UPGRADE_COST,
      itemUpgrades: { hunter_bow: MAX_UPGRADE_LEVEL }, // already maxed
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    let upgradeResult: Character | null = null;
    await act(async () => {
      upgradeResult = await result.current.upgradeItem('hunter_bow');
    });

    expect(upgradeResult).toBeNull();
    expect(result.current.activeCharacter?.itemUpgrades?.hunter_bow).toBe(MAX_UPGRADE_LEVEL);
    // Essence should NOT have been consumed
    expect(result.current.activeCharacter?.essence).toBe(UPGRADE_COST);
  });

  it('should return null when salvaging a non-existent item', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: 10,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Salvage an item that isn't in inventory
    let salvageResult: Character | null = null;
    await act(async () => {
      salvageResult = await result.current.salvageItems('non_existent_item');
    });

    expect(salvageResult).toBeNull();
    // Inventory unchanged
    expect(result.current.activeCharacter?.inventory).toEqual(['hunter_bow']);
    expect(result.current.activeCharacter?.essence).toBe(10);
  });

  it('should return null when fusing with fewer than 3 items', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm'],
      essence: FUSION_COST.common,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Only 2 items — canFuse returns false
    const twoItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
    ];

    let fuseResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
    await act(async () => {
      fuseResult = await result.current.fuseItems(twoItems);
    });

    expect(fuseResult).toEqual({ result: null, updatedChar: null });
    expect(result.current.activeCharacter?.inventory).toEqual(['rusty_sword', 'lucky_charm']);
  });

  // ─── DB Sync ─────────────────────────────────────────────────────────────

  it('should include essence and inventory fields in Supabase update on salvage', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: 10,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    await act(async () => {
      await result.current.salvageItems('hunter_bow');
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: 10 + ESSENCE_YIELD.uncommon,
        inventory: [],
      }),
    );
  });

  it('should include essence, inventory, and item_upgrades fields in Supabase update on fusion', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'lucky_charm', 'worn_bracers'],
      essence: FUSION_COST.common,
      itemUpgrades: {},
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    const commonItems = [
      makeItem('rusty_sword', 'common'),
      makeItem('lucky_charm', 'common'),
      makeItem('worn_bracers', 'common'),
    ];

    await act(async () => {
      await result.current.fuseItems(commonItems);
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: 0,
        inventory: expect.any(Array),
        item_upgrades: {},
      }),
    );

    // Verify item_upgrades is an object
    const updateCall = builder.update.mock.calls[0][0];
    expect(typeof updateCall.item_upgrades).toBe('object');
  });

  it('should include essence and item_upgrades fields in Supabase update on upgrade', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: UPGRADE_COST,
      itemUpgrades: {},
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    await act(async () => {
      await result.current.upgradeItem('hunter_bow');
    });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        essence: 0,
        item_upgrades: { hunter_bow: 1 },
      }),
    );
  });

  it('should throw a connection error when Supabase is unavailable (offline mode)', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: 10,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Now make the builder reject on subsequent Supabase calls (simulate going offline)
    builder._setRejection(new Error('Network error'));

    // Salvage should throw a connection error
    await act(async () => {
      await expect(result.current.salvageItems('hunter_bow')).rejects.toThrow(
        'Connection error',
      );
    });

    // Character state should remain unchanged
    expect(result.current.activeCharacter?.inventory).toContain('hunter_bow');
    expect(result.current.activeCharacter?.essence).toBe(10);
    // dbAvailable should be false
    expect(result.current.dbAvailable).toBe(false);
  });

  it('should not persist when salvage fails due to Supabase error', async () => {
    const char: Character = {
      ...baseCharacter,
      inventory: ['hunter_bow'],
      essence: 10,
    };

    const builder = setupCharacterWithLocalFallback(char);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper(),
    });

    await waitForLoadAndEnableDb(result, builder);

    // Clear any prior localStorage saves
    (localStorage.setItem as any).mockClear();

    // Make supabase fail
    builder._setRejection(new Error('Network error'));

    // Attempt salvage — should throw
    await act(async () => {
      await expect(result.current.salvageItems('hunter_bow')).rejects.toThrow(
        'Connection error',
      );
    });

    // Character unchanged
    expect(result.current.activeCharacter?.inventory).toContain('hunter_bow');
    expect(result.current.activeCharacter?.essence).toBe(10);

    // localStorage should NOT have been updated (no persistCharacter on failure)
    const setItemCalls = (localStorage.setItem as any).mock.calls;
    const forgeSaves = setItemCalls.filter(
      ([key]: [string]) => key === 'bitbrawler_active_char',
    );
    expect(forgeSaves).toHaveLength(0);

    // dbAvailable should be false
    expect(result.current.dbAvailable).toBe(false);
  });
});
