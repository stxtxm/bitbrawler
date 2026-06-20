import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Character } from '../../types/Character';
import { IDLE_CONFIG } from '../../config/idleConfig';
import {
    computeEfficiency,
    computeDisplayData,
    calculateOfflineFightsWithEfficiency,
} from '../../utils/idleEfficiencyUtils';
import { calculateCombatStats, CombatStats } from '../../utils/combatUtils';
import { generateMonsterForPlayer } from '../../utils/monsterUtils';
import { normalizeCharacter } from '../../utils/persistenceUtils';

vi.mock('../../hooks/useOnlineStatus', () => ({
    useOnlineStatus: () => true,
}));

function baseCharacter(overrides: Partial<Character> = {}): Character {
    return {
        name: 'Test',
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
        focus: 10,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        pveFightsLeft: 5,
        lastFightReset: Date.now(),
        id: 'test-id',
        statPoints: 0,
        inventory: [],
        lastLootRoll: 0,
        ...overrides,
    };
}

function makeStats(totalPower: number): CombatStats {
    return { totalPower, offense: 10, defense: 10, speed: 10, critChance: 0.1, magicPower: 10, focus: 10 };
}

beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
        },
        writable: true,
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('Idle Efficiency Integration', () => {
    describe('Efficiency with real combat stats', () => {
        it('higher stats should produce higher efficiency', () => {
            const weakPlayer = makeStats(50);
            const monster = makeStats(100);
            const strongPlayer = makeStats(250);

            const weakEff = computeEfficiency(weakPlayer, monster, 10);
            const strongEff = computeEfficiency(strongPlayer, monster, 10);

            expect(strongEff.efficiency).toBeGreaterThan(weakEff.efficiency);
            expect(strongEff.effectiveInterval).toBeLessThan(weakEff.effectiveInterval);
        });

        it('high dexterity should boost efficiency', () => {
            const player = makeStats(100);
            const monster = makeStats(100);

            const lowDex = computeEfficiency(player, monster, 10);
            const highDex = computeEfficiency(player, monster, 50);

            expect(highDex.efficiency).toBeGreaterThan(lowDex.efficiency);
        });

        it('effective interval should never drop below MIN_INTERVAL', () => {
            const player = makeStats(5000);
            const monster = makeStats(50);

            const eff = computeEfficiency(player, monster, 99);
            expect(eff.effectiveInterval).toBeGreaterThanOrEqual(IDLE_CONFIG.EFFICIENCY.MIN_INTERVAL);
        });
    });

    describe('Offline gains with efficiency', () => {
        it('should calculate offline fights using effective interval', () => {
            const char = baseCharacter({ level: 10, dexterity: 20, strength: 20 });
            const monster = generateMonsterForPlayer(char.level);
            const playerStats = calculateCombatStats(char);
            const monsterStats = calculateCombatStats(monster.character);
            const eff = computeEfficiency(playerStats, monsterStats, char.dexterity);

            const now = Date.now();
            const elapsed = 120000; // 2 min
            const fights = calculateOfflineFightsWithEfficiency(now - elapsed, now, eff.effectiveInterval);
            expect(fights).toBeGreaterThan(0);
        });

        it('should cap offline fights at MAX_IDLE_FIGHTS for very long absence', () => {
            const farPast = Date.now() - IDLE_CONFIG.MAX_OFFLINE_HOURS * 60 * 60 * 1000 * 2;
            const fights = calculateOfflineFightsWithEfficiency(farPast, Date.now(), 1000);
            expect(fights).toBeLessThanOrEqual(IDLE_CONFIG.MAX_IDLE_FIGHTS);
        });
    });

    describe('Display data integration', () => {
        it('should calculate XP per minute from interval', () => {
            const data = computeDisplayData(6000, 100, 0, 0);
            // 60000ms/min / 6000ms = 10 fights/min * 100 XP = 1000
            expect(data.xpPerMinute).toBe(1000);
        });

        it('should calculate streak bonus for active streak', () => {
            const data = computeDisplayData(10000, 100, 10, 50);
            expect(data.streakBonus).toBeGreaterThan(0);
            expect(data.totalKills).toBe(50);
            expect(data.currentStreak).toBe(10);
        });
    });

    describe('Character idle field normalization', () => {
        it('should normalize and preserve idle fields', () => {
            const char = baseCharacter({
                idleStreak: 5,
                idleMaxStreak: 10,
                idleTotalKills: 25,
                idleTotalXp: 1500,
            });

            const result = normalizeCharacter(char);

            expect(result.idleStreak).toBe(5);
            expect(result.idleMaxStreak).toBe(10);
            expect(result.idleTotalKills).toBe(25);
            expect(result.idleTotalXp).toBe(1500);
        });

        it('should default idle fields to 0 when missing', () => {
            const minimal = { ...baseCharacter() } as any;
            delete minimal.idleStreak;
            delete minimal.idleMaxStreak;
            delete minimal.idleTotalKills;
            delete minimal.idleTotalXp;

            const result = normalizeCharacter(minimal);
            expect(result.idleStreak).toBe(0);
            expect(result.idleMaxStreak).toBe(0);
            expect(result.idleTotalKills).toBe(0);
            expect(result.idleTotalXp).toBe(0);
        });
    });
});
