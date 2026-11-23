import type { StreakLadderTier } from '../utils/streakLadderUtils';

export interface StreakLadderTierMeta {
  id: StreakLadderTier;
  label: string;
  icon: string;
  color: string;
  cosmetic: string;
}

export const STREAK_LADDER_TIERS: Record<StreakLadderTier, StreakLadderTierMeta> = {
  gold: {
    id: 'gold',
    label: 'OR',
    icon: '🥇',
    color: '#ffd700',
    cosmetic: 'GOLDEN BRAWLER',
  },
  silver: {
    id: 'silver',
    label: 'ARGENT',
    icon: '🥈',
    color: '#c0c0c0',
    cosmetic: 'SILVER BRAWLER',
  },
  bronze: {
    id: 'bronze',
    label: 'BRONZE',
    icon: '🥉',
    color: '#cd7f32',
    cosmetic: 'BRONZE BRAWLER',
  },
};

export const STREAK_LADDER_DESCRIPTION =
  'Classement hebdomadaire sur ta streak de lootbox. Top 10% OR, top 25% ARGENT, top 50% BRONZE.';
