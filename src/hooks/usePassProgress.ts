import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
  PASS_MAX_LEVEL,
  PASS_XP_PER_LEVEL,
  PASS_XP_PER_FIGHT,
  PASS_XP_PER_FORGE,
  PASS_XP_PER_IDLE_CLAIM,
  PASS_REWARDS,
  getPassLevel,
  getPassProgress,
  getPassRewards,
  SEASONAL_PASS_TIERS,
  getPassTierForXp,
  getPassProgressPct,
  getNextTierXp,
  getXpToNextTier,
  PASS_MAX_XP,
  PASS_MAX_TIER,
} from '../data/seasonalPass'
import {
  loadPassProgress,
  savePassProgress,
  type PassProgress,
} from '../utils/passStorage'

export const PASS_STORAGE_KEY = 'bitbrawler_pass_progress'

export interface PassProgressState {
  xp: number
  claimed: number[]
}

interface StoredPassMap {
  [characterId: string]: PassProgressState
}

const defaultState: PassProgressState = { xp: 0, claimed: [] }

let memoryStore: StoredPassMap = {}
let listeners: Array<(map: StoredPassMap) => void> = []

try {
  const raw = localStorage.getItem(PASS_STORAGE_KEY)
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      memoryStore = parsed as StoredPassMap
    }
  }
} catch { /* ignore */ }

function persistStore() {
  try {
    localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(memoryStore))
  } catch { /* ignore */ }
}

function notifyListeners() {
  listeners.forEach(fn => fn({ ...memoryStore }))
}

function sanitizeState(raw: unknown): PassProgressState {
  if (!raw || typeof raw !== 'object') return { ...defaultState }
  const r = raw as Record<string, unknown>
  const xp = typeof r.xp === 'number' && Number.isFinite(r.xp) && r.xp >= 0 ? Math.floor(r.xp) : 0
  const claimedRaw = Array.isArray(r.claimed) ? r.claimed : []
  const claimed = claimedRaw.filter((v): v is number => Number.isInteger(v) && v >= 1 && v <= PASS_MAX_LEVEL)
  return { xp, claimed: [...new Set(claimed)].sort((a, b) => a - b) }
}

export function getStoredPassProgress(characterId: string): PassProgressState {
  if (!characterId) return { ...defaultState }
  const entry = memoryStore[characterId]
  return entry ? sanitizeState(entry) : { ...defaultState }
}

export function setStoredPassProgress(characterId: string, state: PassProgressState): void {
  if (!characterId) return
  memoryStore[characterId] = sanitizeState(state)
  persistStore()
  notifyListeners()
}

export function addStoredPassXp(characterId: string, amount: number): PassProgressState {
  const current = getStoredPassProgress(characterId)
  const delta = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0
  const next: PassProgressState = { xp: current.xp + delta, claimed: current.claimed }
  setStoredPassProgress(characterId, next)
  return next
}

export function claimStoredPassReward(characterId: string, level: number): boolean {
  const current = getStoredPassProgress(characterId)
  const lvl = getPassLevel(current.xp)
  if (!Number.isInteger(level) || level < 1 || level > PASS_MAX_LEVEL) return false
  if (current.claimed.includes(level)) return false
  if (lvl < level) return false
  const next: PassProgressState = { xp: current.xp, claimed: [...current.claimed, level].sort((a, b) => a - b) }
  setStoredPassProgress(characterId, next)
  return true
}

export function resetStoredPassProgress(characterId: string): void {
  if (!characterId) return
  delete memoryStore[characterId]
  persistStore()
  notifyListeners()
}

export function getPassStorageSnapshot(): StoredPassMap {
  return { ...memoryStore }
}

function resolveInitialState(characterId: string | undefined, characterPass?: PassProgressState): PassProgressState {
  if (!characterId) return sanitizeState(characterPass)
  const stored = memoryStore[characterId]
  if (stored) return sanitizeState(stored)
  if (characterPass) {
    const sanitized = sanitizeState(characterPass)
    memoryStore[characterId] = sanitized
    persistStore()
    return sanitized
  }
  return { ...defaultState }
}

// --- SeasonId compat layer ---
function getDefaultSeasonId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export interface UsePassProgressOptions {
  seasonId?: string
}

export interface UsePassProgressReturn {
  seasonId: string
  passXp: number
  xp: number
  level: number
  currentTier: number
  progress: ReturnType<typeof getPassProgress>
  progressPct: number
  claimed: number[]
  nextTierXp: number | null
  xpToNext: number
  maxXp: number
  maxTier: number
  maxLevel: number
  tiers: typeof SEASONAL_PASS_TIERS
  nextReward: ReturnType<typeof getPassRewards>
  claimableRewards: typeof PASS_REWARDS
  xpPerFight: number
  xpPerForge: number
  xpPerIdleClaim: number
  xpPerLevel: number
  addPassXp: (amount: number) => void
  addXp: (amount: number) => void
  addFightXp: () => void
  addForgeXp: () => void
  addIdleClaimXp: () => void
  claimTier: (tier: number) => boolean
  claimReward: (level: number) => boolean
  canClaim: (tier: number) => boolean
  isClaimed: (tier: number) => boolean
  resetProgress: () => void
}

export function usePassProgress(options?: UsePassProgressOptions): UsePassProgressReturn {
  const { activeCharacter } = useGame()
  const seasonId = options?.seasonId ?? getDefaultSeasonId()
  const characterId = (activeCharacter?.id ?? activeCharacter?.seed ?? '') as string
  const charId = characterId

  // Legacy state for master compatibility (PASS_STORAGE_KEY)
  const [legacyState, setLegacyState] = useState<PassProgressState>(() =>
    resolveInitialState(charId, (activeCharacter as unknown as { passProgress?: PassProgressState })?.passProgress),
  )

  // Progressive track state for PR #951 (seasonId scoped)
  const [progressState, setProgressState] = useState<PassProgress>(() =>
    loadPassProgress(seasonId, characterId || undefined),
  )

  useEffect(() => {
    setLegacyState(resolveInitialState(charId, (activeCharacter as unknown as { passProgress?: PassProgressState })?.passProgress))
  }, [charId])

  useEffect(() => {
    setProgressState(loadPassProgress(seasonId, characterId || undefined))
  }, [seasonId, characterId])

  useEffect(() => {
    const fn = (map: StoredPassMap) => {
      if (!charId) return
      const entry = map[charId]
      setLegacyState(entry ? sanitizeState(entry) : { ...defaultState })
    }
    listeners.push(fn)
    return () => {
      listeners = listeners.filter(f => f !== fn)
    }
  }, [charId])

  const persistProgress = useCallback(
    (next: PassProgress) => {
      savePassProgress(seasonId, next, characterId || undefined)
      setProgressState(next)
    },
    [seasonId, characterId],
  )

  const addPassXp = useCallback(
    (amount: number) => {
      if (amount <= 0 || !Number.isFinite(amount)) return
      const delta = Math.floor(amount)
      const current = loadPassProgress(seasonId, characterId || undefined)
      const next: PassProgress = { xp: current.xp + delta, claimed: current.claimed }
      persistProgress(next)
      if (charId) addStoredPassXp(charId, delta)
    },
    [seasonId, characterId, persistProgress, charId],
  )

  const addXp = useCallback(
    (amount: number) => {
      const delta = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0
      if (delta <= 0) return
      if (charId) {
        addStoredPassXp(charId, delta)
        const legacy = getStoredPassProgress(charId)
        savePassProgress(seasonId, { xp: legacy.xp, claimed: legacy.claimed }, characterId || undefined)
        setProgressState({ xp: legacy.xp, claimed: legacy.claimed })
      } else {
        addPassXp(delta)
      }
    },
    [charId, seasonId, characterId, addPassXp],
  )

  const addFightXp = useCallback(() => addXp(PASS_XP_PER_FIGHT), [addXp])
  const addForgeXp = useCallback(() => addXp(PASS_XP_PER_FORGE), [addXp])
  const addIdleClaimXp = useCallback(() => addXp(PASS_XP_PER_IDLE_CLAIM), [addXp])

  const claimTier = useCallback(
    (tier: number): boolean => {
      const tierDef = SEASONAL_PASS_TIERS.find(t => t.level === tier)
      if (!tierDef) return false
      const current = loadPassProgress(seasonId, characterId || undefined)
      if (current.claimed.includes(tier)) return false
      // For progressive tiers we check against that tier's xpRequired
      if (current.xp < tierDef.xpRequired) {
        // fallback to legacy level check for compat
        const lvl = getPassLevel(current.xp)
        if (lvl < tier) return false
      }
      const next: PassProgress = { xp: current.xp, claimed: [...current.claimed, tier].sort((a, b) => a - b) }
      persistProgress(next)
      if (charId) {
        // also persist to legacy store if possible
        const legacy = getStoredPassProgress(charId)
        if (!legacy.claimed.includes(tier) && getPassLevel(legacy.xp) >= tier) {
          claimStoredPassReward(charId, tier)
        }
      }
      return true
    },
    [seasonId, characterId, persistProgress, charId],
  )

  const claimReward = useCallback(
    (level: number): boolean => {
      if (!charId) return false
      const ok = claimStoredPassReward(charId, level)
      if (ok) {
        const legacy = getStoredPassProgress(charId)
        savePassProgress(seasonId, { xp: legacy.xp, claimed: legacy.claimed }, characterId || undefined)
        setProgressState({ xp: legacy.xp, claimed: legacy.claimed })
      }
      return ok
    },
    [charId, seasonId, characterId],
  )

  const canClaimLegacy = useCallback(
    (lvl: number) => {
      if (legacyState.claimed.includes(lvl)) return false
      return legacyState.claimed ? getPassLevel(legacyState.xp) >= lvl && lvl >= 1 && lvl <= PASS_MAX_LEVEL : false
    },
    [legacyState],
  )

  // Progressive derived values - use progressState as source of truth when seasonId is explicit, else legacy
  const effectiveXp = options?.seasonId ? progressState.xp : legacyState.xp
  const effectiveClaimed = options?.seasonId ? progressState.claimed : legacyState.claimed

  const currentTier = useMemo(() => getPassTierForXp(effectiveXp), [effectiveXp])
  const progressPct = useMemo(() => getPassProgressPct(effectiveXp), [effectiveXp])
  const nextTierXp = useMemo(() => getNextTierXp(effectiveXp), [effectiveXp])
  const xpToNext = useMemo(() => getXpToNextTier(effectiveXp), [effectiveXp])

  const level = getPassLevel(legacyState.xp)
  const progress = getPassProgress(legacyState.xp)

  const isClaimed = useCallback(
    (tier: number): boolean => effectiveClaimed.includes(tier),
    [effectiveClaimed],
  )

  const canClaim = useCallback(
    (tier: number): boolean => {
      if (options?.seasonId) {
        const tierDef = SEASONAL_PASS_TIERS.find(t => t.level === tier)
        if (!tierDef) return false
        if (effectiveClaimed.includes(tier)) return false
        return effectiveXp >= tierDef.xpRequired
      }
      return canClaimLegacy(tier)
    },
    [options?.seasonId, effectiveClaimed, effectiveXp, canClaimLegacy],
  )

  const resetProgress = useCallback(() => {
    const next: PassProgress = { xp: 0, claimed: [] }
    persistProgress(next)
    if (charId) resetStoredPassProgress(charId)
  }, [persistProgress, charId])

  const nextReward = (() => {
    const nextLvl = level + 1
    if (nextLvl > PASS_MAX_LEVEL) return null
    return getPassRewards(nextLvl)
  })()

  const claimableRewards = PASS_REWARDS.filter(r => r.level <= level && !legacyState.claimed.includes(r.level))

  return {
    seasonId,
    passXp: effectiveXp,
    xp: legacyState.xp,
    level,
    currentTier,
    progress,
    progressPct,
    claimed: effectiveClaimed,
    nextTierXp,
    xpToNext,
    maxXp: PASS_MAX_XP,
    maxTier: PASS_MAX_TIER,
    maxLevel: PASS_MAX_LEVEL,
    tiers: SEASONAL_PASS_TIERS,
    nextReward,
    claimableRewards,
    xpPerFight: PASS_XP_PER_FIGHT,
    xpPerForge: PASS_XP_PER_FORGE,
    xpPerIdleClaim: PASS_XP_PER_IDLE_CLAIM,
    xpPerLevel: PASS_XP_PER_LEVEL,
    addPassXp,
    addXp,
    addFightXp,
    addForgeXp,
    addIdleClaimXp,
    claimTier,
    claimReward,
    canClaim,
    isClaimed,
    resetProgress,
  }
}
