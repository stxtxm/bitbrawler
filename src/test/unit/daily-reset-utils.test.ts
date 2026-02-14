import { describe, it, expect } from 'vitest';
import { shouldResetDaily } from '../../utils/dailyReset';

describe('shouldResetDaily', () => {
  it('returns true when the last reset was on a previous day', () => {
    const now = Date.UTC(2025, 0, 2, 1, 0, 0); // 02:00 Paris (CET)
    const lastReset = Date.UTC(2025, 0, 1, 22, 0, 0); // 23:00 Paris, previous day
    expect(shouldResetDaily(lastReset, now)).toBe(true);
  });

  it('returns false when the last reset is today', () => {
    const now = Date.UTC(2025, 0, 2, 3, 0, 0); // 04:00 Paris
    const lastReset = Date.UTC(2025, 0, 1, 23, 30, 0); // 00:30 Paris same day
    expect(shouldResetDaily(lastReset, now)).toBe(false);
  });

  it('handles the midnight boundary correctly', () => {
    const now = Date.UTC(2025, 0, 1, 23, 5, 0); // 00:05 Paris Jan 2
    const lastReset = Date.UTC(2025, 0, 1, 22, 59, 59); // 23:59 Paris Jan 1
    expect(shouldResetDaily(lastReset, now)).toBe(true);
  });
});
