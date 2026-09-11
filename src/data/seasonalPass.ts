export type PassRewardType = 'essence' | 'reroll' | 'pity' | 'biome_token'

export interface PassReward {
  type: PassRewardType
  amount: number
}

export interface PassTier {
  level: number
  xpRequired: number
  reward: PassReward
}

export const SEASONAL_PASS_TIERS: PassTier[] = [
  { level: 1, xpRequired: 100, reward: { type: 'essence', amount: 5 } },
  { level: 2, xpRequired: 220, reward: { type: 'essence', amount: 10 } },
  { level: 3, xpRequired: 360, reward: { type: 'pity', amount: 2 } },
  { level: 4, xpRequired: 520, reward: { type: 'essence', amount: 5 } },
  { level: 5, xpRequired: 700, reward: { type: 'reroll', amount: 1 } },
  { level: 6, xpRequired: 900, reward: { type: 'essence', amount: 10 } },
  { level: 7, xpRequired: 1120, reward: { type: 'essence', amount: 5 } },
  { level: 8, xpRequired: 1360, reward: { type: 'pity', amount: 2 } },
  { level: 9, xpRequired: 1620, reward: { type: 'essence', amount: 15 } },
  { level: 10, xpRequired: 1900, reward: { type: 'biome_token', amount: 1 } },
  { level: 11, xpRequired: 2200, reward: { type: 'essence', amount: 10 } },
  { level: 12, xpRequired: 2500, reward: { type: 'reroll', amount: 1 } },
  { level: 13, xpRequired: 2800, reward: { type: 'essence', amount: 10 } },
  { level: 14, xpRequired: 3100, reward: { type: 'pity', amount: 2 } },
  { level: 15, xpRequired: 3400, reward: { type: 'essence', amount: 15 } },
  { level: 16, xpRequired: 3700, reward: { type: 'essence', amount: 10 } },
  { level: 17, xpRequired: 4000, reward: { type: 'reroll', amount: 1 } },
  { level: 18, xpRequired: 4300, reward: { type: 'pity', amount: 2 } },
  { level: 19, xpRequired: 4600, reward: { type: 'essence', amount: 15 } },
  { level: 20, xpRequired: 4900, reward: { type: 'biome_token', amount: 1 } },
]

export const PASS_MAX_TIER = SEASONAL_PASS_TIERS.length
export const PASS_MAX_XP = SEASONAL_PASS_TIERS[SEASONAL_PASS_TIERS.length - 1].xpRequired

export function getPassTierForXp(xp: number): number {
  let tier = 0
  for (const t of SEASONAL_PASS_TIERS) {
    if (xp >= t.xpRequired) tier = t.level
    else break
  }
  return tier
}

export function getPassTier(level: number): PassTier | undefined {
  return SEASONAL_PASS_TIERS.find(t => t.level === level)
}

export function getPassProgressPct(xp: number): number {
  if (xp <= 0) return 0
  if (xp >= PASS_MAX_XP) return 100
  return Math.min(100, Math.round((xp / PASS_MAX_XP) * 1000) / 10)
}

export function getNextTierXp(xp: number): number | null {
  for (const t of SEASONAL_PASS_TIERS) {
    if (xp < t.xpRequired) return t.xpRequired
  }
  return null
}

export function getXpToNextTier(xp: number): number {
  const next = getNextTierXp(xp)
  if (next === null) return 0
  return next - xp
}

export const PASS_XP_SOURCES = {
  fight: 25,
  forge: 15,
  idle: 10,
} as const
