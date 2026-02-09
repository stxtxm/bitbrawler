import { describe, it, expect } from 'vitest';
import {
  formatZonedDateLabel,
  getZonedMidnightUtc,
  getZonedParts,
  isWithinZonedMidnightWindow
} from '../../utils/timezoneUtils';

describe('timezoneUtils', () => {
  it('computes Paris midnight UTC in winter (CET)', () => {
    const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
    const midnightUtc = getZonedMidnightUtc(date, 'Europe/Paris');
    expect(midnightUtc).toBe(Date.UTC(2025, 0, 14, 23, 0, 0));
  });

  it('computes Paris midnight UTC in summer (CEST)', () => {
    const date = new Date(Date.UTC(2025, 6, 15, 12, 0, 0));
    const midnightUtc = getZonedMidnightUtc(date, 'Europe/Paris');
    expect(midnightUtc).toBe(Date.UTC(2025, 6, 14, 22, 0, 0));
  });

  it('formats zoned date labels and midnight window checks', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 23, 5, 0)); // 00:05 Paris (CET)
    const parts = getZonedParts(date, 'Europe/Paris');
    expect(formatZonedDateLabel(parts)).toBe('2025-01-15');
    expect(isWithinZonedMidnightWindow(date, 'Europe/Paris', 10)).toBe(true);

    const later = new Date(Date.UTC(2025, 0, 14, 23, 20, 0)); // 00:20 Paris (CET)
    expect(isWithinZonedMidnightWindow(later, 'Europe/Paris', 10)).toBe(false);
  });
});
