import { describe, it, expect } from 'vitest';
import {
  getAchievementDefs,
  getDefaultAchievementProgress,
  checkAchievements,
  calculateCombatAchievements,
  calculatePveAchievements,
  calculateCollectionAchievements,
  calculateLevelingAchievements,
  calculateEquipmentAchievements,
  calculateForgeAchievements,
  applyAchievementReward,
  getCompletedCount,
  getTotalAchievementCount,
  getAchievementsByCategory,
} from '../../utils/achievementUtils';
import { PixelItemAsset, ItemRarity } from '../../types/Item';
import { Character } from '../../types/Character';

const makeItem = (id: string, rarity: ItemRarity = 'common'): PixelItemAsset => ({
  id,
  name: id,
  rarity,
  slot: 'weapon',
  stats: { strength: 1 },
  pixels: [[1]],
  requiredLevel: 1,
});

const makeEquipment = (overrides: Partial<Character['equippedItems']> = {}): Character['equippedItems'] => ({
  weapon: null,
  armor: null,
  accessory: null,
  ...overrides,
});

// ─── getAchievementDefs ──────────────────────────────────────────────────────

describe('getAchievementDefs', () => {
  it('returns at least 30 achievement definitions', () => {
    const defs = getAchievementDefs();
    expect(defs.length).toBeGreaterThanOrEqual(30);
  });

  it('each achievement has required fields', () => {
    const defs = getAchievementDefs();
    for (const achievement of defs) {
      expect(achievement.id).toBeTruthy();
      expect(achievement.name).toBeTruthy();
      expect(achievement.description).toBeTruthy();
      expect(achievement.category).toBeDefined();
      expect(achievement.target).toBeGreaterThan(0);
      expect(achievement.reward).toBeDefined();
      expect(achievement.reward.type).toBeTruthy();
      expect(achievement.reward.label).toBeTruthy();
    }
  });

  it('includes all 7 categories', () => {
    const defs = getAchievementDefs();
    expect(defs.some(a => a.category === 'combat')).toBe(true);
    expect(defs.some(a => a.category === 'pve')).toBe(true);
    expect(defs.some(a => a.category === 'collection')).toBe(true);
    expect(defs.some(a => a.category === 'leveling')).toBe(true);
    expect(defs.some(a => a.category === 'equipment')).toBe(true);
    expect(defs.some(a => a.category === 'forge')).toBe(true);
    expect(defs.some(a => a.category === 'secret')).toBe(true);
  });
});

// ─── getDefaultAchievementProgress ───────────────────────────────────────────

describe('getDefaultAchievementProgress', () => {
  it('returns all achievements with progress 0', () => {
    const progress = getDefaultAchievementProgress();
    const defs = getAchievementDefs();
    for (const def of defs) {
      expect(progress[def.id]).toBeDefined();
      expect(progress[def.id].completed).toBe(false);
      expect(progress[def.id].progress).toBe(0);
      expect(progress[def.id].target).toBe(def.target);
    }
  });

  it('all entries start with completed=false and progress=0', () => {
    const progress = getDefaultAchievementProgress();
    for (const key of Object.keys(progress)) {
      expect(progress[key].completed).toBe(false);
      expect(progress[key].progress).toBe(0);
    }
  });
});

// ─── getCompletedCount / getTotalAchievementCount ────────────────────────────

describe('getCompletedCount', () => {
  it('returns 0 for default progress', () => {
    const progress = getDefaultAchievementProgress();
    expect(getCompletedCount(progress)).toBe(0);
  });

  it('counts completed achievements', () => {
    const progress = getDefaultAchievementProgress();
    progress.first_blood = { completed: true, progress: 1, target: 1 };
    progress.novice = { completed: true, progress: 5, target: 5 };
    expect(getCompletedCount(progress)).toBe(2);
  });
});

describe('getTotalAchievementCount', () => {
  it('matches achievement defs length', () => {
    expect(getTotalAchievementCount()).toBe(getAchievementDefs().length);
  });
});

// ─── getAchievementsByCategory ───────────────────────────────────────────────

describe('getAchievementsByCategory', () => {
  it('groups achievements by category', () => {
    const grouped = getAchievementsByCategory();
    expect(grouped.combat).toBeDefined();
    expect(grouped.pve).toBeDefined();
    expect(grouped.collection).toBeDefined();
    expect(grouped.leveling).toBeDefined();
    expect(grouped.equipment).toBeDefined();
    expect(grouped.forge).toBeDefined();
    expect(grouped.secret).toBeDefined();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(getTotalAchievementCount());
  });
});

// ─── calculateCombatAchievements ─────────────────────────────────────────────

describe('calculateCombatAchievements', () => {
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

  it('returns zero progress for 0 wins', () => {
    const progress = calculateCombatAchievements(baseChar());
    expect(progress.first_blood.completed).toBe(false);
    expect(progress.first_blood.progress).toBe(0);
    expect(progress.warrior_path.completed).toBe(false);
    expect(progress.battle_hardened.completed).toBe(false);
    expect(progress.gladiator.completed).toBe(false);
    expect(progress.arena_legend.completed).toBe(false);
  });

  it('tracks first_blood at 1 win', () => {
    const char = baseChar({ wins: 1 });
    const progress = calculateCombatAchievements(char);
    expect(progress.first_blood.progress).toBe(1);
    expect(progress.first_blood.completed).toBe(true);
  });

  it('tracks warrior_path at 10 wins', () => {
    const char = baseChar({ wins: 10 });
    const progress = calculateCombatAchievements(char);
    expect(progress.warrior_path.progress).toBe(10);
    expect(progress.warrior_path.completed).toBe(true);
  });

  it('tracks battle_hardened at 50 wins', () => {
    const char = baseChar({ wins: 50 });
    const progress = calculateCombatAchievements(char);
    expect(progress.battle_hardened.progress).toBe(50);
    expect(progress.battle_hardened.completed).toBe(true);
  });

  it('tracks gladiator at 100 wins', () => {
    const char = baseChar({ wins: 100 });
    const progress = calculateCombatAchievements(char);
    expect(progress.gladiator.progress).toBe(100);
    expect(progress.gladiator.completed).toBe(true);
  });

  it('tracks arena_legend at 500 wins', () => {
    const char = baseChar({ wins: 500 });
    const progress = calculateCombatAchievements(char);
    expect(progress.arena_legend.progress).toBe(500);
    expect(progress.arena_legend.completed).toBe(true);
  });

  it('tracks win_streak_3 at 3 consecutive wins', () => {
    const history = Array.from({ length: 3 }, (_, i) => ({
      date: Date.now() - i * 60000,
      opponentName: `Bot${i}`,
      won: true,
    }));
    const char = baseChar({ wins: 3, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.win_streak_3.progress).toBe(3);
    expect(progress.win_streak_3.completed).toBe(true);
  });

  it('tracks win_streak_5 at 5 consecutive wins', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      date: Date.now() - i * 60000,
      opponentName: `Bot${i}`,
      won: true,
    }));
    const char = baseChar({ wins: 5, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.win_streak_5.progress).toBe(5);
    expect(progress.win_streak_5.completed).toBe(true);
  });

  it('tracks win_streak_10 at 10 consecutive wins', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      date: Date.now() - i * 60000,
      opponentName: `Bot${i}`,
      won: true,
    }));
    const char = baseChar({ wins: 10, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.win_streak_10.progress).toBe(10);
    expect(progress.win_streak_10.completed).toBe(true);
  });

  it('resets win streak progress if last fight was a loss', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: false },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: true },
      { date: Date.now() - 130000, opponentName: 'Bot3', won: true },
    ];
    const char = baseChar({ wins: 2, losses: 1, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.win_streak_3.progress).toBe(0);
    expect(progress.win_streak_3.completed).toBe(false);
  });

  it('tracks comeback_king for wins after 2+ loss streak', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: true },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: false },
      { date: Date.now() - 130000, opponentName: 'Bot3', won: false },
    ];
    const char = baseChar({ wins: 1, losses: 2, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.comeback_king.progress).toBe(1);
    expect(progress.comeback_king.completed).toBe(true);
  });

  it('does not count comeback_king for single loss then win', () => {
    const history = [
      { date: Date.now() - 10000, opponentName: 'Bot1', won: true },
      { date: Date.now() - 70000, opponentName: 'Bot2', won: false },
    ];
    const char = baseChar({ wins: 1, losses: 1, fightHistory: history });
    const progress = calculateCombatAchievements(char);
    expect(progress.comeback_king.progress).toBe(0);
    expect(progress.comeback_king.completed).toBe(false);
  });
});

// ─── calculatePveAchievements ────────────────────────────────────────────────

describe('calculatePveAchievements', () => {
  it('tracks pve_beginner at 10 wins', () => {
    const progress = calculatePveAchievements(10, {});
    expect(progress.pve_beginner.progress).toBe(10);
    expect(progress.pve_beginner.completed).toBe(true);
  });

  it('tracks pve_veteran at 50 wins', () => {
    const progress = calculatePveAchievements(50, {});
    expect(progress.pve_veteran.progress).toBe(50);
    expect(progress.pve_veteran.completed).toBe(true);
  });

  it('tracks pve_master at 200 wins', () => {
    const progress = calculatePveAchievements(200, {});
    expect(progress.pve_master.progress).toBe(200);
    expect(progress.pve_master.completed).toBe(true);
  });

  it('tracks monster_hunter_goblin at 10 kills', () => {
    const progress = calculatePveAchievements(0, { GOBLIN: 10 });
    expect(progress.monster_hunter_goblin.progress).toBe(10);
    expect(progress.monster_hunter_goblin.completed).toBe(true);
  });

  it('tracks monster_hunter_ogre at 10 kills', () => {
    const progress = calculatePveAchievements(0, { OGRE: 10 });
    expect(progress.monster_hunter_ogre.progress).toBe(10);
    expect(progress.monster_hunter_ogre.completed).toBe(true);
  });

  it('tracks monster_hunter_wraith at 10 kills', () => {
    const progress = calculatePveAchievements(0, { WRAITH: 10 });
    expect(progress.monster_hunter_wraith.progress).toBe(10);
    expect(progress.monster_hunter_wraith.completed).toBe(true);
  });

  it('tracks bestiary_complete when all monster types killed', () => {
    const progress = calculatePveAchievements(0, { GOBLIN: 1, OGRE: 1, WRAITH: 1 });
    expect(progress.bestiary_complete.progress).toBe(1);
    expect(progress.bestiary_complete.completed).toBe(true);
  });

  it('does not complete bestiary_complete if a monster type is missing', () => {
    const progress = calculatePveAchievements(0, { GOBLIN: 1, OGRE: 1 });
    expect(progress.bestiary_complete.completed).toBe(false);
  });
});

// ─── calculateCollectionAchievements ─────────────────────────────────────────

describe('calculateCollectionAchievements', () => {
  it('tracks common_collector at 10 common items', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(`common_${i}`, 'common'));
    const progress = calculateCollectionAchievements(items.map(i => i.id), items);
    expect(progress.common_collector.progress).toBe(10);
    expect(progress.common_collector.completed).toBe(true);
  });

  it('tracks uncommon_collector at 10 uncommon items', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(`uncommon_${i}`, 'uncommon'));
    const progress = calculateCollectionAchievements(items.map(i => i.id), items);
    expect(progress.uncommon_collector.progress).toBe(10);
    expect(progress.uncommon_collector.completed).toBe(true);
  });

  it('tracks rare_collector at 5 rare items', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem(`rare_${i}`, 'rare'));
    const progress = calculateCollectionAchievements(items.map(i => i.id), items);
    expect(progress.rare_collector.progress).toBe(5);
    expect(progress.rare_collector.completed).toBe(true);
  });

  it('tracks epic_collector at 3 epic items', () => {
    const items = Array.from({ length: 3 }, (_, i) => makeItem(`epic_${i}`, 'epic'));
    const progress = calculateCollectionAchievements(items.map(i => i.id), items);
    expect(progress.epic_collector.progress).toBe(3);
    expect(progress.epic_collector.completed).toBe(true);
  });

  it('tracks legendary_collector at 1 legendary item', () => {
    const items = [makeItem('legendary_1', 'legendary')];
    const progress = calculateCollectionAchievements(items.map(i => i.id), items);
    expect(progress.legendary_collector.progress).toBe(1);
    expect(progress.legendary_collector.completed).toBe(true);
  });

  it('returns 0 progress for all collectors with empty inventory', () => {
    const progress = calculateCollectionAchievements([], []);
    expect(progress.common_collector.progress).toBe(0);
    expect(progress.common_collector.completed).toBe(false);
    expect(progress.uncommon_collector.progress).toBe(0);
    expect(progress.rare_collector.progress).toBe(0);
    expect(progress.epic_collector.progress).toBe(0);
    expect(progress.legendary_collector.progress).toBe(0);
  });
});

// ─── calculateLevelingAchievements ───────────────────────────────────────────

describe('calculateLevelingAchievements', () => {
  it('tracks novice at level 5', () => {
    const progress = calculateLevelingAchievements(5, 0);
    expect(progress.novice.progress).toBe(5);
    expect(progress.novice.completed).toBe(true);
  });

  it('tracks adventurer at level 10', () => {
    const progress = calculateLevelingAchievements(10, 0);
    expect(progress.adventurer.progress).toBe(10);
    expect(progress.adventurer.completed).toBe(true);
  });

  it('tracks veteran at level 20', () => {
    const progress = calculateLevelingAchievements(20, 0);
    expect(progress.veteran.progress).toBe(20);
    expect(progress.veteran.completed).toBe(true);
  });

  it('tracks master at level 50', () => {
    const progress = calculateLevelingAchievements(50, 0);
    expect(progress.master.progress).toBe(50);
    expect(progress.master.completed).toBe(true);
  });

  it('tracks xp_collector at 1000 XP', () => {
    const progress = calculateLevelingAchievements(1, 1000);
    expect(progress.xp_collector.progress).toBe(1000);
    expect(progress.xp_collector.completed).toBe(true);
    expect(progress.xp_hoarder.completed).toBe(false);
  });

  it('tracks xp_hoarder at 10000 XP', () => {
    const progress = calculateLevelingAchievements(1, 10000);
    expect(progress.xp_hoarder.progress).toBe(10000);
    expect(progress.xp_hoarder.completed).toBe(true);
  });
});

// ─── calculateEquipmentAchievements ──────────────────────────────────────────

describe('calculateEquipmentAchievements', () => {
  it('tracks fully_equipped with all 3 slots filled', () => {
    const equipped = makeEquipment({ weapon: 'sword', armor: 'shield', accessory: 'ring' });
    const progress = calculateEquipmentAchievements(equipped);
    expect(progress.fully_equipped.progress).toBe(3);
    expect(progress.fully_equipped.completed).toBe(true);
  });

  it('does not complete fully_equipped with only 2 slots', () => {
    const equipped = makeEquipment({ weapon: 'sword', armor: 'shield' });
    const progress = calculateEquipmentAchievements(equipped);
    expect(progress.fully_equipped.progress).toBe(2);
    expect(progress.fully_equipped.completed).toBe(false);
  });

  it('completes style_points with full rare set', () => {
    const items = [
      makeItem('rare_weapon', 'rare'),
      makeItem('rare_armor', 'rare'),
      makeItem('rare_acc', 'rare'),
    ];
    const equipped = makeEquipment({ weapon: 'rare_weapon', armor: 'rare_armor', accessory: 'rare_acc' });
    const progress = calculateEquipmentAchievements(equipped, items);
    expect(progress.style_points.completed).toBe(true);
  });

  it('completes epic_wardrobe with full epic set', () => {
    const items = [
      makeItem('epic_weapon', 'epic'),
      makeItem('epic_armor', 'epic'),
      makeItem('epic_acc', 'epic'),
    ];
    const equipped = makeEquipment({ weapon: 'epic_weapon', armor: 'epic_armor', accessory: 'epic_acc' });
    const progress = calculateEquipmentAchievements(equipped, items);
    expect(progress.epic_wardrobe.completed).toBe(true);
  });

  it('completes complete_set with full legendary set', () => {
    const items = [
      makeItem('leg_weapon', 'legendary'),
      makeItem('leg_armor', 'legendary'),
      makeItem('leg_acc', 'legendary'),
    ];
    const equipped = makeEquipment({ weapon: 'leg_weapon', armor: 'leg_armor', accessory: 'leg_acc' });
    const progress = calculateEquipmentAchievements(equipped, items);
    expect(progress.complete_set.completed).toBe(true);
  });

  it('does not complete any full set achievements with empty slots', () => {
    const progress = calculateEquipmentAchievements(makeEquipment());
    expect(progress.style_points.completed).toBe(false);
    expect(progress.epic_wardrobe.completed).toBe(false);
    expect(progress.complete_set.completed).toBe(false);
  });
});

// ─── calculateForgeAchievements ──────────────────────────────────────────────

describe('calculateForgeAchievements', () => {
  it('tracks apprentice_smith at 1 fusion', () => {
    const progress = calculateForgeAchievements(1, 0, 0);
    expect(progress.apprentice_smith.progress).toBe(1);
    expect(progress.apprentice_smith.completed).toBe(true);
  });

  it('tracks seasoned_smith at 10 fusions', () => {
    const progress = calculateForgeAchievements(10, 0, 0);
    expect(progress.seasoned_smith.progress).toBe(10);
    expect(progress.seasoned_smith.completed).toBe(true);
  });

  it('tracks master_smith at 50 fusions', () => {
    const progress = calculateForgeAchievements(50, 0, 0);
    expect(progress.master_smith.progress).toBe(50);
    expect(progress.master_smith.completed).toBe(true);
  });

  it('tracks salvager at 10 salvage', () => {
    const progress = calculateForgeAchievements(0, 10, 0);
    expect(progress.salvager.progress).toBe(10);
    expect(progress.salvager.completed).toBe(true);
  });

  it('tracks scrapper at 100 salvage', () => {
    const progress = calculateForgeAchievements(0, 100, 0);
    expect(progress.scrapper.progress).toBe(100);
    expect(progress.scrapper.completed).toBe(true);
  });

  it('tracks upgrader at upgrade +5', () => {
    const progress = calculateForgeAchievements(0, 0, 5);
    expect(progress.upgrader.progress).toBe(5);
    expect(progress.upgrader.completed).toBe(true);
  });

  it('does not complete any forge achievements at zero', () => {
    const progress = calculateForgeAchievements(0, 0, 0);
    expect(Object.values(progress).every(p => p.completed === false)).toBe(true);
  });
});

// ─── checkAchievements ───────────────────────────────────────────────────────

describe('checkAchievements', () => {
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

  it('returns newly unlocked when progress crosses threshold', () => {
    const char = baseChar({ wins: 1 });
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, []);
    expect(result.newlyUnlocked.some(a => a.id === 'first_blood')).toBe(true);
    expect(result.progress.first_blood.completed).toBe(true);
    expect(result.progress.first_blood.progress).toBe(1);
  });

  it('returns empty newlyUnlocked if no achievements progress', () => {
    const char = baseChar({ wins: 0 });
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, []);
    expect(result.newlyUnlocked).toHaveLength(0);
  });

  it('does NOT return already-unlocked achievements', () => {
    const char = baseChar({ wins: 10 });
    const progress = getDefaultAchievementProgress();
    progress.first_blood = { completed: true, progress: 1, target: 1, unlockedAt: 100 };
    progress.warrior_path = { completed: true, progress: 10, target: 10, unlockedAt: 200 };
    const result = checkAchievements(char, progress, []);
    const newIds = result.newlyUnlocked.map(a => a.id);
    expect(newIds).not.toContain('first_blood');
    expect(newIds).not.toContain('warrior_path');
  });

  it('unlocks multiple achievements at once', () => {
    const char = baseChar({ wins: 10 });
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, []);
    expect(result.newlyUnlocked.some(a => a.id === 'first_blood')).toBe(true);
    expect(result.newlyUnlocked.some(a => a.id === 'warrior_path')).toBe(true);
  });

  it('uses extra context for PvE achievements', () => {
    const char = baseChar();
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, [], {
      pveWins: 10,
    });
    expect(result.newlyUnlocked.some(a => a.id === 'pve_beginner')).toBe(true);
  });

  it('unlocks secret achievements from extra context', () => {
    const char = baseChar();
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, [], {
      glassCannonFight: true,
    });
    expect(result.newlyUnlocked.some(a => a.id === 'close_call')).toBe(true);
  });

  it('unlocks forge achievements from extra context', () => {
    const char = baseChar();
    const progress = getDefaultAchievementProgress();
    const result = checkAchievements(char, progress, [], {
      fusionCount: 1,
    });
    expect(result.newlyUnlocked.some(a => a.id === 'apprentice_smith')).toBe(true);
  });

  it('merges previous progress with updated progress', () => {
    const char = baseChar({ wins: 5 });
    const progress = getDefaultAchievementProgress();
    progress.first_blood = { completed: true, progress: 1, target: 1, unlockedAt: 100 };

    const result = checkAchievements(char, progress, []);
    expect(result.progress.first_blood.completed).toBe(true);
    expect(result.progress.first_blood.progress).toBe(1);
    expect(result.progress.warrior_path.progress).toBe(5);
  });
});

// ─── applyAchievementReward ──────────────────────────────────────────────────

describe('applyAchievementReward', () => {
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
    essence: 0,
  });

  it('applies essence reward correctly', () => {
    const defs = getAchievementDefs();
    const firstBlood = defs.find(a => a.id === 'first_blood')!;
    const char = applyAchievementReward(baseChar(), firstBlood.reward);
    expect(char.essence).toBe(50);
    expect(char.achievementEssenceBonus).toBe(50);
  });

  it('applies essence reward cumulatively', () => {
    const char = baseChar();
    const defs = getAchievementDefs();
    const firstBlood = defs.find(a => a.id === 'first_blood')!;
    const warriorPath = defs.find(a => a.id === 'warrior_path')!;
    const char1 = applyAchievementReward(char, firstBlood.reward);
    const char2 = applyAchievementReward(char1, warriorPath.reward);
    expect(char2.essence).toBe(150);
    expect(char2.achievementEssenceBonus).toBe(150);
  });

  it('applies title reward correctly', () => {
    const defs = getAchievementDefs();
    const battleHardened = defs.find(a => a.id === 'battle_hardened')!;
    const char = applyAchievementReward(baseChar(), battleHardened.reward);
    expect(char.achievementTitle).toBe('Battle Hardened');
  });

  it('applies xp_bonus reward correctly', () => {
    const char = baseChar();
    const reward = { type: 'xp_bonus' as const, label: '+1 XP per win', value: 1 };
    const updated = applyAchievementReward(char, reward);
    expect(updated.achievementXpBonus).toBe(1);
  });

  it('applies xp_bonus reward cumulatively', () => {
    const char = baseChar();
    const reward = { type: 'xp_bonus' as const, label: '+1 XP per win', value: 1 };
    const char2 = applyAchievementReward(char, reward);
    const char3 = applyAchievementReward(char2, reward);
    expect(char3.achievementXpBonus).toBe(2);
  });

  it('applies lootbox reward correctly', () => {
    const char = baseChar();
    const reward = { type: 'lootbox' as const, label: 'Bonus lootbox' };
    const updated = applyAchievementReward(char, reward);
    expect(updated.achievementCosmetics).toContain('bonus_lootbox');
  });

  it('does not duplicate lootbox cosmetic flag', () => {
    const char = baseChar();
    const reward = { type: 'lootbox' as const, label: 'Bonus lootbox' };
    const updated = applyAchievementReward(char, reward);
    const updated2 = applyAchievementReward(updated, reward);
    expect(updated2.achievementCosmetics).toEqual(['bonus_lootbox']);
  });

  it('applies stat_point reward correctly', () => {
    const char = baseChar();
    const reward = { type: 'stat_point' as const, label: '+1 STR', value: 1, stat: 'strength' as const };
    const updated = applyAchievementReward(char, reward);
    expect(updated.strength).toBe(11);
  });

  it('applies cosmetic reward correctly', () => {
    const char = baseChar();
    const reward = { type: 'cosmetic' as const, label: 'Aura', cosmeticId: 'golden_aura' };
    const updated = applyAchievementReward(char, reward);
    expect(updated.achievementCosmetics).toContain('golden_aura');
  });
});
