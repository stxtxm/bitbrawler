import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import {
  BIOMES,
  BiomeId,
  getBiomeForCharacter,
  getBiomeMonsterPool,
} from '../../data/biomes';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  seed: 'player-test',
  name: 'Test Player',
  gender: 'male' as const,
  level: overrides.level ?? 10,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 5,
  losses: 1,
  fightsLeft: 5,
  lastFightReset: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const makeBossProgress = (totalKills: number) => ({
  bossId: 'void_titan',
  attacksLeft: 5,
  lastAttackReset: 0,
  bossHp: 1000,
  bossMaxHp: 1000,
  bossLevel: 10,
  totalKills,
  firstEncounterAt: 0,
});

describe('biome registry', () => {
  it('registers exactly the plains and volcanic biomes', () => {
    expect(BIOMES.length).toBe(2);
    const ids = BIOMES.map((b) => b.id);
    expect(ids).toContain('plains');
    expect(ids).toContain('volcanic');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps plains first as the default biome', () => {
    expect(BIOMES[0].id).toBe('plains');
  });

  it('gives every biome a non-empty label and monster pool', () => {
    BIOMES.forEach((b) => {
      expect(b.label.length).toBeGreaterThan(0);
      expect(b.monsterPool.length).toBeGreaterThan(0);
    });
  });

  it('only references monsters registered in MONSTER_ASSETS', () => {
    const registered = new Set(MONSTER_ASSETS.map((m) => m.id));
    BIOMES.forEach((b) => {
      b.monsterPool.forEach((id) => {
        expect(registered.has(id)).toBe(true);
      });
    });
  });

  it('unlocks plains unconditionally (no unlockAt gate)', () => {
    const plains = BIOMES.find((b) => b.id === 'plains')!;
    expect(plains.unlockAt).toBeUndefined();
  });
});

describe('getBiomeForCharacter', () => {
  it('returns plains for a character with no boss progress', () => {
    expect(getBiomeForCharacter(makeCharacter()).id).toBe('plains');
  });

  it('returns plains before the first boss kill (totalKills 0)', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(0) });
    expect(getBiomeForCharacter(character).id).toBe('plains');
  });

  it('unlocks the volcanic biome after the first boss kill', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(1) });
    expect(getBiomeForCharacter(character).id).toBe('volcanic');
  });

  it('keeps the volcanic biome unlocked after multiple kills', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(4) });
    expect(getBiomeForCharacter(character).id).toBe('volcanic');
  });
});

describe('getBiomeMonsterPool', () => {
  it('returns a non-empty pool for the plains biome', () => {
    expect(getBiomeMonsterPool('plains').length).toBeGreaterThan(0);
  });

  it('returns a non-empty pool for the volcanic biome (plains fallback until sub-issue 3)', () => {
    const pool = getBiomeMonsterPool('volcanic');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).toEqual(getBiomeMonsterPool('plains'));
  });

  it('falls back to the plains pool for an unknown biome id', () => {
    expect(getBiomeMonsterPool('tundra' as BiomeId)).toEqual(
      getBiomeMonsterPool('plains'),
    );
  });
});
