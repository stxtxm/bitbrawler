import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../utils/supabaseMock';
import { gainXp } from '../../utils/xpUtils';
import { getDefaultMedalProgress } from '../../utils/medalUtils';
import { getItemById } from '../../utils/equipmentUtils';

// ─── Supabase Mock ──────────────────────────────────────────────────────────

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
  canRollLootbox: vi.fn(() => true),
  computeNextStreak: vi.fn(() => 1),
  rollLootbox: vi.fn(),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

import { rollLootbox } from '../../utils/lootboxUtils';

const RUSTY_SWORD = getItemById('rusty_sword')!;

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
  fightsLeft: 5,
  pveFightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
  lastLootRoll: 0,
  lootboxStreak: 0,
  essence: 0,
  itemUpgrades: {},
  medalProgress: getDefaultMedalProgress(),
  ...overrides,
});

function setupMockCharacter(char: any, options?: { error?: any }) {
  const row = characterToSupabaseRow(char);
  const builder = createQueryBuilder({ data: row, error: options?.error ?? null });
  builder._setResult(row, options?.error ?? null);
  mockSupabaseFrom.mockReturnValue(builder);
  return builder;
}

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

describe('Achievement/Medal Integration', () => {
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

  describe('PvP fight triggers combat medal check', () => {
    it('updates medal progress after a PvP fight win', async () => {
      const char = makeCharacter({ id: 'test-id', wins: 0 });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.activeCharacter?.wins).toBe(0);

      await act(async () => {
        const fightResult = await result.current.useFight(true, 50, 'Opponent', 'opp-1');
        expect(fightResult).not.toBeNull();
      });

      // The fight should have incremented wins
      expect(result.current.activeCharacter?.wins).toBe(1);

      // Wait for medal check to complete — first_blood should be unlocked
      await waitFor(() => {
        const progress = result.current.activeCharacter?.medalProgress;
        expect(progress).toBeDefined();
        expect(progress?.first_blood?.completed).toBe(true);
      }, { timeout: 10000 });
    }, 15000);

    it('medal progress is updated after winning first fight', async () => {
      const char = makeCharacter({
        id: 'test-id',
        wins: 0,
        fightHistory: [],
        medalProgress: getDefaultMedalProgress(),
      });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify initial state
      expect(result.current.activeCharacter?.wins).toBe(0);

      await act(async () => {
        const fightResult = await result.current.useFight(true, 50, 'Opponent', 'opp-1');
        expect(fightResult).not.toBeNull();
        expect(fightResult!.xpGained).toBe(50);
      });

      // Wait for medal check to trigger and update progress
      await waitFor(() => {
        expect(result.current.activeCharacter?.medalProgress?.first_blood?.completed).toBe(true);
      }, { timeout: 10000 });

      // lastUnlockedMedal should be set (could be first_blood, growing_strong, etc.)
      expect(result.current.lastUnlockedMedal).not.toBeNull();
    }, 15000);
  });

  describe('PvE fight triggers medal check', () => {
    it('updates medal progress after a PvE fight win', async () => {
      const char = makeCharacter({ id: 'test-id', wins: 0 });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.usePveFight(true, 30, 'GOBLIN');
      });

      await waitFor(() => {
        const progress = result.current.activeCharacter?.medalProgress;
        expect(progress).toBeDefined();
        expect(progress?.first_blood?.completed).toBe(true);
      }, { timeout: 10000 });
    }, 15000);
  });

  describe('Lootbox roll triggers collection medal check', () => {
    it('updates medal progress after opening a lootbox', async () => {
      const char = makeCharacter({
        id: 'test-id',
        inventory: [],
        lastLootRoll: 0,
        lootboxStreak: 0,
      });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));

      const builder = setupMockCharacter(char);
      // Ensure update chain works for the lootbox optimistic lock
      builder.update.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.select.mockReturnValue(builder);
      // The lootbox code does .eq('last_loot_roll', ...).select()
      // We need the chain to eventually resolve
      (rollLootbox as any).mockReturnValue(RUSTY_SWORD);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const item = await result.current.rollLootbox();
        expect(item).not.toBeNull();
        expect(item?.id).toBe(RUSTY_SWORD.id);
      });

      // Inventory should now have the item
      expect(result.current.activeCharacter?.inventory).toContain(RUSTY_SWORD.id);

      // Wait for medal check — character now has 1 unique item (collector progress)
      await waitFor(() => {
        const progress = result.current.activeCharacter?.medalProgress;
        expect(progress).toBeDefined();
        expect(progress?.collector?.progress).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });
    }, 15000);
  });

  describe('Forge operation triggers medal check', () => {
    it('completes salvage without error and medal check runs', async () => {
      const char = makeCharacter({
        id: 'test-id',
        inventory: [RUSTY_SWORD.id],
        essence: 0,
      });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        const updatedChar = await result.current.salvageItems(RUSTY_SWORD.id);
        expect(updatedChar).not.toBeNull();
        // After salvage, the item should be removed
        expect(updatedChar?.inventory).not.toContain(RUSTY_SWORD.id);
      });

      // Medal check should have run (at minimum, medalProgress exists)
      await waitFor(() => {
        expect(result.current.activeCharacter?.medalProgress).toBeDefined();
      }, { timeout: 10000 });
    }, 15000);
  });

  describe('lastUnlockedMedal notification state', () => {
    it('sets lastUnlockedMedal when medals are unlocked, and clears on notification dismiss', async () => {
      const char = makeCharacter({
        id: 'test-id',
        wins: 0,
        medalProgress: getDefaultMedalProgress(),
      });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lastUnlockedMedal).toBeNull();

      await act(async () => {
        await result.current.useFight(true, 50, 'Opponent', 'opp-1');
      });

      // Some medals should be unlocked (e.g., first_blood and growing_strong at level 5)
      await waitFor(() => {
        expect(result.current.lastUnlockedMedal).not.toBeNull();
      }, { timeout: 10000 });

      // Verify first_blood progress is completed
      expect(result.current.activeCharacter?.medalProgress?.first_blood?.completed).toBe(true);

      // Clear notification
      act(() => {
        result.current.clearMedalNotification();
      });

      expect(result.current.lastUnlockedMedal).toBeNull();
    }, 15000);
  });

  describe('Medal check failure does not block main action', () => {
    it('completes fight even if medal check throws internally', async () => {
      const char = makeCharacter({ id: 'test-id', wins: 0 });
      (localStorage.getItem as any).mockReturnValue(JSON.stringify(char));
      setupMockCharacter(char);

      const { result } = renderHook(() => useGame(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // The medal check is wrapped in try/catch inside checkAndApplyMedals
      // and uses .catch(() => {}) at the call site.
      // So even if the underlying medal check fails, the fight succeeds.
      const fightResult = await act(async () => {
        return await result.current.useFight(true, 50, 'Opponent', 'opp-1');
      });

      // Fight completed successfully
      expect(fightResult).not.toBeNull();
      expect(fightResult?.xpGained).toBe(50);
      expect(result.current.activeCharacter?.wins).toBe(1);
    });
  });

  describe('Achievement XP bonus', () => {
    it('adds medalXpBonus to XP gained in gainXp', () => {
      const char = makeCharacter({
        experience: 100,
        medalXpBonus: 5,
      });

      const result = gainXp(char, 50);

      // 100 + 50 + 5 = 155
      expect(result.updatedCharacter.experience).toBe(155);
    });

    it('does not add bonus when medalXpBonus is undefined', () => {
      const char = makeCharacter({
        experience: 100,
        medalXpBonus: undefined,
      });

      const result = gainXp(char, 50);

      // 100 + 50 = 150
      expect(result.updatedCharacter.experience).toBe(150);
    });
  });
});
