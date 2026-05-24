import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { GameProvider, useGame } from '../../context/GameContext';
import { Character } from '../../types/Character';
import { createQueryBuilder, characterToSupabaseRow } from '../../test/utils/supabaseMock';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn()
}));

vi.mock('../../config/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  CharacterRow: {}
}));

const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <GameProvider>{children}</GameProvider>
  );
};

describe('Database Unavailability Handling', () => {
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
    fightsLeft: 3,
    lastFightReset: Date.now(),
    firestoreId: 'test-firestore-id'
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

  it('should set dbAvailable to false when Supabase fails during load', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ error: new Error('Network error'), reject: true });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dbAvailable).toBe(false);
    expect(result.current.activeCharacter?.name).toBe('Test Hero');
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should set dbAvailable to false when login fails', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    const builder = createQueryBuilder({ error: new Error('Connection failed'), reject: true });
    mockSupabaseFrom.mockReturnValue(builder);

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

    expect(loginResult).toBe('Connection error - please check your internet connection and try again');
    expect(result.current.dbAvailable).toBe(false);
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('should set dbAvailable to false when useFight fails', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ data: characterToSupabaseRow(mockCharacter), error: null });
    mockSupabaseFrom.mockReturnValue(builder);

    // Make the update call fail
    const updateBuilder = createQueryBuilder({ error: new Error('Connection lost'), reject: true });
    builder.update.mockReturnValue(updateBuilder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.useFight(true, 50, 'FOE', 'opp-1')).rejects.toThrow('Connection error - fight not counted');
    });

    expect(result.current.dbAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeDefined();
  });

  it('should return false when retryConnection runs while offline', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ data: characterToSupabaseRow(mockCharacter), error: null });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ok = true;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await act(async () => {
      ok = await result.current.retryConnection();
    });
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    expect(ok).toBe(false);
    expect(result.current.dbAvailable).toBe(false);
  });

  it('should keep localStorage when Supabase is unavailable', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ error: new Error('Network error'), reject: true });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(result.current.activeCharacter).toBeDefined();
    expect(result.current.dbAvailable).toBe(false);
  });

  it('should keep snapshot but block actions when Supabase is unavailable', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ error: new Error('Network error'), reject: true });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dbAvailable).toBe(false);
    expect(result.current.activeCharacter).toBeDefined();

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('any');
    });
    expect(loginResult).toBe('Connection error - please check your internet connection and try again');

    await act(async () => {
      await expect(result.current.useFight(true, 50, 'FOE', 'opp-2')).rejects.toThrow('Connection error - fight not counted');
    });
  });

  it('should return false when retryConnection cannot reach server', async () => {
    (localStorage.getItem as any).mockReturnValue(JSON.stringify(mockCharacter));
    const builder = createQueryBuilder({ error: new Error('Network error'), reject: true });
    mockSupabaseFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useGame(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.retryConnection();
    });

    expect(ok).toBe(false);
    expect(result.current.dbAvailable).toBe(false);
  });
});
