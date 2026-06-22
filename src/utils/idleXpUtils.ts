import { IDLE_CONFIG } from '../config/idleConfig'
import { calculateFightXp } from './xpUtils'

export function calculateIdleXp(won: boolean, playerLevel: number): number {
  return Math.floor(calculateFightXp(won, playerLevel) * IDLE_CONFIG.XP_MODIFIER)
}

export function calculateIdleEssence(
  won: boolean,
  playerLevel: number,
  intelligence?: number,
  focus?: number,
): number {
  const baseRate = won ? IDLE_CONFIG.ESSENCE.BASE_RATE : IDLE_CONFIG.ESSENCE.BASE_RATE * IDLE_CONFIG.ESSENCE.LOSS_RATIO
  const levelScaling = 1 + (playerLevel - 1) * IDLE_CONFIG.ESSENCE.LEVEL_SCALE
  const statMultiplier = Math.max(0.5, 1 + ((intelligence ?? 10) + (focus ?? 10) - 20) * 0.01)
  return baseRate * levelScaling * statMultiplier
}

export function calculateOfflineFights(lastTimestamp: number, now: number = Date.now()): number {
  if (lastTimestamp <= 0 || now <= lastTimestamp) return 0

  const elapsed = now - lastTimestamp
  const maxOffline = IDLE_CONFIG.MAX_OFFLINE_HOURS * 60 * 60 * 1000
  const cappedElapsed = Math.min(elapsed, maxOffline)

  const fights = Math.floor(cappedElapsed / IDLE_CONFIG.TIMER_INTERVAL)
  return Math.min(fights, IDLE_CONFIG.MAX_IDLE_FIGHTS)
}
