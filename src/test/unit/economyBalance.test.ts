import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ESSENCE_YIELD, UPGRADE_BASE_COST, UPGRADE_COST_SCALING } from '../../data/forgeConstants';
import { getUpgradeCost } from '../../utils/forgeUtils';
import { GAME_RULES } from '../../config/gameRules';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { PixelItemAsset } from '../../types/Item';
import { calculateIdleEssence } from '../../utils/idleXpUtils';
import {
  claimDailyLoginEssence,
  getDailyLoginEssenceKey,
} from '../../utils/dailyEssenceUtils';
import { getDailyResetKey } from '../../utils/dailyReset';

const ITEM = ITEM_ASSETS[0] as PixelItemAsset;

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const oldUpgradeCosts = [30, 50, 70, 90, 110];
const oldYields = [5, 20, 50, 80, 400];
const DAY_ONE = new Date('2026-09-14T10:00:00Z').getTime();
const DAY_TWO = new Date('2026-09-15T10:00:00Z').getTime();

describe('Economy balance — upgrade costs', () => {
  it('lowers the entry cost below the previous 30 essence', () => {
    expect(UPGRADE_BASE_COST).toBeLessThan(30);
    expect(getUpgradeCost(ITEM, 0)).toBe(UPGRADE_BASE_COST);
  });

  it('keeps a progressive per-level increase without an expensive ceiling', () => {
    const costs = Array.from({ length: 5 }, (_, level) => getUpgradeCost(ITEM, level));
    costs.forEach((cost, level) => {
      expect(cost).toBe(UPGRADE_BASE_COST + level * UPGRADE_COST_SCALING);
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(oldUpgradeCosts[level]);
    });
    expect(UPGRADE_COST_SCALING).toBeLessThan(20);
  });

  it('reduces the full 0 to 5 upgrade total by at least 20 percent', () => {
    const newTotal = Array.from({ length: 5 }, (_, level) => getUpgradeCost(ITEM, level))
      .reduce((total, cost) => total + cost, 0);
    const oldTotal = oldUpgradeCosts.reduce((total, cost) => total + cost, 0);
    expect(newTotal).toBeLessThanOrEqual(oldTotal * 0.8);
  });
});

describe('Economy balance — real essence outputs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(DAY_ONE));
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pays the exact upgrade cost for each level', () => {
    expect(Array.from({ length: 5 }, (_, level) => getUpgradeCost(ITEM, level))).toEqual([
      25, 40, 55, 70, 85,
    ]);
  });

  it('pays the exact salvage yield for every rarity', () => {
    expect(rarities.map((rarity) => ESSENCE_YIELD[rarity])).toEqual([
      6, 23, 58, 92, 460,
    ]);
  });

  it('raises salvage yields above the previous values', () => {
    rarities.forEach((rarity, index) => {
      expect(ESSENCE_YIELD[rarity]).toBeGreaterThan(oldYields[index]);
    });
  });

  it('grants the daily login essence once per reset day', () => {
    const amount = GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE;
    expect(claimDailyLoginEssence('hero', DAY_ONE)).toBe(amount);
    expect(claimDailyLoginEssence('hero', DAY_ONE)).toBe(0);
    expect(claimDailyLoginEssence('hero', DAY_TWO)).toBe(amount);
    expect(localStorage.getItem(getDailyLoginEssenceKey('hero'))).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(getDailyLoginEssenceKey('hero')) as string).dayKey).toBe(
      getDailyResetKey(DAY_TWO),
    );
  });

  it('covers one first upgrade with a full offline day of idle essence plus the daily bonus', () => {
    const perWin = calculateIdleEssence(true, 10, 10, 10);
    const offlineFights = 120;
    const dailyBonus = GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE;
    const firstUpgrade = getUpgradeCost(ITEM, 0);

    expect(perWin).toBeCloseTo(0.2286, 4);
    expect(perWin * offlineFights + dailyBonus).toBeGreaterThan(firstUpgrade);
  });
});
