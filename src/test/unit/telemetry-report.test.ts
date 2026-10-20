import { describe, it, expect } from 'vitest';
import { summarizeTelemetry, utcDay, type TelemetryReportRow } from '../../utils/telemetryReport';

const row = (
  install_id: string,
  event: string,
  created_at: string,
  extra: Partial<TelemetryReportRow> = {},
): TelemetryReportRow => ({
  install_id,
  event,
  created_at,
  level: null,
  props: null,
  ...extra,
});

describe('telemetry report (#1230 part 2)', () => {
  it('normalizes timestamps to UTC days', () => {
    expect(utcDay('2026-10-08T23:30:00.000Z')).toBe('2026-10-08');
    expect(utcDay('2026-10-08T00:30:00+02:00')).toBe('2026-10-07');
    expect(utcDay('not-a-date')).toBeNull();
  });

  it('is empty-safe', () => {
    const summary = summarizeTelemetry([]);
    expect(summary.totalEvents).toBe(0);
    expect(summary.totalInstalls).toBe(0);
    expect(summary.d1.rate).toBeNull();
    expect(summary.d7.rate).toBeNull();
    expect(summary.purchases.avgPrice).toBeNull();
    expect(summary.boss.winRate).toBeNull();
  });

  it('computes mature D1/D7 cohorts from session_start only', () => {
    const rows: TelemetryReportRow[] = [
      // A: returns on D1 and D7 — the only retained install of cohort 10-01.
      row('a', 'session_start', '2026-10-01T10:00:00Z'),
      row('a', 'session_start', '2026-10-02T10:00:00Z'),
      row('a', 'session_start', '2026-10-08T10:00:00Z', { level: 12 }),
      // B: never returns.
      row('b', 'session_start', '2026-10-01T12:00:00Z', { level: 30 }),
      // C: new on 10-02, never returns; its D7 is not mature yet.
      row('c', 'session_start', '2026-10-02T09:00:00Z', { level: 5 }),
    ];

    const summary = summarizeTelemetry(rows);

    expect(summary.firstDay).toBe('2026-10-01');
    expect(summary.lastDay).toBe('2026-10-08');
    expect(summary.totalInstalls).toBe(3);
    expect(summary.activeByDay).toEqual([
      { day: '2026-10-01', installs: 2 },
      { day: '2026-10-02', installs: 2 },
      { day: '2026-10-08', installs: 1 },
    ]);

    expect(summary.cohorts).toEqual([
      { day: '2026-10-01', installs: 2, d1: 0.5, d7: 0.5 },
      { day: '2026-10-02', installs: 1, d1: 0, d7: null },
    ]);

    // Pooled D1: cohorts 10-01 (2) and 10-02 (1) are mature → 1/3.
    expect(summary.d1).toEqual({ retained: 1, eligible: 3, rate: 1 / 3 });
    // Pooled D7: only cohort 10-01 is mature at 10-08 → 1/2.
    expect(summary.d7).toEqual({ retained: 1, eligible: 2, rate: 0.5 });
  });

  it('ignores rows without an install id and events that are not session_start for D1/D7', () => {
    const rows: TelemetryReportRow[] = [
      row('', 'session_start', '2026-10-01T10:00:00Z'),
      row('a', 'session_start', '2026-10-01T10:00:00Z'),
      row('a', 'level_up', '2026-10-02T10:00:00Z'),
      row('a', 'purchase', '2026-10-02T10:00:00Z'),
    ];

    const summary = summarizeTelemetry(rows);
    expect(summary.totalInstalls).toBe(1);
    expect(summary.cohorts).toEqual([{ day: '2026-10-01', installs: 1, d1: 0, d7: null }]);
    expect(summary.d1).toEqual({ retained: 0, eligible: 1, rate: 0 });
  });

  it('summarizes levels, purchases, walls and boss outcomes', () => {
    const rows: TelemetryReportRow[] = [
      row('a', 'session_start', '2026-10-01T10:00:00Z', { level: 10 }),
      row('a', 'level_up', '2026-10-02T10:00:00Z', { level: 12 }),
      row('b', 'session_start', '2026-10-01T10:00:00Z', { level: 30 }),
      row('a', 'purchase', '2026-10-03T10:00:00Z', { props: { offer: 'Bronze Axe', price: 27 } }),
      row('b', 'purchase', '2026-10-03T11:00:00Z', { props: { offer: 'Coffre mystère', price: 53 } }),
      row('a', 'wall_reached', '2026-10-05T10:00:00Z', { level: 31, props: { losses: 3, level: 31 } }),
      row('b', 'wall_reached', '2026-10-06T10:00:00Z', { level: 31, props: { losses: 4, level: 31 } }),
      row('a', 'boss_attempt', '2026-10-07T10:00:00Z', { props: { boss: 'VOID TITAN', won: true } }),
      row('b', 'boss_attempt', '2026-10-07T11:00:00Z', { props: { boss: 'VOID TITAN', won: false } }),
      row('b', 'boss_attempt', '2026-10-08T11:00:00Z', { props: { boss: 'VOID TITAN', won: true } }),
    ];

    const summary = summarizeTelemetry(rows);

    expect(summary.levels).toEqual([
      { level: 31, installs: 2 },
    ]);
    expect(summary.purchases).toEqual({ count: 2, installs: 2, avgPrice: 40 });
    expect(summary.walls).toEqual([{ level: 31, count: 2 }]);
    expect(summary.boss).toEqual({
      attempts: 3,
      installs: 2,
      wins: 2,
      winRate: 2 / 3,
    });
    expect(summary.events[0]).toEqual({ event: 'boss_attempt', count: 3 });
    expect(summary.events).toContainEqual({ event: 'purchase', count: 2 });
  });

  it('reads the wall level from props when the ambient level column is empty', () => {
    const summary = summarizeTelemetry([
      row('a', 'session_start', '2026-10-01T10:00:00Z'),
      row('a', 'wall_reached', '2026-10-02T10:00:00Z', {
        level: null,
        props: { level: 12, losses: 3 },
      }),
    ]);

    expect(summary.walls).toEqual([{ level: 12, count: 1 }]);
  });
});
