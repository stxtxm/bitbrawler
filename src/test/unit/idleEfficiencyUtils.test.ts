import { describe, it, expect } from 'vitest';
import {
    computeEfficiency,
    computeDisplayData,
    calculatePowerRatio,
    calculateEfficiency,
    calculateEffectiveInterval,
    calculateXpBonusMultiplier,
    calculateXpPerMinute,
    calculateStreakBonus,
    getStreakMilestone,
    calculateOfflineFightsWithEfficiency,
    EfficiencyResult,
} from '../../utils/idleEfficiencyUtils';
import { CombatStats } from '../../utils/combatUtils';
import { IDLE_CONFIG } from '../../config/idleConfig';

const EFF = IDLE_CONFIG.EFFICIENCY;

function makeStats(totalPower: number): CombatStats {
    return { totalPower, offense: 10, defense: 10, speed: 10, critChance: 0.1, magicPower: 10, focus: 10 };
}

describe('idleEfficiencyUtils', () => {
    describe('calculatePowerRatio', () => {
        it('should return 1 for equal power', () => {
            expect(calculatePowerRatio(makeStats(100), makeStats(100))).toBe(1);
        });

        it('should return ratio > 1 when player is stronger', () => {
            expect(calculatePowerRatio(makeStats(200), makeStats(100))).toBe(2);
        });

        it('should cap at MAX_POWER_RATIO', () => {
            expect(calculatePowerRatio(makeStats(5000), makeStats(100))).toBe(EFF.MAX_POWER_RATIO);
        });

        it('should floor at 0.5 when player is much weaker', () => {
            expect(calculatePowerRatio(makeStats(10), makeStats(100))).toBe(0.5);
        });

        it('should return MAX_POWER_RATIO when monster power is 0', () => {
            expect(calculatePowerRatio(makeStats(100), makeStats(0))).toBe(EFF.MAX_POWER_RATIO);
        });
    });

    describe('calculateEfficiency', () => {
        it('should return 1 for equal power and dexterity 10', () => {
            expect(calculateEfficiency(1, 10)).toBe(1);
        });

        it('should increase with higher power ratio', () => {
            const low = calculateEfficiency(1, 10);
            const high = calculateEfficiency(2, 10);
            expect(high).toBeGreaterThan(low);
        });

        it('should increase with higher dexterity', () => {
            const low = calculateEfficiency(1, 10);
            const high = calculateEfficiency(1, 30);
            expect(high).toBeGreaterThan(low);
        });

        it('dexterity below 10 should not penalize', () => {
            const result = calculateEfficiency(1, 5);
            expect(result).toBe(1);
        });
    });

    describe('calculateEffectiveInterval', () => {
        it('should return BASE_INTERVAL for efficiency 1', () => {
            expect(calculateEffectiveInterval(1)).toBe(EFF.BASE_INTERVAL);
        });

        it('should decrease as efficiency increases', () => {
            const fast = calculateEffectiveInterval(2);
            expect(fast).toBeLessThan(EFF.BASE_INTERVAL);
        });

        it('should never go below MIN_INTERVAL', () => {
            const result = calculateEffectiveInterval(100);
            expect(result).toBeGreaterThanOrEqual(EFF.MIN_INTERVAL);
        });

        it('should never exceed BASE_INTERVAL', () => {
            const result = calculateEffectiveInterval(0.1);
            expect(result).toBeLessThanOrEqual(EFF.BASE_INTERVAL);
        });
    });

    describe('calculateXpBonusMultiplier', () => {
        it('should return 1 for efficiency 1', () => {
            expect(calculateXpBonusMultiplier(1)).toBe(1);
        });

        it('should scale with efficiency above 1', () => {
            const result = calculateXpBonusMultiplier(2);
            expect(result).toBeGreaterThan(1);
            expect(result).toBeLessThan(2);
        });
    });

    describe('calculateXpPerMinute', () => {
        it('should calculate correct XP per minute', () => {
            const xpMin = calculateXpPerMinute(100, 60000);
            expect(xpMin).toBe(100);
        });

        it('should give more XP for faster intervals', () => {
            const slow = calculateXpPerMinute(100, 120000);
            const fast = calculateXpPerMinute(100, 60000);
            expect(fast).toBeGreaterThan(slow);
        });

        it('should give more XP for higher XP per kill', () => {
            const low = calculateXpPerMinute(50, 60000);
            const high = calculateXpPerMinute(100, 60000);
            expect(high).toBeGreaterThan(low);
        });
    });

    describe('calculateStreakBonus', () => {
        it('should return 0 for 0 streak', () => {
            expect(calculateStreakBonus(0)).toBe(0);
        });

        it('should increase with streak', () => {
            expect(calculateStreakBonus(5)).toBeGreaterThan(0);
        });

        it('should cap at STREAK_BONUS_CAP', () => {
            const result = calculateStreakBonus(1000);
            expect(result).toBeLessThanOrEqual(EFF.STREAK_BONUS_CAP);
        });
    });

    describe('getStreakMilestone', () => {
        it('should return milestone for exact match', () => {
            expect(getStreakMilestone(5)).toBe(5);
            expect(getStreakMilestone(10)).toBe(10);
            expect(getStreakMilestone(25)).toBe(25);
        });

        it('should return null for non-milestone', () => {
            expect(getStreakMilestone(3)).toBeNull();
            expect(getStreakMilestone(7)).toBeNull();
            expect(getStreakMilestone(11)).toBeNull();
        });

        it('should return null for 0', () => {
            expect(getStreakMilestone(0)).toBeNull();
        });
    });

    describe('calculateOfflineFightsWithEfficiency', () => {
        it('should return 0 for zero timestamp', () => {
            expect(calculateOfflineFightsWithEfficiency(0, Date.now(), 10000)).toBe(0);
        });

        it('should return 0 when now <= lastTimestamp', () => {
            expect(calculateOfflineFightsWithEfficiency(1000, 500, 10000)).toBe(0);
        });

        it('should calculate fights for elapsed time', () => {
            const fights = calculateOfflineFightsWithEfficiency(1, 20001, 10000);
            expect(fights).toBe(2);
        });

        it('should cap at MAX_IDLE_FIGHTS', () => {
            const farPast = Date.now() - 9999999999;
            const fights = calculateOfflineFightsWithEfficiency(farPast, Date.now(), 1000);
            expect(fights).toBeLessThanOrEqual(IDLE_CONFIG.MAX_IDLE_FIGHTS);
        });
    });

    describe('computeEfficiency — integration', () => {
        it('should return all fields', () => {
            const result = computeEfficiency(makeStats(150), makeStats(100), 10);
            expect(result).toHaveProperty('powerRatio');
            expect(result).toHaveProperty('efficiency');
            expect(result).toHaveProperty('effectiveInterval');
            expect(result).toHaveProperty('xpBonusMultiplier');
        });

        it('balance: efficiency should be > 1 when player has stat advantage', () => {
            const result = computeEfficiency(makeStats(250), makeStats(100), 30);
            expect(result.efficiency).toBeGreaterThan(1);
            expect(result.effectiveInterval).toBeLessThan(EFF.BASE_INTERVAL);
        });

        it('balance: equal stats should yield efficiency ≈ 1', () => {
            const result = computeEfficiency(makeStats(100), makeStats(100), 10);
            expect(result.efficiency).toBeCloseTo(1, 1);
            expect(result.effectiveInterval).toBe(EFF.BASE_INTERVAL);
        });
    });

    describe('computeDisplayData — integration', () => {
        it('should return all display fields', () => {
            const data = computeDisplayData(10000, 135, 5, 42);
            expect(data.xpPerMinute).toBeGreaterThan(0);
            expect(data.streakBonus).toBeGreaterThan(0);
            expect(data.totalKills).toBe(42);
            expect(data.currentStreak).toBe(5);
        });

        it('should detect streak milestone at 5', () => {
            const data = computeDisplayData(10000, 135, 5, 10);
            expect(data.streakMilestone).toBe(5);
        });

        it('should not detect milestone for non-milestone streak', () => {
            const data = computeDisplayData(10000, 135, 3, 10);
            expect(data.streakMilestone).toBeNull();
        });
    });

    describe('offline gain with efficiency', () => {
        it('should respect max offline hours', () => {
            const now = Date.now();
            const lastTimestamp = now - IDLE_CONFIG.MAX_OFFLINE_HOURS * 60 * 60 * 1000 * 2;
            const fights = calculateOfflineFightsWithEfficiency(lastTimestamp, now, 10000);
            const maxFights = (IDLE_CONFIG.MAX_OFFLINE_HOURS * 3600000) / 10000;
            expect(fights).toBeLessThanOrEqual(maxFights);
        });
    });
});
