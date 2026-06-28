import { describe, it, expect } from 'vitest';
import { generateMonster, getRandomMonsterId, getMonsterDef, generateMonsterForPlayer } from '../../utils/monsterUtils';
import { MONSTER_ASSETS } from '../../data/monsterAssets';

describe('monsterUtils', () => {
  it('getMonsterDef returns definition for valid ID', () => {
    const def = getMonsterDef('goblin');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Goblin');
  });

  it('getMonsterDef returns definition for new monster', () => {
    const def = getMonsterDef('slime');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Slime');
  });

  it('getMonsterDef returns undefined for invalid ID', () => {
    const def = getMonsterDef('unknown' as any);
    expect(def).toBeUndefined();
  });

  it('getRandomMonsterId returns a valid monster ID', () => {
    const id = getRandomMonsterId(10);
    expect(MONSTER_ASSETS.some(m => m.id === id)).toBe(true);
  });

  it('getRandomMonsterId excludes given ID', () => {
    const ids = Array.from({ length: 40 }, () => getRandomMonsterId(10, 'ogre'));
    ids.forEach(id => {
      expect(id).not.toBe('ogre');
    });
  });

  it('getRandomMonsterId filters by level — low level gets tier-appropriate monsters', () => {
    const ids = Array.from({ length: 50 }, () => getRandomMonsterId(3));
    // Level 3 should never get high-tier monsters
    ids.forEach(id => {
      const def = getMonsterDef(id)!;
      if (def.minLevel !== undefined) {
        expect(3).toBeGreaterThanOrEqual(def.minLevel);
      }
      if (def.maxLevel !== undefined) {
        expect(3).toBeLessThanOrEqual(def.maxLevel);
      }
    });
    // Level 3 should sometimes get slime (minLevel 1)
    expect(ids.some(id => id === 'slime')).toBe(true);
  });

  it('getRandomMonsterId filters by level — high level gets tier-appropriate monsters', () => {
    const ids = Array.from({ length: 50 }, () => getRandomMonsterId(35));
    ids.forEach(id => {
      const def = getMonsterDef(id)!;
      if (def.minLevel !== undefined) {
        expect(35).toBeGreaterThanOrEqual(def.minLevel);
      }
      if (def.maxLevel !== undefined) {
        expect(35).toBeLessThanOrEqual(def.maxLevel);
      }
    });
    // Level 35 should sometimes get dragon_spawn (minLevel 30)
    expect(ids.some(id => id === 'dragon_spawn')).toBe(true);
    // Level 35 should never get slime (maxLevel 8)
    expect(ids.every(id => id !== 'slime')).toBe(true);
  });

  it('getRandomMonsterId at mid level gets mid-tier monsters', () => {
    const ids = Array.from({ length: 50 }, () => getRandomMonsterId(15));
    // Level 15 should sometimes get wolf but never slime or dragon_spawn
    expect(ids.some(id => id === 'wolf')).toBe(true);
    expect(ids.every(id => id !== 'slime')).toBe(true);
    expect(ids.every(id => id !== 'dragon_spawn')).toBe(true);
    // Legacy monsters (goblin, ogre, wraith) should always be available
    expect(ids.some(id => id === 'goblin')).toBe(true);
    expect(ids.some(id => id === 'ogre')).toBe(true);
    expect(ids.some(id => id === 'wraith')).toBe(true);
  });

  it('generateMonster creates a character at the given level', () => {
    const monster = generateMonster('goblin', 5);
    expect(monster.name).toBe('Goblin');
    expect(monster.level).toBe(5);
    expect(monster.isBot).toBe(true);
    expect(monster.equippedItems).toEqual({ weapon: null, armor: null, accessory: null });
  });

  it('stats scale with level', () => {
    const lvl1 = generateMonster('ogre', 1);
    const lvl10 = generateMonster('ogre', 10);
    expect(lvl10.strength).toBeGreaterThan(lvl1.strength);
    expect(lvl10.vitality).toBeGreaterThan(lvl1.vitality);
    expect(lvl10.maxHp).toBeGreaterThan(lvl1.maxHp);
  });

  it('generated monster has minimum level 1', () => {
    const monster = generateMonster('wraith', 0);
    expect(monster.level).toBe(1);
  });

  it('all 8 monster types can be generated', () => {
    const allIds = MONSTER_ASSETS.map(m => m.id);
    allIds.forEach(id => {
      const monster = generateMonster(id, 10);
      expect(monster.name).toBe(getMonsterDef(id)!.name);
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.maxHp).toBeGreaterThan(0);
    });
  });

  it('different monster IDs produce different stats at same level', () => {
    const goblin = generateMonster('goblin', 5);
    const ogre = generateMonster('ogre', 5);
    expect(ogre.strength).toBeGreaterThan(goblin.strength);
    expect(ogre.vitality).toBeGreaterThan(goblin.vitality);
    expect(goblin.dexterity).toBeGreaterThan(ogre.dexterity);
  });

  it('endgame monsters have higher stats than early monsters at same level', () => {
    const slime = generateMonster('slime', 10);
    const dragon = generateMonster('dragon_spawn', 10);
    expect(dragon.strength).toBeGreaterThan(slime.strength);
    expect(dragon.maxHp).toBeGreaterThan(slime.maxHp);
  });

  it('generateMonsterForPlayer respects level tiers', () => {
    // At level 3, only low-tier monsters should appear
    const results = Array.from({ length: 30 }, () => generateMonsterForPlayer(3));
    results.forEach(({ def }) => {
      expect(def.minLevel === undefined || 3 >= def.minLevel).toBe(true);
      expect(def.maxLevel === undefined || 3 <= def.maxLevel).toBe(true);
    });
  });

  it('generated character is compatible with simulateCombat (no crash)', () => {
    const goblin = generateMonster('goblin', 3);
    expect(goblin.hp).toBeGreaterThan(0);
    expect(goblin.maxHp).toBeGreaterThan(0);
    expect(typeof goblin.strength).toBe('number');
    expect(typeof goblin.vitality).toBe('number');
    expect(typeof goblin.dexterity).toBe('number');
    expect(typeof goblin.luck).toBe('number');
    expect(typeof goblin.intelligence).toBe('number');
    expect(typeof goblin.focus).toBe('number');
  });

  it('throws for unknown monster ID', () => {
    expect(() => generateMonster('unknown' as any, 1)).toThrow();
  });
});
