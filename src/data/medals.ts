export type MedalCategory = 'combat' | 'loot' | 'progression' | 'special';
export type MedalRewardType = 'hp' | 'stat_point' | 'inventory_slot' | 'xp_bonus' | 'title' | 'aura';
export type MedalStat = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

export interface MedalReward {
  type: MedalRewardType;
  label: string;
  stat?: MedalStat;
  value?: number;
}

export interface MedalDef {
  id: string;
  category: MedalCategory;
  name: string;
  description: string;
  condition: string;
  icon: string;
  requiredProgress: number;
  reward: MedalReward;
  hidden?: boolean;
}

export interface MedalProgress {
  completed: boolean;
  progress: number;
  unlockedAt?: number;
}

export type MedalProgressMap = Record<string, MedalProgress>;

export const MEDAL_DEFS: MedalDef[] = [
  // ─── Combat Medals ───────────────────────────────────────────────────────
  {
    id: 'first_blood',
    category: 'combat',
    name: 'First Blood',
    description: 'Win your first fight in the arena',
    condition: 'Win 1 fight',
    icon: 'sword',
    requiredProgress: 1,
    reward: { type: 'hp', label: '+1 permanent HP', value: 1 },
  },
  {
    id: 'brawler',
    category: 'combat',
    name: 'Brawler',
    description: 'Prove yourself as a real brawler',
    condition: 'Win 10 fights total',
    icon: 'strength',
    requiredProgress: 10,
    reward: { type: 'stat_point', label: '+1 permanent STR', stat: 'strength', value: 1 },
  },
  {
    id: 'warrior',
    category: 'combat',
    name: 'Warrior',
    description: 'Earn the name of warrior through countless battles',
    condition: 'Win 50 fights total',
    icon: 'trophy',
    requiredProgress: 50,
    reward: { type: 'stat_point', label: '+1 permanent VIT', stat: 'vitality', value: 1 },
  },
  {
    id: 'legend',
    category: 'combat',
    name: 'Legend',
    description: 'Become a living legend of the arena',
    condition: 'Win 100 fights total',
    icon: 'trophy',
    requiredProgress: 100,
    reward: { type: 'title', label: 'Permanent title "The Legend"' },
  },
  {
    id: 'unstoppable',
    category: 'combat',
    name: 'Unstoppable',
    description: 'Chain victories together',
    condition: 'Win 5 fights in a row',
    icon: 'power',
    requiredProgress: 5,
    reward: { type: 'stat_point', label: '+1 permanent DEX', stat: 'dexterity', value: 1 },
  },
  {
    id: 'comeback_king',
    category: 'combat',
    name: 'Comeback King',
    description: 'Defy the odds and turn the tide',
    condition: 'Win after losing 2+ in a row',
    icon: 'luck',
    requiredProgress: 1,
    reward: { type: 'stat_point', label: '+1 permanent LUK', stat: 'luck', value: 1 },
  },

  // ─── Loot Medals ─────────────────────────────────────────────────────────
  {
    id: 'collector',
    category: 'loot',
    name: 'Collector',
    description: 'Assemble a collection of unique items',
    condition: 'Collect 10 unique items',
    icon: 'backpack',
    requiredProgress: 10,
    reward: { type: 'inventory_slot', label: '+1 inventory slot', value: 1 },
  },
  {
    id: 'rare_hunter',
    category: 'loot',
    name: 'Rare Hunter',
    description: 'Track down rare and powerful gear',
    condition: 'Collect 3 rare items',
    icon: 'chest',
    requiredProgress: 3,
    reward: { type: 'stat_point', label: '+1 permanent INT', stat: 'intelligence', value: 1 },
  },
  {
    id: 'epic_seeker',
    category: 'loot',
    name: 'Epic Seeker',
    description: 'Claim an epic item of legend',
    condition: 'Collect 1 epic item',
    icon: 'chest',
    requiredProgress: 1,
    reward: { type: 'stat_point', label: '+1 permanent FOC', stat: 'focus', value: 1 },
  },
  {
    id: 'fully_equipped',
    category: 'loot',
    name: 'Fully Equipped',
    description: 'Fill all your equipment slots',
    condition: 'Equip all 3 slots simultaneously',
    icon: 'gear',
    requiredProgress: 3,
    reward: { type: 'inventory_slot', label: '+1 inventory slot', value: 1 },
  },

  // ─── Progression Medals ──────────────────────────────────────────────────
  {
    id: 'growing_strong',
    category: 'progression',
    name: 'Growing Strong',
    description: 'Reach level 5 and grow in power',
    condition: 'Reach level 5',
    icon: 'levels',
    requiredProgress: 5,
    reward: { type: 'hp', label: '+5 permanent HP', value: 5 },
  },
  {
    id: 'peak_performance',
    category: 'progression',
    name: 'Peak Performance',
    description: 'Push your limits to new heights',
    condition: 'Reach level 10',
    icon: 'levels',
    requiredProgress: 10,
    reward: { type: 'stat_point', label: '+1 to all stats', value: 1 },
  },
  {
    id: 'level_master',
    category: 'progression',
    name: 'Level Master',
    description: 'Master the art of leveling',
    condition: 'Reach level 20',
    icon: 'trophy',
    requiredProgress: 20,
    reward: { type: 'aura', label: 'Permanent pixel aura effect' },
  },
  {
    id: 'veteran',
    category: 'progression',
    name: 'Veteran',
    description: 'Show up day after day',
    condition: 'Complete 10 daily sessions',
    icon: 'updates',
    requiredProgress: 10,
    reward: { type: 'xp_bonus', label: '+1 bonus XP on every win', value: 1 },
  },

  // ─── Special Medals ──────────────────────────────────────────────────────
  {
    id: 'lucky_day',
    category: 'special',
    name: 'Lucky Day',
    description: 'Strike it rich on your very first lootbox',
    condition: 'Get an epic item from first lootbox',
    icon: 'dice',
    requiredProgress: 1,
    reward: { type: 'stat_point', label: '+1 permanent LUK', stat: 'luck', value: 1 },
    hidden: true,
  },
  {
    id: 'glass_cannon',
    category: 'special',
    name: 'Glass Cannon',
    description: 'Win by the skin of your teeth',
    condition: 'Win a fight with <10 HP remaining',
    icon: 'vitality',
    requiredProgress: 1,
    reward: { type: 'stat_point', label: '+1 permanent STR', stat: 'strength', value: 1 },
    hidden: true,
  },
  {
    id: 'pacifist',
    category: 'special',
    name: 'Pacifist',
    description: 'Win without taking a single point of damage',
    condition: 'Win a fight with 0 damage taken',
    icon: 'dexterity',
    requiredProgress: 1,
    reward: { type: 'stat_point', label: '+1 permanent VIT', stat: 'vitality', value: 1 },
    hidden: true,
  },
];

export const MEDAL_IDS = MEDAL_DEFS.map(m => m.id);
export const MEDAL_CATEGORIES: MedalCategory[] = ['combat', 'loot', 'progression', 'special'];
