import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
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

export interface UsePassProgressOptions {
  seasonId?: string
}

export interface UsePassProgressReturn {
  seasonId: string
  passXp: number
  currentTier: number
  progressPct: number
  claimed: number[]
  nextTierXp: number | null
  xpToNext: number
  maxXp: number
  maxTier: number
  tiers: typeof SEASONAL_PASS_TIERS
  addPassXp: (amount: number) => void
  claimTier: (tier: number) => boolean
  canClaim: (tier: number) => boolean
  isClaimed: (tier: number) => boolean
  resetProgress: () => void
}

function getDefaultSeasonId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function usePassProgress(options?: UsePassProgressOptions): UsePassProgressReturn {
  const { activeCharacter } = useGame()
  const seasonId = options?.seasonId ?? getDefaultSeasonId()
  const characterId = activeCharacter?.id ?? activeCharacter?.seed

  const [progress, setProgress] = useState<PassProgress>(() => loadPassProgress(seasonId, characterId))

  useEffect(() => {
    setProgress(loadPassProgress(seasonId, characterId))
  }, [seasonId, characterId])

  const persist = useCallback(
    (next: PassProgress) => {
      savePassProgress(seasonId, next, characterId)
      setProgress(next)
    },
    [seasonId, characterId],
  )

  const addPassXp = useCallback(
    (amount: number) => {
      if (amount <= 0) return
      const current = loadPassProgress(seasonId, characterId)
      const next: PassProgress = { xp: current.xp + amount, claimed: current.claimed }
      persist(next)
    },
    [seasonId, characterId, persist],
  )

  const canClaim = useCallback(
    (tier: number): boolean => {
      const tierDef = SEASONAL_PASS_TIERS.find(t => t.level === tier)
      if (!tierDef) return false
      const xp = loadPassProgress(seasonId, characterId).xp
      const claimed = loadPassProgress(seasonId, characterId).claimed
      if (claimed.includes(tier)) return false
      return xp >= tierDef.xpRequired
    },
    [seasonId, characterId],
  )

  const claimTier = useCallback(
    (tier: number): boolean => {
      const tierDef = SEASONAL_PASS_TIERS.find(t => t.level === tier)
      if (!tierDef) return false
      const current = loadPassProgress(seasonId, characterId)
      if (current.claimed.includes(tier)) return false
      if (current.xp < tierDef.xpRequired) return false
      const next: PassProgress = { xp: current.xp, claimed: [...current.claimed, tier].sort((a, b) => a - b) }
      persist(next)
      return true
    },
    [seasonId, characterId, persist],
  )

  const isClaimed = useCallback(
    (tier: number): boolean => {
      return loadPassProgress(seasonId, characterId).claimed.includes(tier)
    },
    [seasonId, characterId],
  )

  const resetProgress = useCallback(() => {
    const next: PassProgress = { xp: 0, claimed: [] }
    persist(next)
  }, [persist])

  const currentTier = useMemo(() => getPassTierForXp(progress.xp), [progress.xp])
  const progressPct = useMemo(() => getPassProgressPct(progress.xp), [progress.xp])
  const nextTierXp = useMemo(() => getNextTierXp(progress.xp), [progress.xp])
  const xpToNext = useMemo(() => getXpToNextTier(progress.xp), [progress.xp])

  return {
    seasonId,
    passXp: progress.xp,
    currentTier,
    progressPct,
    claimed: progress.claimed,
    nextTierXp,
    xpToNext,
    maxXp: PASS_MAX_XP,
    maxTier: PASS_MAX_TIER,
    tiers: SEASONAL_PASS_TIERS,
    addPassXp,
    claimTier,
    canClaim,
    isClaimed,
    resetProgress,
  }
}
