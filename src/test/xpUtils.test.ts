import { describe, it, expect } from 'vitest';
import {
    getXpRequiredForNextLevel,
    getTotalXpForLevel,
    getXpProgress,
    gainXp,
    calculateFightXp,
    formatXpDisplay,
    getMaxLevel
} from '../utils/xpUtils';
import { Character } from '../types/Character';

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
            const xp = calculateFightXp(1, true);
            expect(xp).toBeGreaterThan(0);
        });

        it('should give more XP for winning', () => {
            // Run multiple times to account for randomness
            let totalWin = 0;
            let totalLose = 0;

            for (let i = 0; i < 100; i++) {
                totalWin += calculateFightXp(1, true);
                totalLose += calculateFightXp(1, false);
            }

            expect(totalWin / 100).toBeGreaterThan(totalLose / 100);
        });

        it('should scale with player level', () => {
            // Average over multiple runs
            let avgLevel1 = 0;
            let avgLevel10 = 0;

            for (let i = 0; i < 100; i++) {
                avgLevel1 += calculateFightXp(1, true);
                avgLevel10 += calculateFightXp(10, true);
            }

            expect(avgLevel10 / 100).toBeGreaterThan(avgLevel1 / 100);
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
            // Check that early levels are achievable
            const xpLevel1 = getXpRequiredForNextLevel(1);
            const xpLevel5 = getXpRequiredForNextLevel(5);

            expect(xpLevel1).toBeLessThan(200); // Not too grindy at start
            expect(xpLevel5).toBeLessThan(2000); // Still reasonable at level 5
        });

        it('should have challenging late game progression', () => {
            // Check that late levels require significant XP
            const xpLevel50 = getXpRequiredForNextLevel(50);
            const xpLevel90 = getXpRequiredForNextLevel(90);

            expect(xpLevel50).toBeGreaterThan(10000);
            expect(xpLevel90).toBeGreaterThan(100000);
        });
    });
});
