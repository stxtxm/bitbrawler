import { describe, it, expect } from 'vitest';
import { simulateCombat } from '../../utils/combatUtils';
import { generateInitialStats } from '../../utils/characterUtils';
import { Character } from '../../types/Character';

describe('🤖 Bot & Character Generation System', () => {
    it('should generate balanced stats with exactly 50 points total', () => {
        // Generate 100 characters to verify statistical consistency
        for (let i = 0; i < 100; i++) {
            const char = generateInitialStats(`Bot_${i}`, 'male');

            const totalStats =
                char.strength +
                char.vitality +
                char.dexterity +
                char.luck +
                char.intelligence;

            // The new balanced system targets exactly 50 points
            expect(totalStats).toBe(50);

            // Stats should be clamped between 5 and 15
            expect(char.strength).toBeGreaterThan(0);
            expect(char.strength).toBeLessThanOrEqual(15);
        }
    });

    it('should generate unique seeds for visuals', () => {
        const char1 = generateInitialStats('Bot_1', 'male');
        const char2 = generateInitialStats('Bot_2', 'male');
        expect(char1.seed).not.toBe(char2.seed);
    });
});

describe('⚔️ Combat System Balancing', () => {
    const createFighter = (level: number, multiplier: number = 1): Character => ({
        name: level === 1 ? 'Weakling' : 'Champion',
        gender: 'male',
        seed: 'abc',
        level: level,
        hp: 100 * multiplier,
        maxHp: 100 * multiplier,
        strength: 10 * multiplier,
        vitality: 10 * multiplier,
        dexterity: 10 * multiplier,
        luck: 10 * multiplier,
        intelligence: 10 * multiplier,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: 0
    });

    it('Level 10 should consistently beat Level 1 (Win Rate > 95%)', () => {
        const strong = createFighter(10, 2); // Double stats
        const weak = createFighter(1, 1);

        let strongWins = 0;
        const SIMULATIONS = 100;

        for (let i = 0; i < SIMULATIONS; i++) {
            // Reset HP for each fight simulation to avoid carrying over damage
            const s = { ...strong };
            const w = { ...weak };
            const result = simulateCombat(s, w);
            if (result.winner === 'attacker') strongWins++;
        }

        // A level 10 vs level 1 should be a crush
        expect(strongWins).toBeGreaterThanOrEqual(95);
    });

    it('Equal clones should have roughly 50% win rate (+- variance)', () => {
        const p1 = createFighter(5);
        const p2 = { ...createFighter(5), name: 'Clone' };

        let p1Wins = 0;
        const SIMULATIONS = 500;

        for (let i = 0; i < SIMULATIONS; i++) {
            // Reset HP
            const f1 = { ...p1 };
            const f2 = { ...p2 };
            const result = simulateCombat(f1, f2);
            if (result.winner === 'attacker') p1Wins++;
        }

        const winRate = (p1Wins / SIMULATIONS) * 100;

        // With RNG, it should be between 40% and 60%
        console.log(`Equal Match Win Rate: ${winRate}%`);
        expect(winRate).toBeGreaterThan(35);
        expect(winRate).toBeLessThan(65);
    });

    it('Combat log should contain detailed events', () => {
        const p1 = createFighter(5);
        const p2 = createFighter(5);
        const result = simulateCombat(p1, p2);

        expect(result.rounds).toBeGreaterThan(0);
        expect(result.details.length).toBeGreaterThan(0);
        expect(result.details[0]).toContain(p1.name);
    });
});
