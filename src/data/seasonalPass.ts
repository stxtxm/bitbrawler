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
