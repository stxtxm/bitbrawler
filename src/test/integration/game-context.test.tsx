import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../../test/utils/supabaseMock';
import { PixelItemAsset } from '../../types/Item';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn()
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {}
}));

vi.mock('../../utils/matchmakingUtils', () => ({
  findOpponent: vi.fn(),
}));

vi.mock('../../utils/lootboxUtils', () => ({
  canRollLootbox: vi.fn(),
  rollLootbox: vi.fn(),
}));

import { findOpponent } from '../../utils/matchmakingUtils';
import { canRollLootbox, rollLootbox } from '../../utils/lootboxUtils';

function setupMockCharacter(char: any, options?: { error?: any }) {
  const row = characterToSupabaseRow(char);
  const builder = createQueryBuilder({ data: row, error: options?.error ?? null });
  mockSupabaseFrom.mockReturnValue(builder);
  return builder;
}

// Wrapper component for testing hooks
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

describe('GameContext Integration', () => {
  const mockCharacter: Character = {
    name: 'Test Hero',
    gender: 'male',
    seed: 'test-seed',
    level: 5,
    hp: 150,
    maxHp: 150,
    strength: 15,
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
    id: 'test-firestore-id',
    statPoints: 0,
    inventory: [],
    lastLootRoll: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load character from Supabase on mount', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeDefined();
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should prioritize Supabase data over localStorage', async () => {
    const localStorageChar = { ...mockCharacter, fightsLeft: 1, experience: 100 };
    const supabaseChar = { ...mockCharacter, fightsLeft: 5, experience: 600 };

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(localStorageChar));
    setupMockCharacter(supabaseChar);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(5);
    expect(result.current.activeCharacter?.experience).toBe(600);
  });

  it('should handle login with Supabase data', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('Test Hero');
    });

    expect(loginResult).toBe(null);
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
    expect(result.current.activeCharacter?.id).toBe('test-firestore-id');
  });

  it('should update fights and XP when useFight is called', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialFights = result.current.activeCharacter?.fightsLeft || 0;

    await act(async () => {
      await result.current.useFight(true, 50, 'MOCK_FOE', 'opp-1');
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(initialFights - 1);
    expect(result.current.activeCharacter?.experience).toBeGreaterThan(500);
  });

  it('should reserve energy and store pending fight on matchmaking start', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = setupMockCharacter(mockCharacter);
    builder.update.mockReturnValue(builder);

    const opponent: Character = {
      ...mockCharacter,
      name: 'Opp',
      id: 'opp-1'
    };

    (findOpponent as any).mockResolvedValue({
      opponent,
      matchType: 'balanced',
      candidates: [opponent]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialFights = result.current.activeCharacter?.fightsLeft || 0;

    await act(async () => {
      await result.current.startMatchmaking();
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(initialFights - 1);
    expect(result.current.activeCharacter?.pendingFight?.status).toBe('matched');
  });

  it('should refund energy when no opponent is found', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = setupMockCharacter(mockCharacter);
    builder.update.mockReturnValue(builder);

    (findOpponent as any).mockResolvedValue(null);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialFights = result.current.activeCharacter?.fightsLeft || 0;

    await act(async () => {
      const match = await result.current.startMatchmaking();
      expect(match).toBeNull();
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(initialFights);
    expect(result.current.activeCharacter?.pendingFight).toBeUndefined();
  });

  it('should omit undefined bot flags in pending fight payload', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = setupMockCharacter(mockCharacter);
    builder.update.mockReturnValue(builder);

    const opponent: Character = {
      ...mockCharacter,
      name: 'Opp',
      id: 'opp-3'
    };

    (findOpponent as any).mockResolvedValue({
      opponent,
      matchType: 'balanced',
      candidates: [opponent]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.startMatchmaking();
    });

    expect(result.current.activeCharacter?.pendingFight).toBeDefined();
    const pendingFight = result.current.activeCharacter?.pendingFight;
    expect(Object.prototype.hasOwnProperty.call(pendingFight!.opponent, 'isBot')).toBe(false);
  });

  it('should not consume extra energy when pending fight resolves', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = setupMockCharacter(mockCharacter);
    builder.update.mockReturnValue(builder);

    const opponent: Character = {
      ...mockCharacter,
      name: 'Opp',
      id: 'opp-2'
    };

    (findOpponent as any).mockResolvedValue({
      opponent,
      matchType: 'balanced',
      candidates: [opponent]
    });

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.startMatchmaking();
    });

    const reservedFights = result.current.activeCharacter?.fightsLeft || 0;

    await act(async () => {
      await result.current.useFight(true, 50, opponent.name, opponent.id || '');
    });

    expect(result.current.activeCharacter?.fightsLeft).toBe(reservedFights);
    expect(result.current.activeCharacter?.pendingFight).toBeUndefined();
  });

  it('should track unique opponents fought today', async () => {
    const charWithHistory: Character = {
      ...mockCharacter,
      foughtToday: ['opp-1'],
      statPoints: 0
    };

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(charWithHistory));
    setupMockCharacter(charWithHistory);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight(true, 50, 'MOCK_FOE', 'opp-2');
    });

    expect(result.current.activeCharacter?.foughtToday).toEqual(['opp-1', 'opp-2']);
    expect(mockSupabaseFrom).toHaveBeenCalledWith('characters');
  });

  it('should grant stat points when leveling up', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight(true, 10000, 'LEVEL_UP_FOE', 'opp-lvl');
    });

    expect(result.current.activeCharacter?.statPoints).toBeGreaterThan(0);
  });

  it('should allocate stat points and persist updates', async () => {
    const charWithPoints: Character = {
      ...mockCharacter,
      statPoints: 1
    };

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(charWithPoints));
    setupMockCharacter(charWithPoints);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.allocateStatPoint('strength');
    });

    expect(result.current.activeCharacter?.strength).toBe(mockCharacter.strength + 1);
    expect(result.current.activeCharacter?.statPoints).toBe(0);
    expect(mockSupabaseFrom).toHaveBeenCalledWith('characters');
  });

  it('should roll a lootbox item and persist inventory', async () => {
    const now = new Date('2025-01-01T00:00:00Z');
    vi.setSystemTime(now);

    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const mockItem: PixelItemAsset = {
      id: 'test-item',
      name: 'Test Item',
      rarity: 'common',
      slot: 'weapon',
      stats: { strength: 1 },
      pixels: [[1]],
      requiredLevel: 1
    };

    (canRollLootbox as any).mockReturnValue(true);
    (rollLootbox as any).mockReturnValue(mockItem);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const item = await result.current.rollLootbox();
      expect(item?.id).toBe('test-item');
    });

    expect(result.current.activeCharacter?.inventory).toContain('test-item');
    expect(mockSupabaseFrom).toHaveBeenCalledWith('characters');
  });

  it('should handle logout correctly', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeDefined();

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.activeCharacter).toBeNull();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should handle Supabase sync errors gracefully', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter?.name).toBe('Test Hero');
  });

  it('should handle corrupted localStorage', async () => {
    (localStorage.getItem as any).mockReturnValue('invalid-json');

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should track XP gain notifications', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight(true, 50, 'MOCK_FOE', 'opp-1');
    });

    expect(result.current.lastXpGain).toBeGreaterThan(0);
  });

  it('should clear XP notifications when requested', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    setupMockCharacter(mockCharacter);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.useFight(true, 50, 'MOCK_OPPONENT', 'opp-2');
    });

    expect(result.current.lastXpGain).not.toBeNull();

    act(() => {
      result.current.clearXpNotifications();
    });

    expect(result.current.lastXpGain).toBeNull();
  });

  it('should logout if character is missing from Supabase on mount', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));

    // Simulate character not found (PGRST116 error)
    const err: any = new Error('Not found');
    err.code = 'PGRST116';
    const builder = createQueryBuilder({ data: null, error: err });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeCharacter).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('bitbrawler_active_char');
  });

  it('should logout and throw error if character is deleted during a fight', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ data: characterToSupabaseRow(mockCharacter), error: null });
    mockSupabaseFrom.mockReturnValue(builder);

    // Make the update call fail with a message that includes 'not found'
    const updateBuilder = createQueryBuilder({ error: new Error('not found'), reject: true });
    builder.update.mockReturnValue(updateBuilder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.useFight(true, 50, 'FOE', 'opp-3'))
        .rejects.toThrow('Your character has been deleted or is no longer available.');
    });

    expect(result.current.activeCharacter).toBeNull();
  });

  it('should sync isBot when setAutoMode toggles', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const row = characterToSupabaseRow(mockCharacter);
    const builder = createQueryBuilder({ data: row, error: null });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Initially the character has isBot: false, autoMode: false
    expect(result.current.activeCharacter?.isBot).toBeFalsy();
    expect(result.current.activeCharacter?.autoMode).toBeFalsy();

    // Enable auto mode — isBot should follow
    await act(async () => {
      await result.current.setAutoMode(true);
    });

    expect(result.current.activeCharacter?.autoMode).toBe(true);
    expect(result.current.activeCharacter?.isBot).toBe(true);

    // Verify Supabase was called with both fields
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ auto_mode: true, is_bot: true })
    );

    // Disable auto mode — isBot should clear too
    await act(async () => {
      await result.current.setAutoMode(false);
    });

    expect(result.current.activeCharacter?.autoMode).toBe(false);
    expect(result.current.activeCharacter?.isBot).toBe(false);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ auto_mode: false, is_bot: false })
    );
  });
});
