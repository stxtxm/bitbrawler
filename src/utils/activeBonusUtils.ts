import { Character } from '../types/Character'
import { getDailyResetKey } from './dailyReset'

export const ACTIVE_WIN_BONUS = {
  WINS_PER_DAY: 3,
  XP_MULTIPLIER: 2,
} as const

export function countActiveWinsToday(character: Character, now: number = Date.now()): number {
  const dayKey = getDailyResetKey(now)
  return (character.fightHistory ?? []).filter(
    (fight) => fight.won && Number.isFinite(fight.date) && getDailyResetKey(fight.date) === dayKey,
  ).length
}

export function getActiveWinXpMultiplier(
  character: Character,
  won: boolean,
  now: number = Date.now(),
): number {
  if (!won) return 1
  return countActiveWinsToday(character, now) < ACTIVE_WIN_BONUS.WINS_PER_DAY
    ? ACTIVE_WIN_BONUS.XP_MULTIPLIER
    : 1
}
