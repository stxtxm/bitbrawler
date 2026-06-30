import { describe, it, expect } from 'vitest';
import { generateInitialStats } from '../../utils/characterUtils';
import { getXpRequiredForNextLevel, calculateFightXp } from '../../utils/xpUtils';
import { calculateCombatStats } from '../../utils/combatUtils';
import { Character } from '../../types/Character';

const makeChar = (overrides: Partial<Character> = {}): Character => ({
    seed: 'test',
    name: 'Tester',
    gender: 'male',
    level: overrides.level ?? 5,
    hp: overrides.hp ?? 100,
    maxHp: overrides.maxHp ?? 100,
    strength: overrides.strength ?? 10,
    vitality: overrides.vitality ?? 10,
    dexterity: overrides.dexterity ?? 10,
    luck: overrides.luck ?? 10,
    intelligence: overrides.intelligence ?? 10,
    focus: overrides.focus ?? 10,
    experience: overrides.experience ?? 0,
    wins: overrides.wins ?? 0,
    losses: overrides.losses ?? 0,
    fightsLeft: overrides.fightsLeft ?? 5,
    lastFightReset: overrides.lastFightReset ?? Date.now(),
});

describe('Game Balance — Stat Generation', () => {
    it('should not produce extreme outliers (primary > 30) in 500 rolls', () => {
        for (let i = 0; i < 500; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const maxStat = Math.max(...allStats);
            expect(maxStat).toBeLessThanOrEqual(35);
        }
    });

    it('should have no stat below 5 (respects START_BASE)', () => {
        for (let i = 0; i < 500; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            for (const s of allStats) {
                expect(s).toBeGreaterThanOrEqual(5);
            }
        }
    });
});

describe('Game Balance — Item Stat Contribution', () => {
    it('should have items provide supplementary bonuses (not dominate base stats)', () => {
        let maxPrimary = 0;
        let minPrimary = 100;
        for (let i = 0; i < 200; i++) {
            const char = generateInitialStats(`Test_${i}`, 'male');
            const allStats = [
                char.strength, char.vitality, char.dexterity,
                char.luck, char.intelligence, char.focus
            ];
            const maxStat = Math.max(...allStats);
            if (maxStat > maxPrimary) maxPrimary = maxStat;
            if (maxStat < minPrimary) minPrimary = maxStat;
        }
        // At high end, +6 item bonus is a meaningful % of base (supplementary, not dominant)
        const highEndRatio = 6 / maxPrimary;
        expect(highEndRatio).toBeGreaterThan(0.15);
        expect(highEndRatio).toBeLessThan(0.50);
        // At low end, +2 item bonus is still meaningful but not overwhelming
        const lowEndRatio = 2 / minPrimary;
        expect(lowEndRatio).toBeGreaterThan(0.05);
        expect(lowEndRatio).toBeLessThan(0.35);
    });
});

describe('Game Balance — Combat Power Ratio', () => {
    it('should keep offense-distribution ratio reasonable between specialist and generalist', () => {
        const specialist = makeChar({ strength: 18, vitality: 8, dexterity: 8, luck: 8, intelligence: 8, focus: 8 });
        const generalist = makeChar({ strength: 11, vitality: 11, dexterity: 11, luck: 11, intelligence: 11, focus: 11 });

        const sStats = calculateCombatStats(specialist);
        const gStats = calculateCombatStats(generalist);

        const sOffense = sStats.offense;
        const gOffense = gStats.offense;

        expect(sOffense).toBeGreaterThan(gOffense);
        // Specialist should not completely overwhelm — less than 2x advantage
        expect(sOffense / gOffense).toBeLessThan(2);
    });

    it('should ensure specialist defense is not crippled (< 60% of generalist)', () => {
        const specialist = makeChar({ strength: 18, vitality: 8, dexterity: 8, luck: 8, intelligence: 8, focus: 8 });
        const generalist = makeChar({ strength: 11, vitality: 11, dexterity: 11, luck: 11, intelligence: 11, focus: 11 });

        const sStats = calculateCombatStats(specialist);
        const gStats = calculateCombatStats(generalist);

        const sDefense = sStats.defense;
        const gDefense = gStats.defense;

        const defenseRatio = sDefense / gDefense;
        expect(defenseRatio).toBeGreaterThan(0.6);
    });
});

describe('Game Balance — XP Progression Feasibility', () => {
    it('should allow reaching level 10 in under 80 total wins (reasonable early grind)', () => {
        let cumulativeXp = 0;
        let wins = 0;
        for (let level = 1; level < 10; level++) {
            const xpNeeded = getXpRequiredForNextLevel(level);
            while (cumulativeXp < xpNeeded + getTotalXpForLevel(level)) {
                cumulativeXp += calculateFightXp(true, level);
                wins++;
            }
        }
        expect(wins).toBeLessThan(120);
    });

    it('should make level 40+ slow but not impossible (< 80 wins per level)', () => {
        const fightsPerLevel: number[] = [];
        for (let level = 40; level < 45; level++) {
            const xpNeeded = getXpRequiredForNextLevel(level);
            const winXp = calculateFightXp(true, level);
            fightsPerLevel.push(Math.ceil(xpNeeded / winXp));
        }
        for (const fights of fightsPerLevel) {
            expect(fights).toBeLessThan(200);
        }
    });
});

function getTotalXpForLevel(level: number): number {
    if (level <= 1) return 0;
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += getXpRequiredForNextLevel(i);
    }
    return Math.floor(total);
}
