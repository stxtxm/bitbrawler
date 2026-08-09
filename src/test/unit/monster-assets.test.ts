import { describe, it, expect } from 'vitest';
import { MONSTER_ASSETS, MONSTER_PALETTES } from '../../data/monsterAssets';
import { ELEMENTS } from '../../types/Item';

describe('Monster assets', () => {
  it('defines exactly 11 monsters', () => {
    expect(MONSTER_ASSETS.length).toBe(11);
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

  it('elements are spread across the 8 monsters', () => {
    const elements = MONSTER_ASSETS.map(m => m.element);
    expect(elements).toContain('wind');
    expect(elements).toContain('earth');
    expect(elements).toContain('dark');
    expect(elements).toContain('water');
    expect(elements).toContain('fire');
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
    const keys = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'hp'] as const;
    MONSTER_ASSETS.forEach(m => {
      keys.forEach(key => {
        expect(m.baseStats[key]).toBeGreaterThan(0);
      });
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

  it('legacy monsters have no level restrictions', () => {
    const unrestricted = MONSTER_ASSETS.filter(m =>
      ['goblin', 'ogre', 'wraith'].includes(m.id)
    );
    unrestricted.forEach(m => {
      expect(m.minLevel).toBeUndefined();
      expect(m.maxLevel).toBeUndefined();
    });
  });

  it('new monsters have valid level restrictions', () => {
    const restricted = MONSTER_ASSETS.filter(m =>
      ['slime', 'wolf', 'skeleton', 'chimera', 'dragon_spawn', 'cinder_imp', 'lava_hound', 'magma_golem'].includes(m.id)
    );
    restricted.forEach(m => {
      expect(m.minLevel).toBeDefined();
      expect(m.maxLevel).toBeDefined();
      expect(m.minLevel!).toBeLessThanOrEqual(m.maxLevel!);
      expect(m.minLevel!).toBeGreaterThanOrEqual(1);
      expect(m.maxLevel!).toBeLessThanOrEqual(50);
    });
  });

  it('monster level tiers have predictable progression', () => {
    const slime = MONSTER_ASSETS.find(m => m.id === 'slime')!;
    const wolf = MONSTER_ASSETS.find(m => m.id === 'wolf')!;
    const skeleton = MONSTER_ASSETS.find(m => m.id === 'skeleton')!;
    const chimera = MONSTER_ASSETS.find(m => m.id === 'chimera')!;
    const dragon = MONSTER_ASSETS.find(m => m.id === 'dragon_spawn')!;

    // Each tier starts at a higher level than the previous
    expect(wolf.minLevel!).toBeGreaterThanOrEqual(slime.minLevel!);
    expect(skeleton.minLevel!).toBeGreaterThan(wolf.minLevel!);
    expect(chimera.minLevel!).toBeGreaterThan(skeleton.minLevel!);
    expect(dragon.minLevel!).toBeGreaterThan(chimera.minLevel!);

    // No monster has a maxLevel above 50
    expect(slime.maxLevel!).toBeLessThanOrEqual(50);
    expect(wolf.maxLevel!).toBeLessThanOrEqual(50);
    expect(skeleton.maxLevel!).toBeLessThanOrEqual(50);
    expect(chimera.maxLevel!).toBeLessThanOrEqual(50);
    expect(dragon.maxLevel!).toBeLessThanOrEqual(50);
  });

  it('specialty stat distributions make each monster unique', () => {
    const goblin = MONSTER_ASSETS.find(m => m.id === 'goblin')!;
    const ogre = MONSTER_ASSETS.find(m => m.id === 'ogre')!;
    const wraith = MONSTER_ASSETS.find(m => m.id === 'wraith')!;
    const slime = MONSTER_ASSETS.find(m => m.id === 'slime')!;
    const wolf = MONSTER_ASSETS.find(m => m.id === 'wolf')!;
    const skeleton = MONSTER_ASSETS.find(m => m.id === 'skeleton')!;

    // Goblin: high DEX/LUK growth
    expect(goblin.growthRates.dexterity).toBeGreaterThan(goblin.growthRates.strength);
    expect(goblin.growthRates.luck).toBeGreaterThan(goblin.growthRates.vitality);

    // Ogre: high STR/VIT growth
    expect(ogre.growthRates.strength).toBeGreaterThan(ogre.growthRates.dexterity);
    expect(ogre.growthRates.vitality).toBeGreaterThan(ogre.growthRates.dexterity);

    // Wraith: high INT/FOC growth
    expect(wraith.growthRates.intelligence).toBeGreaterThan(wraith.growthRates.strength);
    expect(wraith.growthRates.focus).toBeGreaterThan(wraith.growthRates.vitality);

    // Slime: lowest base HP of all monsters
    expect(slime.baseStats.hp).toBeLessThan(skeleton.baseStats.hp);

    // Wolf: high DEX, low VIT (glass cannon)
    expect(wolf.growthRates.dexterity).toBeGreaterThan(wolf.growthRates.vitality);
    expect(wolf.baseStats.vitality).toBeLessThan(wolf.baseStats.strength);

    // Skeleton: balanced INT/DEX
    expect(skeleton.growthRates.intelligence).toBe(skeleton.growthRates.dexterity);
  });

  it('registers the 3 volcanic monsters with fire/lava palettes', () => {
    const cinderImp = MONSTER_ASSETS.find(m => m.id === 'cinder_imp');
    const lavaHound = MONSTER_ASSETS.find(m => m.id === 'lava_hound');
    const magmaGolem = MONSTER_ASSETS.find(m => m.id === 'magma_golem');
    expect(cinderImp).toBeDefined();
    expect(lavaHound).toBeDefined();
    expect(magmaGolem).toBeDefined();
    expect(MONSTER_PALETTES.cinder_imp).toBe(cinderImp!.palette);
    expect(MONSTER_PALETTES.lava_hound).toBe(lavaHound!.palette);
    expect(MONSTER_PALETTES.magma_golem).toBe(magmaGolem!.palette);
  });

  it('volcanic monsters follow their archetype stat profiles', () => {
    const cinderImp = MONSTER_ASSETS.find(m => m.id === 'cinder_imp')!;
    const lavaHound = MONSTER_ASSETS.find(m => m.id === 'lava_hound')!;
    const magmaGolem = MONSTER_ASSETS.find(m => m.id === 'magma_golem')!;

    // cinder_imp = fire mage (high INT/FOC growth)
    expect(cinderImp.element).toBe('fire');
    expect(cinderImp.growthRates.intelligence).toBeGreaterThan(cinderImp.growthRates.strength);
    expect(cinderImp.growthRates.focus).toBeGreaterThan(cinderImp.growthRates.dexterity);

    // lava_hound = fast glass cannon (high DEX growth, low VIT/HP)
    expect(lavaHound.element).toBe('fire');
    expect(lavaHound.growthRates.dexterity).toBeGreaterThan(lavaHound.growthRates.vitality);
    expect(lavaHound.baseStats.vitality).toBeLessThan(lavaHound.baseStats.strength);

    // magma_golem = tank (high STR/VIT/HP, low DEX)
    expect(magmaGolem.element).toBe('earth');
    expect(magmaGolem.baseStats.hp).toBeGreaterThan(lavaHound.baseStats.hp);
    expect(magmaGolem.growthRates.vitality).toBeGreaterThan(magmaGolem.growthRates.dexterity);
    expect(magmaGolem.baseStats.dexterity).toBeLessThan(magmaGolem.baseStats.strength);
  });

  it('volcanic monster level tiers are coherent and non-overlapping with legacy tiers', () => {
    const cinderImp = MONSTER_ASSETS.find(m => m.id === 'cinder_imp')!;
    const lavaHound = MONSTER_ASSETS.find(m => m.id === 'lava_hound')!;
    const magmaGolem = MONSTER_ASSETS.find(m => m.id === 'magma_golem')!;

    expect(cinderImp.minLevel!).toBeLessThanOrEqual(cinderImp.maxLevel!);
    expect(lavaHound.minLevel!).toBeLessThanOrEqual(lavaHound.maxLevel!);
    expect(magmaGolem.minLevel!).toBeLessThanOrEqual(magmaGolem.maxLevel!);

    // Tier order: cinder_imp < lava_hound < magma_golem
    expect(lavaHound.minLevel!).toBeGreaterThan(cinderImp.minLevel!);
    expect(magmaGolem.minLevel!).toBeGreaterThan(lavaHound.minLevel!);
  });
});
