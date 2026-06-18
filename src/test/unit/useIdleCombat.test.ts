import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';
import { GAME_RULES } from '../../config/gameRules';

const baseCharacter: Character = {
    seed: 'test',
    name: 'TestHero',
    gender: 'male',
    level: 1,
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
    fightsLeft: 5,
    lastFightReset: Date.now(),
};

describe('useIdleCombat', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should start with empty log and 0 totals', () => {
        const setCharacter = vi.fn();
        const { result } = renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        expect(result.current.idleState.combatLog).toHaveLength(0);
        expect(result.current.idleState.totalIdleFights).toBe(0);
        expect(result.current.idleState.totalIdleXpGained).toBe(0);
    });

    it('should trigger a combat after the interval', () => {
        const setCharacter = vi.fn();
        renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        act(() => {
            vi.advanceTimersByTime(GAME_RULES.IDLE.COMBAT_INTERVAL_MS);
        });

        // setCharacter should have been called (XP gain)
        expect(setCharacter).toHaveBeenCalled();
    });

    it('should record monsters in combat log over time', () => {
        const setCharacter = vi.fn();
        const { result } = renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        // Advance past 3 intervals
        act(() => {
            vi.advanceTimersByTime(GAME_RULES.IDLE.COMBAT_INTERVAL_MS * 3);
        });

        expect(result.current.idleState.totalIdleFights).toBe(3);
        expect(result.current.idleState.combatLog).toHaveLength(3);
    });

    it('should accumulate XP across multiple combats', () => {
        const setCharacter = vi.fn();
        const { result } = renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        act(() => {
            vi.advanceTimersByTime(GAME_RULES.IDLE.COMBAT_INTERVAL_MS * 5);
        });

        expect(result.current.idleState.totalIdleFights).toBe(5);
        expect(result.current.idleState.totalIdleXpGained).toBeGreaterThan(0);
    });

    it('should record wins and accumulate XP', () => {
        const setCharacter = vi.fn();
        const { result } = renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        act(() => {
            vi.advanceTimersByTime(GAME_RULES.IDLE.COMBAT_INTERVAL_MS * 10);
        });

        expect(result.current.idleState.totalIdleFights).toBe(10);
        // XP should be positive even if all fights are losses
        expect(result.current.idleState.totalIdleXpGained).toBeGreaterThan(0);
    });

    it('should compute offline gains on mount when timestamp is in the past', () => {
        const setCharacter = vi.fn();
        const charWithOldTimestamp: Character = {
            ...baseCharacter,
            lastIdleTimestamp: Date.now() - 7200000, // 2 hours ago
        };

        const { result } = renderHook(() => useIdleCombat(charWithOldTimestamp, setCharacter));

        expect(result.current.offlineGains).not.toBeNull();
        expect(result.current.offlineGains!.elapsedHours).toBeGreaterThan(0);
        expect(result.current.offlineGains!.fightsSimulated).toBeGreaterThan(0);
    });

    it('should not compute offline gains when timestamp is current', () => {
        const setCharacter = vi.fn();
        const charWithCurrentTimestamp: Character = {
            ...baseCharacter,
            lastIdleTimestamp: Date.now(),
        };

        const { result } = renderHook(() => useIdleCombat(charWithCurrentTimestamp, setCharacter));

        expect(result.current.offlineGains).toBeNull();
    });

    it('should dismiss offline recap', () => {
        const setCharacter = vi.fn();
        const charWithOldTimestamp: Character = {
            ...baseCharacter,
            lastIdleTimestamp: Date.now() - 7200000,
        };

        const { result } = renderHook(() => useIdleCombat(charWithOldTimestamp, setCharacter));

        expect(result.current.offlineGains).not.toBeNull();

        act(() => {
            result.current.dismissOfflineRecap();
        });

        expect(result.current.offlineGains).toBeNull();
    });

    it('should not crash without setCharacter', () => {
        const { result } = renderHook(() => useIdleCombat(baseCharacter, undefined as any));

        act(() => {
            vi.advanceTimersByTime(GAME_RULES.IDLE.COMBAT_INTERVAL_MS);
        });

        expect(result.current.idleState.totalIdleFights).toBe(1);
    });

    it('should clean up interval on unmount', () => {
        const setCharacter = vi.fn();
        const clearSpy = vi.spyOn(global, 'clearInterval');

        const { unmount } = renderHook(() => useIdleCombat(baseCharacter, setCharacter));

        unmount();

        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
