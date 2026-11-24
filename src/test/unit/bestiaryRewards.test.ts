import { beforeEach, describe, expect, it } from 'vitest';
import {
  BESTIARY_KILL_MILESTONES,
  BESTIARY_GLOBAL_MILESTONES,
  DISCOVERY_ESSENCE_REWARD,
  getBestiaryRewardState,
  claimBestiaryReward,
  getClaimableBestiaryRewards,
  applyBestiaryReward,
  getBestiaryGlobalProgress,
} from '../../utils/bestiaryRewardUtils';
import { clearBestiaryRewardClaims } from '../../utils/bestiaryRewardStorage';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import type { Character } from '../../types/Character';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'char-1',
  seed: 'seed-1',
  name: 'Hero',
  gender: 'male',
  level: 5,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 20,
  itemUpgrades: {},
  monsterKills: {},
  monsterEncounters: {},
  ...overrides,
});

describe('bestiaryRewardUtils', () => {
  beforeEach(() => {
    clearBestiaryRewardClaims();
  });

  it('defines per-monster kill milestones at 1, 5 and 25', () => {
    expect(BESTIARY_KILL_MILESTONES.map((m) => m.kills)).toEqual([1, 5, 25]);
  });

  it('defines global compendium milestones at 10, 25, 50 and 100 species', () => {
    expect(BESTIARY_GLOBAL_MILESTONES.map((m) => m.species)).toEqual([10, 25, 50, 100]);
  });

  it('grants discovery essence for first encounter milestone', () => {
    const discovery = BESTIARY_KILL_MILESTONES.find((m) => m.kills === 1);
    expect(discovery?.essence).toBe(DISCOVERY_ESSENCE_REWARD);
  });

  it('computes global progress from seen species', () => {
    const char = makeCharacter({ monsterEncounters: { goblin: 1, ogre: 1, wraith: 1 } });
    const progress = getBestiaryGlobalProgress(char);
    expect(progress.seen).toBe(3);
    expect(progress.total).toBe(MONSTER_ASSETS.length);
  });

  it('returns claimable discovery reward when monster is encountered once', () => {
    const char = makeCharacter({ monsterEncounters: { goblin: 1 }, monsterKills: {} });
    const claimable = getClaimableBestiaryRewards(char);
    expect(claimable.some((r) => r.type === 'monster' && r.monsterId === 'goblin' && r.milestone === 1)).toBe(true);
  });

  it('returns claimable kill rewards at 5 and 25 kills', () => {
    const char = makeCharacter({ monsterKills: { goblin: 25 }, monsterEncounters: { goblin: 25 } });
    const claimable = getClaimableBestiaryRewards(char);
    expect(claimable.some((r) => r.type === 'monster' && r.monsterId === 'goblin' && r.milestone === 5)).toBe(true);
    expect(claimable.some((r) => r.type === 'monster' && r.monsterId === 'goblin' && r.milestone === 25)).toBe(true);
  });

  it('does not return already claimed rewards', () => {
    const char = makeCharacter({ monsterKills: { goblin: 25 }, monsterEncounters: { goblin: 25 } });
    claimBestiaryReward(char, 'monster:goblin:5');
    const claimable = getClaimableBestiaryRewards(char);
    expect(claimable.some((r) => r.id === 'monster:goblin:5')).toBe(false);
    expect(claimable.some((r) => r.id === 'monster:goblin:25')).toBe(true);
  });

  it('applies essence reward without mutating original character', () => {
    const char = makeCharacter({ essence: 10 });
    const reward = { id: 'monster:goblin:1', type: 'monster' as const, monsterId: 'goblin', monsterName: 'Goblin', milestone: 1, essence: 5, label: 'Discovery' };
    const before = char.essence;
    const updated = applyBestiaryReward(char, reward);
    expect(updated.essence).toBe(15);
    expect(char.essence).toBe(before);
  });

  it('applies global reward with reroll grant flag', () => {
    const char = makeCharacter({ essence: 0 });
    const reward = { id: 'global:10', type: 'global' as const, milestone: 10, essence: 20, reroll: 1, label: 'Global 10' };
    const updated = applyBestiaryReward(char, reward);
    expect(updated.essence).toBe(20);
  });

  it('builds reward state with claimed and claimable ids', () => {
    const char = makeCharacter({ monsterKills: { goblin: 5 }, monsterEncounters: { goblin: 5 } });
    claimBestiaryReward(char, 'monster:goblin:1');
    const state = getBestiaryRewardState(char);
    expect(state.claimedIds).toContain('monster:goblin:1');
    expect(state.claimable.some((r) => r.id === 'monster:goblin:5')).toBe(true);
  });
});
