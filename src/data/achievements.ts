// ─── Achievement Types ───────────────────────────────────────────────────────

export type AchievementCategory = 'combat' | 'pve' | 'collection' | 'leveling' | 'equipment' | 'forge' | 'secret';
export type AchievementRewardType = 'title' | 'essence' | 'lootbox' | 'cosmetic' | 'xp_bonus' | 'stat_point';

export interface AchievementReward {
  type: AchievementRewardType;
  label: string;
  value?: number;
  stat?: 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';
  title?: string;
  cosmeticId?: string;
}

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  icon: string;
  target: number;
  reward: AchievementReward;
  hidden?: boolean;
}

export interface AchievementProgress {
  completed: boolean;
  progress: number;
  target: number;
  unlockedAt?: number;
}

export type AchievementProgressMap = Record<string, AchievementProgress>;

// ─── Achievement Definitions ─────────────────────────────────────────────────

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ─── Combat ───────────────────────────────────────────────────────────────
  {
    id: 'first_blood',
    category: 'combat',
    name: 'First Blood',
    description: 'Win your first fight',
    icon: 'sword',
    target: 1,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'warrior_path',
    category: 'combat',
    name: 'Warrior Path',
    description: 'Win 10 fights',
    icon: 'sword',
    target: 10,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'battle_hardened',
    category: 'combat',
    name: 'Battle Hardened',
    description: 'Win 50 fights',
    icon: 'trophy',
    target: 50,
    reward: { type: 'title', label: 'Title "Battle Hardened"', title: 'Battle Hardened' },
  },
  {
    id: 'gladiator',
    category: 'combat',
    name: 'Gladiator',
    description: 'Win 100 fights',
    icon: 'trophy',
    target: 100,
    reward: { type: 'title', label: 'Title "Gladiator"', title: 'Gladiator' },
  },
  {
    id: 'arena_legend',
    category: 'combat',
    name: 'Arena Legend',
    description: 'Win 500 fights',
    icon: 'trophy',
    target: 500,
    reward: { type: 'title', label: 'Title "Arena Legend"', title: 'Arena Legend' },
  },
  {
    id: 'win_streak_3',
    category: 'combat',
    name: 'Win Streak 3',
    description: 'Win 3 fights in a row',
    icon: 'power',
    target: 3,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'win_streak_5',
    category: 'combat',
    name: 'Win Streak 5',
    description: 'Win 5 fights in a row',
    icon: 'power',
    target: 5,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'win_streak_10',
    category: 'combat',
    name: 'Win Streak 10',
    description: 'Win 10 fights in a row',
    icon: 'power',
    target: 10,
    reward: { type: 'title', label: 'Title "Unstoppable"', title: 'Unstoppable' },
  },
  {
    id: 'comeback_king',
    category: 'combat',
    name: 'Comeback King',
    description: 'Win after 2 or more consecutive losses',
    icon: 'luck',
    target: 1,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },

  // ─── PvE ──────────────────────────────────────────────────────────────────
  {
    id: 'pve_beginner',
    category: 'pve',
    name: 'PvE Beginner',
    description: 'Win 10 PvE fights',
    icon: 'monster',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'pve_veteran',
    category: 'pve',
    name: 'PvE Veteran',
    description: 'Win 50 PvE fights',
    icon: 'monster',
    target: 50,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'pve_master',
    category: 'pve',
    name: 'PvE Master',
    description: 'Win 200 PvE fights',
    icon: 'trophy',
    target: 200,
    reward: { type: 'title', label: 'Title "Monster Slayer"', title: 'Monster Slayer' },
  },
  {
    id: 'monster_hunter_goblin',
    category: 'pve',
    name: 'Goblin Hunter',
    description: 'Kill 10 Goblins',
    icon: 'goblin',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'monster_hunter_ogre',
    category: 'pve',
    name: 'Ogre Hunter',
    description: 'Kill 10 Ogres',
    icon: 'ogre',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'monster_hunter_wraith',
    category: 'pve',
    name: 'Wraith Hunter',
    description: 'Kill 10 Wraiths',
    icon: 'wraith',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'bestiary_complete',
    category: 'pve',
    name: 'Bestiary Complete',
    description: 'Kill each monster type at least once',
    icon: 'book',
    target: 1,
    reward: { type: 'title', label: 'Title "Zoologist"', title: 'Zoologist' },
  },

  // ─── Collection ───────────────────────────────────────────────────────────
  {
    id: 'common_collector',
    category: 'collection',
    name: 'Common Collector',
    description: 'Collect 10 common items',
    icon: 'backpack',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'uncommon_collector',
    category: 'collection',
    name: 'Uncommon Collector',
    description: 'Collect 10 uncommon items',
    icon: 'backpack',
    target: 10,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'rare_collector',
    category: 'collection',
    name: 'Rare Collector',
    description: 'Collect 5 rare items',
    icon: 'chest',
    target: 5,
    reward: { type: 'title', label: 'Title "Rare Collector"', title: 'Rare Collector' },
  },
  {
    id: 'epic_collector',
    category: 'collection',
    name: 'Epic Collector',
    description: 'Collect 3 epic items',
    icon: 'chest',
    target: 3,
    reward: { type: 'title', label: 'Title "Epic Seeker"', title: 'Epic Seeker' },
  },
  {
    id: 'legendary_collector',
    category: 'collection',
    name: 'Legendary Collector',
    description: 'Collect 1 legendary item',
    icon: 'chest',
    target: 1,
    reward: { type: 'title', label: 'Title "Legendary"', title: 'Legendary' },
  },

  // ─── Leveling ─────────────────────────────────────────────────────────────
  {
    id: 'novice',
    category: 'leveling',
    name: 'Novice',
    description: 'Reach level 5',
    icon: 'levels',
    target: 5,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'adventurer',
    category: 'leveling',
    name: 'Adventurer',
    description: 'Reach level 10',
    icon: 'levels',
    target: 10,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'veteran',
    category: 'leveling',
    name: 'Veteran',
    description: 'Reach level 20',
    icon: 'trophy',
    target: 20,
    reward: { type: 'title', label: 'Title "Veteran"', title: 'Veteran' },
  },
  {
    id: 'master',
    category: 'leveling',
    name: 'Master',
    description: 'Reach level 50',
    icon: 'trophy',
    target: 50,
    reward: { type: 'title', label: 'Title "Master"', title: 'Master' },
  },
  {
    id: 'xp_collector',
    category: 'leveling',
    name: 'XP Collector',
    description: 'Earn 1000 total XP',
    icon: 'xp',
    target: 1000,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'xp_hoarder',
    category: 'leveling',
    name: 'XP Hoarder',
    description: 'Earn 10000 total XP',
    icon: 'xp',
    target: 10000,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },

  // ─── Equipment ────────────────────────────────────────────────────────────
  {
    id: 'fully_equipped',
    category: 'equipment',
    name: 'Fully Equipped',
    description: 'Equip all 3 equipment slots',
    icon: 'gear',
    target: 3,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'style_points',
    category: 'equipment',
    name: 'Style Points',
    description: 'Equip a full set of rare items',
    icon: 'gear',
    target: 1,
    reward: { type: 'title', label: 'Title "Stylish"', title: 'Stylish' },
  },
  {
    id: 'epic_wardrobe',
    category: 'equipment',
    name: 'Epic Wardrobe',
    description: 'Equip a full set of epic items',
    icon: 'gear',
    target: 1,
    reward: { type: 'title', label: 'Title "Epic Champion"', title: 'Epic Champion' },
  },
  {
    id: 'complete_set',
    category: 'equipment',
    name: 'Complete Set',
    description: 'Equip a full set of legendary items',
    icon: 'gear',
    target: 1,
    reward: { type: 'title', label: 'Title "Legendary Warrior"', title: 'Legendary Warrior' },
  },

  // ─── Forge ────────────────────────────────────────────────────────────────
  {
    id: 'apprentice_smith',
    category: 'forge',
    name: 'Apprentice Smith',
    description: 'Fuse 1 item',
    icon: 'forge',
    target: 1,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'seasoned_smith',
    category: 'forge',
    name: 'Seasoned Smith',
    description: 'Fuse 10 items',
    icon: 'forge',
    target: 10,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'master_smith',
    category: 'forge',
    name: 'Master Smith',
    description: 'Fuse 50 items',
    icon: 'forge',
    target: 50,
    reward: { type: 'title', label: 'Title "Master Smith"', title: 'Master Smith' },
  },
  {
    id: 'salvager',
    category: 'forge',
    name: 'Salvager',
    description: 'Salvage 10 items',
    icon: 'salvage',
    target: 10,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'scrapper',
    category: 'forge',
    name: 'Scrapper',
    description: 'Salvage 100 items',
    icon: 'salvage',
    target: 100,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
  },
  {
    id: 'upgrader',
    category: 'forge',
    name: 'Upgrader',
    description: 'Reach upgrade level +5 on any item',
    icon: 'upgrade',
    target: 5,
    reward: { type: 'title', label: 'Title "Upgrader"', title: 'Upgrader' },
  },

  // ─── Secret ───────────────────────────────────────────────────────────────
  {
    id: 'lucky_break',
    category: 'secret',
    name: 'Lucky Break',
    description: 'Get an epic item from your first lootbox',
    icon: 'dice',
    target: 1,
    reward: { type: 'essence', label: '+200 Essence', value: 200 },
    hidden: true,
  },
  {
    id: 'close_call',
    category: 'secret',
    name: 'Close Call',
    description: 'Win a fight with less than 10 HP remaining',
    icon: 'vitality',
    target: 1,
    reward: { type: 'essence', label: '+100 Essence', value: 100 },
    hidden: true,
  },
  {
    id: 'flawless',
    category: 'secret',
    name: 'Flawless',
    description: 'Win a fight without taking any damage',
    icon: 'dexterity',
    target: 1,
    reward: { type: 'title', label: 'Title "Flawless"', title: 'Flawless' },
    hidden: true,
  },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENT_DEFS.map(a => a.id);
export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = [
  'combat',
  'pve',
  'collection',
  'leveling',
  'equipment',
  'forge',
  'secret',
];
