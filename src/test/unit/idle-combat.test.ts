import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateIdleXp, calculateOfflineGains } from '../../utils/idleXpUtils';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';

const baseCharacter: Character = {
    seed: 'test',
    name: 'Test',
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

describe('calculateIdleXp', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return 25% of PvP win XP at level 1', () => {
        const pvpWinXp = GAME_RULES.COMBAT.XP_WIN;
        const expected = Math.floor(Math.floor(pvpWinXp * 1.0 * 1.0) * GAME_RULES.IDLE.XP_MODIFIER);
        const result = calculateIdleXp(true, 1);
        expect(result).toBe(expected);
    });

    it('should return 25% of PvP loss XP at level 1', () => {
        const pvpLossXp = GAME_RULES.COMBAT.XP_LOSS;
        const expected = Math.floor(Math.floor(pvpLossXp * 1.0 * 1.0) * GAME_RULES.IDLE.XP_MODIFIER);
        const result = calculateIdleXp(false, 1);
        expect(result).toBe(expected);
    });

    it('should scale with player level (+8% per level)', () => {
        const xpLevel1 = calculateIdleXp(true, 1);
        const xpLevel10 = calculateIdleXp(true, 10);
        expect(xpLevel10).toBeGreaterThan(xpLevel1);
    });

    it('should always return a non-negative integer', () => {
        for (let level = 1; level <= 50; level++) {
            const result = calculateIdleXp(true, level);
            expect(Number.isInteger(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
        }
    });

    it('should return 0 XP at max level', () => {
        const maxLevel = 99;
        const result = calculateIdleXp(true, maxLevel);
        expect(result).toBe(0);
    });
});

describe('calculateOfflineGains', () => {
    it('should return zero gains for 0 elapsed time', () => {
        const gains = calculateOfflineGains(baseCharacter, 0);
        expect(gains.fightsSimulated).toBe(0);
        expect(gains.totalXpGained).toBe(0);
        expect(gains.levelsGained).toBe(0);
    });

    it('should calculate correct number of fights for 1 hour', () => {
        const intervalMs = GAME_RULES.IDLE.COMBAT_INTERVAL_MS;
        const fightsPerHour = Math.floor(3600000 / intervalMs);
        const gains = calculateOfflineGains(baseCharacter, 1);
        expect(gains.fightsSimulated).toBe(fightsPerHour);
    });

    it('should cap elapsed time at OFFLINE_MAX_HOURS', () => {
        const gains = calculateOfflineGains(baseCharacter, 48);
        const intervalMs = GAME_RULES.IDLE.COMBAT_INTERVAL_MS;
        const maxFights = Math.floor(GAME_RULES.IDLE.OFFLINE_MAX_HOURS * 3600000 / intervalMs);
        expect(gains.fightsSimulated).toBeLessThanOrEqual(maxFights);
    });

    it('should have more wins than losses (player favored)', () => {
        const gains = calculateOfflineGains(baseCharacter, 2);
        expect(gains.wins).toBeGreaterThan(gains.fightsSimulated - gains.wins);
    });

    it('should accumulate XP from multiple fights', () => {
        const gains = calculateOfflineGains(baseCharacter, 1);
        const minXp = gains.wins * Math.floor(GAME_RULES.COMBAT.XP_WIN * GAME_RULES.IDLE.XP_MODIFIER);
        expect(gains.totalXpGained).toBeGreaterThanOrEqual(minXp);
    });

    it('should detect level-ups', () => {
        const highLevelChar: Character = { ...baseCharacter, level: 1, experience: 0 };
        const gains = calculateOfflineGains(highLevelChar, 5);
        // After 5 hours of idle, should gain at least 1 level
        expect(gains.levelsGained).toBeGreaterThanOrEqual(1);
    });

    it('should return elapsedHours matching input', () => {
        const gains = calculateOfflineGains(baseCharacter, 3.5);
        expect(gains.elapsedHours).toBe(3.5);
    });
});
