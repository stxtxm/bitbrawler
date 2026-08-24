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

  it('queueLevelUp(3, 8) aggregates into a single LEVEL UP ×3 FX at the final level, then clears', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(3, 8);
    });

    // No staggered one-per-level cascade: a single FX announces the whole
    // catch-up at the final level with the level count (regression: a big
    // offline catch-up used to fire one flash per level every 1200ms, which
    // read as "a level-up for every monster killed").
    expect(result.current.recentLevelUp).toEqual({ newLevel: 8, isMilestone: false, count: 3 });

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
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the FX lock when visibilitychange purges the hide-timer mid-FX', () => {
    const { result } = makeHook();
    const setVis = (s: 'visible' | 'hidden') =>
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });

    act(() => { result.current.queueLevelUp(1, 5); });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 5, isMilestone: true });

    // Tab hidden DURING the FX -> handler purges the hide-timer
    act(() => {
      setVis('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.recentLevelUp).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    // Back visible + grace/throttle elapsed -> a NEW level announces normally
    act(() => {
      setVis('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(9000);
    });
    act(() => { result.current.queueLevelUp(1, 6); });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 6, isMilestone: false });
  });

  it('swallows a new queue while an FX is already showing (no chaining loop)', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(3, 8);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 8, isMilestone: false, count: 3 });

    // Background-throttled ticks crossing more levels must NOT extend/replay
    // the FX (regression: chained flashes looped endlessly on PWA resume).
    act(() => {
      result.current.queueLevelUp(1, 9);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 8, isMilestone: false, count: 3 });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.recentLevelUp).toBeNull();

    // 5.5.1 throttle: within 8s of the last announcement, new levels are
    // aggregated silently (pending) instead of chaining flashes.
    act(() => {
      result.current.queueLevelUp(1, 9);
      result.current.queueLevelUp(1, 10);
    });
    expect(result.current.recentLevelUp).toBeNull();

    // After the throttle window clears, the next genuine level announces with
    // the carried aggregation included.
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    act(() => {
      result.current.queueLevelUp(1, 11);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 11, isMilestone: false, count: 4 });
  });

  it('synchronous duplicate call while the FX shows neither restarts nor extends it', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(1, 5);
      result.current.queueLevelUp(1, 5);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 5, isMilestone: true });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.recentLevelUp).toBeNull();
  });

  it('releases the FX lock when the visibility purge cancels the hide timer', () => {
    const { result } = makeHook();

    act(() => {
      result.current.queueLevelUp(1, 5);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 5, isMilestone: true });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.recentLevelUp).toBeNull();

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    act(() => {
      result.current.queueLevelUp(1, 6);
    });
    expect(result.current.recentLevelUp).toEqual({ newLevel: 6, isMilestone: false });
  });
});
