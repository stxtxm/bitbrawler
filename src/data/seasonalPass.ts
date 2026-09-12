// === MASTER base (linear) ===
export const PASS_SEASON_DAYS = 30
export const PASS_MAX_LEVEL = 20
export const PASS_XP_PER_LEVEL = 100

export const PASS_XP_PER_FIGHT = 10
export const PASS_XP_PER_FORGE = 5
export const PASS_XP_PER_IDLE_CLAIM = 15

export type PassRewardType = 'essence' | 'reroll' | 'pity' | 'biome_token'

export interface PassReward {
  level: number
  type: PassRewardType
  amount?: number
  label: string
}

export const PASS_REWARDS: PassReward[] = [
  { level: 1, type: 'essence', amount: 5, label: '5 Essence' },
  { level: 2, type: 'essence', amount: 10, label: '10 Essence' },
  { level: 3, type: 'reroll', amount: 1, label: 'Reroll Shop' },
  { level: 4, type: 'essence', amount: 5, label: '5 Essence' },
  { level: 5, type: 'pity', amount: 2, label: 'Pity -2' },
  { level: 6, type: 'essence', amount: 15, label: '15 Essence' },
  { level: 7, type: 'essence', amount: 10, label: '10 Essence' },
  { level: 8, type: 'reroll', amount: 1, label: 'Reroll Shop' },
  { level: 9, type: 'essence', amount: 15, label: '15 Essence' },
  { level: 10, type: 'biome_token', amount: 1, label: 'Biome Token' },
  { level: 11, type: 'essence', amount: 5, label: '5 Essence' },
  { level: 12, type: 'pity', amount: 2, label: 'Pity -2' },
  { level: 13, type: 'essence', amount: 10, label: '10 Essence' },
  { level: 14, type: 'reroll', amount: 1, label: 'Reroll Shop' },
  { level: 15, type: 'essence', amount: 15, label: '15 Essence' },
  { level: 16, type: 'essence', amount: 5, label: '5 Essence' },
  { level: 17, type: 'pity', amount: 2, label: 'Pity -2' },
  { level: 18, type: 'essence', amount: 10, label: '10 Essence' },
  { level: 19, type: 'reroll', amount: 1, label: 'Reroll Shop' },
  { level: 20, type: 'biome_token', amount: 1, label: 'Biome Token' },
]

export function getPassThreshold(level: number): number {
  if (level <= 0) return 0
  if (level > PASS_MAX_LEVEL) return PASS_MAX_LEVEL * PASS_XP_PER_LEVEL
  return level * PASS_XP_PER_LEVEL
}

export function getPassLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp <= 0) return 0
  const lvl = Math.floor(xp / PASS_XP_PER_LEVEL)
  return Math.min(lvl, PASS_MAX_LEVEL)
}

export function getPassRewards(level: number): PassReward | null {
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return null
  return PASS_REWARDS.find(r => r.level === level) ?? null
}

export function getPassProgress(xp: number): { level: number; xpIntoLevel: number; xpForNext: number; percent: number } {
  const level = getPassLevel(xp)
  const xpIntoLevel = Math.max(0, xp - level * PASS_XP_PER_LEVEL)
  const isMax = level >= PASS_MAX_LEVEL
  const xpForNext = isMax ? 0 : PASS_XP_PER_LEVEL - xpIntoLevel
  const percent = isMax ? 100 : Math.min(100, Math.max(0, (xpIntoLevel / PASS_XP_PER_LEVEL) * 100))
  return { level, xpIntoLevel, xpForNext, percent }
}

export function canClaimPassReward(level: number, xp: number, claimed: number[]): boolean {
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return false
  if (claimed.includes(level)) return false
  return getPassLevel(xp) >= level
}

export function getClaimableRewards(xp: number, claimed: number[]): PassReward[] {
  const lvl = getPassLevel(xp)
  return PASS_REWARDS.filter(r => r.level <= lvl && !claimed.includes(r.level))
}

// === PR #951 additions (progressive tiers) ===
export interface PassTier {
  level: number
  xpRequired: number
  reward: { type: PassRewardType; amount: number }
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
