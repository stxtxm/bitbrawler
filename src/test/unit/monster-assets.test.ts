import { describe, it, expect } from 'vitest';
import { MONSTER_ASSETS, MONSTER_PALETTES } from '../../data/monsterAssets';
import { ELEMENTS } from '../../types/Item';

describe('Monster assets', () => {
  it('defines exactly 3 monsters', () => {
    expect(MONSTER_ASSETS.length).toBe(3);
  });

  it('has unique IDs', () => {
    const ids = MONSTER_ASSETS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all monsters have valid elements', () => {
    MONSTER_ASSETS.forEach(m => {
      expect(ELEMENTS).toContain(m.element);
    });
  });

  it('all elements are represented across the 3 monsters', () => {
    const elements = MONSTER_ASSETS.map(m => m.element);
    expect(elements).toContain('wind');
    expect(elements).toContain('earth');
    expect(elements).toContain('dark');
  });

  it('each monster has a non-empty specialty', () => {
    MONSTER_ASSETS.forEach(m => {
      expect(m.specialty.length).toBeGreaterThan(0);
    });
  });

  it('each monster has a 16x16 pixel grid', () => {
    MONSTER_ASSETS.forEach(m => {
      expect(m.pixels.length).toBe(16);
      m.pixels.forEach(row => {
        expect(row.length).toBe(16);
      });
    });
  });

  it('each monster has a palette matching its ID', () => {
    MONSTER_ASSETS.forEach(m => {
      expect(MONSTER_PALETTES[m.id]).toBe(m.palette);
    });
  });

  it('each monster has positive base stats', () => {
    MONSTER_ASSETS.forEach(m => {
      expect(m.baseStats.strength).toBeGreaterThan(0);
      expect(m.baseStats.vitality).toBeGreaterThan(0);
      expect(m.baseStats.dexterity).toBeGreaterThan(0);
      expect(m.baseStats.luck).toBeGreaterThan(0);
      expect(m.baseStats.intelligence).toBeGreaterThan(0);
      expect(m.baseStats.focus).toBeGreaterThan(0);
      expect(m.baseStats.hp).toBeGreaterThan(0);
    });
  });

  it('each monster has growth rates for all stats', () => {
    const keys = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'] as const;
    MONSTER_ASSETS.forEach(m => {
      keys.forEach(key => {
        expect(typeof m.growthRates[key]).toBe('number');
      });
    });
  });

  it('specialty stat distributions make each monster unique', () => {
    const goblin = MONSTER_ASSETS.find(m => m.id === 'goblin')!;
    const ogre = MONSTER_ASSETS.find(m => m.id === 'ogre')!;
    const wraith = MONSTER_ASSETS.find(m => m.id === 'wraith')!;

    // Goblin: high DEX/LUK growth
    expect(goblin.growthRates.dexterity).toBeGreaterThan(goblin.growthRates.strength);
    expect(goblin.growthRates.luck).toBeGreaterThan(goblin.growthRates.vitality);

    // Ogre: high STR/VIT growth
    expect(ogre.growthRates.strength).toBeGreaterThan(ogre.growthRates.dexterity);
    expect(ogre.growthRates.vitality).toBeGreaterThan(ogre.growthRates.dexterity);

    // Wraith: high INT/FOC growth
    expect(wraith.growthRates.intelligence).toBeGreaterThan(wraith.growthRates.strength);
    expect(wraith.growthRates.focus).toBeGreaterThan(wraith.growthRates.vitality);
  });
});
