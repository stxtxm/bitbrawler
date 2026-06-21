import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { PixelItemAsset } from '../../types/Item';
import { createQueryBuilder, characterToSupabaseRow } from '../utils/supabaseMock';
import {
  ESSENCE_YIELD,
  FUSION_COST,
  UPGRADE_COST,
  MAX_UPGRADE_LEVEL,
  ESSENCE_SOFT_CAP,
  FUSION_INPUT_COUNT,
} from '../../data/forgeConstants';
import { getItemById } from '../../utils/equipmentUtils';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {},
}));

// RARITY_RANK needed by forgeUtils for fusion; must use vi.hoisted (hoisted before vi.mock)
const rarityRank = vi.hoisted(() => ({
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4,
}));

vi.mock('../../utils/lootboxUtils', () => ({
  RARITY_RANK: rarityRank,
  canRollLootbox: vi.fn(),
  computeNextStreak: vi.fn(() => 1),
  rollLootbox: vi.fn(),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

// All level-1 (tier 1) items from itemAssets:
//   RUSTY_SWORD: common
//   WORN_BRACERS: common
//   LUCKY_CHARM: common
//   NOVICE_WRAP: uncommon
//   FLAME_DAGGER: epic (level 4 tier)
const RUSTY_SWORD = getItemById('rusty_sword')!;
const WORN_BRACERS = getItemById('worn_bracers')!;
const LUCKY_CHARM = getItemById('lucky_charm')!;
const NOVICE_WRAP = getItemById('novice_wrap')!;
const FLAME_DAGGER = getItemById('flame_dagger')!;

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
  pveFightsLeft: 5,
  lastFightReset: Date.now(),
  id: 'forge-test-id',
  inventory: [],
  essence: 0,
  itemUpgrades: {},
  lastLootRoll: 0,
  lootboxStreak: 0,
  statPoints: 0,
  ...overrides,
});

function setupMockCharacter(char: Character, options?: { error?: any }) {
  const row = characterToSupabaseRow(char);
  const builder = createQueryBuilder({ data: row, error: options?.error ?? null });
  mockSupabaseFrom.mockReturnValue(builder);
  return builder;
}

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Forge System Integration', () => {
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

  describe('Salvage Integration', () => {
    it('should salvage an item and sync essence/inventory to Supabase', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 10,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.activeCharacter?.essence).toBe(10);
      expect(result.current.activeCharacter?.inventory).toContain(RUSTY_SWORD.id);

      await act(async () => {
        const updated = await result.current.salvageItems(RUSTY_SWORD.id);
        expect(updated).not.toBeNull();
      });

      // Essence should have increased by common yield (5)
      expect(result.current.activeCharacter?.essence).toBe(10 + ESSENCE_YIELD.common);
      // Item should be removed from inventory
      expect(result.current.activeCharacter?.inventory).not.toContain(RUSTY_SWORD.id);

      // Verify Supabase was called with essence and inventory
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          essence: 10 + ESSENCE_YIELD.common,
          inventory: [],
        }),
      );

      // Verify localStorage was updated
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'bitbrawler_active_char',
        expect.stringContaining(String(10 + ESSENCE_YIELD.common)),
      );
    });

    it('should salvage multiple items and accumulate essence', async () => {
      // RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM are all common → 5 essence each
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
        essence: 0,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Salvage first item (common → 5 essence)
      await act(async () => {
        await result.current.salvageItems(RUSTY_SWORD.id);
      });
      expect(result.current.activeCharacter?.essence).toBe(ESSENCE_YIELD.common);

      // Salvage second item (common → 5 essence)
      await act(async () => {
        await result.current.salvageItems(WORN_BRACERS.id);
      });
      expect(result.current.activeCharacter?.essence).toBe(ESSENCE_YIELD.common * 2);

      // Salvage third item (common → 5 essence)
      await act(async () => {
        await result.current.salvageItems(LUCKY_CHARM.id);
      });

      const expectedTotal = ESSENCE_YIELD.common * 3;
      expect(result.current.activeCharacter?.essence).toBe(expectedTotal);
      expect(result.current.activeCharacter?.inventory?.length).toBe(0);
    });

    it('should clamp essence to soft cap when salvaging', async () => {
      const char = makeCharacter({
        inventory: [FLAME_DAGGER.id], // epic → 100 essence
        essence: ESSENCE_SOFT_CAP - 10, // 490
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.salvageItems(FLAME_DAGGER.id);
      });

      // 490 + 100 = 590 → clamped to 500
      expect(result.current.activeCharacter?.essence).toBe(ESSENCE_SOFT_CAP);

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          essence: ESSENCE_SOFT_CAP,
        }),
      );
    });

    it('should return null when salvaging an item not in inventory', async () => {
      const char = makeCharacter({ inventory: [], essence: 10 });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let salvageResult: Character | null = null;
      await act(async () => {
        salvageResult = await result.current.salvageItems('nonexistent_item');
      });

      expect(salvageResult).toBeNull();
      expect(result.current.activeCharacter?.essence).toBe(10);
    });
  });

  describe('Fusion Integration', () => {
    it('should fuse 3 items into a higher rarity item', async () => {
      // All 3 are common at level 1 → fuse into uncommon
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
        essence: 100,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const items = [RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM];

      let fusionResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
      await act(async () => {
        fusionResult = await result.current.fuseItems(items);
      });

      expect(fusionResult).not.toBeNull();
      expect(fusionResult!.result).not.toBeNull();
      expect(fusionResult!.updatedChar).not.toBeNull();

      // Result should be of uncommon rarity or higher (not common)
      const resultRarity = fusionResult!.result!.rarity;
      expect(['uncommon', 'rare', 'epic', 'legendary']).toContain(resultRarity);

      // Inventory should have 1 result item (3 input removed, 1 added)
      expect(fusionResult!.updatedChar!.inventory?.length).toBe(1);

      // Essence should be deducted
      expect(fusionResult!.updatedChar!.essence).toBe(100 - FUSION_COST.common);

      // Verify Supabase was called with correct data
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          essence: 100 - FUSION_COST.common,
          inventory: expect.any(Array),
        }),
      );

      // Verify result item is in inventory
      const resultItemId = fusionResult!.result!.id;
      expect(fusionResult!.updatedChar!.inventory).toContain(resultItemId);
    });

    it('should not fuse when character has insufficient essence', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
        essence: 2, // Not enough for common fusion (costs 5)
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const items = [RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM];

      let fusionResult: { result: PixelItemAsset | null; updatedChar: Character | null } | null = null;
      await act(async () => {
        fusionResult = await result.current.fuseItems(items);
      });

      // Fusion should fail — result and updatedChar should be null
      expect(fusionResult!.result).toBeNull();
      expect(fusionResult!.updatedChar).toBeNull();
    });

    it('should handle fusion of last 3 items of a rarity (leaves zero)', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id], // exactly 3 commons
        essence: 100,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const items = [RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM];

      await act(async () => {
        await result.current.fuseItems(items);
      });

      // No common items should remain, just 1 result item
      const updatedChar = result.current.activeCharacter;
      expect(updatedChar?.inventory?.length).toBe(1);

      // Essence should be deducted
      expect(updatedChar?.essence).toBe(100 - FUSION_COST.common);
    });
  });

  describe('Upgrade Integration', () => {
    it('should upgrade an item and consume essence', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 100,
        itemUpgrades: {},
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const updated = await result.current.upgradeItem(RUSTY_SWORD.id);
        expect(updated).not.toBeNull();
      });

      // Essence should be deducted
      expect(result.current.activeCharacter?.essence).toBe(100 - UPGRADE_COST);

      // Item should be upgraded to level 1
      expect(result.current.activeCharacter?.itemUpgrades?.[RUSTY_SWORD.id]).toBe(1);

      // Verify Supabase was called with essence and item_upgrades
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          essence: 100 - UPGRADE_COST,
          item_upgrades: { rusty_sword: 1 },
        }),
      );

      // Verify localStorage was updated
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'bitbrawler_active_char',
        expect.stringContaining('itemUpgrades'),
      );
    });

    it('should upgrade an item multiple times up to max level', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 200,
        itemUpgrades: {},
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Upgrade 3 times
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.upgradeItem(RUSTY_SWORD.id);
        });
      }

      expect(result.current.activeCharacter?.itemUpgrades?.[RUSTY_SWORD.id]).toBe(3);
      expect(result.current.activeCharacter?.essence).toBe(200 - UPGRADE_COST * 3);
    });

    it('should not upgrade beyond max level', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 200,
        itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const updated = await result.current.upgradeItem(RUSTY_SWORD.id);
        expect(updated).toBeNull(); // should fail — already maxed
      });

      // Essence should not change
      expect(result.current.activeCharacter?.essence).toBe(200);
      expect(result.current.activeCharacter?.itemUpgrades?.[RUSTY_SWORD.id]).toBe(MAX_UPGRADE_LEVEL);
    });

    it('should not upgrade with insufficient essence', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 10, // Not enough (costs 25)
        itemUpgrades: {},
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const updated = await result.current.upgradeItem(RUSTY_SWORD.id);
        expect(updated).toBeNull();
      });

      expect(result.current.activeCharacter?.essence).toBe(10);
    });
  });

  describe('Persistence Integration', () => {
    it('should persist forge state across multiple operations', async () => {
      // RUSTY_SWORD and LUCKY_CHARM are common (5 essence each)
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
        essence: 50,
        itemUpgrades: {},
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 1. Salvage one common item (+5 essence)
      await act(async () => {
        await result.current.salvageItems(WORN_BRACERS.id);
      });

      const afterSalvageEssence = 50 + ESSENCE_YIELD.common;
      expect(result.current.activeCharacter?.essence).toBe(afterSalvageEssence);
      expect(result.current.activeCharacter?.inventory?.length).toBe(2);

      // 2. Upgrade the remaining common item (-25 essence)
      await act(async () => {
        await result.current.upgradeItem(RUSTY_SWORD.id);
      });

      const afterUpgradeEssence = afterSalvageEssence - UPGRADE_COST;
      expect(result.current.activeCharacter?.essence).toBe(afterUpgradeEssence);
      expect(result.current.activeCharacter?.itemUpgrades?.[RUSTY_SWORD.id]).toBe(1);

      // Verify localStorage was called for each operation (initial load + 2 operations)
      expect(localStorage.setItem).toHaveBeenCalledTimes(3);
    });

    it('should handle offline mode via localStorage persistence', async () => {
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 100,
        itemUpgrades: {},
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Perform an upgrade
      await act(async () => {
        await result.current.upgradeItem(RUSTY_SWORD.id);
      });

      // Verify localStorage was updated with the new state
      const setItemCalls = (localStorage.setItem as any).mock.calls;
      const lastCall = setItemCalls[setItemCalls.length - 1];
      const savedData = JSON.parse(lastCall[1]);

      expect(savedData.essence).toBe(100 - UPGRADE_COST);
      expect(savedData.itemUpgrades?.rusty_sword).toBe(1);
      expect(savedData.inventory).toContain(RUSTY_SWORD.id);
    });
  });

  describe('Edge Cases', () => {
    it('should handle salvage on character with no essence field gracefully', async () => {
      // Character without essence field (legacy data)
      const char = makeCharacter({
        inventory: [RUSTY_SWORD.id],
      }) as any;
      delete char.essence;

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.salvageItems(RUSTY_SWORD.id);
      });

      // Should have gained essence from 0
      expect(result.current.activeCharacter?.essence).toBe(ESSENCE_YIELD.common);
    });

    it('should handle fusion with varying RNG outcomes', async () => {
      // Test that fusion works regardless of RNG outcome
      const char = makeCharacter({
        inventory: [
          RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id,
          ...Array.from({ length: 10 }, (_, i) => `extra_item_${i}`),
        ],
        essence: 100,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const items = [RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM];

      await act(async () => {
        const fusionResult = await result.current.fuseItems(items);
        expect(fusionResult.result).not.toBeNull();
        // Result can be any rarity (depending on RNG for lucky proc)
        // But should never be common (since fusion always upgrades at least 1 tier)
        expect(fusionResult.result!.rarity).not.toBe('common');
      });
    });

    it('should maintain total inventory count correctly after fusing', async () => {
      const initialInventory = [
        RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id,
        NOVICE_WRAP.id, // 1 uncommon item that stays
        ...Array.from({ length: 10 }, (_, i) => `extra_item_${i}`), // 10 extra items
      ];
      const char = makeCharacter({
        inventory: initialInventory,
        essence: 100,
      });

      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      const builder = setupMockCharacter(char);
      builder.update.mockReturnValue(builder);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCount = result.current.activeCharacter?.inventory?.length ?? 0;

      // Fuse 3 common items → get 1 result item → net -2
      const items = [RUSTY_SWORD, WORN_BRACERS, LUCKY_CHARM];

      await act(async () => {
        await result.current.fuseItems(items);
      });

      const expectedCount = initialCount - FUSION_INPUT_COUNT + 1; // -3 + 1 = -2
      const updatedCount = result.current.activeCharacter?.inventory?.length ?? 0;
      expect(updatedCount).toBe(expectedCount);
    });
  });
});
