import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldResetDaily } from '../../utils/dailyReset';

describe('shouldResetDaily', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when the last reset was on a previous day', () => {
    vi.setSystemTime(new Date(2025, 0, 2, 10, 0, 0)); // Jan 2, 10:00 local
    const lastReset = new Date(2025, 0, 1, 23, 0, 0).getTime();
    expect(shouldResetDaily(lastReset)).toBe(true);
  });

  it('returns false when the last reset is today', () => {
    vi.setSystemTime(new Date(2025, 0, 2, 10, 0, 0));
    const lastReset = new Date(2025, 0, 2, 0, 1, 0).getTime();
    expect(shouldResetDaily(lastReset)).toBe(false);
  });

  it('handles the midnight boundary correctly', () => {
    vi.setSystemTime(new Date(2025, 0, 2, 0, 0, 1));
    const lastReset = new Date(2025, 0, 1, 23, 59, 59).getTime();
    expect(shouldResetDaily(lastReset)).toBe(true);
  });
});
