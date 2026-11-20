import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  claimDailyLoginEssence,
  getDailyLoginEssenceKey,
  hasClaimedDailyLoginEssence,
} from '../../utils/dailyEssenceUtils';
import { GAME_RULES } from '../../config/gameRules';
import { getDailyResetKey } from '../../utils/dailyReset';

const DAY_ONE = new Date('2026-11-20T12:00:00Z').getTime();
const DAY_TWO = new Date('2026-11-21T12:00:00Z').getTime();

describe('dailyEssenceUtils', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  it('exposes a per-character storage key', () => {
    expect(getDailyLoginEssenceKey('abc')).not.toBe(getDailyLoginEssenceKey('def'));
  });

  it('claims the daily login essence once per Paris day', () => {
    const amount = GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE;
    expect(hasClaimedDailyLoginEssence('hero', DAY_ONE)).toBe(false);
    expect(claimDailyLoginEssence('hero', DAY_ONE)).toBe(amount);
    expect(hasClaimedDailyLoginEssence('hero', DAY_ONE)).toBe(true);
    expect(claimDailyLoginEssence('hero', DAY_ONE)).toBe(0);
  });

  it('allows a new claim on the next day', () => {
    expect(claimDailyLoginEssence('hero', DAY_ONE)).toBe(GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE);
    expect(claimDailyLoginEssence('hero', DAY_TWO)).toBe(GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE);
  });

  it('keeps claims isolated per character', () => {
    claimDailyLoginEssence('hero', DAY_ONE);
    expect(claimDailyLoginEssence('villain', DAY_ONE)).toBe(GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE);
  });

  it('returns zero when there is no valid character id', () => {
    expect(claimDailyLoginEssence('', DAY_ONE)).toBe(0);
    expect(claimDailyLoginEssence('hero', DAY_ONE, 0)).toBe(0);
  });

  it('stores the claim under the current reset day', () => {
    claimDailyLoginEssence('hero', DAY_ONE);
    const raw = localStorage.getItem(getDailyLoginEssenceKey('hero'));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).dayKey).toBe(getDailyResetKey(DAY_ONE));
  });
});
