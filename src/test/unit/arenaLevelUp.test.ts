import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { isMilestoneLevel, useArenaLevelUp } from '../../hooks/useArenaLevelUp';
import { Character } from '../../types/Character';

describe('isMilestoneLevel', () => {
  it('returns true for level 5', () => {
    expect(isMilestoneLevel(5)).toBe(true);
  });

  it('returns true for level 10', () => {
    expect(isMilestoneLevel(10)).toBe(true);
  });

  it('returns true for level 15', () => {
    expect(isMilestoneLevel(15)).toBe(true);
  });

  it('returns true for level 20', () => {
    expect(isMilestoneLevel(20)).toBe(true);
  });

  it('returns false for level 1', () => {
    expect(isMilestoneLevel(1)).toBe(false);
  });

  it('returns false for level 4', () => {
    expect(isMilestoneLevel(4)).toBe(false);
  });

  it('returns false for level 6', () => {
    expect(isMilestoneLevel(6)).toBe(false);
  });

  it('returns false for level 11', () => {
    expect(isMilestoneLevel(11)).toBe(false);
  });

  it('returns false for level 0', () => {
    expect(isMilestoneLevel(0)).toBe(false);
  });

  it('returns true for level 25 (future milestone)', () => {
    expect(isMilestoneLevel(25)).toBe(true);
  });
});

describe('useArenaLevelUp - multi-level stagger queue', () => {
  const mockCharacter: Character = {
    seed: 'seed-test',
    name: 'Test',
    gender: 'male',
    level: 8,
    experience: 0,
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
    fightsLeft: 10,
    lastFightReset: 0,
    statPoints: 0,
  };

  const makeHook = () => {
    const clearXpNotifications = vi.fn();
    const setCharacter = vi.fn();
    const saveStatAllocations = vi.fn().mockResolvedValue(null);
    const play = vi.fn();

    return renderHook(() =>
      useArenaLevelUp({
        character: mockCharacter,
        lastXpGain: null,
        clearXpNotifications,
        setCharacter,
        saveStatAllocations,
        play,
      })
    );
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('queueLevelUp(3, 8) staggers through levels 6, 7, 8 then clears', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(3, 8);
    });

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 6, isMilestone: false });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 7, isMilestone: false });

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 8, isMilestone: false });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.recentLevelUp).toBeNull();
  });

  it('queueLevelUp(1, 5) applies FX immediately and dismisses after 2000ms', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(1, 5);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 5, isMilestone: true });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.recentLevelUp).toBeNull();
  });

  it('unmount cleanup cancels pending queue timers', () => {
    const { result, unmount } = makeHook();

    act(() => {
      result.current.queueLevelUp(3, 8);
    });
    expect(vi.getTimerCount()).toBe(3);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-queue during an active queue cancels previous timers', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(3, 8);
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 7, isMilestone: false });

    act(() => {
      result.current.queueLevelUp(1, 9);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 9, isMilestone: false });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.recentLevelUp).toBeNull();
  });
});
