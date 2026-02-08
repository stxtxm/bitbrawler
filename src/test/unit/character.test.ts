import { describe, it, expect } from 'vitest';
import { generateInitialStats } from '../../utils/characterUtils';

describe('Character Generation', () => {
    it('should generate a character with the correct initial stat pool', () => {
        const char = generateInitialStats('Test', 'male');

        // Base is 10 for 6 stats (60) total RPG points
        const totalRPGStats =
            char.strength +
            char.vitality +
            char.dexterity +
            char.luck +
            char.intelligence +
            char.focus;
        expect(totalRPGStats).toBe(60);
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
});
