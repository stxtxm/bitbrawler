import { describe, it, expect } from 'vitest';
import { formatRelativeLogDate, formatSettingsLogDate } from '../../utils/arenaUtils';

describe('arenaUtils', () => {
  it('formatSettingsLogDate returns a string', () => {
    const result = formatSettingsLogDate(Date.now());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatSettingsLogDate contains date separators', () => {
    const result = formatSettingsLogDate(1700000000000);
    expect(result).toContain('/');
  });

  it('formatSettingsLogDate handles timestamps', () => {
    const ts = new Date('2026-06-17T12:00:00').getTime();
    const result = formatSettingsLogDate(ts);
    expect(typeof result).toBe('string');
  });

  it('formatSettingsLogDate handles zero timestamp', () => {
    const result = formatSettingsLogDate(0);
    expect(typeof result).toBe('string');
  });

  it('formatRelativeLogDate renders a compact relative time', () => {
    const now = new Date('2026-11-23T12:00:00Z').getTime();

    expect(formatRelativeLogDate(now - 20_000, now)).toBe('JUST NOW');
    expect(formatRelativeLogDate(now - 5 * 60_000, now)).toBe('5M AGO');
    expect(formatRelativeLogDate(now - 3 * 3_600_000, now)).toBe('3H AGO');
    expect(formatRelativeLogDate(now - 2 * 86_400_000, now)).toBe('2D AGO');
  });

  it('formatRelativeLogDate falls back safely on invalid timestamps', () => {
    expect(formatRelativeLogDate(0)).toBe('UNKNOWN');
    expect(formatRelativeLogDate(Number.NaN)).toBe('UNKNOWN');
    expect(formatRelativeLogDate(Number.POSITIVE_INFINITY)).toBe('UNKNOWN');
  });
});
