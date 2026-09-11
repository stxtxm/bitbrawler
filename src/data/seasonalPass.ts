export const PASS_MAX_LEVEL = 20
export const PASS_XP_PER_LEVEL = 100
export const PASS_SEASON_DAYS = 30

export const PASS_XP_SOURCES = {
  fight: 10,
  forge: 15,
  idleClaim: 20,
} as const

export type PassRewardType = 'essence' | 'reroll' | 'pity' | 'biome_token'

export interface PassReward {
  type: PassRewardType
  amount: number
  label: string
}

export interface PassLevel {
  level: number
  xpRequired: number
  reward: PassReward
}

export const PASS_LEVELS: PassLevel[] = [
  { level: 1, xpRequired: 100, reward: { type: 'essence', amount: 5, label: 'Essence x5' } },
  { level: 2, xpRequired: 200, reward: { type: 'reroll', amount: 1, label: 'Reroll shop x1' } },
  { level: 3, xpRequired: 300, reward: { type: 'essence', amount: 10, label: 'Essence x10' } },
  { level: 4, xpRequired: 400, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 5, xpRequired: 500, reward: { type: 'essence', amount: 5, label: 'Essence x5' } },
  { level: 6, xpRequired: 600, reward: { type: 'essence', amount: 10, label: 'Essence x10' } },
  { level: 7, xpRequired: 700, reward: { type: 'reroll', amount: 1, label: 'Reroll shop x1' } },
  { level: 8, xpRequired: 800, reward: { type: 'essence', amount: 15, label: 'Essence x15' } },
  { level: 9, xpRequired: 900, reward: { type: 'essence', amount: 5, label: 'Essence x5' } },
  { level: 10, xpRequired: 1000, reward: { type: 'biome_token', amount: 1, label: 'Biome token x1' } },
  { level: 11, xpRequired: 1100, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 12, xpRequired: 1200, reward: { type: 'essence', amount: 10, label: 'Essence x10' } },
  { level: 13, xpRequired: 1300, reward: { type: 'reroll', amount: 1, label: 'Reroll shop x1' } },
  { level: 14, xpRequired: 1400, reward: { type: 'essence', amount: 15, label: 'Essence x15' } },
  { level: 15, xpRequired: 1500, reward: { type: 'essence', amount: 5, label: 'Essence x5' } },
  { level: 16, xpRequired: 1600, reward: { type: 'essence', amount: 10, label: 'Essence x10' } },
  { level: 17, xpRequired: 1700, reward: { type: 'biome_token', amount: 1, label: 'Biome token x1' } },
  { level: 18, xpRequired: 1800, reward: { type: 'reroll', amount: 1, label: 'Reroll shop x1' } },
  { level: 19, xpRequired: 1900, reward: { type: 'pity', amount: 2, label: 'Pity -2' } },
  { level: 20, xpRequired: 2000, reward: { type: 'essence', amount: 15, label: 'Essence x15' } },
]

export function getPassLevel(xp: number): number {
  if (xp < 0 || !Number.isFinite(xp)) return 0
  const lvl = Math.floor(xp / PASS_XP_PER_LEVEL)
  if (lvl < 0) return 0
  if (lvl > PASS_MAX_LEVEL) return PASS_MAX_LEVEL
  return lvl
}

export function getPassRewards(level: number): PassReward | null {
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return null
  const entry = PASS_LEVELS[level - 1]
  return entry ? entry.reward : null
}

export function getPassLevelDef(level: number): PassLevel | null {
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return null
  return PASS_LEVELS[level - 1] ?? null
}

export function getPassProgress(xp: number): { level: number; nextXp: number | null; progress: number } {
  const level = getPassLevel(xp)
  if (level >= PASS_MAX_LEVEL) {
    return { level, nextXp: null, progress: 1 }
  }
  const nextXp = (level + 1) * PASS_XP_PER_LEVEL
  const currentBase = level * PASS_XP_PER_LEVEL
  const progress = (xp - currentBase) / PASS_XP_PER_LEVEL
  return { level, nextXp, progress: Math.max(0, Math.min(1, progress)) }
}

export function getSeasonWindowForPass(date: Date = new Date()): { seasonId: string; start: Date; end: Date } {
  const SEASON_MS = PASS_SEASON_DAYS * 24 * 60 * 60 * 1000
  const EPOCH = Date.UTC(2026, 0, 1)
  const elapsed = date.getTime() - EPOCH
  const idx = Math.floor(elapsed / SEASON_MS)
  const startMs = EPOCH + idx * SEASON_MS
  const endMs = startMs + SEASON_MS
  return { seasonId: `season-${idx}`, start: new Date(startMs), end: new Date(endMs) }
}
