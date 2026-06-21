import { describe, it, expect } from 'vitest';
import {
  getMedalDefs,
  getDefaultMedalProgress,
  checkMedals,
  calculateCombatProgress,
  calculateLootProgress,
  calculateProgressionProgress,
  applyMedalReward,
} from '../../utils/medalUtils';
import { PixelItemAsset } from '../../types/Item';
import { Character } from '../../types/Character';

const makeItem = (id: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common'): PixelItemAsset => ({
  id,
  name: id,
  rarity,
  slot: 'weapon',
  stats: { strength: 1 },
  pixels: [[1]],
  requiredLevel: 1,
});

describe('getMedalDefs', () => {
  it('returns all medal definitions', () => {
    const defs = getMedalDefs();
    expect(defs.length).toBeGreaterThanOrEqual(14);
  });

  it('each medal has required fields', () => {
    const defs = getMedalDefs();
    for (const medal of defs) {
      expect(medal.id).toBeTruthy();
      expect(medal.name).toBeTruthy();
      expect(medal.description).toBeTruthy();
      expect(medal.category).toBeDefined();
      expect(medal.requiredProgress).toBeGreaterThan(0);
      expect(medal.reward).toBeDefined();
      expect(medal.reward.type).toBeTruthy();
      expect(medal.reward.label).toBeTruthy();
    }
  });

  it('includes combat, loot, progression and special categories', () => {
    const defs = getMedalDefs();
    expect(defs.some(m => m.category === 'combat')).toBe(true);
    expect(defs.some(m => m.category === 'loot')).toBe(true);
    expect(defs.some(m => m.category === 'progression')).toBe(true);
    expect(defs.some(m => m.category === 'special')).toBe(true);
  });
});

describe('getDefaultMedalProgress', () => {
  it('returns an entry for every medal id', () => {
    const progress = getDefaultMedalProgress();
    const defs = getMedalDefs();
    for (const medal of defs) {
      expect(progress[medal.id]).toBeDefined();
    }
  });

  it('all entries start with completed=false and progress=0', () => {
    const progress = getDefaultMedalProgress();
    for (const key of Object.keys(progress)) {
      expect(progress[key].completed).toBe(false);
      expect(progress[key].progress).toBe(0);
    }
  });
});

describe('calculateCombatProgress', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero',
    gender: 'male',
    seed: 'abc',
    level: 1,
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
    fightHistory: [],
    ...overrides,
  });

  it('tracks first blood at 1 win', () => {
    const char = baseChar({ wins: 1 });
    const progress = calculateCombatProgress(char);
    expect(progress.first_blood.progress).toBe(1);
    expect(progress.first_blood.completed).toBe(true);
  });

  it('tracks brawler at 10 wins', () => {
    const char = baseChar({ wins: 10 });
    const progress = calculateCombatProgress(char);
    expect(progress.brawler.progress).toBe(10);
    expect(progress.brawler.completed).toBe(true);
  });

  it('tracks warrior at 50 wins', () => {
    const char = baseChar({ wins: 50 });
    const progress = calculateCombatProgress(char);
    expect(progress.warrior.progress).toBe(50);
    expect(progress.warrior.completed).toBe(true);
  });

  it('tracks legend at 100 wins', () => {
    const char = baseChar({ wins: 100 });
    const progress = calculateCombatProgress(char);
    expect(progress.legend.progress).toBe(100);
    expect(progress.legend.completed).toBe(true);
  });

  it('tracks unstoppable with 5 consecutive wins', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      date: Date.now() - i * 60000,
      opponentName: `Bot${i}`,
      won: true,
    }));
    const char = baseChar({ wins: 5, fightHistory: history });
    const progress = calculateCombatProgress(char);
    expect(progress.unstoppable.progress).toBe(5);
    expect(progress.unstoppable.completed).toBe(true);
  });

  it('resets unstoppable progress if last fight was a loss', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: false },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: true },
      { date: Date.now() - 130000, opponentName: 'Bot3', won: true },
    ];
    const char = baseChar({ wins: 2, losses: 1, fightHistory: history });
    const progress = calculateCombatProgress(char);
    // Last fight was loss, streak resets to 0
    expect(progress.unstoppable.progress).toBe(0);
    expect(progress.unstoppable.completed).toBe(false);
  });

  it('tracks comeback king as number of wins after loss streaks', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: true },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: false },
      { date: Date.now() - 130000, opponentName: 'Bot3', won: false },
    ];
    const char = baseChar({ wins: 1, losses: 2, fightHistory: history });
    const progress = calculateCombatProgress(char);
    // Won after losing 2+ in a row
    expect(progress.comeback_king.progress).toBe(1);
  });

  it('does not count comeback king for a single loss then win', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: true },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: false },
    ];
    const char = baseChar({ wins: 1, losses: 1, fightHistory: history });
    const progress = calculateCombatProgress(char);
    // Only 1 consecutive loss before win, not 2+
    expect(progress.comeback_king.progress).toBe(0);
  });
});

describe('calculateLootProgress', () => {
  it('tracks collector at 10 unique items', () => {
    const inventory = Array.from({ length: 10 }, (_, i) => `item_${i}`);
    const progress = calculateLootProgress(inventory);
    expect(progress.collector.progress).toBe(10);
    expect(progress.collector.completed).toBe(true);
  });

  it('tracks rare hunter at 3 rare+ items', () => {
    const items = [
      makeItem('rare1', 'rare'),
      makeItem('rare2', 'rare'),
      makeItem('epic1', 'epic'),
      makeItem('common1', 'common'),
    ];
    const progress = calculateLootProgress(items.map(i => i.id), items);
    expect(progress.rare_hunter.progress).toBe(3);
    expect(progress.rare_hunter.completed).toBe(true);
  });

  it('tracks epic seeker at 1 epic+ item', () => {
    const items = [makeItem('epic1', 'epic')];
    const progress = calculateLootProgress(items.map(i => i.id), items);
    expect(progress.epic_seeker.progress).toBe(1);
    expect(progress.epic_seeker.completed).toBe(true);
  });

  it('tracks fully equipped when all 3 slots are filled', () => {
    const equipped = { weapon: 'sword', armor: 'shield', accessory: 'ring' };
    const progress = calculateLootProgress([], [], equipped);
    expect(progress.fully_equipped.progress).toBe(3);
    expect(progress.fully_equipped.completed).toBe(true);
  });
});

describe('calculateProgressionProgress', () => {
  it('tracks growing strong at level 5', () => {
    const progress = calculateProgressionProgress(5, 0);
    expect(progress.growing_strong.progress).toBe(5);
    expect(progress.growing_strong.completed).toBe(true);
  });

  it('tracks peak performance at level 10', () => {
    const progress = calculateProgressionProgress(10, 0);
    expect(progress.peak_performance.progress).toBe(10);
    expect(progress.peak_performance.completed).toBe(true);
  });

  it('tracks level master at level 20', () => {
    const progress = calculateProgressionProgress(20, 0);
    expect(progress.level_master.progress).toBe(20);
    expect(progress.level_master.completed).toBe(true);
  });

  it('tracks veteran at 10 daily sessions', () => {
    const progress = calculateProgressionProgress(1, 10);
    expect(progress.veteran.progress).toBe(10);
    expect(progress.veteran.completed).toBe(true);
  });
});

describe('applyMedalReward', () => {
  const baseChar = (): Character => ({
    name: 'Hero',
    gender: 'male',
    seed: 'abc',
    level: 1,
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
  });

  it('applies +1 HP reward from first_blood medal', () => {
    const defs = getMedalDefs();
    const firstBlood = defs.find(m => m.id === 'first_blood')!;
    const char = applyMedalReward(baseChar(), firstBlood.reward);
    expect(char.maxHp).toBe(101);
    expect(char.hp).toBe(101);
  });

  it('applies +5 HP from growing_strong medal', () => {
    const defs = getMedalDefs();
    const growingStrong = defs.find(m => m.id === 'growing_strong')!;
    const char = applyMedalReward(baseChar(), growingStrong.reward);
    expect(char.maxHp).toBe(105);
    expect(char.hp).toBe(105);
  });

  it('applies +1 STR from brawler medal', () => {
    const defs = getMedalDefs();
    const brawler = defs.find(m => m.id === 'brawler')!;
    const char = applyMedalReward(baseChar(), brawler.reward);
    expect(char.strength).toBe(11);
  });

  it('applies +1 VIT from warrior medal', () => {
    const defs = getMedalDefs();
    const warrior = defs.find(m => m.id === 'warrior')!;
    const char = applyMedalReward(baseChar(), warrior.reward);
    expect(char.vitality).toBe(11);
  });

  it('applies +1 DEX from unstoppable medal', () => {
    const defs = getMedalDefs();
    const unstoppable = defs.find(m => m.id === 'unstoppable')!;
    const char = applyMedalReward(baseChar(), unstoppable.reward);
    expect(char.dexterity).toBe(11);
  });

  it('applies +1 LUK from comeback_king medal', () => {
    const defs = getMedalDefs();
    const comebackKing = defs.find(m => m.id === 'comeback_king')!;
    const char = applyMedalReward(baseChar(), comebackKing.reward);
    expect(char.luck).toBe(11);
  });

  it('applies +1 INT from rare_hunter medal', () => {
    const defs = getMedalDefs();
    const rareHunter = defs.find(m => m.id === 'rare_hunter')!;
    const char = applyMedalReward(baseChar(), rareHunter.reward);
    expect(char.intelligence).toBe(11);
  });

  it('applies +1 FOC from epic_seeker medal', () => {
    const defs = getMedalDefs();
    const epicSeeker = defs.find(m => m.id === 'epic_seeker')!;
    const char = applyMedalReward(baseChar(), epicSeeker.reward);
    expect(char.focus).toBe(11);
  });

  it('applies all stats +1 from peak_performance medal', () => {
    const defs = getMedalDefs();
    const peak = defs.find(m => m.id === 'peak_performance')!;
    const char = applyMedalReward(baseChar(), peak.reward);
    expect(char.strength).toBe(11);
    expect(char.vitality).toBe(11);
    expect(char.dexterity).toBe(11);
    expect(char.luck).toBe(11);
    expect(char.intelligence).toBe(11);
    expect(char.focus).toBe(11);
  });
});

describe('checkMedals', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero',
    gender: 'male',
    seed: 'abc',
    level: 1,
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
    ...overrides,
  });

  it('unlocks first_blood on first win', () => {
    const char = baseChar({ wins: 1 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'first_blood')).toBe(true);
    expect(result.progress.first_blood.completed).toBe(true);
    expect(result.progress.first_blood.progress).toBe(1);
  });

  it('returns empty newlyUnlocked if no medals progress', () => {
    const char = baseChar({ wins: 0 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked).toHaveLength(0);
  });

  it('does not double-unlock already completed medals', () => {
    const char = baseChar({ wins: 10 });
    const progress = getDefaultMedalProgress();
    progress.first_blood = { completed: true, progress: 1, unlockedAt: 100 };
    progress.brawler = { completed: true, progress: 10, unlockedAt: 200 };
    const result = checkMedals(char, progress, []);
    const newIds = result.newlyUnlocked.map(m => m.id);
    expect(newIds).not.toContain('first_blood');
    expect(newIds).not.toContain('brawler');
  });

  it('unlocks loot medals with inventory items', () => {
    const items = [
      makeItem('epic1', 'epic'),
      makeItem('rare1', 'rare'),
      makeItem('rare2', 'rare'),
    ];
    const inventory = items.map(i => i.id);
    const char = baseChar({ inventory });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, items);
    expect(result.newlyUnlocked.some(m => m.id === 'epic_seeker')).toBe(true);
<<<<<<< HEAD
    expect(result.newlyUnlocked.some(m => m.id === 'rare_hunter')).toBe(true); // 1 epic + 2 rare = 3 rare+
=======
    expect(result.newlyUnlocked.some(m => m.id === 'rare_hunter')).toBe(true); // epic + 2 rares = 3 rare+
>>>>>>> origin/master
  });

  it('unlocks progression medals at level milestones', () => {
    const char = baseChar({ level: 10 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'growing_strong')).toBe(true);
    expect(result.newlyUnlocked.some(m => m.id === 'peak_performance')).toBe(true);
    expect(result.newlyUnlocked.some(m => m.id === 'level_master')).toBe(false);
  });

  it('merges previous progress with updated progress', () => {
    const char = baseChar({ wins: 5 });
    const progress = getDefaultMedalProgress();
    // Simulate already having first_blood completed
    progress.first_blood = { completed: true, progress: 1, unlockedAt: 100 };
    
    const result = checkMedals(char, progress, []);
    // first_blood should remain completed
    expect(result.progress.first_blood.completed).toBe(true);
    expect(result.progress.first_blood.progress).toBe(1);
    // brawler should show updated progress
    expect(result.progress.brawler.progress).toBe(5);
  });
});
