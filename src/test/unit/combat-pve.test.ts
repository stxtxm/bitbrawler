import { describe, it, expect } from 'vitest';
import { simulateCombat } from '../../utils/combatUtils';
import { generateMonster } from '../../utils/monsterUtils';
import { calculateFightXp } from '../../utils/xpUtils';
import { GAME_RULES } from '../../config/gameRules';

const makePlayer = (overrides: Record<string, any> = {}) => ({
  seed: 'player-test',
  name: 'Test Player',
  gender: 'male' as const,
  level: overrides.level ?? 5,
  experience: 0,
  strength: overrides.strength ?? 10,
  vitality: overrides.vitality ?? 10,
  dexterity: overrides.dexterity ?? 10,
  luck: overrides.luck ?? 10,
  intelligence: overrides.intelligence ?? 10,
  focus: overrides.focus ?? 10,
  hp: overrides.hp ?? 100,
  maxHp: overrides.maxHp ?? 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  equippedItems: { weapon: 'rusty_sword' as string | null, armor: null, accessory: null },
});

describe('PvE combat', () => {
  it('simulateCombat works with generated monster', () => {
    const player = makePlayer();
    const monster = generateMonster('goblin', player.level);
    const result = simulateCombat(player, monster);
    expect(result.winner).toBeDefined();
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(50);
  });

  it('monster can win against a weak player', () => {
    const weakPlayer = makePlayer({ strength: 3, vitality: 3, hp: 20, maxHp: 20 });
    const monster = generateMonster('ogre', 1);
    const result = simulateCombat(weakPlayer, monster);
    // ogre at level 1 should beat a very weak player
    expect(result.winner).toBe('defender');
  });

  it('player can win against a monster', () => {
    const strongPlayer = makePlayer({ strength: 15, vitality: 15, dexterity: 15, hp: 200, maxHp: 200 });
    const monster = generateMonster('goblin', 1);
    const result = simulateCombat(strongPlayer, monster);
    expect(result.winner).toBe('attacker');
  });

  it('combat logs contain monster name', () => {
    const player = makePlayer();
    const monster = generateMonster('wraith', player.level);
    const result = simulateCombat(player, monster);
    const allLogs = result.details.join(' ');
    expect(allLogs).toContain(monster.name);
  });

  it('monster without equipment does not break combat', () => {
    const player = makePlayer();
    const monster = generateMonster('ogre', player.level);
    expect(monster.equippedItems).toEqual({ weapon: null, armor: null, accessory: null });
    const result = simulateCombat(player, monster);
    expect(result.winner).toBeDefined();
  });

  it('PvE XP modifier is applied correctly', () => {
    const xpWin = calculateFightXp(true, 5, 5);
    const pveXp = Math.round(xpWin * GAME_RULES.PVE.XP_MODIFIER);
    expect(pveXp).toBe(Math.round(xpWin * 0.8));
    expect(pveXp).toBeLessThan(xpWin);
  });

  it('can fight monsters at every level from 1 to 20', () => {
    for (let level = 1; level <= 20; level++) {
      const player = makePlayer({ level });
      const monster = generateMonster('goblin', level);
      const result = simulateCombat(player, monster);
      expect(monster.level).toBe(level);
      expect(result.winner).toBeDefined();
    }
  });
});
