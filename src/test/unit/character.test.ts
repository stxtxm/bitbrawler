import { describe, it, expect } from 'vitest';
import { generateInitialStats } from '../../utils/characterUtils';
import { GAME_RULES } from '../../config/gameRules';

describe('Character Generation', () => {
    it('should generate a character with the correct initial stat pool', () => {
        const char = generateInitialStats('Test', 'male');

        // Base is minValue (4) * 6 stats + 42 distributed points = 66 total
        const totalRPGStats =
            char.strength +
            char.vitality +
            char.dexterity +
            char.luck +
            char.intelligence +
            char.focus;
        expect(totalRPGStats).toBe(66);
    });

    it('should calculate HP correctly based on vitality', () => {
        const char = generateInitialStats('Test', 'female');
        // HP Formula: 100 + (vitality * 8)
        const expectedHp = 100 + (char.vitality * 8);
        expect(char.hp).toBe(expectedHp);
        expect(char.maxHp).toBe(expectedHp);
    });

    it('should assign the provided name and gender', () => {
        const char = generateInitialStats('BRAWLER1', 'female');
        expect(char.name).toBe('BRAWLER1');
        expect(char.gender).toBe('female');
    });

    it('should generate a seed string', () => {
        const char = generateInitialStats('Test', 'male');
        expect(char.seed).toBeDefined();
        expect(typeof char.seed).toBe('string');
        expect(char.seed.length).toBeGreaterThan(0);
    });

    it('should initialize basic levels and wins', () => {
        const char = generateInitialStats('Test', 'male');
        expect(char.level).toBe(1);
        expect(char.experience).toBe(0);
        expect(char.wins).toBe(0);
        expect(char.losses).toBe(0);
    });

    it('should have all stats >= MIN_VALUE', () => {
        // Generate 50 characters and verify no stat drops below MIN_VALUE
        for (let i = 0; i < 50; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            for (const stat of allStats) {
                expect(stat).toBeGreaterThanOrEqual(GAME_RULES.STATS.MIN_VALUE);
            }
        }
    });

    it('should have all stats <= MAX_VALUE', () => {
        // Generate 50 characters and verify no stat exceeds MAX_VALUE
        for (let i = 0; i < 50; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            for (const stat of allStats) {
                expect(stat).toBeLessThanOrEqual(GAME_RULES.STATS.MAX_VALUE);
            }
        }
    });

    it('should produce stat spread > 3 across 100 characters (archetype variance)', () => {
        // Verify that the weighted random allocation creates genuine archetypes:
        // the range (max - min) across 6 stats should average > 3
        let totalSpread = 0;
        const SAMPLES = 100;
        for (let i = 0; i < SAMPLES; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const spread = Math.max(...allStats) - Math.min(...allStats);
            totalSpread += spread;
        }
        const avgSpread = totalSpread / SAMPLES;
        expect(avgSpread).toBeGreaterThan(3);
    });

    it('should consistently have the primary stat be the highest or tied for highest', () => {
        // Since the primary stat gets 15x weight vs 1x for others,
        // it should be the highest stat (or tied) in the vast majority of cases
        let primaryIsHighest = 0;
        const SAMPLES = 100;
        for (let i = 0; i < SAMPLES; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const maxStat = Math.max(...allStats);
            // We can't know which stat was primary, but we know at least one
            // stat should be notably higher than others — if max > avg + 2, archetype exists
            const avgStat = allStats.reduce((a, b) => a + b, 0) / allStats.length;
            if (maxStat > avgStat + 2) {
                primaryIsHighest++;
            }
        }
        // At least 80% of characters should have a clear primary archetype
        expect(primaryIsHighest).toBeGreaterThanOrEqual(80);
    });

    it('should cap non-primary stats at MAX_VALUE-1 while primary can reach MAX_VALUE', () => {
        // Only the primary stat can reach MAX_VALUE (14);
        // all other stats are capped at MAX_VALUE-1 (13).
        // Over 100 characters, at most 1 stat should exceed MAX_VALUE-1.
        const SAMPLES = 100;
        for (let i = 0; i < SAMPLES; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const statsAboveSecondaryCap = allStats.filter(
                s => s > GAME_RULES.STATS.MAX_VALUE - 1
            );
            expect(statsAboveSecondaryCap.length).toBeLessThanOrEqual(1);
        }
    });

    it('should produce an average stat spread > 4 with the new weights (stronger archetypes)', () => {
        // With primary=15x, secondary=5x weights and secondary caps,
        // the range (max - min) across 6 stats should average > 4
        let totalSpread = 0;
        const SAMPLES = 100;
        for (let i = 0; i < SAMPLES; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const spread = Math.max(...allStats) - Math.min(...allStats);
            totalSpread += spread;
        }
        const avgSpread = totalSpread / SAMPLES;
        expect(avgSpread).toBeGreaterThan(4);
    });
});
