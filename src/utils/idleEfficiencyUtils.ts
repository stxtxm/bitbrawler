import { IDLE_CONFIG } from '../config/idleConfig';
import { CombatStats } from './combatUtils';

const EFF = IDLE_CONFIG.EFFICIENCY;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculatePowerRatio(playerStats: CombatStats, monsterStats: CombatStats): number {
  if (monsterStats.totalPower <= 0) return EFF.MAX_POWER_RATIO;
  const rawRatio = playerStats.totalPower / monsterStats.totalPower;
  return clamp(rawRatio, 0.5, EFF.MAX_POWER_RATIO);
}

function calculateEfficiency(powerRatio: number, dexterity: number): number {
  const dexBonus = Math.max(0, (dexterity - 10)) * EFF.SPEED_FACTOR;
  const powerBonus = Math.max(0, powerRatio - 1) * EFF.POWER_RATIO_FACTOR;
  return 1 + dexBonus + powerBonus;
}

function calculateEffectiveInterval(efficiency: number): number {
  const raw = EFF.BASE_INTERVAL / efficiency;
  return clamp(Math.round(raw), EFF.MIN_INTERVAL, EFF.BASE_INTERVAL);
}

function calculateXpBonusMultiplier(efficiency: number): number {
  return 1 + (efficiency - 1) * EFF.XP_BONUS_RATIO;
}

function calculateXpPerMinute(xpPerKill: number, intervalMs: number): number {
  const fightsPerMinute = 60000 / intervalMs;
  return Math.round(xpPerKill * fightsPerMinute);
}

function calculateStreakBonus(streak: number): number {
  return Math.min(streak * EFF.STREAK_BONUS_PER_STEP, EFF.STREAK_BONUS_CAP);
}

function getStreakMilestone(streak: number): number | null {
  for (const m of EFF.STREAK_MILESTONES) {
    if (streak === m) return m;
  }
  return null;
}

function calculateOfflineFightsWithEfficiency(
  lastTimestamp: number,
  now: number,
  effectiveInterval: number,
): number {
  if (lastTimestamp <= 0 || now <= lastTimestamp) return 0;
  const elapsed = now - lastTimestamp;
  const maxOffline = IDLE_CONFIG.MAX_OFFLINE_HOURS * 60 * 60 * 1000;
  const cappedElapsed = Math.min(elapsed, maxOffline);
  const fights = Math.floor(cappedElapsed / effectiveInterval);
  return Math.min(fights, IDLE_CONFIG.MAX_IDLE_FIGHTS);
}

export interface EfficiencyResult {
  powerRatio: number;
  efficiency: number;
  effectiveInterval: number;
  xpBonusMultiplier: number;
}

export interface EfficiencyDisplayData {
  xpPerMinute: number;
  streakBonus: number;
  streakMilestone: number | null;
  totalKills: number;
  currentStreak: number;
}

export function computeEfficiency(
  playerStats: CombatStats,
  monsterStats: CombatStats,
  dexterity: number,
): EfficiencyResult {
  const powerRatio = calculatePowerRatio(playerStats, monsterStats);
  const efficiency = calculateEfficiency(powerRatio, dexterity);
  const effectiveInterval = calculateEffectiveInterval(efficiency);
  const xpBonusMultiplier = calculateXpBonusMultiplier(efficiency);
  return { powerRatio, efficiency, effectiveInterval, xpBonusMultiplier };
}

export function computeDisplayData(
  effectiveInterval: number,
  avgXpPerKill: number,
  currentStreak: number,
  totalKills: number,
): EfficiencyDisplayData {
  const xpPerMinute = calculateXpPerMinute(avgXpPerKill, effectiveInterval);
  const streakBonus = calculateStreakBonus(currentStreak);
  const streakMilestone = getStreakMilestone(currentStreak);
  return { xpPerMinute, streakBonus, streakMilestone, totalKills, currentStreak };
}

function calculateNextLevelTime(
  xpPerMinute: number,
  currentXpInLevel: number,
  xpRequiredForNextLevel: number,
): number | null {
  if (xpPerMinute <= 0 || xpRequiredForNextLevel <= 0) return null
  const remaining = xpRequiredForNextLevel - currentXpInLevel
  if (remaining <= 0) return null
  const minutes = remaining / xpPerMinute
  return Math.round(minutes * 60)
}

export {
  calculatePowerRatio,
  calculateEfficiency,
  calculateEffectiveInterval,
  calculateXpBonusMultiplier,
  calculateXpPerMinute,
  calculateStreakBonus,
  getStreakMilestone,
  calculateOfflineFightsWithEfficiency,
  calculateNextLevelTime,
};
