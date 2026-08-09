import { describe, it, expect } from 'vitest';
import { BIOMES, getBiomeForCharacter, getBiomeMonsterPool } from '../../data/biomes';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import { Character } from '../../types/Character';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 10,
  experience: 0,
  strength: 12,
  vitality: 12,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 120,
  maxHp: 120,
  wins: 3,
  losses: 1,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const makeBossProgress = (totalKills: number) => ({
  bossId: 'void_titan',
  attacksLeft: 5,
  lastAttackReset: Date.now(),
  bossHp: 1000,
  bossMaxHp: 1000,
  bossLevel: 12,
  totalKills,
  firstEncounterAt: Date.now(),
});

describe('Biome registry', () => {
  it('registers plains (default) and volcanic biomes', () => {
    expect(BIOMES.map(b => b.id)).toEqual(['plains', 'volcanic']);
  });

  it('every biome has a label and a non-empty monster pool', () => {
    BIOMES.forEach(biome => {
      expect(biome.label.length).toBeGreaterThan(0);
      expect(biome.monsterPool.length).toBeGreaterThan(0);
    });
  });

  it('plains has no unlock gate and uses the current monster roster', () => {
    const plains = BIOMES.find(b => b.id === 'plains')!;
    expect(plains.unlockAt).toBeUndefined();
    expect(plains.monsterPool).toEqual(MONSTER_ASSETS.map(m => m.id));
  });

  it('volcanic gates on at least one boss kill', () => {
    const volcanic = BIOMES.find(b => b.id === 'volcanic')!;
    expect(volcanic.unlockAt).toBeDefined();
    expect(volcanic.unlockAt!(makeCharacter())).toBe(false);
    expect(volcanic.unlockAt!(makeCharacter({ bossProgress: makeBossProgress(1) }))).toBe(true);
    expect(volcanic.unlockAt!(makeCharacter({ bossProgress: makeBossProgress(3) }))).toBe(true);
  });
});

describe('getBiomeForCharacter', () => {
  it('falls back to plains before the first boss kill', () => {
    expect(getBiomeForCharacter(makeCharacter()).id).toBe('plains');
    expect(getBiomeForCharacter(makeCharacter({ bossProgress: makeBossProgress(0) })).id).toBe('plains');
  });

  it('returns plains when bossProgress is undefined', () => {
    expect(getBiomeForCharacter(makeCharacter({ bossProgress: undefined })).id).toBe('plains');
  });

  it('returns volcanic after the first boss kill', () => {
    expect(getBiomeForCharacter(makeCharacter({ bossProgress: makeBossProgress(1) })).id).toBe('volcanic');
  });
});

describe('getBiomeMonsterPool', () => {
  it('returns the full current roster for plains', () => {
    expect(getBiomeMonsterPool('plains')).toEqual(MONSTER_ASSETS.map(m => m.id));
  });

  it('returns a non-empty pool for volcanic', () => {
    const volcanic = BIOMES.find(b => b.id === 'volcanic')!;
    const pool = getBiomeMonsterPool('volcanic');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).toEqual(volcanic.monsterPool);
  });
});
