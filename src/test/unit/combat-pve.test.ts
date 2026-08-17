import { describe, it, expect } from 'vitest';
import { simulateCombat } from '../../utils/combatUtils';
import { generateMonster } from '../../utils/monsterUtils';
import { calculateFightXp } from '../../utils/xpUtils';
import { GAME_RULES } from '../../config/gameRules';
import { COMBAT_BALANCE } from '../../config/combatBalance';

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
    expect(result.rounds).toBeLessThanOrEqual(COMBAT_BALANCE.roundLimit);
  });

  it('monster can win against a weak player', () => {
    const weakPlayer = makePlayer({ strength: 3, vitality: 3, hp: 20, maxHp: 20 });
    const monster = generateMonster('ogre', 1);
    const result = simulateCombat(weakPlayer, monster);
    // ogre at level 1 should beat a very weak player
    expect(result.winner).toBe('defender');
  });

  it('player can win against a monster', () => {
    // Monster at playerLevel=1 gets boosted stats (LEVEL_BOOST=3, STAT_MULTIPLIER=1)
    // Player needs overwhelming stats to guarantee victory vs RNG
    const strongPlayer = makePlayer({ level: 1, strength: 300, vitality: 200, dexterity: 200, focus: 200, luck: 100, intelligence: 100, hp: 5000, maxHp: 5000 });
    const monster = generateMonster('goblin', 1);
    const result = simulateCombat(strongPlayer, monster);
    expect(result.winner).toBe('attacker');
  });

  it('a typical early player can defeat a level-appropriate monster (balance fix #723)', () => {
    // Regression for #723: STAT_MULTIPLIER=20 / HP_MULTIPLIER=22 made monsters
    // mathematically unbeatable (player dealt min-clamp 20 dmg vs ~2000 HP pools).
    // With 1.0 multipliers a fresh player (allocated 66 stat points) must reliably win.
    for (let i = 0; i < 10; i++) {
      const player = makePlayer({ level: 1, strength: 12, vitality: 12, dexterity: 12, focus: 12, luck: 12, intelligence: 12, hp: 150, maxHp: 150 });
      const monster = generateMonster('goblin', 1);
      const result = simulateCombat(player, monster);
      expect(result.winner).toBe('attacker');
    }
  });

  it('monster remains a challenge for a weak early player (LEVEL_BOOST keeps tension)', () => {
    // Even with 1.0 multipliers, LEVEL_BOOST=3 keeps ogre threatening to a glass-cannon player.
    const weakPlayer = makePlayer({ level: 1, strength: 5, vitality: 5, dexterity: 5, hp: 60, maxHp: 60 });
    const monster = generateMonster('ogre', 1);
    const result = simulateCombat(weakPlayer, monster);
    expect(result.winner).toBeDefined();
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

  it('PvE win XP is strictly greater than the equivalent PvP win XP', () => {
    const level = 5;
    const pvpWinXp = calculateFightXp(true, level, level);
    const pveWinXp = Math.round(pvpWinXp * GAME_RULES.PVE.XP_MODIFIER);

    expect(pveWinXp).toBeGreaterThan(pvpWinXp);
    expect(pveWinXp).toBe(Math.round(pvpWinXp * GAME_RULES.PVE.XP_MODIFIER));
    expect(GAME_RULES.PVE.XP_MODIFIER).toBe(2.5);
  });

  it('PvE win XP exceeds the base XP_WIN payout at every level 1-20', () => {
    for (let level = 1; level <= 20; level++) {
      const baseWin = Math.floor(GAME_RULES.COMBAT.XP_WIN * (1 + (level - 1) * 0.06));
      const pveWinXp = Math.round(baseWin * GAME_RULES.PVE.XP_MODIFIER);
      expect(pveWinXp).toBeGreaterThan(baseWin);
      expect(pveWinXp).toBeGreaterThan(GAME_RULES.COMBAT.XP_WIN);
    }
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
