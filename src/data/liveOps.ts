import { BIOMES, BiomeDef, BiomeId } from './biomes';
import { GAME_RULES } from '../config/gameRules';
import { DAILY_RESET_TIMEZONE, getDailyResetKey } from '../utils/dailyReset';
import { getZonedParts, getTimeZoneOffsetMinutes } from '../utils/timezoneUtils';

export const LIVEOPS_TIMEZONE = 'Europe/Paris';
export const SEASON_LENGTH_DAYS = 30;
export const SEASON_EPOCH_KEY = '2026-01-01';

export type SurgeId = BiomeId | 'forest' | 'desert';

export type BurstState = {
  active: boolean;
  startsAt: Date;
  endsAt: Date;
};

export type SeasonWindow = {
  id: string;
  index: number;
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  seasonId: string;
};

export const SURGE_ROTATION: SurgeId[] = ['plains', 'volcanic', 'abyssal', 'forest', 'desert'];
export const SURGE_BIOME_ROTATION: BiomeId[] = BIOMES.map((b) => b.id);

const EPOCH_MONDAY_UTC = Date.UTC(2025, 11, 29);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BIOME_SURGE_EPOCH = Date.UTC(2026, 0, 1);

function getParisWeekday(date: Date): number {
  const parts = getZonedParts(date, LIVEOPS_TIMEZONE);
  const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
  return new Date(noonUtc).getUTCDay();
}

function getMondayUtcMs(date: Date): number {
  const parts = getZonedParts(date, LIVEOPS_TIMEZONE);
  const weekday = getParisWeekday(date);
  const offsetToMonday = (weekday + 6) % 7;
  return Date.UTC(parts.year, parts.month - 1, parts.day - offsetToMonday);
}

function getDaysSinceEpoch(date: Date): number {
  const parts = getZonedParts(date, LIVEOPS_TIMEZONE);
  const utcParis = Date.UTC(parts.year, parts.month - 1, parts.day);
  const utcEpoch = Date.UTC(2026, 0, 1);
  return Math.floor((utcParis - utcEpoch) / 86400000);
}

function parisLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = getTimeZoneOffsetMinutes(new Date(guessUtc), LIVEOPS_TIMEZONE);
  const utc = guessUtc - offset * 60000;
  const secondOffset = getTimeZoneOffsetMinutes(new Date(utc), LIVEOPS_TIMEZONE);
  if (secondOffset !== offset) {
    return new Date(guessUtc - secondOffset * 60000);
  }
  return new Date(utc);
}

function getBurstWindowForDate(date: Date): { startsAt: Date; endsAt: Date } {
  const parts = getZonedParts(date, LIVEOPS_TIMEZONE);
  const weekday = getParisWeekday(date);
  let fridayYear = parts.year;
  let fridayMonth = parts.month;
  let fridayDay = parts.day;
  if (weekday === 5) {
    fridayDay = parts.day;
  } else if (weekday === 6) {
    const utc = Date.UTC(parts.year, parts.month - 1, parts.day - 1);
    const d = new Date(utc);
    fridayYear = d.getUTCFullYear();
    fridayMonth = d.getUTCMonth() + 1;
    fridayDay = d.getUTCDate();
  } else if (weekday === 0) {
    const utc = Date.UTC(parts.year, parts.month - 1, parts.day - 2);
    const d = new Date(utc);
    fridayYear = d.getUTCFullYear();
    fridayMonth = d.getUTCMonth() + 1;
    fridayDay = d.getUTCDate();
  } else {
    const daysToFriday = (5 - weekday + 7) % 7;
    const prevFridayOffset = daysToFriday === 0 ? 0 : daysToFriday - 7;
    const utc = Date.UTC(parts.year, parts.month - 1, parts.day + prevFridayOffset);
    const d = new Date(utc);
    fridayYear = d.getUTCFullYear();
    fridayMonth = d.getUTCMonth() + 1;
    fridayDay = d.getUTCDate();
    if (weekday < 5) {
      const mondayUtc = getMondayUtcMs(date);
      const fridayUtc = mondayUtc + 4 * 86400000;
      const fridayDate = new Date(fridayUtc);
      fridayYear = fridayDate.getUTCFullYear();
      fridayMonth = fridayDate.getUTCMonth() + 1;
      fridayDay = fridayDate.getUTCDate();
    }
  }
  if (weekday >= 1 && weekday <= 4) {
    const mondayUtc = getMondayUtcMs(date);
    const fridayUtc = mondayUtc + 4 * 86400000;
    const fd = new Date(fridayUtc);
    fridayYear = fd.getUTCFullYear();
    fridayMonth = fd.getUTCMonth() + 1;
    fridayDay = fd.getUTCDate();
  }
  const startsAt = parisLocalToUtc(fridayYear, fridayMonth, fridayDay, 18, 0);
  const sundayUtc = Date.UTC(fridayYear, fridayMonth - 1, fridayDay + 2);
  const sundayDate = new Date(sundayUtc);
  const endsAt = parisLocalToUtc(
    sundayDate.getUTCFullYear(),
    sundayDate.getUTCMonth() + 1,
    sundayDate.getUTCDate(),
    18,
    0,
  );
  return { startsAt, endsAt };
}

export function getSurgeBiome(date: Date = new Date()): BiomeDef {
  const elapsed = date.getTime() - BIOME_SURGE_EPOCH;
  const weekIdx = Math.floor(elapsed / WEEK_MS);
  const safeIdx = ((weekIdx % BIOMES.length) + BIOMES.length) % BIOMES.length;
  return BIOMES[safeIdx];
}

export function getSurgeBiomeIdByDate(date: Date = new Date()): BiomeId {
  return getSurgeBiome(date).id;
}

export function getActiveSurge(date: Date = new Date()): SurgeId {
  const mondayUtc = getMondayUtcMs(date);
  const weekIndex = Math.floor((mondayUtc - EPOCH_MONDAY_UTC) / 604800000);
  const len = SURGE_ROTATION.length;
  const idx = ((weekIndex % len) + len) % len;
  return SURGE_ROTATION[idx];
}

export function getActiveSurgeBiome(date: Date = new Date()): BiomeDef {
  return getSurgeBiome(date);
}

export function isBurstActive(date: Date = new Date()): boolean {
  const parts = getZonedParts(date, LIVEOPS_TIMEZONE);
  const weekday = getParisWeekday(date);
  if (weekday === 5) return parts.hour >= 18;
  if (weekday === 6) return true;
  if (weekday === 0) return parts.hour < 18;
  return false;
}

export function isBurstWindow(date: Date = new Date()): boolean {
  return isBurstActive(date);
}

export function getBurstState(date: Date = new Date()): BurstState {
  const { startsAt, endsAt } = getBurstWindowForDate(date);
  return {
    active: isBurstActive(date),
    startsAt,
    endsAt,
  };
}

export function getSeasonWindow(date: Date = new Date()): SeasonWindow {
  const days = getDaysSinceEpoch(date);
  const index = Math.floor(days / SEASON_LENGTH_DAYS);
  const safeIndex = index < 0 ? 0 : index;
  const startDayOffset = safeIndex * SEASON_LENGTH_DAYS;
  const epochUtc = Date.UTC(2026, 0, 1);
  const startUtc = epochUtc + startDayOffset * 86400000;
  const endUtc = startUtc + SEASON_LENGTH_DAYS * 86400000;
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const startKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  const endKey = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
  const id = `S${String(safeIndex + 1).padStart(2, '0')}`;
  return {
    id,
    index: safeIndex,
    start,
    end,
    startKey,
    endKey,
    seasonId: id,
  };
}

export function getMaxDailyFights(date: Date = new Date()): number {
  return isBurstActive(date) ? GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1 : GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
}

export function getBurstGrowthChance(date: Date = new Date()): number {
  const burstChance = (GAME_RULES.BOTS as { BURST_GROWTH_CHANCE?: number }).BURST_GROWTH_CHANCE ?? 0.1;
  return isBurstActive(date) ? burstChance : GAME_RULES.BOTS.GROWTH_CHANCE;
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

export function getSurgeBiomeId(surgeOrDate: SurgeId | Date = new Date()): BiomeId | SurgeId {
  if (typeof surgeOrDate === 'string') {
    const surge = surgeOrDate;
    if (surge === 'plains' || surge === 'volcanic' || surge === 'abyssal') return surge;
    if (surge === 'forest' || surge === 'desert') return surge;
    return 'plains';
  }
  return getSurgeBiome(surgeOrDate).id;
}

export const ACTIVE_SURGE: SurgeId = getActiveSurge(new Date());
export const BURST_ACTIVE: boolean = isBurstActive(new Date());
export const SEASON_ID: string = getSeasonWindow(new Date()).id;

void DAILY_RESET_TIMEZONE;
