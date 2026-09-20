import { describe, it, expect } from 'vitest';
import { generateMonsterForPlayer, generateMonster } from '../../utils/monsterUtils';
import { simulateCombat } from '../../utils/combatUtils';
import { IDLE_CONFIG } from '../../config/idleConfig';
import type { Character } from '../../types/Character';

function intBuild(level: number): Character {
  const g = (b: number, r: number): number => Math.round(b + (level - 1) * r);
  return {
    id: 'curve', name: 'Curve', seed: 'curve', gender: 'male', level, experience: 0,
    hp: 100 + level * 14, maxHp: 100 + level * 14,
    strength: g(8, 0.25), vitality: g(8, 0.3), dexterity: g(8, 0.4),
    luck: g(8, 0.25), intelligence: g(10, 1.2), focus: g(8, 0.45),
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: 0,
    inventory: [], equippedItems: { weapon: null, armor: null, accessory: null }, itemUpgrades: {},
  } as unknown as Character;
}

describe('elite defeat curve', () => {
  it('pins the elite tuning constants', () => {
    expect(IDLE_CONFIG.ELITE.MIN_LEVEL).toBe(15);
    expect(IDLE_CONFIG.ELITE.LEVEL_BOOST).toBe(8);
    expect(IDLE_CONFIG.ELITE.ESSENCE_MULT).toBe(2);
    expect(IDLE_CONFIG.PACK.MIN_LEVEL).toBe(8);
    expect(IDLE_CONFIG.PACK.MAX_SIZE).toBe(3);
  });

  it('elites threaten average builds without being impossible (paired)', () => {
    const level = 20;
    const N = 400;
    let normalWins = 0;
    let eliteWins = 0;
    for (let i = 0; i < N; i++) {
      const rolled = generateMonsterForPlayer(level, 'plains');
      const elite = generateMonster(rolled.def.id, level + IDLE_CONFIG.ELITE.LEVEL_BOOST - 4);
      if (simulateCombat({ ...intBuild(level) }, rolled.character).winner === 'attacker') normalWins++;
      if (simulateCombat({ ...intBuild(level) }, elite).winner === 'attacker') eliteWins++;
    }
    const normalRate = normalWins / N;
    const eliteRate = eliteWins / N;
    // elites strictly harder with margin, yet beatable
    expect(normalRate - eliteRate).toBeGreaterThan(0.05);
    expect(eliteRate).toBeGreaterThan(0.02);
  });
});
