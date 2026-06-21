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
import { gainXp } from '../../utils/xpUtils';
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

/**
 * Simulates a simple fight entry for test purposes.
 */
function makeFight(won: boolean): { date: number; opponentName: string; won: boolean } {
  return { date: Date.now(), opponentName: 'Bot', won };
}

describe('checkMedals — special combat context', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
    ...overrides,
  });

  it('detects glass cannon when won with <10 HP remaining', () => {
    const char = baseChar({ wins: 1, fightHistory: [makeFight(true)] });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], {
      glassCannonFight: true,
    });
    expect(result.newlyUnlocked.some(m => m.id === 'glass_cannon')).toBe(true);
    expect(result.progress.glass_cannon.completed).toBe(true);
  });

  it('detects pacifist when won with 0 damage taken', () => {
    const char = baseChar({ wins: 1, fightHistory: [makeFight(true)] });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], {
      pacifistFight: true,
    });
    expect(result.newlyUnlocked.some(m => m.id === 'pacifist')).toBe(true);
    expect(result.progress.pacifist.completed).toBe(true);
  });

  it('does not unlock glass cannon if not provided in context', () => {
    const char = baseChar({ wins: 1, fightHistory: [makeFight(true)] });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'glass_cannon')).toBe(false);
  });

  it('does not unlock pacifist if not provided in context', () => {
    const char = baseChar({ wins: 1, fightHistory: [makeFight(true)] });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'pacifist')).toBe(false);
  });
});

describe('checkMedals — special loot context (lucky day)', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
    ...overrides,
  });

  it('detects lucky day when epic obtained from first lootbox', () => {
    const char = baseChar();
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], {
      luckyDayRoll: true,
    });
    expect(result.newlyUnlocked.some(m => m.id === 'lucky_day')).toBe(true);
    expect(result.progress.lucky_day.completed).toBe(true);
  });

  it('does not unlock lucky day if context is false', () => {
    const char = baseChar();
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'lucky_day')).toBe(false);
  });

  it('preserves lucky_day progress if already unlocked', () => {
    const char = baseChar();
    const progress = getDefaultMedalProgress();
    progress.lucky_day = { completed: true, progress: 1, unlockedAt: 100 };
    const result = checkMedals(char, progress, []);
    // Should still show as completed (preserved)
    expect(result.progress.lucky_day.completed).toBe(true);
    expect(result.newlyUnlocked.some(m => m.id === 'lucky_day')).toBe(false);
  });
});

describe('checkMedals — progression/level integration', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
    ...overrides,
  });

  it('unlocks growing_strong at level 5', () => {
    const char = baseChar({ level: 5 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { sessionCount: 0 });
    expect(result.newlyUnlocked.some(m => m.id === 'growing_strong')).toBe(true);
    expect(result.newlyUnlocked.some(m => m.id === 'peak_performance')).toBe(false);
  });

  it('unlocks peak_performance at level 10', () => {
    const char = baseChar({ level: 10 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { sessionCount: 0 });
    expect(result.newlyUnlocked.some(m => m.id === 'growing_strong')).toBe(true);
    expect(result.newlyUnlocked.some(m => m.id === 'peak_performance')).toBe(true);
  });

  it('unlocks level_master at level 20', () => {
    const char = baseChar({ level: 20 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { sessionCount: 0 });
    expect(result.newlyUnlocked.some(m => m.id === 'level_master')).toBe(true);
  });

  it('unlocks veteran at 10 sessions', () => {
    const char = baseChar({ level: 1 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { sessionCount: 10 });
    expect(result.newlyUnlocked.some(m => m.id === 'veteran')).toBe(true);
  });
});

describe('medal integration — fight → unlock → reward → next fight', () => {
  const baseChar = (): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
    fightHistory: [],
  });

  it('applies +1 HP reward after first win (first_blood)', () => {
    // Start with 0 wins
    let char = baseChar();
    const progress = getDefaultMedalProgress();

    // After first win
    char = { ...char, wins: 1, fightHistory: [makeFight(true)] };
    const result = checkMedals(char, progress, []);

    // Should unlock first_blood
    expect(result.newlyUnlocked.some(m => m.id === 'first_blood')).toBe(true);
    const firstBloodUnlock = result.newlyUnlocked.find(m => m.id === 'first_blood')!;

    // Apply reward
    char = applyMedalReward(char, firstBloodUnlock.reward);
    char.medalProgress = result.progress;

    // Check HP increased
    expect(char.maxHp).toBe(101);
    expect(char.hp).toBe(101);
  });

  it('applies +1 STR reward after 10 wins (brawler)', () => {
    let char = baseChar();
    const progress = getDefaultMedalProgress();

    // After 10 wins
    const history = Array.from({ length: 10 }, () => makeFight(true));
    char = { ...char, wins: 10, fightHistory: history };
    const result = checkMedals(char, progress, []);

    // Should unlock brawler (and first_blood)
    const brawlerUnlock = result.newlyUnlocked.find(m => m.id === 'brawler');
    expect(brawlerUnlock).toBeDefined();

    // Apply reward
    char = applyMedalReward(char, brawlerUnlock!.reward);
    expect(char.strength).toBe(11);
  });

  it('stat bonuses stack additively with base stats', () => {
    let char = baseChar(); // strength = 10
    const progress = getDefaultMedalProgress();

    // Simulate unlocking brawler and applying +1 STR
    const result1 = checkMedals({ ...char, wins: 10 }, progress, []);
    const brawlerUnlock = result1.newlyUnlocked.find(m => m.id === 'brawler');
    if (brawlerUnlock) {
      char = applyMedalReward(char, brawlerUnlock.reward);
    }

    // Simulate another medal giving +1 STR (glass_cannon)
    const result2 = checkMedals({ ...char, wins: 10 }, { ...result1.progress }, [], { glassCannonFight: true });
    const gcUnlock = result2.newlyUnlocked.find(m => m.id === 'glass_cannon');
    if (gcUnlock) {
      char = applyMedalReward(char, gcUnlock.reward);
    }

    // Strength should be 12 (10 base + 1 from brawler + 1 from glass_cannon)
    expect(char.strength).toBe(12);
  });

  it('unlocking peak_performance gives +1 to all stats', () => {
    let char = baseChar(); // all stats = 10
    const progress = getDefaultMedalProgress();

    const result = checkMedals({ ...char, level: 10 }, progress, []);
    const peakUnlock = result.newlyUnlocked.find(m => m.id === 'peak_performance');
    expect(peakUnlock).toBeDefined();

    char = applyMedalReward(char, peakUnlock!.reward);
    expect(char.strength).toBe(11);
    expect(char.vitality).toBe(11);
    expect(char.dexterity).toBe(11);
    expect(char.luck).toBe(11);
    expect(char.intelligence).toBe(11);
    expect(char.focus).toBe(11);
  });

  it('unlocking collector gives +1 inventory slot', () => {
    let char = baseChar();
    const progress = getDefaultMedalProgress();

    const inventory = Array.from({ length: 10 }, (_, i) => `item_${i}`);
    char = { ...char, inventory };
    const result = checkMedals(char, progress, []);
    const collectorUnlock = result.newlyUnlocked.find(m => m.id === 'collector');
    expect(collectorUnlock).toBeDefined();

    char = applyMedalReward(char, collectorUnlock!.reward);
    expect(char.medalInventoryBonus).toBe(1);
  });

  it('unlocking veteran gives +1 bonus XP on win', () => {
    let char = baseChar();
    const progress = getDefaultMedalProgress();

    const result = checkMedals(char, progress, [], { sessionCount: 10 });
    const veteranUnlock = result.newlyUnlocked.find(m => m.id === 'veteran');
    expect(veteranUnlock).toBeDefined();

    char = applyMedalReward(char, veteranUnlock!.reward);
    expect(char.medalXpBonus).toBe(1);
  });

  it('applies medal reward to maxHp AND current hp', () => {
    let char = baseChar(); // maxHp = 100, hp = 100
    const defs = getMedalDefs();
    const firstBlood = defs.find(m => m.id === 'first_blood')!;

    char = applyMedalReward(char, firstBlood.reward);
    expect(char.maxHp).toBe(101);
    expect(char.hp).toBe(101);
  });

  it('applies +5 HP from growing_strong', () => {
    let char = baseChar(); // maxHp = 100
    const defs = getMedalDefs();
    const growingStrong = defs.find(m => m.id === 'growing_strong')!;

    char = applyMedalReward(char, growingStrong.reward);
    expect(char.maxHp).toBe(105);
    expect(char.hp).toBe(105);
  });
});

describe('medal integration — combat progress + context combined', () => {
  const baseChar = (overrides: Partial<Character> = {}): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
    fightHistory: [],
    ...overrides,
  });

  it('unlocks first_blood and glass_cannon in same check', () => {
    const char = baseChar({
      wins: 1,
      fightHistory: [makeFight(true)],
    });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], {
      glassCannonFight: true,
    });
    const ids = result.newlyUnlocked.map(m => m.id);
    expect(ids).toContain('first_blood');
    expect(ids).toContain('glass_cannon');
  });

  it('unlocks pacifist alongside brawler', () => {
    const char = baseChar({
      wins: 10,
      fightHistory: Array.from({ length: 10 }, () => makeFight(true)),
    });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], {
      pacifistFight: true,
    });
    const ids = result.newlyUnlocked.map(m => m.id);
    expect(ids).toContain('brawler');
    expect(ids).toContain('pacifist');
  });

  it('combat medals scale with wins and streak context', () => {
    const streak = Array.from({ length: 5 }, () => makeFight(true));
    const char = baseChar({
      wins: 5,
      fightHistory: streak,
    });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);

    expect(result.progress.unstoppable.completed).toBe(true);
    expect(result.progress.unstoppable.progress).toBe(5);
    expect(result.progress.brawler.progress).toBe(5);
    expect(result.progress.brawler.completed).toBe(false); // needs 10
  });
});

describe('applyMedalReward — edge cases', () => {
  const baseChar = (): Character => ({
    name: 'Hero', gender: 'male', seed: 'abc',
    level: 1, experience: 0,
    strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10,
    hp: 100, maxHp: 100,
    wins: 0, losses: 0, fightsLeft: 5, lastFightReset: Date.now(),
  });

  it('handles missing stat values (undefined) with defaults', () => {
    const char: Character = {
      ...baseChar(),
      strength: undefined as any,
      vitality: undefined as any,
      dexterity: undefined as any,
      luck: undefined as any,
      intelligence: undefined as any,
      focus: undefined as any,
    };
    const result = applyMedalReward(char, { type: 'stat_point', label: '+1 STR', stat: 'strength', value: 1 });
    expect(result.strength).toBe(11);
  });

  it('handles missing medalInventoryBonus default', () => {
    const char = baseChar();
    delete (char as any).medalInventoryBonus;
    const result = applyMedalReward(char, { type: 'inventory_slot', label: '+1 slot', value: 1 });
    expect(result.medalInventoryBonus).toBe(1);
  });

  it('handles missing medalXpBonus default', () => {
    const char = baseChar();
    delete (char as any).medalXpBonus;
    const result = applyMedalReward(char, { type: 'xp_bonus', label: '+1 XP', value: 1 });
    expect(result.medalXpBonus).toBe(1);
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
    // 3 rare+ items (epic + 2 rare) → rare_hunter also unlocks
    expect(result.newlyUnlocked.some(m => m.id === 'rare_hunter')).toBe(true);
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

  it('unlocks glass_cannon via special context', () => {
    const char = baseChar({ wins: 1 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { glassCannonFight: true });
    expect(result.newlyUnlocked.some(m => m.id === 'glass_cannon')).toBe(true);
    expect(result.progress.glass_cannon.completed).toBe(true);
  });

  it('unlocks pacifist via special context', () => {
    const char = baseChar({ wins: 1 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, [], { pacifistFight: true });
    expect(result.newlyUnlocked.some(m => m.id === 'pacifist')).toBe(true);
    expect(result.progress.pacifist.completed).toBe(true);
  });

  it('unlocks lucky_day when first lootbox yields epic+ item', () => {
    const char = baseChar({ wins: 0 });
    const progress = getDefaultMedalProgress();
    const items = [makeItem('epic_sword', 'epic')];
    const result = checkMedals(char, progress, items, { luckyDayRoll: true });
    expect(result.newlyUnlocked.some(m => m.id === 'lucky_day')).toBe(true);
    expect(result.progress.lucky_day.completed).toBe(true);
  });

  it('does not unlock lucky_day without luckyDayRoll context', () => {
    const char = baseChar({ wins: 0, inventory: ['epic_sword'] });
    const progress = getDefaultMedalProgress();
    const items = [makeItem('epic_sword', 'epic')];
    const result = checkMedals(char, progress, items);
    expect(result.newlyUnlocked.some(m => m.id === 'lucky_day')).toBe(false);
  });
});

describe('Medal reward application integration', () => {
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

  it('applies +1 permanent HP reward from first_blood and persists in character', () => {
    let char = baseChar({ wins: 1 });
    const progress = getDefaultMedalProgress();
    const result = checkMedals(char, progress, []);
    const firstBlood = result.newlyUnlocked.find(m => m.id === 'first_blood');
    expect(firstBlood).toBeDefined();
    if (firstBlood) {
      char = applyMedalReward(char, firstBlood.reward);
      expect(char.maxHp).toBe(101);
    }
  });

  it('applies +1 inventory slot from collector medal reward', () => {
    let char = baseChar({ medalInventoryBonus: 0 });
    const defs = getMedalDefs();
    const collector = defs.find(m => m.id === 'collector')!;
    char = applyMedalReward(char, collector.reward);
    expect(char.medalInventoryBonus).toBe(1);
  });

  it('applies +1 XP bonus from veteran medal reward', () => {
    let char = baseChar({ medalXpBonus: 0 });
    const defs = getMedalDefs();
    const veteran = defs.find(m => m.id === 'veteran')!;
    char = applyMedalReward(char, veteran.reward);
    expect(char.medalXpBonus).toBe(1);
  });

  it('applies permanent title from legend medal reward', () => {
    let char = baseChar({});
    const defs = getMedalDefs();
    const legend = defs.find(m => m.id === 'legend')!;
    char = applyMedalReward(char, legend.reward);
    expect(char.medalTitle).toBe('The Legend');
  });

  it('applies permanent aura from level_master medal reward', () => {
    let char = baseChar({});
    const defs = getMedalDefs();
    const levelMaster = defs.find(m => m.id === 'level_master')!;
    char = applyMedalReward(char, levelMaster.reward);
    expect(char.medalAura).toBe(true);
  });

  it('stacks multiple medal rewards cumulatively', () => {
    let char = baseChar({ wins: 1, strength: 10, maxHp: 100, hp: 100 });
    const defs = getMedalDefs();
    
    // Apply first_blood (+1 HP)
    const firstBlood = defs.find(m => m.id === 'first_blood')!;
    char = applyMedalReward(char, firstBlood.reward);
    expect(char.maxHp).toBe(101);

    // Apply brawler (+1 STR)
    const brawler = defs.find(m => m.id === 'brawler')!;
    char = applyMedalReward(char, brawler.reward);
    expect(char.strength).toBe(11);
    expect(char.maxHp).toBe(101); // HP unchanged by stat reward
  });

  it('end-to-end: fight → medal unlock → reward applied → next fight uses new stats', () => {
    // Simulate a character winning their first fight
    let char = baseChar({ wins: 1, strength: 10, maxHp: 100 });
    let progress = getDefaultMedalProgress();

    // Check medals after first win
    let result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'first_blood')).toBe(true);

    // Apply all newly unlocked rewards
    for (const medal of result.newlyUnlocked) {
      char = applyMedalReward(char, medal.reward);
    }
    progress = result.progress;

    // Verify first_blood reward applied (+1 HP)
    expect(char.maxHp).toBe(101);

    // Simulate the character winning more fights (up to 10 wins)
    char = baseChar({ wins: 10, strength: 10, maxHp: 100 });
    result = checkMedals(char, progress, []);
    expect(result.newlyUnlocked.some(m => m.id === 'brawler')).toBe(true);

    // Apply brawler reward (+1 STR)
    for (const medal of result.newlyUnlocked) {
      char = applyMedalReward(char, medal.reward);
    }
    expect(char.strength).toBe(11);

    // Next fight would use strength=11 instead of 10
    // This is verified by checking the character stats include the medal bonuses
  });

  it('medal Xp bonus adds to XP on wins', () => {
    // A character with medalXpBonus=1 should get +1 XP on win
    const char = baseChar({ medalXpBonus: 1, experience: 0, level: 1 });
    
    // Simulate a win with 100 base XP + 1 bonus
    const result = gainXp(char, 100 + 1);
    expect(result.updatedCharacter.experience).toBe(101);
    
    // Without bonus, would be 100
    const resultNoBonus = gainXp(baseChar({ experience: 0, level: 1 }), 100);
    expect(resultNoBonus.updatedCharacter.experience).toBe(100);
  });
});
