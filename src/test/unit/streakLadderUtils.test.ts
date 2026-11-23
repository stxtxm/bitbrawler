import { describe, it, expect } from 'vitest';
import {
  buildStreakLadder,
  findOwnEntry,
  formatLadderWeekLabel,
  getBestTier,
  getLadderTier,
  getPreviousWeekKey,
  getRetentionCutoffWeek,
  getWeekEndMs,
  getWeekKey,
  getWeekStartMs,
  normalizeLadderStreak,
  type StreakLadderEntryInput,
} from '../../utils/streakLadderUtils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('streakLadderUtils — semaine ISO Europe/Paris', () => {
  it('returns the ISO week of a Paris date, not the UTC date', () => {
    const sundayUtc = Date.UTC(2026, 10, 22, 23, 30, 0);
    expect(getWeekKey(sundayUtc)).toBe('2026-W48');
  });

  it('keeps the previous week for a Sunday evening in Paris', () => {
    const sundayParis = Date.UTC(2026, 10, 22, 22, 30, 0);
    expect(getWeekKey(sundayParis)).toBe('2026-W47');
  });

  it('handles the ISO year boundary', () => {
    expect(getWeekKey(Date.UTC(2027, 0, 1, 12, 0, 0))).toBe('2026-W53');
  });

  it('computes the Monday midnight (Paris) start and next Monday end', () => {
    const midday = Date.UTC(2026, 10, 23, 12, 0, 0);
    expect(getWeekStartMs(midday)).toBe(Date.UTC(2026, 10, 22, 23, 0, 0));
    expect(getWeekEndMs(midday)).toBe(Date.UTC(2026, 10, 29, 23, 0, 0));
  });

  it('returns the previous week key', () => {
    const monday = Date.UTC(2026, 10, 23, 12, 0, 0);
    expect(getPreviousWeekKey(monday)).toBe('2026-W47');
  });

  it('computes a retention cutoff week', () => {
    const monday = Date.UTC(2026, 10, 23, 12, 0, 0);
    expect(getRetentionCutoffWeek(monday, 8)).toBe(getWeekKey(monday - 8 * 7 * MS_PER_DAY));
  });

  it('formats the week label', () => {
    expect(formatLadderWeekLabel('2026-W48')).toBe('SEMAINE 48 · 2026');
    expect(formatLadderWeekLabel('nope')).toBe('nope');
  });
});

describe('streakLadderUtils — tiers par pourcentage', () => {
  it('assigns top 10% gold, top 25% silver, top 50% bronze', () => {
    expect(getLadderTier(1, 100)).toBe('gold');
    expect(getLadderTier(10, 100)).toBe('gold');
    expect(getLadderTier(11, 100)).toBe('silver');
    expect(getLadderTier(25, 100)).toBe('silver');
    expect(getLadderTier(26, 100)).toBe('bronze');
    expect(getLadderTier(50, 100)).toBe('bronze');
    expect(getLadderTier(51, 100)).toBeNull();
  });

  it('stays generous on tiny ladders', () => {
    expect(getLadderTier(1, 3)).toBe('gold');
    expect(getLadderTier(2, 3)).toBe('silver');
    expect(getLadderTier(3, 3)).toBe('bronze');
  });

  it('returns null for invalid inputs', () => {
    expect(getLadderTier(0, 10)).toBeNull();
    expect(getLadderTier(1, 0)).toBeNull();
    expect(getLadderTier(Number.NaN, 10)).toBeNull();
  });
});

describe('streakLadderUtils — classement', () => {
  const entries: StreakLadderEntryInput[] = [
    { characterId: 'c', name: 'Charlie', streak: 4 },
    { characterId: 'a', name: 'Alpha', streak: 12 },
    { characterId: 'b', name: 'Bravo', streak: 7 },
  ];

  it('sorts by streak descending and assigns ranks and tiers', () => {
    const ladder = buildStreakLadder(entries);
    expect(ladder.map((e) => e.characterId)).toEqual(['a', 'b', 'c']);
    expect(ladder.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(ladder.map((e) => e.tier)).toEqual(['gold', 'silver', 'bronze']);
  });

  it('normalizes and dedupes characters, keeping the best streak', () => {
    const ladder = buildStreakLadder([
      { characterId: 'a', name: 'Alpha', streak: 3 },
      { characterId: 'a', name: 'Alpha', streak: 9 },
      { characterId: '', name: 'Ghost', streak: 50 },
    ]);
    expect(ladder).toHaveLength(1);
    expect(ladder[0].streak).toBe(9);
  });

  it('breaks ties by name for deterministic ranks', () => {
    const ladder = buildStreakLadder([
      { characterId: 'z', name: 'Zulu', streak: 5 },
      { characterId: 'a', name: 'Alpha', streak: 5 },
    ]);
    expect(ladder.map((e) => e.name)).toEqual(['Alpha', 'Zulu']);
  });

  it('normalizes streak values', () => {
    expect(normalizeLadderStreak(3.9)).toBe(3);
    expect(normalizeLadderStreak(-2)).toBe(0);
    expect(normalizeLadderStreak(Number.NaN)).toBe(0);
    expect(normalizeLadderStreak('8')).toBe(8);
    expect(normalizeLadderStreak(undefined)).toBe(0);
  });

  it('finds the own entry', () => {
    const ladder = buildStreakLadder(entries);
    expect(findOwnEntry(ladder, 'b')?.rank).toBe(2);
    expect(findOwnEntry(ladder, 'missing')).toBeNull();
  });

  it('returns the best tier across badges', () => {
    expect(getBestTier(['bronze', 'gold', 'silver'])).toBe('gold');
    expect(getBestTier([null, 'silver', undefined])).toBe('silver');
    expect(getBestTier([])).toBeNull();
  });
});
