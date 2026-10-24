import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '../context/GameContext'
import {
  PIXEL_SEASON_MAX_POINTS,
  PIXEL_SEASON_MISSIONS,
  PIXEL_SEASON_PREMIUM_REWARDS,
  PIXEL_SEASON_FREE_REWARDS,
  PIXEL_SEASON_TIER_COUNT,
  buildPixelSeasonLeaderboard,
  getPixelSeasonCalendar,
  getPixelSeasonFreeReward,
  getPixelSeasonMissionProgress,
  getPixelSeasonPoints,
  getPixelSeasonPointsToNextTier,
  getPixelSeasonPremiumReward,
  getPixelSeasonProgressPct,
  getPixelSeasonTheme,
  getPixelSeasonTier,
  getPixelSeasonTierThreshold,
  isPixelSeasonMissionComplete,
  type PixelSeasonCalendar,
  type PixelSeasonFreeReward,
  type PixelSeasonMission,
  type PixelSeasonPremiumReward,
  type PixelSeasonTheme,
} from '../data/pixelSeason'
import {
  claimPixelSeasonFreeTier,
  claimPixelSeasonPremiumTier,
  getActivePixelSeasonId,
  loadPixelSeasonState,
  subscribePixelSeason,
  unlockPixelSeasonPremium,
  type PixelSeasonState,
} from '../utils/pixelSeasonStorage'

export interface PixelSeasonMissionState extends PixelSeasonMission {
  progress: number
  complete: boolean
}

export interface PixelSeasonFreeRewardState extends PixelSeasonFreeReward {
  unlocked: boolean
  claimed: boolean
  claimable: boolean
}

export interface PixelSeasonPremiumRewardState extends PixelSeasonPremiumReward {
  unlocked: boolean
  claimed: boolean
  claimable: boolean
}

export interface UsePixelSeasonOptions {
  now?: Date
  characterId?: string
  seasonId?: string
}

export interface UsePixelSeasonReturn {
  seasonId: string
  theme: PixelSeasonTheme
  calendar: PixelSeasonCalendar
  state: PixelSeasonState
  counters: PixelSeasonState['counters']
  points: number
  tier: number
  progressPct: number
  pointsToNext: number
  maxPoints: number
  maxTier: number
  missions: PixelSeasonMissionState[]
  freeRewards: PixelSeasonFreeRewardState[]
  premiumRewards: PixelSeasonPremiumRewardState[]
  claimedFree: number[]
  claimedPremium: number[]
  premiumUnlocked: boolean
  leaderboard: ReturnType<typeof buildPixelSeasonLeaderboard>
  canClaimFree: (tier: number) => boolean
  canClaimPremium: (tier: number) => boolean
  claimFree: (tier: number) => boolean
  claimPremium: (tier: number) => boolean
  unlockPremium: () => void
}

export function usePixelSeason(options?: UsePixelSeasonOptions): UsePixelSeasonReturn {
  const { activeCharacter } = useGame()
  const nowMs = options?.now?.getTime() ?? Date.now()
  const seasonId = options?.seasonId ?? getActivePixelSeasonId(new Date(nowMs))
  const characterId = options?.characterId ?? activeCharacter?.id ?? activeCharacter?.seed ?? ''

  const [state, setState] = useState<PixelSeasonState>(() => loadPixelSeasonState(seasonId, characterId))

  useEffect(() => {
    setState(loadPixelSeasonState(seasonId, characterId))
  }, [seasonId, characterId])

  useEffect(() => {
    return subscribePixelSeason(() => {
      setState(loadPixelSeasonState(seasonId, characterId))
    })
  }, [seasonId, characterId])

  const points = useMemo(() => getPixelSeasonPoints(state.counters), [state.counters])
  const tier = useMemo(() => getPixelSeasonTier(points), [points])
  const progressPct = useMemo(() => getPixelSeasonProgressPct(points), [points])
  const pointsToNext = useMemo(() => getPixelSeasonPointsToNextTier(points), [points])
  const theme = useMemo(() => getPixelSeasonTheme(seasonId), [seasonId])
  const calendar = useMemo(
    () => getPixelSeasonCalendar(seasonId, new Date(nowMs)),
    [seasonId, nowMs],
  )

  const missions = useMemo<PixelSeasonMissionState[]>(
    () => PIXEL_SEASON_MISSIONS.map((mission) => ({
      ...mission,
      progress: getPixelSeasonMissionProgress(mission, state.counters),
      complete: isPixelSeasonMissionComplete(mission, state.counters),
    })),
    [state.counters],
  )

  const canClaimFree = useCallback(
    (targetTier: number): boolean => {
      if (!getPixelSeasonFreeReward(targetTier)) return false
      if (state.claimedFree.includes(targetTier)) return false
      return points >= getPixelSeasonTierThreshold(targetTier)
    },
    [points, state.claimedFree],
  )

  const canClaimPremium = useCallback(
    (targetTier: number): boolean => {
      if (!state.premiumUnlocked) return false
      if (!getPixelSeasonPremiumReward(targetTier)) return false
      if (state.claimedPremium.includes(targetTier)) return false
      return points >= getPixelSeasonTierThreshold(targetTier)
    },
    [points, state.claimedPremium, state.premiumUnlocked],
  )

  const claimFree = useCallback(
    (targetTier: number): boolean => {
      const claimed = claimPixelSeasonFreeTier(characterId, targetTier, seasonId)
      setState(loadPixelSeasonState(seasonId, characterId))
      return claimed
    },
    [characterId, seasonId],
  )

  const claimPremium = useCallback(
    (targetTier: number): boolean => {
      const claimed = claimPixelSeasonPremiumTier(characterId, targetTier, seasonId)
      setState(loadPixelSeasonState(seasonId, characterId))
      return claimed
    },
    [characterId, seasonId],
  )

  const unlockPremium = useCallback(() => {
    setState(unlockPixelSeasonPremium(characterId, seasonId))
  }, [characterId, seasonId])

  const freeRewards = useMemo<PixelSeasonFreeRewardState[]>(
    () => PIXEL_SEASON_FREE_REWARDS.map((reward) => ({
      ...reward,
      unlocked: points >= getPixelSeasonTierThreshold(reward.tier),
      claimed: state.claimedFree.includes(reward.tier),
      claimable: canClaimFree(reward.tier),
    })),
    [points, state.claimedFree, canClaimFree],
  )

  const premiumRewards = useMemo<PixelSeasonPremiumRewardState[]>(
    () => PIXEL_SEASON_PREMIUM_REWARDS.map((reward) => ({
      ...reward,
      unlocked: points >= getPixelSeasonTierThreshold(reward.tier),
      claimed: state.claimedPremium.includes(reward.tier),
      claimable: canClaimPremium(reward.tier),
    })),
    [points, state.claimedPremium, canClaimPremium],
  )

  const leaderboard = useMemo(
    () => buildPixelSeasonLeaderboard(seasonId, activeCharacter?.name ?? 'YOU', points),
    [seasonId, activeCharacter?.name, points],
  )

  return {
    seasonId,
    theme,
    calendar,
    state,
    counters: state.counters,
    points,
    tier,
    progressPct,
    pointsToNext,
    maxPoints: PIXEL_SEASON_MAX_POINTS,
    maxTier: PIXEL_SEASON_TIER_COUNT,
    missions,
    freeRewards,
    premiumRewards,
    claimedFree: state.claimedFree,
    claimedPremium: state.claimedPremium,
    premiumUnlocked: state.premiumUnlocked,
    leaderboard,
    canClaimFree,
    canClaimPremium,
    claimFree,
    claimPremium,
    unlockPremium,
  }
}
