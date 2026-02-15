import { describe, it, expect } from 'vitest';
import {
  formatZonedDateLabel,
  getZonedMidnightUtc,
  getZonedMidnightUtcForWindow,
  getZonedParts,
  isWithinZonedHourWindow,
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

  it('checks wrapped hour windows across midnight', () => {
    const before = new Date(Date.UTC(2025, 0, 15, 21, 59, 0)); // 22:59 Paris
    const inFirstHour = new Date(Date.UTC(2025, 0, 15, 22, 30, 0)); // 23:30 Paris
    const inSecondHour = new Date(Date.UTC(2025, 0, 15, 23, 30, 0)); // 00:30 Paris (next day)
    const after = new Date(Date.UTC(2025, 0, 16, 0, 0, 0)); // 01:00 Paris

    expect(isWithinZonedHourWindow(before, 'Europe/Paris', 23, 1)).toBe(false);
    expect(isWithinZonedHourWindow(inFirstHour, 'Europe/Paris', 23, 1)).toBe(true);
    expect(isWithinZonedHourWindow(inSecondHour, 'Europe/Paris', 23, 1)).toBe(true);
    expect(isWithinZonedHourWindow(after, 'Europe/Paris', 23, 1)).toBe(false);
  });

  it('maps 23:xx and 00:xx to the same reset midnight', () => {
    const at2330Paris = new Date(Date.UTC(2025, 0, 15, 22, 30, 0)); // 23:30 Paris
    const at0030Paris = new Date(Date.UTC(2025, 0, 15, 23, 30, 0)); // 00:30 Paris

    const first = getZonedMidnightUtcForWindow(at2330Paris, 'Europe/Paris', 23);
    const second = getZonedMidnightUtcForWindow(at0030Paris, 'Europe/Paris', 23);

    expect(first).toBe(second);
    expect(first).toBe(Date.UTC(2025, 0, 15, 23, 0, 0));
  });
});
