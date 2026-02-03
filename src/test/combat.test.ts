import { describe, it, expect } from 'vitest';
import { calculateCombatStats, getCombatBalance, simulateCombat } from '../utils/combatUtils';
import { Character } from '../types/Character';

describe('Combat System', () => {
    const mockCharacter: Character = {
        name: 'Test Brawler',
        gender: 'male',
        seed: 'test-seed',
        level: 1,
        hp: 100,
        maxHp: 100,
        strength: 10,
        vitality: 10,
        dexterity: 10,
        luck: 10,
        intelligence: 10,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: Date.now()
    };

    it('should correctly calculate combat stats from RPG stats', () => {
        const stats = calculateCombatStats(mockCharacter);

        expect(stats.offense).toBe(20); // 10 * 2
        expect(stats.defense).toBe(20); // 10 * 2
        expect(stats.speed).toBe(20);   // 10 * 2
        expect(stats.critChance).toBe(20); // 10 * 2
        expect(stats.magicPower).toBe(20); // 10 * 2
    });

    it('should cap critical chance at 30%', () => {
        const luckyChar = { ...mockCharacter, luck: 50 };
        const stats = calculateCombatStats(luckyChar as Character);

        expect(stats.critChance).toBe(30);
    });

    it('should correctly identify a character class/balance', () => {
        const stats = calculateCombatStats(mockCharacter);
        expect(getCombatBalance(stats)).toBe('⚖️ Balanced');

        const tankStats = { ...stats, offense: 10, defense: 30, speed: 10, magicPower: 10 };
        expect(getCombatBalance(tankStats)).toBe('🛡️ Tank');

        const dpsStats = { ...stats, offense: 30, defense: 10, speed: 10, magicPower: 10 };
        expect(getCombatBalance(dpsStats)).toBe('⚔️ Berserker');

        const mageStats = { ...stats, offense: 10, defense: 10, speed: 10, magicPower: 30 };
        expect(getCombatBalance(mageStats)).toBe('🔮 Mage');
    });

    it('should simulate combat and return a result', () => {
        const attacker = { ...mockCharacter, name: 'Attacker', strength: 20 };
        const defender = { ...mockCharacter, name: 'Defender', vitality: 20 };

        const result = simulateCombat(attacker as Character, defender as Character);

        expect(result.winner).toBeDefined();
        expect(result.rounds).toBeGreaterThan(0);
        expect(result.details.length).toBeGreaterThan(0);
        expect(result.details[0]).toContain('Attacker vs Defender');
    });
});
