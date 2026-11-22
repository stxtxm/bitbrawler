import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import {
  BIOMES,
  BiomeId,
  getBiomeForCharacter,
  getBiomeMonsterPool,
  getBiomeRewardMultiplier,
  getSelectedBiomeId,
  getUnlockedBiomes,
  setSelectedBiomeId,
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
  it('registers the expected biomes in progression order slots', () => {
    expect(BIOMES.length).toBe(5);
    const ids = BIOMES.map((b) => b.id);
    expect(ids).toEqual(['plains', 'volcanic', 'mountain', 'abyssal', 'eclipse']);
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

  it('returns a non-empty volcanic pool with the 3 exclusive volcanic monsters', () => {
    const pool = getBiomeMonsterPool('volcanic');
    expect(pool.length).toBeGreaterThan(0);
    expect(pool).not.toEqual(getBiomeMonsterPool('plains'));
    expect(pool).toEqual(['magma_golem', 'lava_hound', 'cinder_imp']);
  });

  it('keeps volcanic monsters out of the plains pool', () => {
    const plainsPool = getBiomeMonsterPool('plains');
    expect(plainsPool).not.toContain('magma_golem');
    expect(plainsPool).not.toContain('lava_hound');
    expect(plainsPool).not.toContain('cinder_imp');
  });

  it('falls back to the plains pool for an unknown biome id', () => {
    expect(getBiomeMonsterPool('tundra' as BiomeId)).toEqual(
      getBiomeMonsterPool('plains'),
    );
  });
});

describe('biome unlock and selection', () => {
  it('unlocks volcanic when void titan kill is stored in bossProgresses', () => {
    const character = makeCharacter({
      level: 12,
      bossProgress: undefined,
      bossProgresses: { void_titan: makeBossProgress(1) } as any,
    } as any);
    expect(getBiomeForCharacter(character).id).toBe('volcanic');
  });

  it('unlocks mountain at level 40', () => {
    const character = makeCharacter({ level: 40, bossProgress: makeBossProgress(1) });
    expect(getUnlockedBiomes(character).map((b) => b.id)).toContain('mountain');
  });

  it('keeps frostpeak biome locked until the second boss is defeated', () => {
    const character = makeCharacter({ level: 40, bossProgress: makeBossProgress(1) } as any);
    expect(getUnlockedBiomes(character).map((b) => b.id)).not.toContain('abyssal');
    const withKill = makeCharacter({
      level: 40,
      bossProgress: makeBossProgress(1),
      bossProgresses: { abyssal_monarch: { ...makeBossProgress(1), bossId: 'abyssal_monarch' } } as any,
    } as any);
    expect(getUnlockedBiomes(withKill).map((b) => b.id)).toContain('abyssal');
  });

  it('keeps eclipse prepared but locked (future lvl 60 boss)', () => {
    const character = makeCharacter({ level: 99, bossProgress: makeBossProgress(5), bossProgresses: { abyssal_monarch: { ...makeBossProgress(3), bossId: 'abyssal_monarch' } } as any } as any);
    expect(getUnlockedBiomes(character).map((b) => b.id)).not.toContain('eclipse');
  });

  it('defaults to highest unlocked biome but allows selecting an unlocked one', () => {
    const character = makeCharacter({ id: 'char-b1', level: 40, bossProgress: makeBossProgress(1) } as any);
    setSelectedBiomeId(character, 'volcanic');
    expect(getSelectedBiomeId(character)).toBe('volcanic');
    expect(getBiomeForCharacter(character).id).toBe('volcanic');
  });

  it('ignores a selected biome that is locked', () => {
    const character = makeCharacter({ id: 'char-b2', level: 10, bossProgress: makeBossProgress(1) } as any);
    setSelectedBiomeId(character, 'abyssal');
    expect(getBiomeForCharacter(character).id).toBe('volcanic');
  });

  it('exposes increasing reward multipliers by biome progression', () => {
    expect(getBiomeRewardMultiplier('plains')).toBe(1);
    expect(getBiomeRewardMultiplier('volcanic')).toBeGreaterThan(1);
    expect(getBiomeRewardMultiplier('mountain')).toBeGreaterThan(getBiomeRewardMultiplier('volcanic'));
    expect(getBiomeRewardMultiplier('abyssal')).toBeGreaterThan(getBiomeRewardMultiplier('mountain'));
    expect(getBiomeRewardMultiplier('eclipse')).toBeGreaterThan(getBiomeRewardMultiplier('abyssal'));
  });
});
