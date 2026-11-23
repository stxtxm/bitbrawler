import { getZonedMidnightUtc, getZonedParts } from './timezoneUtils';

export const STREAK_LADDER_TIMEZONE = 'Europe/Paris';
export const STREAK_LADDER_RETENTION_WEEKS = 8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TIER_ORDER: Record<StreakLadderTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

export type StreakLadderTier = 'bronze' | 'silver' | 'gold';

export interface StreakLadderEntryInput {
  characterId: string;
  name: string;
  streak: number;
  updatedAt?: number;
}

export interface StreakLadderEntry extends StreakLadderEntryInput {
  rank: number;
  tier: StreakLadderTier | null;
}

function zonedCalendarDate(timestamp: number, timeZone: string): Date {
  const { year, month, day } = getZonedParts(new Date(timestamp), timeZone);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function isoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

export function getWeekKey(timestamp: number, timeZone = STREAK_LADDER_TIMEZONE): string {
  const date = zonedCalendarDate(timestamp, timeZone);
  date.setUTCDate(date.getUTCDate() + 4 - isoWeekday(date));
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function getWeekStartMs(timestamp: number, timeZone = STREAK_LADDER_TIMEZONE): number {
  const date = zonedCalendarDate(timestamp, timeZone);
  date.setUTCDate(date.getUTCDate() - (isoWeekday(date) - 1));
  return getZonedMidnightUtc(date, timeZone);
}

export function getWeekEndMs(timestamp: number, timeZone = STREAK_LADDER_TIMEZONE): number {
  const nextWeekProbe = getWeekStartMs(timestamp, timeZone) + 8 * MS_PER_DAY;
  return getWeekStartMs(nextWeekProbe, timeZone);
}

export function getPreviousWeekKey(timestamp: number, timeZone = STREAK_LADDER_TIMEZONE): string {
  return getWeekKey(getWeekStartMs(timestamp, timeZone) - MS_PER_DAY, timeZone);
}

export function getRetentionCutoffWeek(
  timestamp: number,
  weeks = STREAK_LADDER_RETENTION_WEEKS,
  timeZone = STREAK_LADDER_TIMEZONE,
): string {
  return getWeekKey(timestamp - weeks * 7 * MS_PER_DAY, timeZone);
}

export function normalizeLadderStreak(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

export function getLadderTier(rank: number, total: number): StreakLadderTier | null {
  if (!Number.isFinite(rank) || !Number.isFinite(total) || total <= 0 || rank < 1) return null;
  const goldCut = Math.max(1, Math.ceil(total * 0.1));
  const silverCut = Math.max(goldCut + 1, Math.ceil(total * 0.25));
  const bronzeCut = Math.max(silverCut + 1, Math.ceil(total * 0.5));
  if (rank <= goldCut) return 'gold';
  if (rank <= silverCut) return 'silver';
  if (rank <= bronzeCut) return 'bronze';
  return null;
}

export function buildStreakLadder(entries: StreakLadderEntryInput[]): StreakLadderEntry[] {
  const byCharacter = new Map<string, StreakLadderEntryInput>();

  for (const entry of entries) {
    if (!entry || typeof entry.characterId !== 'string' || entry.characterId.length === 0) continue;
    const normalized: StreakLadderEntryInput = {
      characterId: entry.characterId,
      name: (entry.name ?? '').trim() || 'UNKNOWN',
      streak: normalizeLadderStreak(entry.streak),
      updatedAt: entry.updatedAt,
    };
    const existing = byCharacter.get(normalized.characterId);
    if (!existing || normalized.streak > existing.streak) {
      byCharacter.set(normalized.characterId, normalized);
    }
  }

  const ordered = [...byCharacter.values()].sort(
    (left, right) => right.streak - left.streak || left.name.localeCompare(right.name),
  );

  return ordered.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    tier: getLadderTier(index + 1, ordered.length),
  }));
}

export function findOwnEntry(
  entries: StreakLadderEntry[],
  characterId: string | undefined,
): StreakLadderEntry | null {
  if (!characterId) return null;
  return entries.find((entry) => entry.characterId === characterId) ?? null;
}

export function getBestTier(
  tiers: Iterable<StreakLadderTier | null | undefined>,
): StreakLadderTier | null {
  let best: StreakLadderTier | null = null;
  for (const tier of tiers) {
    if (!tier) continue;
    if (!best || TIER_ORDER[tier] > TIER_ORDER[best]) best = tier;
  }
  return best;
}

export function formatLadderWeekLabel(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  return `SEMAINE ${Number(match[2])} · ${match[1]}`;
}
