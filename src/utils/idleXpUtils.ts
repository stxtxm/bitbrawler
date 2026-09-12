import { IDLE_CONFIG } from '../config/idleConfig'
import { calculateFightXp } from './xpUtils'
import { isBurstActive } from '../data/liveOps'

export function calculateIdleXp(won: boolean, playerLevel: number): number {
  if (isBurstActive()) return 0
  return Math.floor(calculateFightXp(won, playerLevel) * IDLE_CONFIG.XP_MODIFIER)
}

export function calculateOfflineIdleXp(won: boolean, playerLevel: number): number {
  if (isBurstActive()) return 0
  return Math.floor(calculateIdleXp(won, playerLevel) * IDLE_CONFIG.OFFLINE_XP_MODIFIER)
}

export function calculateIdleEssence(
  won: boolean,
  playerLevel: number,
  intelligence?: number,
  focus?: number,
): number {
  if (isBurstActive()) return 0
  const baseRate = won ? IDLE_CONFIG.ESSENCE.BASE_RATE : IDLE_CONFIG.ESSENCE.BASE_RATE * IDLE_CONFIG.ESSENCE.LOSS_RATIO
  const levelScaling = 1 + (playerLevel - 1) * IDLE_CONFIG.ESSENCE.LEVEL_SCALE
  const statMultiplier = Math.max(0.5, 1 + ((intelligence ?? 10) + (focus ?? 10) - 20) * 0.01)
  return baseRate * levelScaling * statMultiplier
}


