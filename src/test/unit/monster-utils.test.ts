import { describe, it, expect } from 'vitest';
import { generateMonster, getRandomMonsterId, getMonsterDef } from '../../utils/monsterUtils';
import { MONSTER_ASSETS } from '../../data/monsterAssets';

describe('monsterUtils', () => {
  it('getMonsterDef returns definition for valid ID', () => {
    const def = getMonsterDef('goblin');
    expect(def).toBeDefined();
    expect(def!.name).toBe('Goblin');
  });

  it('getMonsterDef returns undefined for invalid ID', () => {
    const def = getMonsterDef('unknown' as any);
    expect(def).toBeUndefined();
  });

  it('getRandomMonsterId returns a valid monster ID', () => {
    const id = getRandomMonsterId();
    expect(MONSTER_ASSETS.some(m => m.id === id)).toBe(true);
  });

  it('getRandomMonsterId excludes given ID', () => {
    const ids = Array.from({ length: 20 }, () => getRandomMonsterId('ogre'));
    ids.forEach(id => {
      expect(id).not.toBe('ogre');
    });
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

  it('different monster IDs produce different stats at same level', () => {
    const goblin = generateMonster('goblin', 5);
    const ogre = generateMonster('ogre', 5);
    // Ogres have higher STR/VIT, goblins have higher DEX/LUK
    expect(ogre.strength).toBeGreaterThan(goblin.strength);
    expect(ogre.vitality).toBeGreaterThan(goblin.vitality);
    expect(goblin.dexterity).toBeGreaterThan(ogre.dexterity);
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
