import type { SeasonCounters } from '../data/pixelSeason'
import { recordPixelSeasonDelta } from './pixelSeasonStorage'

export interface PixelSeasonTrackableCharacter {
  id?: string
  seed?: string
  wins?: number
  idleTotalKills?: number
  idleStreak?: number
}

function positiveDelta(next: number | undefined, previous: number | undefined): number {
  return Math.max(0, (next ?? 0) - (previous ?? 0))
}

export function getPixelSeasonCharacterDelta(
  previous: PixelSeasonTrackableCharacter | null,
  next: PixelSeasonTrackableCharacter,
): SeasonCounters {
  if (!previous) return { fight: 0, salvage: 0, idle: 0, streak: 0 }
  const nextStreak = Math.max(0, next.idleStreak ?? 0)
  const previousStreak = Math.max(0, previous.idleStreak ?? 0)
  return {
    fight: positiveDelta(next.wins, previous.wins),
    salvage: 0,
    idle: positiveDelta(next.idleTotalKills, previous.idleTotalKills),
    streak: nextStreak > previousStreak ? nextStreak : 0,
  }
}

export function trackPixelSeasonCharacter(
  previous: PixelSeasonTrackableCharacter | null,
  next: PixelSeasonTrackableCharacter,
  seasonId?: string,
): boolean {
  const characterId = next.id ?? next.seed
  if (!characterId || !previous) return false
  const delta = getPixelSeasonCharacterDelta(previous, next)
  if (delta.fight === 0 && delta.idle === 0 && delta.streak === 0) return false
  recordPixelSeasonDelta(characterId, {
    fight: delta.fight,
    idle: delta.idle,
    streak: delta.streak,
  }, seasonId)
  return true
}
