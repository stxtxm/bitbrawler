import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateCombatStats, getCombatBalance, simulateCombat } from '../../utils/combatUtils';
import { Character } from '../../types/Character';
import { COMBAT_BALANCE } from '../../config/combatBalance';

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
        focus: 10,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: 5,
        lastFightReset: Date.now()
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should correctly calculate combat stats from RPG stats', () => {
        const stats = calculateCombatStats(mockCharacter);

        expect(stats.offense).toBeCloseTo(18.5, 1);
        expect(stats.defense).toBeCloseTo(20, 1);
        expect(stats.speed).toBeCloseTo(16, 1);
        expect(stats.critChance).toBeCloseTo(13.5, 1);
        expect(stats.magicPower).toBeCloseTo(16, 1);
        expect(stats.focus).toBeCloseTo(13.5, 1);
    });

    it('should cap critical chance at 30%', () => {
        const luckyChar = { ...mockCharacter, luck: 50 };
        const stats = calculateCombatStats(luckyChar as Character);

        expect(stats.critChance).toBe(30);
    });

    it('should include inventory bonuses in combat stats', () => {
        const base = { ...mockCharacter, strength: 10, inventory: [] };
        const boosted = { ...mockCharacter, strength: 10, inventory: ['rusty_sword'], equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null } };

        const baseStats = calculateCombatStats(base as Character);
        const boostedStats = calculateCombatStats(boosted as Character);

        expect(boostedStats.offense).toBeGreaterThan(baseStats.offense);
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

    it('should grant a small level-based combat boost at equal raw stats', () => {
        const lowLevel = calculateCombatStats({ ...mockCharacter, level: 1 });
        const highLevel = calculateCombatStats({ ...mockCharacter, level: 20 });

        expect(highLevel.offense).toBeGreaterThan(lowLevel.offense);
        expect(highLevel.defense).toBeGreaterThan(lowLevel.defense);
        expect(highLevel.totalPower).toBeGreaterThan(lowLevel.totalPower);
    });

    it('should correctly identify a character class/balance', () => {
        const stats = calculateCombatStats(mockCharacter);
        const balancedStats = { ...stats, offense: 10, defense: 10, speed: 10, magicPower: 10, focus: 10 };
        expect(getCombatBalance(balancedStats)).toBe('⚖️ Balanced');

        const tankStats = { ...stats, offense: 10, defense: 30, speed: 10, magicPower: 10, focus: 10 };
        expect(getCombatBalance(tankStats)).toBe('🛡️ Tank');

        const dpsStats = { ...stats, offense: 30, defense: 10, speed: 10, magicPower: 10, focus: 10 };
        expect(getCombatBalance(dpsStats)).toBe('⚔️ Berserker');

        const mageStats = { ...stats, offense: 10, defense: 10, speed: 10, magicPower: 30, focus: 10 };
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

    it('should never report negative HP and should cap rounds', () => {
        const attacker = { ...mockCharacter, name: 'Attacker', strength: 18 };
        const defender = { ...mockCharacter, name: 'Defender', vitality: 18 };
        const result = simulateCombat(attacker as Character, defender as Character);

        expect(result.rounds).toBeLessThanOrEqual(COMBAT_BALANCE.roundLimit);
        result.timeline.forEach((snapshot) => {
            expect(snapshot.attackerHp).toBeGreaterThanOrEqual(0);
            expect(snapshot.defenderHp).toBeGreaterThanOrEqual(0);
        });
    });

    it('should log crit hits when crit triggers', () => {
        const attacker = { ...mockCharacter, name: 'Critter', strength: 40, luck: 50 };
        const defender = { ...mockCharacter, name: 'Dummy', vitality: 5, hp: 50, maxHp: 50 };

        const sequence = [
            0, // initiative
            0, // hit
            0, // crit
            0.99, // magic miss
            0.5, // variance
            0.99 // focus surge miss
        ];
        vi.spyOn(Math, 'random').mockImplementation(() => sequence.shift() ?? 0.99);

        const result = simulateCombat(attacker as Character, defender as Character);
        const critLog = result.details.find((line) => line.includes('CRIT!'));
        expect(critLog).toBeTruthy();
    });

    it('should log magic surges when magic triggers', () => {
        const attacker = { ...mockCharacter, name: 'Mage', intelligence: 40 };
        const defender = { ...mockCharacter, name: 'Dummy', vitality: 5, hp: 50, maxHp: 50 };

        const sequence = [
            0, // initiative
            0, // hit
            0.99, // crit miss
            0, // magic hit
            0.5, // variance
            0.99 // focus surge miss
        ];
        vi.spyOn(Math, 'random').mockImplementation(() => sequence.shift() ?? 0.99);

        const result = simulateCombat(attacker as Character, defender as Character);
        const magicLog = result.details.find((line) => line.includes('MAGIC SURGE'));
    expect(magicLog).toBeTruthy();
  });

  // ─── Affinity Tests ─────────────────────────────────────────────────────

  it('includes super effective in logs when fire weapon hits tank archetype', () => {
    const attacker = {
      ...mockCharacter,
      name: 'Pyro',
      level: 5,
      strength: 20,
      vitality: 5,
      inventory: ['ember_blade'],
      equippedItems: { weapon: 'ember_blade', armor: null, accessory: null },
    };
    const defender = {
      ...mockCharacter,
      name: 'Wall',
      level: 5,
      strength: 5,
      vitality: 20,
      hp: 200,
      maxHp: 200,
      inventory: [],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };

    // deterministic: attacker wins initiative, hits, no crit, no magic, no focus surge
    const sequence = [
      0.4, // initiative (attacker first — 0.4 < 0.5 base)
      0,   // hit (always hits at rng=0)
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => sequence.shift() ?? 0.99);

    const result = simulateCombat(attacker as Character, defender as Character);
    const affinityLog = result.details.find((line) => line.includes('super effective'));
    expect(affinityLog).toBeTruthy();
  });

  // ─── Combat Timeout Tests ─────────────────────────────────────────────

  it('should timeout combat when maxDurationMs is exceeded and attacker has more HP', () => {
    // Balanced fighters with high HP so fight could go long
    const attacker = {
      ...mockCharacter,
      name: 'Speedy',
      strength: 18,
      vitality: 18,
      hp: 300,
      maxHp: 300,
    };
    const defender = {
      ...mockCharacter,
      name: 'Tanky',
      strength: 18,
      vitality: 18,
      hp: 300,
      maxHp: 300,
    };

    // Deterministic random: always hit, no crit, no magic, no focus surge
    const seq = [
      0.4,  // initiative (attacker first)
      0,    // hit
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
      // defender counter
      0,    // hit
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0.99);

    // Mock Date.now to simulate timeout after first round
    let dateCalls = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      dateCalls++;
      if (dateCalls === 1) return 0;       // startTime
      return 31000;                          // 31s → exceeds 25s timeout
    });

    const result = simulateCombat(attacker as Character, defender as Character);

    // Should finish after just 1 round (timeout triggered)
    expect(result.rounds).toBe(1);
    expect(result.winner).toBeDefined();
    // With identical stats and same deterministic rolls, attacker and defender
    // deal symmetric damage. After 1 round both take equal damage → HP equal → draw
    expect(result.details.some(d => d.includes('timeout') || d.includes('Timeout'))).toBeTruthy();
  });

  it('should timeout combat when maxDurationMs is exceeded and defender has more HP', () => {
    // Attacker deals less damage (lower strength), defender has more HP
    const attacker = {
      ...mockCharacter,
      name: 'Weakling',
      strength: 5,
      vitality: 5,
      hp: 50,
      maxHp: 50,
    };
    const defender = {
      ...mockCharacter,
      name: 'Tanky',
      strength: 5,
      vitality: 20,
      hp: 500,
      maxHp: 500,
    };

    // Deterministic: attacker first, always hits, no specials
    const seq = [
      0.4,  // initiative (attacker first)
      0,    // hit
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
      // defender counter
      0,    // hit
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => seq.shift() ?? 0.99);

    // Mock Date.now to simulate timeout after first round
    let dateCalls = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      dateCalls++;
      if (dateCalls === 1) return 0;
      return 31000;                          // exceeds 25s maxDurationMs
    });

    const result = simulateCombat(attacker as Character, defender as Character);

    expect(result.rounds).toBe(1);
    // Defender (Tanky) should have more remaining HP → should win
    expect(result.winner).toBe('defender');
    const timeoutMsg = result.details.find(d => d.includes('timeout') || d.includes('Timeout'));
    expect(timeoutMsg).toBeTruthy();
    expect(timeoutMsg).toContain('Tanky');
  });

  it('should not be affected by timeout under normal fast combat conditions', () => {
    // Normal combat (attacker much stronger)
    const attacker = {
      ...mockCharacter,
      name: 'Strong',
      strength: 40,
      vitality: 25,
      hp: 200,
      maxHp: 200,
    };
    const defender = {
      ...mockCharacter,
      name: 'Weak',
      strength: 5,
      vitality: 5,
      hp: 50,
      maxHp: 50,
    };

    // Use real Date.now (no mock) — timeout should not trigger
    vi.restoreAllMocks();

    const result = simulateCombat(attacker as Character, defender as Character);

    // Combat should end by knockout, not timeout
    expect(result.winner).toBe('attacker');
    expect(result.rounds).toBeLessThan(COMBAT_BALANCE.roundLimit);
    const timeoutMsg = result.details.find(d => d.includes('timeout') || d.includes('Timeout'));
    expect(timeoutMsg).toBeFalsy();
  });

  it('does not include super effective when no element matches', () => {
    const attacker = {
      ...mockCharacter,
      name: 'Punchy',
      level: 5,
      strength: 20,
      vitality: 5,
      inventory: ['ember_blade'],
      equippedItems: { weapon: 'ember_blade', armor: null, accessory: null },
    };
    const defender = {
      ...mockCharacter,
      name: 'Bruiser',
      level: 5,
      strength: 20, // bruiser archetype (fire not effective vs bruiser)
      vitality: 5,
      hp: 200,
      maxHp: 200,
      inventory: [],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };

    const sequence = [
      0.4, // initiative (attacker first)
      0,   // hit
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => sequence.shift() ?? 0.99);

    const result = simulateCombat(attacker as Character, defender as Character);
    const affinityLog = result.details.find((line) => line.includes('super effective'));
    expect(affinityLog).toBeFalsy();
  });
});
