import {
  EMPTY_SEASON_COUNTERS,
  PIXEL_SEASON_TIER_COUNT,
  getClaimableFreeTiers,
  getClaimablePremiumTiers,
  getPixelSeasonIdForDate,
  getPixelSeasonPremiumReward,
  getPixelSeasonPoints,
  getPixelSeasonTierThreshold,
  type SeasonCounters,
} from '../data/pixelSeason'

export interface PixelSeasonState {
  seasonId: string
  counters: SeasonCounters
  claimedFree: number[]
  claimedPremium: number[]
  premiumUnlocked: boolean
}

export type PixelSeasonAction = keyof SeasonCounters

export const PIXEL_SEASON_STORAGE_PREFIX = 'pixel_season'

const memoryStore = new Map<string, PixelSeasonState>()
const listeners = new Set<(characterId?: string) => void>()

function isLocalStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined
  } catch {
    return false
  }
}

export function getPixelSeasonStorageKey(seasonId: string, characterId?: string): string {
  if (characterId) return `${PIXEL_SEASON_STORAGE_PREFIX}_${seasonId}_${characterId}`
  return `${PIXEL_SEASON_STORAGE_PREFIX}_${seasonId}`
}

function sanitizeCounters(raw: unknown): SeasonCounters {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_SEASON_COUNTERS }
  const value = raw as Record<string, unknown>
  const read = (key: keyof SeasonCounters): number => {
    const n = value[key]
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }
  return { fight: read('fight'), salvage: read('salvage'), idle: read('idle'), streak: read('streak') }
}

function sanitizeTiers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const tiers = raw.filter(
    (value): value is number => Number.isInteger(value) && value >= 1 && value <= PIXEL_SEASON_TIER_COUNT,
  )
  return [...new Set(tiers)].sort((a, b) => a - b)
}

function sanitizeState(seasonId: string, raw: unknown): PixelSeasonState {
  if (!raw || typeof raw !== 'object') {
    return {
      seasonId,
      counters: { ...EMPTY_SEASON_COUNTERS },
      claimedFree: [],
      claimedPremium: [],
      premiumUnlocked: false,
    }
  }
  const value = raw as Record<string, unknown>
  return {
    seasonId,
    counters: sanitizeCounters(value.counters),
    claimedFree: sanitizeTiers(value.claimedFree),
    claimedPremium: sanitizeTiers(value.claimedPremium),
    premiumUnlocked: value.premiumUnlocked === true,
  }
}

function readStored(seasonId: string, characterId?: string): PixelSeasonState {
  const key = getPixelSeasonStorageKey(seasonId, characterId)
  if (isLocalStorageAvailable()) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return sanitizeState(seasonId, JSON.parse(raw))
    } catch {
      // fall through to memory
    }
  }
  return memoryStore.get(key) ?? sanitizeState(seasonId, null)
}

function notify(characterId?: string): void {
  listeners.forEach((listener) => listener(characterId))
}

export function getActivePixelSeasonId(now: Date = new Date()): string {
  return getPixelSeasonIdForDate(now)
}

export function loadPixelSeasonState(
  seasonId: string = getActivePixelSeasonId(),
  characterId?: string,
): PixelSeasonState {
  return readStored(seasonId, characterId)
}

export function savePixelSeasonState(state: PixelSeasonState, characterId?: string): void {
  const key = getPixelSeasonStorageKey(state.seasonId, characterId)
  const normalized = sanitizeState(state.seasonId, state)
  memoryStore.set(key, normalized)
  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(key, JSON.stringify(normalized))
    } catch {
      // memory fallback already updated
    }
  }
  notify(characterId)
}

export function clearPixelSeasonState(seasonId?: string, characterId?: string): void {
  if (seasonId) {
    const exactKey = getPixelSeasonStorageKey(seasonId, characterId)
    memoryStore.delete(exactKey)
    try {
      localStorage?.removeItem(exactKey)
    } catch {
      // ignore
    }
    if (!characterId) {
      const prefix = `${PIXEL_SEASON_STORAGE_PREFIX}_${seasonId}_`
      for (const key of Array.from(memoryStore.keys())) {
        if (key.startsWith(prefix)) memoryStore.delete(key)
      }
      try {
        const keys: string[] = []
        for (let i = 0; i < (localStorage?.length ?? 0); i++) {
          const key = localStorage.key(i)
          if (key?.startsWith(prefix)) keys.push(key)
        }
        keys.forEach((key) => localStorage.removeItem(key))
      } catch {
        // ignore
      }
    }
    return
  }

  memoryStore.clear()
  try {
    const keys: string[] = []
    for (let i = 0; i < (localStorage?.length ?? 0); i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PIXEL_SEASON_STORAGE_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // ignore
  }
  notify(characterId)
}

export function recordPixelSeasonDelta(
  characterId: string,
  delta: Partial<SeasonCounters>,
  seasonId: string = getActivePixelSeasonId(),
): PixelSeasonState {
  const current = readStored(seasonId, characterId)
  const counters: SeasonCounters = { ...current.counters }
  for (const key of Object.keys(counters) as PixelSeasonAction[]) {
    const raw = delta[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue
    const amount = Math.floor(raw)
    counters[key] = key === 'streak' ? Math.max(counters[key], amount) : counters[key] + amount
  }
  const next: PixelSeasonState = { ...current, seasonId, counters }
  savePixelSeasonState(next, characterId)
  return next
}

export function recordPixelSeasonAction(
  characterId: string,
  action: PixelSeasonAction,
  amount: number,
  seasonId: string = getActivePixelSeasonId(),
): PixelSeasonState {
  return recordPixelSeasonDelta(characterId, { [action]: amount }, seasonId)
}

export function claimPixelSeasonFreeTier(
  characterId: string,
  tier: number,
  seasonId: string = getActivePixelSeasonId(),
): boolean {
  const current = readStored(seasonId, characterId)
  const points = getPixelSeasonPoints(current.counters)
  if (!getClaimableFreeTiers(points, current.claimedFree).includes(tier)) return false
  const next: PixelSeasonState = {
    ...current,
    claimedFree: [...current.claimedFree, tier].sort((a, b) => a - b),
  }
  savePixelSeasonState(next, characterId)
  return true
}

export function claimPixelSeasonPremiumTier(
  characterId: string,
  tier: number,
  seasonId: string = getActivePixelSeasonId(),
): boolean {
  const current = readStored(seasonId, characterId)
  const points = getPixelSeasonPoints(current.counters)
  if (!getPixelSeasonPremiumReward(tier)) return false
  if (getPixelSeasonTierThreshold(tier) > points) return false
  if (!getClaimablePremiumTiers(points, current.claimedPremium, current.premiumUnlocked).includes(tier)) {
    return false
  }
  const next: PixelSeasonState = {
    ...current,
    claimedPremium: [...current.claimedPremium, tier].sort((a, b) => a - b),
  }
  savePixelSeasonState(next, characterId)
  return true
}

export function unlockPixelSeasonPremium(
  characterId: string,
  seasonId: string = getActivePixelSeasonId(),
): PixelSeasonState {
  const current = readStored(seasonId, characterId)
  const next: PixelSeasonState = { ...current, seasonId, premiumUnlocked: true }
  savePixelSeasonState(next, characterId)
  return next
}

export function subscribePixelSeason(listener: (characterId?: string) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
