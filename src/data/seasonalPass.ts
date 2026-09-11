import type { Character } from '../types/Character';

export type PassRewardType = 'essence' | 'reroll' | 'pity' | 'biome_token';

export interface PassReward {
  type: PassRewardType;
  amount: number;
  label: string;
}

export interface PassTier {
  level: number;
  xpRequired: number;
  reward: PassReward;
}

export const PASS_TIERS: PassTier[] = [
  { level: 1, xpRequired: 3, reward: { type: 'essence', amount: 5, label: '5 Essence' } },
  { level: 2, xpRequired: 6, reward: { type: 'essence', amount: 10, label: '10 Essence' } },
  { level: 3, xpRequired: 9, reward: { type: 'reroll', amount: 1, label: 'Shop Reroll' } },
  { level: 4, xpRequired: 12, reward: { type: 'essence', amount: 15, label: '15 Essence' } },
  { level: 5, xpRequired: 15, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 6, xpRequired: 18, reward: { type: 'biome_token', amount: 1, label: 'Biome Token' } },
  { level: 7, xpRequired: 21, reward: { type: 'essence', amount: 10, label: '10 Essence' } },
  { level: 8, xpRequired: 24, reward: { type: 'essence', amount: 5, label: '5 Essence' } },
  { level: 9, xpRequired: 27, reward: { type: 'reroll', amount: 1, label: 'Shop Reroll' } },
  { level: 10, xpRequired: 30, reward: { type: 'essence', amount: 15, label: '15 Essence' } },
  { level: 11, xpRequired: 33, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 12, xpRequired: 36, reward: { type: 'biome_token', amount: 1, label: 'Biome Token' } },
  { level: 13, xpRequired: 39, reward: { type: 'essence', amount: 10, label: '10 Essence' } },
  { level: 14, xpRequired: 42, reward: { type: 'essence', amount: 5, label: '5 Essence' } },
  { level: 15, xpRequired: 45, reward: { type: 'reroll', amount: 1, label: 'Shop Reroll' } },
  { level: 16, xpRequired: 48, reward: { type: 'essence', amount: 15, label: '15 Essence' } },
  { level: 17, xpRequired: 51, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 18, xpRequired: 54, reward: { type: 'biome_token', amount: 1, label: 'Biome Token' } },
  { level: 19, xpRequired: 57, reward: { type: 'essence', amount: 10, label: '10 Essence' } },
  { level: 20, xpRequired: 60, reward: { type: 'essence', amount: 15, label: '15 Essence' } },
];

export function getPassTier(level: number): PassTier | undefined {
  return PASS_TIERS.find((t) => t.level === level);
}

export function getPassLevel(xp: number): number {
  let lvl = 0;
  for (const tier of PASS_TIERS) {
    if (xp >= tier.xpRequired) lvl = tier.level;
    else break;
  }
  return lvl;
}

export function getPassRewards(level: number): PassReward | null {
  const tier = getPassTier(level);
  return tier ? tier.reward : null;
}

export function getNextTierXp(xp: number): number | null {
  for (const tier of PASS_TIERS) {
    if (xp < tier.xpRequired) return tier.xpRequired;
  }
  return null;
}

export function getProgressPct(xp: number): number {
  const maxXp = PASS_TIERS[PASS_TIERS.length - 1].xpRequired;
  if (maxXp <= 0) return 0;
  return Math.min(100, (xp / maxXp) * 100);
}

export function calculatePassXp(character: Character): number {
  const stored = character.passProgress?.xp;
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    const fallback = (character.wins ?? 0) + (character.losses ?? 0) + (character.idleTotalKills ?? 0);
    return Math.max(stored, fallback);
  }
  return (character.wins ?? 0) + (character.losses ?? 0) + (character.idleTotalKills ?? 0);
}
