import { describe, it, expect } from 'vitest';
import { calculateCombatStats, getCombatBalance, simulateCombat } from '../../utils/combatUtils';
import { Character } from '../../types/Character';

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

        expect(stats.offense).toBeCloseTo(19, 1);
        expect(stats.defense).toBeCloseTo(21, 1);
        expect(stats.speed).toBeCloseTo(17, 1);
        expect(stats.critChance).toBeCloseTo(14, 1);
        expect(stats.magicPower).toBeCloseTo(17, 1);
    });

    it('should cap critical chance at 28%', () => {
        const luckyChar = { ...mockCharacter, luck: 50 };
        const stats = calculateCombatStats(luckyChar as Character);

        expect(stats.critChance).toBe(28);
    });

    it('should apply diminishing returns to high stats', () => {
        const low = calculateCombatStats({ ...mockCharacter, strength: 10 });
        const lowPlus = calculateCombatStats({ ...mockCharacter, strength: 11 });
        const high = calculateCombatStats({ ...mockCharacter, strength: 20 });
        const highPlus = calculateCombatStats({ ...mockCharacter, strength: 21 });

        const lowDelta = lowPlus.offense - low.offense;
        const highDelta = highPlus.offense - high.offense;

        expect(lowDelta).toBeGreaterThan(highDelta);
    });

    it('should correctly identify a character class/balance', () => {
        const stats = calculateCombatStats(mockCharacter);
        const balancedStats = { ...stats, offense: 10, defense: 10, speed: 10, magicPower: 10 };
        expect(getCombatBalance(balancedStats)).toBe('⚖️ Balanced');

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
        expect(result.timeline.length).toBe(result.details.length);
        expect(result.timeline[0].attackerHp).toBe(attacker.hp);
        expect(result.timeline[0].defenderHp).toBe(defender.hp);
        expect(result.details[0]).toContain('Attacker vs Defender');
    });
});
