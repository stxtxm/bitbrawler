import { BiomeId, getBiomeMonsterPool } from './biomes';
import { MonsterId } from './monsterAssets';
import { GAME_RULES } from '../config/gameRules';
import { DAILY_RESET_TIMEZONE } from '../utils/dailyReset';
import { getZonedMidnightUtc } from '../utils/timezoneUtils';

export const SURGE_ROTATION: BiomeId[] = ['volcanic', 'forest', 'desert', 'abyssal'];

const ANCHOR_MIDNIGHT_MS = getZonedMidnightUtc(new Date(Date.UTC(2024, 0, 1, 12, 0, 0)), DAILY_RESET_TIMEZONE);

function toDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value);
}

export function getWeekIndex(date: Date | number = Date.now()): number {
  const parisMidnight = getZonedMidnightUtc(toDate(date), DAILY_RESET_TIMEZONE);
  const diff = parisMidnight - ANCHOR_MIDNIGHT_MS;
  return Math.floor(diff / (7 * 86400000));
}

export function getActiveSurge(date: Date | number = Date.now()): BiomeId | null {
  const weekIndex = getWeekIndex(date);
  if (weekIndex % 2 !== 0) return null;
  const normalizedWeek = weekIndex < 0 ? Math.ceil(weekIndex / 2) : Math.floor(weekIndex / 2);
  const len = SURGE_ROTATION.length;
  const surgeIndex = ((normalizedWeek % len) + len) % len;
  return SURGE_ROTATION[surgeIndex];
}

export function isBurstActive(date: Date | number = Date.now()): boolean {
  return getActiveSurge(date) === null;
}

export function getEffectivePveXpModifier(date: Date | number = Date.now()): number {
  return getActiveSurge(date) !== null ? GAME_RULES.LIVEOPS.XP_SURGE_MODIFIER : GAME_RULES.PVE.XP_MODIFIER;
}

export function getSurgeMonsterPool(date: Date | number = Date.now()): MonsterId[] {
  const surge = getActiveSurge(date);
  if (surge === null) return [];
  return getBiomeMonsterPool(surge);
}

export function isSurgeMonster(monsterId: MonsterId, date: Date | number = Date.now()): boolean {
  const pool = getSurgeMonsterPool(date);
  return pool.includes(monsterId);
}

export function getEssenceSurgeMultiplier(monsterId: MonsterId, date: Date | number = Date.now()): number {
  return isSurgeMonster(monsterId, date) ? 1 + GAME_RULES.LIVEOPS.ESSENCE_SURGE_BONUS : 1;
}

export function getDailyBountyTarget(date: Date | number = Date.now()): { biomeId: BiomeId; monsterPool: MonsterId[]; required: number } | null {
  const surge = getActiveSurge(date);
  if (surge === null) return null;
  return { biomeId: surge, monsterPool: getBiomeMonsterPool(surge), required: 3 };
}

export function getBountyProgress(kills: Record<string, number>, date: Date | number = Date.now()): { current: number; required: number; completed: boolean; biomeId: BiomeId | null } {
  const target = getDailyBountyTarget(date);
  if (!target) return { current: 0, required: 3, completed: false, biomeId: null };
  const current = target.monsterPool.reduce((sum, id) => sum + (kills[id] ?? 0), 0);
  return { current, required: target.required, completed: current >= target.required, biomeId: target.biomeId };
}

export function isBountyCompleted(kills: Record<string, number>, date: Date | number = Date.now()): boolean {
  return getBountyProgress(kills, date).completed;
}

export const ACTIVE_SURGE: BiomeId | null = getActiveSurge(Date.now());
export const BURST_ACTIVE: boolean = ACTIVE_SURGE === null;
