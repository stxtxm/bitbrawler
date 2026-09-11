import { GAME_RULES } from '../config/gameRules'
import { getZonedParts } from '../utils/timezoneUtils'

export const SEASON_DURATION_DAYS = 30
export const BURST_START_HOUR = 18
export const BURST_WINDOW_HOURS = 72

export type SurgeId = 'plains' | 'volcanic' | 'abyssal'
export type BurstMutatorId = 'offense' | 'defense' | 'xp'

export interface BurstMutatorOption {
  id: BurstMutatorId
  label: string
  description: string
}

export const BURST_MUTATORS: BurstMutatorOption[] = [
  { id: 'offense', label: '⚔️ Rage', description: '+10% offense' },
  { id: 'defense', label: '🛡️ Fortify', description: '-10% defense' },
  { id: 'xp', label: '✨ Focus', description: '+15% xp' },
]

const BIOME_CYCLE: SurgeId[] = ['plains', 'volcanic', 'abyssal']

const SEASON_ANCHOR_UTC = Date.UTC(2026, 8, 1, 0, 0, 0)

function getParisWeekday(date: Date): number {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short' })
  const part = fmt.formatToParts(date).find(p => p.type === 'weekday')?.value ?? 'Mon'
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }
  return map[part] ?? 1
}

function getDaysSinceSeasonStart(date: Date): number {
  const paris = getZonedParts(date, 'Europe/Paris')
  const parisMidnightUtc = (() => {
    const utcGuess = Date.UTC(paris.year, paris.month - 1, paris.day, 0, 0, 0)
    const offset = (() => {
      const zoned = getZonedParts(new Date(utcGuess), 'Europe/Paris')
      const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second)
      return (zonedAsUtc - utcGuess) / 60000
    })()
    return utcGuess - offset * 60 * 1000
  })()
  const anchorParisMidnightUtc = (() => {
    const anchorDate = new Date(SEASON_ANCHOR_UTC)
    const zp = getZonedParts(anchorDate, 'Europe/Paris')
    const guess = Date.UTC(zp.year, zp.month - 1, zp.day, 0, 0, 0)
    const off = (() => {
      const z = getZonedParts(new Date(guess), 'Europe/Paris')
      const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second)
      return (asUtc - guess) / 60000
    })()
    return guess - off * 60 * 1000
  })()
  const diff = parisMidnightUtc - anchorParisMidnightUtc
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

export function getSeasonWindow(date = new Date()) {
  const daysSince = getDaysSinceSeasonStart(date)
  const seasonIndex = Math.floor(daysSince / SEASON_DURATION_DAYS)
  const seasonStartDays = seasonIndex * SEASON_DURATION_DAYS
  const seasonEndDays = seasonStartDays + SEASON_DURATION_DAYS - 1
  const seasonStart = new Date(SEASON_ANCHOR_UTC + seasonStartDays * 24 * 60 * 60 * 1000)
  const seasonEnd = new Date(SEASON_ANCHOR_UTC + seasonEndDays * 24 * 60 * 60 * 1000)
  const weekIndex = Math.floor((daysSince - seasonStartDays) / 7)
  return {
    seasonId: `S${seasonIndex + 1}`,
    seasonStart,
    seasonEnd,
    daysSinceStart: daysSince,
    weekIndex: Math.max(0, weekIndex),
  }
}

export function getWeekIndexInSeason(date = new Date()): number {
  return getSeasonWindow(date).weekIndex
}

export function isBurstWeek(date = new Date()): boolean {
  return getWeekIndexInSeason(date) % 2 === 1
}

export function isWithinBurstWindow(date = new Date()): boolean {
  const parts = getZonedParts(date, 'Europe/Paris')
  const weekday = getParisWeekday(date)
  const hour = parts.hour
  if (weekday === 5 && hour >= BURST_START_HOUR) return true
  if (weekday === 6) return true
  if (weekday === 0 && hour < BURST_START_HOUR) return true
  return false
}

export function isBurstActive(date = new Date()): boolean {
  return isBurstWeek(date) && isWithinBurstWindow(date)
}

export function isIdlePaused(date = new Date()): boolean {
  return isBurstActive(date)
}

export function getActiveSurge(date = new Date()): SurgeId | null {
  if (isBurstWeek(date)) return null
  const weekIdx = getWeekIndexInSeason(date)
  const surgeWeekNumber = Math.floor(weekIdx / 2)
  return BIOME_CYCLE[surgeWeekNumber % BIOME_CYCLE.length]
}

export function getEffectiveMaxFights(burstActive: boolean): number {
  return burstActive ? GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1 : GAME_RULES.COMBAT.MAX_DAILY_FIGHTS
}

export function applyBurstMutator(
  base: { offense: number; defense: number; xp: number },
  mutatorId: BurstMutatorId
): { offense: number; defense: number; xp: number } {
  if (mutatorId === 'offense') return { ...base, offense: Math.round(base.offense * 1.1) }
  if (mutatorId === 'defense') return { ...base, defense: Math.round(base.defense * 0.9) }
  return { ...base, xp: Math.round(base.xp * 1.15) }
}

export function logDepthToIdleRatio(depth: number, idle: number, date = new Date()): void {
  if (!isBurstActive(date)) return
  const total = depth + idle
  const ratio = total > 0 ? depth / total : 0
  console.debug(`[ActiveBurst] depthToIdleRatio ${ratio.toFixed(2)} depth:${depth} idle:${idle}`)
}

export const BURST_ACTIVE = isBurstActive(new Date())
export const ACTIVE_SURGE = getActiveSurge(new Date())
export const SEASON_ID = getSeasonWindow(new Date()).seasonId
