import { describe, it, expect, vi } from 'vitest';
import { COMBAT_BALANCE } from '../../config/combatBalance';
import { simulateCombat } from '../../utils/combatUtils';
import { Character } from '../../types/Character';

describe('Combat Balance Config', () => {
  const baseCharacter: Character = {
    name: 'Test',
    gender: 'male',
    seed: 'test',
    level: 5,
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
    lastFightReset: Date.now(),
  };

  // ── Value Assertions ───────────────────────────────────────────────────

  it('should have offenseWeight set to 1.2', () => {
    expect(COMBAT_BALANCE.damage.offenseWeight).toBe(1.2);
  });

  it('should have defenseWeight set to 0.35', () => {
    expect(COMBAT_BALANCE.damage.defenseWeight).toBe(0.35);
  });

  it('should have critMultiplier set to 1.30', () => {
    expect(COMBAT_BALANCE.damage.critMultiplier).toBe(1.30);
  });

  it('should have hitChance.base set to 78', () => {
    expect(COMBAT_BALANCE.hitChance.base).toBe(78);
  });

  it('should have comeback.damageMultiplier set to 1.10', () => {
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBe(1.10);
  });

  it('should have hitChance.max set to 96', () => {
    expect(COMBAT_BALANCE.hitChance.max).toBe(96);
  });

  it('should have diminishingExponent set to 0.85', () => {
    expect(COMBAT_BALANCE.diminishingExponent).toBe(0.85);
  });

  // ── Behavioral Impact: Damage Output ───────────────────────────────────

  it('should deal reduced damage with lower offenseWeight', () => {
    const attacker = { ...baseCharacter, name: 'Strong', strength: 20 };
    const defender = { ...baseCharacter, name: 'Tough', vitality: 15, hp: 500, maxHp: 500 };

    // Deterministic: attacker wins initiative, always hits, no crit, no magic, no focus surge
    const seq: number[] = [
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

    const result = simulateCombat(attacker as Character, defender as Character);
    const attackerHits = result.details.filter(
      (d) => d.includes('hit') && d.includes('DMG') && !d.includes('counter')
    );

    // Extract the damage numbers from hit lines
    const damages = attackerHits.map((line) => {
      const match = line.match(/hit[!]?\s+(\d+)\s+DMG/);
      return match ? parseInt(match[1], 10) : 0;
    });

    // With offenseWeight=1.2, the first hit should be measurable
    expect(damages.length).toBeGreaterThan(0);

    // Calculate expected damage with the updated balance parameters
    // scaleStat(20): 10 + (20-10)^0.85 = 10 + 10^0.85 = 10 + 7.079 = 17.079
    // scaleStat(15): 10 + (15-10)^0.85 = 10 + 5^0.85 = 10 + 3.928 = 13.928
    // level 5: levelMultiplier = 1 + min(0.22, 4*0.012) = 1 + 0.048 = 1.048
    // offense = 17.079 * 1.85 * 1.048 = 33.113
    // defense = 13.928 * 2.0 * 1.048 = 29.193
    // baseDamage = 33.113 * 1.2 - 29.193 * 0.35 = 39.736 - 10.218 = 29.518
    // With variance at 0.5: varianceRange = 0.2 - min(0.08, 10*0.002) = 0.2 - 0.02 = 0.18
    // varianceFactor = (1 - 0.09) + 0.5*0.18 = 0.91 + 0.09 = 1.0
    // No comeback (HP > 35%), no focus surge, no affinity
    // damage = max(20, round(29.518 * 1.0)) = 30
    expect(damages[0]).toBe(30);
  });

  // ── Behavioral Impact: Comeback ────────────────────────────────────────

  it('should apply lowered comeback damage multiplier (1.10)', () => {
    // Attacker starts very low HP to trigger comeback
    const attacker = {
      ...baseCharacter,
      name: 'Underdog',
      strength: 15,
      vitality: 5,
      hp: 10,
      maxHp: 100,
    };
    const defender = {
      ...baseCharacter,
      name: 'Topdog',
      strength: 5,
      vitality: 20,
      hp: 200,
      maxHp: 200,
    };

    // Deterministic: attacker wins initiative, hits, no crit, no magic, no focus surge
    const seq: number[] = [
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

    const result = simulateCombat(attacker as Character, defender as Character);

    // Find underdog's hit (attacker's non-counter hit)
    const hitLines = result.details.filter(
      (d) => d.includes('Underdog') && d.includes('hit') && d.includes('DMG') && !d.includes('counter')
    );

    expect(hitLines.length).toBeGreaterThan(0);

    // The damage should reflect the 1.01 comeback multiplier
    const match = hitLines[0].match(/hit[!]?\s+(\d+)\s+DMG/);
    expect(match).not.toBeNull();
    const damage = parseInt(match![1], 10);

    // With comeback active (hp < 35%) and diminished returns exponent 0.85:
    // level 5: levelMultiplier = 1.048
    // scaleStat(15) = 10 + 5^0.85 = 13.928
    // offense = 13.928 * 1.85 * 1.048 ≈ 27.004
    // scaleStat(20) = 10 + 10^0.85 = 17.079
    // defense = 17.079 * 2.0 * 1.048 = 35.798
    // baseDamage = 27.004 * 1.2 - 35.798 * 0.35 = 32.405 - 12.529 = 19.876
    // comebackMultiplier = 1.10
    // varianceFactor at 0.5 = 1.0 (same as above)
    // damage = max(20, round(19.876 * 1.0 * 1.10)) = max(20, round(21.864)) = 22
    expect(damage).toBe(22);
  });

  // ── Behavioral Impact: Hit Chance Cap ──────────────────────────────────

  it('should cap hit chance so rng=0.95 hits but rng=0.97 misses', () => {
    // Attacker with massive speed and focus advantage to push hit chance high
    const attacker = {
      ...baseCharacter,
      name: 'Speedy',
      dexterity: 50,
      focus: 50,
      strength: 5,
      hp: 100,
      maxHp: 100,
    };
    const defender = {
      ...baseCharacter,
      name: 'Sluggish',
      dexterity: 1,
      focus: 1,
      vitality: 1,
      strength: 1,
      hp: 5000,
      maxHp: 5000,
    };

    // rng=0.95 (95% < 96% max) → should hit
    const hitSeq: number[] = [
      0.4,  // initiative (attacker first)
      0.95, // hit chance (95% < 96% → hit)
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => hitSeq.shift() ?? 0.99);

    const hitResult = simulateCombat(attacker as Character, defender as Character);
    const firstHitDetail = hitResult.details[1]; // first action after "vs"
    expect(firstHitDetail).toContain('hit');
  });

  it('should cap hit chance so rng=0.97 misses', () => {
    const attacker = {
      ...baseCharacter,
      name: 'Speedy',
      dexterity: 50,
      focus: 50,
      strength: 1,
      hp: 400,
      maxHp: 400,
    };
    const defender = {
      ...baseCharacter,
      name: 'Sluggish',
      dexterity: 1,
      focus: 1,
      vitality: 1,
      strength: 1,
      hp: 20,
      maxHp: 20,
    };

    // rng=0.97 (97% > 96% max) → should miss
    const missSeq: number[] = [
      0.4,  // initiative (attacker first)
      0.97, // hit chance (97% > 96% → miss)
      // attacker missed → defender turn
      0.5,  // initiative is not used (already determined)
      0.97, // defender hit chance
      0.99, // no crit
      0.99, // no magic
      0.5,  // variance
      0.99, // no focus surge
    ];
    vi.spyOn(Math, 'random').mockImplementation(() => missSeq.shift() ?? 0.99);

    const missResult = simulateCombat(attacker as Character, defender as Character);
    const firstActionDetail = missResult.details[1]; // first action after "vs"
    expect(firstActionDetail).toContain('missed');
  });

  it('should have offenseWeight within safe range (< 3.0)', () => {
    expect(COMBAT_BALANCE.damage.offenseWeight).toBeLessThan(3.0);
  });

  it('should have defenseWeight lower than extreme maximum (0.50)', () => {
    expect(COMBAT_BALANCE.damage.defenseWeight).toBeLessThan(0.50);
  });

  it('should have lower critMultiplier than extreme maximum (1.45)', () => {
    expect(COMBAT_BALANCE.damage.critMultiplier).toBeLessThan(1.45);
  });

  it('should have hitChance.base within safe range (< 82)', () => {
    expect(COMBAT_BALANCE.hitChance.base).toBeLessThan(82);
  });

  it('should have comeback damageMultiplier between 1.0 and 1.40', () => {
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBeGreaterThanOrEqual(1.0);
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBeLessThan(1.40);
  });

  it('should have diminishingExponent reverted back to pre-June value (0.85)', () => {
    expect(COMBAT_BALANCE.diminishingExponent).toBe(0.85);
  });

  it('should have hitChance.max within safe range (< 99)', () => {
    expect(COMBAT_BALANCE.hitChance.max).toBeLessThan(99);
  });

  // ── Max Duration ────────────────────────────────────────────────────────

  it('should have maxDurationMs set to 25000', () => {
    expect(COMBAT_BALANCE.maxDurationMs).toBe(25000);
  });

  // ── Hard Timeout ────────────────────────────────────────────────────────

  it('should have fightHardTimeoutMs set to 45000', () => {
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBe(45000);
  });
});
