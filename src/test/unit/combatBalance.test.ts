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

  it('should have offenseWeight set to 1.45', () => {
    expect(COMBAT_BALANCE.damage.offenseWeight).toBe(1.45);
  });

  it('should have comeback.damageMultiplier set to 1.03', () => {
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBe(1.03);
  });

  it('should have hitChance.max set to 88', () => {
    expect(COMBAT_BALANCE.hitChance.max).toBe(88);
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

    // With offenseWeight=1.45, the first hit should be measurable
    // and lower than what it would be with offenseWeight=1.52
    expect(damages.length).toBeGreaterThan(0);

    // Calculate expected damage with the new offenseWeight
    // scaleStat(20): 10 + (20-10)^0.85 = 10 + 10^0.85 = 10 + 7.079 = 17.079
    // scaleStat(15): 10 + (15-10)^0.85 = 10 + 5^0.85 = 10 + 3.927 = 13.927
    // level 5: levelMultiplier = 1 + min(0.22, 4*0.012) = 1 + 0.048 = 1.048
    // offense = 17.079 * 1.85 * 1.048 = 33.113
    // defense = 13.927 * 2.0 * 1.048 = 29.192
    // baseDamage = 33.113 * 1.45 - 29.192 * 0.42 = 48.014 - 12.261 = 35.753
    // With variance at 0.5: varianceRange = 0.2 - min(0.08, 10*0.002) = 0.2 - 0.02 = 0.18
    // varianceFactor = (1 - 0.09) + 0.5*0.18 = 0.91 + 0.09 = 1.0
    // No comeback (HP > 35%), no focus surge, no affinity
    // damage = max(6, round(35.753 * 1.0)) = 36
    expect(damages[0]).toBe(36);
  });

  // ── Behavioral Impact: Comeback ────────────────────────────────────────

  it('should apply lower comeback damage multiplier (1.03)', () => {
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

    // The damage should reflect the 1.03 comeback multiplier
    const match = hitLines[0].match(/hit[!]?\s+(\d+)\s+DMG/);
    expect(match).not.toBeNull();
    const damage = parseInt(match![1], 10);

    // With comeback active (hp < 35%):
    // level 5: levelMultiplier = 1.048
    // offense = 15 * 1.85 * 1.048 ≈ 29.082
    // baseDamage = 29.082 * 1.45 * 1 - (20*2.0*1.048) * 0.42
    // defense = 20 * 2.0 * 1.048 = 41.92
    // baseDamage = 42.169 - 17.606 ≈ 24.563
    // comebackMultiplier = 1.03 (new value)
    // varianceFactor at 0.5 = 1.0 (same as above)
    // damage = max(6, round(24.563 * 1.0 * 1.03)) = max(6, round(25.3)) = 25
    expect(damage).toBe(25);
  });

  // ── Behavioral Impact: Hit Chance Cap ──────────────────────────────────

  it('should cap hit chance so rng=0.87 hits but rng=0.89 misses', () => {
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

    // rng=0.87 (87% < 88% max) → should hit
    const hitSeq: number[] = [
      0.4,  // initiative (attacker first)
      0.87, // hit chance (87% < 88% → hit)
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

  it('should cap hit chance so rng=0.89 misses', () => {
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

    // rng=0.89 (89% > 88% max) → should miss
    const missSeq: number[] = [
      0.4,  // initiative (attacker first)
      0.89, // hit chance (89% > 88% → miss)
      // attacker missed → defender turn
      0.5,  // initiative is not used (already determined)
      0.89, // defender hit chance
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

  it('should have lower offenseWeight than previous value (1.52)', () => {
    expect(COMBAT_BALANCE.damage.offenseWeight).toBeLessThan(1.52);
  });

  it('should have lower comeback damageMultiplier than previous value (1.06)', () => {
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBeLessThan(1.06);
  });

  it('should have lower hitChance.max than previous value (92)', () => {
    expect(COMBAT_BALANCE.hitChance.max).toBeLessThan(92);
  });
});
