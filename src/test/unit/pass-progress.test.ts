import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PASS_TIERS, getPassLevel, getPassRewards, getProgressPct, calculatePassXp } from '../../data/seasonalPass';

const mockSetCharacter = vi.fn();

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

import { useGame } from '../../context/GameContext';
import { usePassProgress } from '../../hooks/usePassProgress';

const mockedUseGame = useGame as unknown as ReturnType<typeof vi.fn>;

function mockCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char-1',
    seed: 'seed-1',
    name: 'Hero',
    level: 5,
    experience: 0,
    wins: 2,
    losses: 1,
    idleTotalKills: 4,
    ...overrides,
  };
}

describe('seasonalPass config', () => {
  it('expose 20 paliers avec xpRequired croissant', () => {
    expect(PASS_TIERS).toHaveLength(20);
    for (let i = 1; i < PASS_TIERS.length; i++) {
      expect(PASS_TIERS[i].xpRequired).toBeGreaterThan(PASS_TIERS[i - 1].xpRequired);
    }
  });

  it('répartition rewards contient les 4 types essence | reroll | pity | biome_token', () => {
    const types = new Set(PASS_TIERS.map((t) => t.reward.type));
    expect(types.has('essence')).toBe(true);
    expect(types.has('reroll')).toBe(true);
    expect(types.has('pity')).toBe(true);
    expect(types.has('biome_token')).toBe(true);
  });

  it('getPassLevel retourne le palier correct selon xp', () => {
    expect(getPassLevel(0)).toBe(0);
    expect(getPassLevel(3)).toBe(1);
    expect(getPassLevel(6)).toBe(2);
    expect(getPassLevel(60)).toBe(20);
    expect(getPassLevel(999)).toBe(20);
  });

  it('getPassRewards retourne le reward du palier', () => {
    expect(getPassRewards(1)?.type).toBe('essence');
    expect(getPassRewards(3)?.type).toBe('reroll');
    expect(getPassRewards(999)).toBeNull();
  });

  it('getProgressPct calcule le pourcentage global', () => {
    expect(getProgressPct(0)).toBe(0);
    expect(getProgressPct(30)).toBe(50);
    expect(getProgressPct(60)).toBe(100);
    expect(getProgressPct(999)).toBe(100);
  });

  it('calculatePassXp somme fights + idle kills et respecte passProgress stocké', () => {
    const char = mockCharacter({ wins: 2, losses: 1, idleTotalKills: 4 }) as unknown as Parameters<typeof calculatePassXp>[0];
    expect(calculatePassXp(char)).toBe(7);
    const charWithStored = mockCharacter({
      wins: 1,
      losses: 0,
      idleTotalKills: 0,
      passProgress: { xp: 20, claimed: [1, 2] },
    }) as unknown as Parameters<typeof calculatePassXp>[0];
    expect(calculatePassXp(charWithStored)).toBe(20);
  });
});

describe('usePassProgress hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSetCharacter.mockClear();
  });

  it('réutilise useGame pour calculer currentXp et expose tiers / progressPct', () => {
    const char = mockCharacter({ wins: 3, losses: 2, idleTotalKills: 1 });
    mockedUseGame.mockReturnValue({
      activeCharacter: char,
      setCharacter: mockSetCharacter,
    } as unknown as ReturnType<typeof useGame>);

    const { result } = renderHook(() => usePassProgress());
    expect(result.current.tiers).toHaveLength(20);
    expect(result.current.currentXp).toBe(6);
    expect(result.current.progressPct).toBe(10);
  });

  it('canClaim retourne vrai seulement si xp suffisant et non claimed', () => {
    const char = mockCharacter({ wins: 2, losses: 1, idleTotalKills: 4 });
    mockedUseGame.mockReturnValue({
      activeCharacter: char,
      setCharacter: mockSetCharacter,
    } as unknown as ReturnType<typeof useGame>);

    const { result } = renderHook(() => usePassProgress());
    expect(result.current.canClaim(1)).toBe(true);
    expect(result.current.canClaim(2)).toBe(true);
    expect(result.current.canClaim(3)).toBe(false);
    expect(result.current.canClaim(20)).toBe(false);
  });

  it('claimTier persiste en localStorage et via setCharacter', () => {
    const char = mockCharacter({ wins: 5, losses: 5, idleTotalKills: 5 });
    mockedUseGame.mockReturnValue({
      activeCharacter: char,
      setCharacter: mockSetCharacter,
    } as unknown as ReturnType<typeof useGame>);

    const { result } = renderHook(() => usePassProgress());
    expect(result.current.canClaim(1)).toBe(true);

    act(() => {
      const ok = result.current.claimTier(1);
      expect(ok).toBe(true);
    });

    expect(result.current.claimedTiers).toContain(1);
    expect(result.current.canClaim(1)).toBe(false);
    expect(localStorage.getItem('bitbrawler_pass_claimed_char-1')).toContain('1');
    expect(mockSetCharacter).toHaveBeenCalled();
  });

  it('refuse de claim un palier locked ou déjà claimed', () => {
    const char = mockCharacter({ wins: 0, losses: 0, idleTotalKills: 0 });
    mockedUseGame.mockReturnValue({
      activeCharacter: char,
      setCharacter: mockSetCharacter,
    } as unknown as ReturnType<typeof useGame>);

    const { result } = renderHook(() => usePassProgress());
    act(() => {
      expect(result.current.claimTier(5)).toBe(false);
    });
    expect(result.current.claimedTiers).not.toContain(5);

    const char2 = mockCharacter({ wins: 10, losses: 10, idleTotalKills: 10, passProgress: { xp: 60, claimed: [1] } });
    localStorage.setItem('bitbrawler_pass_claimed_char-1', JSON.stringify([1]));
    mockedUseGame.mockReturnValue({
      activeCharacter: char2,
      setCharacter: mockSetCharacter,
    } as unknown as ReturnType<typeof useGame>);
    const { result: r2 } = renderHook(() => usePassProgress());
    act(() => {
      expect(r2.current.claimTier(1)).toBe(false);
    });
  });
});
