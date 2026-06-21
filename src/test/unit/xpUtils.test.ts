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
        it('should return 120 XP for level 1 to 2', () => {
            const xp = getXpRequiredForNextLevel(1);
            expect(xp).toBe(120);
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

        it('should return 120 for level 2', () => {
            expect(getTotalXpForLevel(2)).toBe(120);
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
        it('XP_WIN should be 125', () => {
            expect(GAME_RULES.COMBAT.XP_WIN).toBe(125);
        });

        it('should yield ~125 XP average per win at level 1', () => {
            let total = 0;
            const trials = 200;
            for (let i = 0; i < trials; i++) {
                total += calculateFightXp(true, 1);
            }
            const avg = total / trials;
            // With base 125 + variance ±10%: range [112.5, 137.5]
            expect(avg).toBeGreaterThan(105);
            expect(avg).toBeLessThan(145);
        });

        it('should allow reaching level 3 in ~3 daily runs with 46.7% win rate', () => {
            // Simulate a full daily run (5 fights) with realistic win rate
            const winsPerRun = Math.round(5 * 0.467); // ~2 wins
            const lossesPerRun = 5 - winsPerRun;       // ~3 losses
            const runs = 3;

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

            // XP needed for level 3 = 120 (lvl1) + 376 (lvl2) = 496
            const xpNeededForLevel3 = getTotalXpForLevel(3);
            expect(xpNeededForLevel3).toBe(496);

            expect(avgXp).toBeGreaterThanOrEqual(496);
        });
    });

    describe('XP tuning — Loss rewards', () => {
        it('XP_LOSS should be 50', () => {
            expect(GAME_RULES.COMBAT.XP_LOSS).toBe(50);
        });

        it('should yield ~50 XP average per loss at level 1', () => {
            let total = 0;
            const trials = 200;
            for (let i = 0; i < trials; i++) {
                total += calculateFightXp(false, 1);
            }
            const avg = total / trials;
            // With base 50 + variance ±10%: range [45, 55]
            expect(avg).toBeGreaterThan(40);
            expect(avg).toBeLessThan(60);
        });

        it('should make loss XP feel meaningful — at least 30% of win XP', () => {
            // XP_LOSS=50 should be 40% of XP_WIN=125 (ratio 2.5:1)
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
            expect(xpLevel5).toBeLessThan(3000);
        });

        it('should have challenging late game progression', () => {
            const xpLevel50 = getXpRequiredForNextLevel(50);
            const xpLevel90 = getXpRequiredForNextLevel(90);

            expect(xpLevel50).toBeGreaterThan(10000);
            expect(xpLevel90).toBeGreaterThan(100000);
        });

        it('should require 1-2 wins for level 2 (quick start)', () => {
            const xpNeeded = getXpRequiredForNextLevel(1);
            const winXp = calculateFightXp(true, 1);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeLessThanOrEqual(2);
        });

        it('should require 50+ wins per level at level 20 (mid-game grind)', () => {
            const xpNeeded = getXpRequiredForNextLevel(20);
            const winXp = calculateFightXp(true, 20);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeGreaterThanOrEqual(50);
        });

        it('should keep level 50 requirement < 200 fights per level', () => {
            const xpNeeded = getXpRequiredForNextLevel(50);
            const winXp = calculateFightXp(true, 50);
            const fights = Math.ceil(xpNeeded / winXp);
            expect(fights).toBeLessThan(200);
        });
    });
});
