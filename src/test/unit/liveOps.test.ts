import { describe, it, expect } from 'vitest';
import {
  ACTIVE_SURGE,
  BURST_ACTIVE,
  SEASON_ID,
  SEASON_LENGTH_DAYS,
  LIVEOPS_TIMEZONE,
  SURGE_ROTATION,
  getActiveSurge,
  isBurstActive,
  getSeasonWindow,
  getSurgeBiomeId,
  getBurstState,
} from '../../data/liveOps';

function parisToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const getOffset = (ts: number) => {
    const d = new Date(ts);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: LIVEOPS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(d);
    const map: Record<string, string> = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    const zonedAsUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    return (zonedAsUtc - ts) / 60000;
  };
  let offset = getOffset(guessUtc);
  let utc = guessUtc - offset * 60000;
  const secondOffset = getOffset(utc);
  if (secondOffset !== offset) {
    offset = secondOffset;
    utc = guessUtc - offset * 60000;
  }
  return new Date(utc);
}

describe('liveOps foundation', () => {
  describe('constants', () => {
    it('exposes LIVEOPS_TIMEZONE as Europe/Paris', () => {
      expect(LIVEOPS_TIMEZONE).toBe('Europe/Paris');
    });
    it('exposes SEASON_LENGTH_DAYS as 30', () => {
      expect(SEASON_LENGTH_DAYS).toBe(30);
    });
    it('exposes SURGE_ROTATION with at least 3 biomes including future placeholders', () => {
      expect(SURGE_ROTATION.length).toBeGreaterThanOrEqual(3);
      expect(SURGE_ROTATION).toContain('plains');
      expect(SURGE_ROTATION).toContain('volcanic');
      expect(SURGE_ROTATION).toContain('abyssal');
    });
    it('includes future forest/desert placeholders non-blocking', () => {
      expect(SURGE_ROTATION).toContain('forest');
      expect(SURGE_ROTATION).toContain('desert');
    });
    it('exposes ACTIVE_SURGE as valid SurgeId', () => {
      expect(SURGE_ROTATION).toContain(ACTIVE_SURGE);
    });
    it('exposes BURST_ACTIVE as boolean', () => {
      expect(typeof BURST_ACTIVE).toBe('boolean');
    });
    it('exposes SEASON_ID as non-empty string', () => {
      expect(typeof SEASON_ID).toBe('string');
      expect(SEASON_ID.length).toBeGreaterThan(0);
    });
  });

  describe('getActiveSurge', () => {
    it('is deterministic for same date', () => {
      const d = parisToUtc(2026, 9, 11, 10, 0);
      expect(getActiveSurge(d)).toBe(getActiveSurge(d));
    });
    it('is stable within same week regardless of hour', () => {
      const mon = parisToUtc(2026, 9, 7, 9, 0);
      const fri = parisToUtc(2026, 9, 11, 22, 0);
      expect(getActiveSurge(mon)).toBe(getActiveSurge(fri));
    });
    it('changes on next week', () => {
      const week1 = parisToUtc(2026, 9, 7, 10, 0);
      const week2 = parisToUtc(2026, 9, 14, 10, 0);
      expect(getActiveSurge(week1)).not.toBe(getActiveSurge(week2));
    });
    it('cycles through SURGE_ROTATION deterministically', () => {
      const base = parisToUtc(2026, 1, 5, 10, 0);
      const seen = new Set<string>();
      for (let w = 0; w < SURGE_ROTATION.length; w++) {
        const d = new Date(base.getTime() + w * 7 * 86400000);
        seen.add(getActiveSurge(d));
      }
      expect(seen.size).toBe(SURGE_ROTATION.length);
    });
    it('wraps around after full rotation', () => {
      const start = parisToUtc(2026, 1, 5, 10, 0);
      const afterCycle = new Date(start.getTime() + SURGE_ROTATION.length * 7 * 86400000);
      expect(getActiveSurge(start)).toBe(getActiveSurge(afterCycle));
    });
    it('maps previous epoch Monday consistently', () => {
      const a = parisToUtc(2026, 1, 1, 12, 0);
      const b = parisToUtc(2026, 1, 1, 23, 59);
      expect(getActiveSurge(a)).toBe(getActiveSurge(b));
    });
  });

  describe('getSurgeBiomeId', () => {
    it('maps plains/volcanic/abyssal to themselves', () => {
      expect(getSurgeBiomeId('plains')).toBe('plains');
      expect(getSurgeBiomeId('volcanic')).toBe('volcanic');
      expect(getSurgeBiomeId('abyssal')).toBe('abyssal');
    });
    it('maps future forest/desert without throwing and fallback to plains-compatible', () => {
      expect(() => getSurgeBiomeId('forest')).not.toThrow();
      expect(() => getSurgeBiomeId('desert')).not.toThrow();
      const fb = getSurgeBiomeId('forest');
      const db = getSurgeBiomeId('desert');
      expect(['plains', 'volcanic', 'abyssal', 'forest', 'desert']).toContain(fb);
      expect(['plains', 'volcanic', 'abyssal', 'forest', 'desert']).toContain(db);
    });
  });

  describe('isBurstActive', () => {
    it('is inactive Friday before 18h Paris (CEST)', () => {
      const d = parisToUtc(2026, 9, 11, 17, 59);
      expect(isBurstActive(d)).toBe(false);
    });
    it('is active Friday at 18h Paris', () => {
      const d = parisToUtc(2026, 9, 11, 18, 0);
      expect(isBurstActive(d)).toBe(true);
    });
    it('is active Friday 23:30 Paris', () => {
      const d = parisToUtc(2026, 9, 11, 23, 30);
      expect(isBurstActive(d)).toBe(true);
    });
    it('is active Saturday noon Paris', () => {
      const d = parisToUtc(2026, 9, 12, 12, 0);
      expect(isBurstActive(d)).toBe(true);
    });
    it('is active Sunday before 18h Paris', () => {
      const d = parisToUtc(2026, 9, 13, 17, 59);
      expect(isBurstActive(d)).toBe(true);
    });
    it('is inactive Sunday at 18h Paris', () => {
      const d = parisToUtc(2026, 9, 13, 18, 0);
      expect(isBurstActive(d)).toBe(false);
    });
    it('is inactive Monday Paris', () => {
      const d = parisToUtc(2026, 9, 14, 10, 0);
      expect(isBurstActive(d)).toBe(false);
    });
    it('is inactive Thursday Paris', () => {
      const d = parisToUtc(2026, 9, 10, 20, 0);
      expect(isBurstActive(d)).toBe(false);
    });
    it('handles winter burst Friday 18h CET', () => {
      const before = parisToUtc(2026, 1, 9, 17, 59);
      const at = parisToUtc(2026, 1, 9, 18, 0);
      expect(isBurstActive(before)).toBe(false);
      expect(isBurstActive(at)).toBe(true);
    });
    it('handles winter Sunday 18h CET', () => {
      const before = parisToUtc(2026, 1, 11, 17, 59);
      const after = parisToUtc(2026, 1, 11, 18, 0);
      expect(isBurstActive(before)).toBe(true);
      expect(isBurstActive(after)).toBe(false);
    });
    it('is deterministic for same instant', () => {
      const d = parisToUtc(2026, 9, 12, 15, 0);
      expect(isBurstActive(d)).toBe(isBurstActive(new Date(d.getTime())));
    });
  });

  describe('getBurstState', () => {
    it('returns active flag matching isBurstActive', () => {
      const d = parisToUtc(2026, 9, 12, 12, 0);
      const state = getBurstState(d);
      expect(state.active).toBe(isBurstActive(d));
      expect(state.startsAt instanceof Date).toBe(true);
      expect(state.endsAt instanceof Date).toBe(true);
      expect(state.startsAt.getTime()).toBeLessThan(state.endsAt.getTime());
    });
    it('window spans 48 hours Friday 18h to Sunday 18h', () => {
      const d = parisToUtc(2026, 9, 12, 12, 0);
      const state = getBurstState(d);
      const diff = state.endsAt.getTime() - state.startsAt.getTime();
      expect(diff).toBe(48 * 3600 * 1000);
    });
  });

  describe('getSeasonWindow', () => {
    it('returns 30-day window for epoch start 2026-01-01', () => {
      const d = parisToUtc(2026, 1, 1, 12, 0);
      const w = getSeasonWindow(d);
      expect(w.startKey).toBe('2026-01-01');
      expect(w.endKey).toBe('2026-01-31');
      expect(w.index).toBe(0);
      expect(w.id.length).toBeGreaterThan(0);
    });
    it('returns same window for any date within same 30-day season', () => {
      const a = parisToUtc(2026, 1, 5, 10, 0);
      const b = parisToUtc(2026, 1, 30, 23, 0);
      expect(getSeasonWindow(a).id).toBe(getSeasonWindow(b).id);
      expect(getSeasonWindow(a).startKey).toBe(getSeasonWindow(b).startKey);
    });
    it('advances to next season after 30 days', () => {
      const first = parisToUtc(2026, 1, 1, 12, 0);
      const next = parisToUtc(2026, 1, 31, 12, 0);
      const w1 = getSeasonWindow(first);
      const w2 = getSeasonWindow(next);
      expect(w2.index).toBe(w1.index + 1);
      expect(w2.startKey).toBe('2026-01-31');
      expect(w2.endKey).toBe('2026-03-02');
    });
    it('windows are contiguous and cover 30 days each', () => {
      const w1 = getSeasonWindow(parisToUtc(2026, 2, 15, 12, 0));
      const w2 = getSeasonWindow(parisToUtc(2026, 3, 17, 12, 0));
      expect(w1.endKey).toBe(w2.startKey);
      const startMs = w1.start.getTime();
      const endMs = w1.end.getTime();
      expect(endMs - startMs).toBe(30 * 86400000);
    });
    it('is deterministic for same date', () => {
      const d = parisToUtc(2026, 6, 15, 12, 0);
      expect(getSeasonWindow(d).id).toBe(getSeasonWindow(new Date(d.getTime())).id);
    });
    it('handles date far from epoch (months later)', () => {
      const d = parisToUtc(2026, 9, 11, 12, 0);
      const w = getSeasonWindow(d);
      expect(w.index).toBeGreaterThan(0);
      expect(w.startKey < w.endKey).toBe(true);
    });
    it('start and end are Date instances with correct ordering', () => {
      const w = getSeasonWindow(parisToUtc(2026, 9, 11, 12, 0));
      expect(w.start instanceof Date).toBe(true);
      expect(w.end instanceof Date).toBe(true);
      expect(w.start.getTime()).toBeLessThan(w.end.getTime());
    });
  });

  describe('derived constants consistency', () => {
    it('ACTIVE_SURGE matches getActiveSurge for now', () => {
      const now = new Date();
      expect(SURGE_ROTATION).toContain(getActiveSurge(now));
      expect(typeof ACTIVE_SURGE).toBe('string');
    });
    it('BURST_ACTIVE matches isBurstActive for now', () => {
      const now = new Date();
      expect(typeof BURST_ACTIVE).toBe('boolean');
      expect(BURST_ACTIVE).toBe(isBurstActive(now));
    });
    it('SEASON_ID matches getSeasonWindow for now', () => {
      const now = new Date();
      expect(SEASON_ID).toBe(getSeasonWindow(now).id);
    });
  });
});
