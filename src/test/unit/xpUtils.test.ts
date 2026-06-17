import { describe, it, expect } from 'vitest';
import {
    getXpRequiredForNextLevel,
    getTotalXpForLevel,
    getXpProgress,
    gainXp,
    calculateFightXp,
    formatXpDisplay,
    getMaxLevel
} from '../../utils/xpUtils';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';

// Helper to create a test character
const createTestCharacter = (level: number, experience: number): Character => ({
    seed: 'test-seed',
    name: 'TestFighter',
    gender: 'male',
    level,
    experience,
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
});

describe('XP Utils', () => {
    describe('getXpRequiredForNextLevel', () => {
        it('should return 100 XP for level 1 to 2', () => {
            const xp = getXpRequiredForNextLevel(1);
            expect(xp).toBe(100);
        });

        it('should increase exponentially as level increases', () => {
            const xpLevel1 = getXpRequiredForNextLevel(1);
            const xpLevel5 = getXpRequiredForNextLevel(5);
            const xpLevel10 = getXpRequiredForNextLevel(10);

            expect(xpLevel5).toBeGreaterThan(xpLevel1);
            expect(xpLevel10).toBeGreaterThan(xpLevel5);
        });

        it('should return Infinity for max level', () => {
            const maxLevel = getMaxLevel();
            const xp = getXpRequiredForNextLevel(maxLevel);
            expect(xp).toBe(Infinity);
        });
    });

    describe('getTotalXpForLevel', () => {
        it('should return 0 for level 1', () => {
            expect(getTotalXpForLevel(1)).toBe(0);
        });

        it('should return 100 for level 2', () => {
            expect(getTotalXpForLevel(2)).toBe(100);
        });

        it('should be cumulative', () => {
            const totalForLevel3 = getTotalXpForLevel(3);
            const xpLevel1 = getXpRequiredForNextLevel(1);
            const xpLevel2 = getXpRequiredForNextLevel(2);

            expect(totalForLevel3).toBe(xpLevel1 + xpLevel2);
        });
    });

    describe('getXpProgress', () => {
        it('should calculate correct progress at start of level', () => {
            const char = createTestCharacter(1, 0);
            const progress = getXpProgress(char);

            expect(progress.currentXpInLevel).toBe(0);
            expect(progress.percentage).toBe(0);
            expect(progress.isMaxLevel).toBe(false);
        });

        it('should calculate 50% progress correctly', () => {
            const xpForLevel1 = getXpRequiredForNextLevel(1);
            const char = createTestCharacter(1, xpForLevel1 / 2);
            const progress = getXpProgress(char);

            expect(progress.percentage).toBeCloseTo(50, 0);
        });

        it('should detect max level', () => {
            const maxLevel = getMaxLevel();
            const char = createTestCharacter(maxLevel, 999999);
            const progress = getXpProgress(char);

            expect(progress.isMaxLevel).toBe(true);
            expect(progress.percentage).toBe(100);
        });
    });

    describe('gainXp', () => {
        it('should add XP to character', () => {
            const char = createTestCharacter(1, 0);
            const result = gainXp(char, 50);

            expect(result.updatedCharacter.experience).toBe(50);
            expect(result.leveledUp).toBe(false);
        });

        it('should level up when reaching XP threshold', () => {
            const xpForLevel1 = getXpRequiredForNextLevel(1);
            const char = createTestCharacter(1, xpForLevel1 - 10);
            const result = gainXp(char, 20);

            expect(result.leveledUp).toBe(true);
            expect(result.newLevel).toBe(2);
            expect(result.levelsGained).toBe(1);
        });

        it('should handle multiple level ups', () => {
            const char = createTestCharacter(1, 0);
            // Give enough XP to gain multiple levels
            const xpLevel1 = getXpRequiredForNextLevel(1);
            const xpLevel2 = getXpRequiredForNextLevel(2);
            const totalXp = xpLevel1 + xpLevel2 + 100;

            const result = gainXp(char, totalXp);

            expect(result.leveledUp).toBe(true);
            expect(result.levelsGained).toBeGreaterThanOrEqual(2);
        });

        it('should not exceed max level', () => {
            const maxLevel = getMaxLevel();
            const char = createTestCharacter(maxLevel, 0);
            const result = gainXp(char, 999999);

            expect(result.updatedCharacter.level).toBe(maxLevel);
            expect(result.leveledUp).toBe(false);
        });
    });

    describe('calculateFightXp', () => {
        it('should return positive XP', () => {
            const xp = calculateFightXp(true, 1);
            expect(xp).toBeGreaterThan(0);
        });

        it('should give more XP for winning', () => {
            // Run multiple times to account for randomness
            let totalWin = 0;
            let totalLose = 0;

            for (let i = 0; i < 100; i++) {
                totalWin += calculateFightXp(true, 1);
                totalLose += calculateFightXp(false, 1);
            }

            expect(totalWin / 100).toBeGreaterThan(totalLose / 100);
        });

        it('should scale with player level', () => {
            // Average over multiple runs
            let avgLevel1 = 0;
            let avgLevel10 = 0;

            for (let i = 0; i < 100; i++) {
                avgLevel1 += calculateFightXp(true, 1);
                avgLevel10 += calculateFightXp(true, 10);
            }

            expect(avgLevel10 / 100).toBeGreaterThan(avgLevel1 / 100);
        });
    });

    describe('XP tuning — WIN rewards', () => {
        it('XP_WIN should be 135 for better early progression', () => {
            expect(GAME_RULES.COMBAT.XP_WIN).toBe(135);
        });

        it('should yield ~135 XP average per win at level 1', () => {
            let total = 0;
            const trials = 200;
            for (let i = 0; i < trials; i++) {
                total += calculateFightXp(true, 1);
            }
            const avg = total / trials;
            // With base 135 + variance ±10%: range [121.5, 148.5]
            expect(avg).toBeGreaterThan(115);
            expect(avg).toBeLessThan(150);
        });

        it('should allow reaching level 3 in ~2 daily runs with 46.7% win rate', () => {
            // Simulate a full daily run (5 fights) with realistic win rate
            const winsPerRun = Math.round(5 * 0.467); // ~2 wins
            const lossesPerRun = 5 - winsPerRun;       // ~3 losses
            const runs = 2;

            let totalXp = 0;
            // Simulate multiple runs for statistical stability
            const simulations = 100;
            for (let sim = 0; sim < simulations; sim++) {
                let xp = 0;
                for (let r = 0; r < runs; r++) {
                    for (let w = 0; w < winsPerRun; w++) {
                        xp += calculateFightXp(true, 1);
                    }
                    for (let l = 0; l < lossesPerRun; l++) {
                        xp += calculateFightXp(false, 1);
                    }
                }
                totalXp += xp;
            }
            const avgXp = totalXp / simulations;

            // XP needed for level 3 = 100 (lvl1) + 303 (lvl2) = 403
            const xpNeededForLevel3 = getTotalXpForLevel(3);
            expect(xpNeededForLevel3).toBe(403);

            // With XP_WIN=135, 2 runs should comfortably exceed 403 XP
            expect(avgXp).toBeGreaterThanOrEqual(403);
        });
    });

    describe('XP tuning — Loss rewards', () => {
        it('XP_LOSS should be 55 for better loss retention (was 45)', () => {
            expect(GAME_RULES.COMBAT.XP_LOSS).toBe(55);
        });

        it('should yield ~55 XP average per loss at level 1', () => {
            let total = 0;
            const trials = 200;
            for (let i = 0; i < trials; i++) {
                total += calculateFightXp(false, 1);
            }
            const avg = total / trials;
            // With base 55 + variance ±10%: range [49.5, 60.5]
            expect(avg).toBeGreaterThan(44);
            expect(avg).toBeLessThan(66);
        });

        it('should make loss XP feel meaningful — at least 30% of win XP', () => {
            // XP_LOSS=55 should be at least 30% of XP_WIN=135 (ratio ~2.45:1)
            expect(GAME_RULES.COMBAT.XP_LOSS / GAME_RULES.COMBAT.XP_WIN).toBeGreaterThanOrEqual(0.30);
        });
    });

    describe('formatXpDisplay', () => {
        it('should format XP as "current / needed XP"', () => {
            const char = createTestCharacter(1, 50);
            const display = formatXpDisplay(char);

            expect(display).toContain('/');
            expect(display).toContain('XP');
        });

        it('should show MAX LEVEL for max level characters', () => {
            const maxLevel = getMaxLevel();
            const char = createTestCharacter(maxLevel, 999999);
            const display = formatXpDisplay(char);

            expect(display).toBe('MAX LEVEL');
        });
    });

    describe('XP curve progression', () => {
        it('should have a reasonable early game progression', () => {
            const xpLevel1 = getXpRequiredForNextLevel(1);
            const xpLevel5 = getXpRequiredForNextLevel(5);

            expect(xpLevel1).toBeLessThan(200);
            expect(xpLevel5).toBeLessThan(2000);
        });

        it('should have challenging late game progression', () => {
            const xpLevel50 = getXpRequiredForNextLevel(50);
            const xpLevel90 = getXpRequiredForNextLevel(90);

            expect(xpLevel50).toBeGreaterThan(10000);
            expect(xpLevel90).toBeGreaterThan(100000);
        });

        it('should require ~1-3 wins for level 2 (quick start)', () => {
            const xpNeeded = getXpRequiredForNextLevel(1);
            const winXp = calculateFightXp(true, 1);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeLessThanOrEqual(3);
        });

        it('should require 25+ wins per level at level 20 (mid-game grind)', () => {
            const xpNeeded = getXpRequiredForNextLevel(20);
            const winXp = calculateFightXp(true, 20);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeGreaterThanOrEqual(25);
        });

        it('should keep level 50 requirement < 100 fights per level (not infinite grind)', () => {
            const xpNeeded = getXpRequiredForNextLevel(50);
            const winXp = calculateFightXp(true, 50);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeLessThan(100);
        });
    });
});
