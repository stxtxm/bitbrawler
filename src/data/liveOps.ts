import { BIOMES, BiomeDef, BiomeId } from './biomes';
import { GAME_RULES } from '../config/gameRules';
import { DAILY_RESET_TIMEZONE, getDailyResetKey } from '../utils/dailyReset';
import { getZonedParts } from '../utils/timezoneUtils';

export const SURGE_BIOME_ROTATION: BiomeId[] = BIOMES.map((b) => b.id);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BIOME_SURGE_EPOCH = Date.UTC(2026, 0, 1);

export function getSurgeBiome(date: Date = new Date()): BiomeDef {
  const elapsed = date.getTime() - BIOME_SURGE_EPOCH;
  const weekIdx = Math.floor(elapsed / WEEK_MS);
  const safeIdx = ((weekIdx % BIOMES.length) + BIOMES.length) % BIOMES.length;
  return BIOMES[safeIdx];
}

export function getSurgeBiomeId(date: Date = new Date()): BiomeId {
  return getSurgeBiome(date).id;
}

export function getActiveSurge(date: Date = new Date()): BiomeDef {
  return getSurgeBiome(date);
}

export function getSeasonWindow(date: Date = new Date()): { seasonId: string; start: Date; end: Date } {
  const SEASON_DAYS = 30;
  const seasonMs = SEASON_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = date.getTime() - BIOME_SURGE_EPOCH;
  const seasonIdx = Math.floor(elapsed / seasonMs);
  const startMs = BIOME_SURGE_EPOCH + seasonIdx * seasonMs;
  const endMs = startMs + seasonMs;
  return {
    seasonId: `season-${seasonIdx}`,
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

export function isBurstActive(date: Date = new Date()): boolean {
  const parts = getZonedParts(date, DAILY_RESET_TIMEZONE);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  if (weekday === 5 && parts.hour >= 18) return true;
  if (weekday === 6) return true;
  if (weekday === 0 && parts.hour < 18) return true;
  return false;
}

export function isBurstWindow(date: Date = new Date()): boolean {
  return isBurstActive(date);
}

export function getMaxDailyFights(date: Date = new Date()): number {
  return isBurstActive(date) ? GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1 : GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
}

export function getBurstGrowthChance(date: Date = new Date()): number {
  return isBurstActive(date) ? GAME_RULES.BOTS.BURST_GROWTH_CHANCE : GAME_RULES.BOTS.GROWTH_CHANCE;
}

export function getDepthToIdleRatio(depth: number, idleKills: number): number {
  if (idleKills <= 0) return depth;
  return depth / idleKills;
}

export function getBurstBonusKey(date: Date = new Date()): string {
  return `bitbrawler_burst_bonus_${getDailyResetKey(date.getTime())}`;
}

export function isBurstBonusUsed(date: Date = new Date()): boolean {
  try {
    return localStorage.getItem(getBurstBonusKey(date)) === '1';
  } catch {
    return false;
  }
}

export function markBurstBonusUsed(date: Date = new Date()): void {
  try {
    localStorage.setItem(getBurstBonusKey(date), '1');
  } catch { /* ignore */ }
}

export function clearBurstBonusUsed(date: Date = new Date()): void {
  try {
    localStorage.removeItem(getBurstBonusKey(date));
  } catch { /* ignore */ }
}
