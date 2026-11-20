import { describe, it, expect } from 'vitest';
import { ESSENCE_YIELD, UPGRADE_BASE_COST, UPGRADE_COST_SCALING } from '../../data/forgeConstants';
import { getUpgradeCost } from '../../utils/forgeUtils';
import { GAME_RULES } from '../../config/gameRules';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { PixelItemAsset } from '../../types/Item';

const ITEM = ITEM_ASSETS[0] as PixelItemAsset;

const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
const oldUpgradeCosts = [30, 50, 70, 90, 110];
const oldYields = [5, 20, 50, 80, 400];
const baseline = {
  upgradeSpendPerRun: 19.64,
  salvageIncomePerRun: 17.23,
  netEssencePerRun: -5.01,
  runsPerDay: 5,
};

const average = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

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

describe('Economy balance — essence generation', () => {
  it('raises salvage yields for every rarity', () => {
    rarities.forEach((rarity, index) => {
      expect(ESSENCE_YIELD[rarity]).toBeGreaterThan(oldYields[index]);
    });
  });

  it('grants a positive daily login essence reward', () => {
    expect(GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE).toBeGreaterThan(0);
  });

  it('projects a net positive essence balance between +1 and +3 per run', () => {
    const newUpgradeCosts = Array.from({ length: 5 }, (_, level) => getUpgradeCost(ITEM, level));
    const newYields = rarities.map((rarity) => ESSENCE_YIELD[rarity]);
    const upgradeRatio = average(newUpgradeCosts) / average(oldUpgradeCosts);
    const salvageRatio = average(newYields) / average(oldYields);

    const upgradeSaving = baseline.upgradeSpendPerRun * (1 - upgradeRatio);
    const salvageGain = baseline.salvageIncomePerRun * (salvageRatio - 1);
    const dailyBonusPerRun = GAME_RULES.ECONOMY.DAILY_LOGIN_ESSENCE / baseline.runsPerDay;
    const projectedNet = baseline.netEssencePerRun + upgradeSaving + salvageGain + dailyBonusPerRun;

    expect(projectedNet).toBeGreaterThanOrEqual(1);
    expect(projectedNet).toBeLessThanOrEqual(3);
  });
});
