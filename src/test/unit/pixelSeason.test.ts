import { describe, it, expect } from 'vitest';
import {
  PIXEL_SEASON_ACTIVE_DAYS,
  PIXEL_SEASON_REST_DAYS,
  PIXEL_SEASON_CYCLE_DAYS,
  PIXEL_SEASON_TIER_COUNT,
  PIXEL_SEASON_POINTS_PER_TIER,
  PIXEL_SEASON_MAX_POINTS,
  PIXEL_SEASON_THEMES,
  PIXEL_SEASON_MISSIONS,
  PIXEL_SEASON_FREE_REWARDS,
  PIXEL_SEASON_PREMIUM_REWARDS,
  EMPTY_SEASON_COUNTERS,
  getPixelSeasonIdForDate,
  getPixelSeasonCalendar,
  getPixelSeasonTheme,
  getPixelSeasonPoints,
  getPixelSeasonTier,
  getPixelSeasonTierThreshold,
  getPixelSeasonProgressPct,
  getPixelSeasonPointsToNextTier,
  getPixelSeasonMissionProgress,
  isPixelSeasonMissionComplete,
  getClaimableFreeTiers,
  getClaimablePremiumTiers,
  getPixelSeasonFreeReward,
  getPixelSeasonPremiumReward,
  getPixelSeasonNextSeasonId,
  buildPixelSeasonLeaderboard,
} from '../../data/pixelSeason';

describe('pixelSeason config', () => {
  it('uses 14 active days plus 2 rest days per cycle', () => {
    expect(PIXEL_SEASON_ACTIVE_DAYS).toBe(14);
    expect(PIXEL_SEASON_REST_DAYS).toBe(2);
    expect(PIXEL_SEASON_CYCLE_DAYS).toBe(16);
  });

  it('has 30 tiers of 100 points', () => {
    expect(PIXEL_SEASON_TIER_COUNT).toBe(30);
    expect(PIXEL_SEASON_POINTS_PER_TIER).toBe(100);
    expect(PIXEL_SEASON_MAX_POINTS).toBe(3000);
  });

  it('rotates through 3 themes', () => {
    expect(PIXEL_SEASON_THEMES).toHaveLength(3);
  });

  it('exposes 10 missions covering the 4 existing loops', () => {
    expect(PIXEL_SEASON_MISSIONS).toHaveLength(10);
    const actions = new Set(PIXEL_SEASON_MISSIONS.map((m) => m.action));
    expect(actions).toEqual(new Set(['fight', 'salvage', 'idle', 'streak']));
  });

  it('mission points total more than the max track (buffer for rest days)', () => {
    const total = PIXEL_SEASON_MISSIONS.reduce((sum, mission) => sum + mission.points, 0);
    expect(total).toBeGreaterThan(PIXEL_SEASON_MAX_POINTS);
  });

  it('mission targets grow inside each action', () => {
    for (const action of ['fight', 'salvage', 'idle', 'streak'] as const) {
      const targets = PIXEL_SEASON_MISSIONS
        .filter((m) => m.action === action)
        .map((m) => m.target);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i]).toBeGreaterThan(targets[i - 1]);
      }
    }
  });

  it('free track has one reward per tier with allowed types', () => {
    expect(PIXEL_SEASON_FREE_REWARDS).toHaveLength(PIXEL_SEASON_TIER_COUNT);
    const allowed = new Set(['essence', 'lootbox', 'cosmetic_frag']);
    PIXEL_SEASON_FREE_REWARDS.forEach((reward, index) => {
      expect(reward.tier).toBe(index + 1);
      expect(allowed.has(reward.type)).toBe(true);
      expect(reward.amount).toBeGreaterThan(0);
    });
  });

  it('premium track only contains cosmetics', () => {
    expect(PIXEL_SEASON_PREMIUM_REWARDS.length).toBeGreaterThan(0);
    const allowed = new Set(['skin', 'palette', 'frame']);
    PIXEL_SEASON_PREMIUM_REWARDS.forEach((reward) => {
      expect(allowed.has(reward.type)).toBe(true);
      expect(reward.amount).toBeGreaterThan(0);
    });
  });
});

describe('season calendar', () => {
  const firstSeason = '2026-01-05';

  it('derives a stable season id from a date', () => {
    expect(getPixelSeasonIdForDate(new Date('2026-01-05T12:00:00Z'))).toBe(firstSeason);
    expect(getPixelSeasonIdForDate(new Date('2026-01-18T23:59:59Z'))).toBe(firstSeason);
    expect(getPixelSeasonIdForDate(new Date('2026-01-20T12:00:00Z'))).toBe(firstSeason);
    expect(getPixelSeasonIdForDate(new Date('2026-01-21T00:00:00Z'))).toBe('2026-01-21');
  });

  it('exposes active phase and remaining days', () => {
    const calendar = getPixelSeasonCalendar(firstSeason, new Date('2026-01-10T12:00:00Z'));
    expect(calendar.phase).toBe('active');
    expect(calendar.dayIndex).toBe(5);
    expect(calendar.activeDaysLeft).toBe(9);
  });

  it('exposes rest phase after 14 active days', () => {
    const calendar = getPixelSeasonCalendar(firstSeason, new Date('2026-01-19T12:00:00Z'));
    expect(calendar.phase).toBe('rest');
    expect(calendar.dayIndex).toBe(14);
    expect(calendar.activeDaysLeft).toBe(0);
    expect(calendar.restDaysLeft).toBe(2);
  });

  it('finds the next season id', () => {
    expect(getPixelSeasonNextSeasonId(firstSeason)).toBe('2026-01-21');
  });
});

describe('season theme rotation', () => {
  it('changes theme every season and wraps after 3', () => {
    const themeA = getPixelSeasonTheme('2026-01-05');
    const themeB = getPixelSeasonTheme('2026-01-21');
    const themeC = getPixelSeasonTheme('2026-02-06');
    const themeD = getPixelSeasonTheme('2026-02-22');
    expect(themeA.id).not.toBe(themeB.id);
    expect(themeB.id).not.toBe(themeC.id);
    expect(themeD.id).toBe(themeA.id);
  });
});

describe('season progression', () => {
  it('starts empty', () => {
    expect(getPixelSeasonPoints(EMPTY_SEASON_COUNTERS)).toBe(0);
    expect(getPixelSeasonTier(0)).toBe(0);
    expect(getPixelSeasonProgressPct(0)).toBe(0);
  });

  it('awards mission points only once the target is reached', () => {
    const fightMission = PIXEL_SEASON_MISSIONS.find((m) => m.action === 'fight');
    expect(fightMission).toBeDefined();
    const partial = { ...EMPTY_SEASON_COUNTERS, fight: fightMission!.target - 1 };
    const complete = { ...EMPTY_SEASON_COUNTERS, fight: fightMission!.target };
    expect(getPixelSeasonMissionProgress(fightMission!, partial)).toBe(fightMission!.target - 1);
    expect(isPixelSeasonMissionComplete(fightMission!, partial)).toBe(false);
    expect(getPixelSeasonPoints(partial)).toBe(0);
    expect(isPixelSeasonMissionComplete(fightMission!, complete)).toBe(true);
    expect(getPixelSeasonPoints(complete)).toBe(fightMission!.points);
  });

  it('computes tier and next threshold', () => {
    expect(getPixelSeasonTier(99)).toBe(0);
    expect(getPixelSeasonTier(100)).toBe(1);
    expect(getPixelSeasonTier(2999)).toBe(29);
    expect(getPixelSeasonTier(3000)).toBe(30);
    expect(getPixelSeasonTier(9999)).toBe(30);
    expect(getPixelSeasonTierThreshold(1)).toBe(100);
    expect(getPixelSeasonTierThreshold(30)).toBe(3000);
    expect(getPixelSeasonPointsToNextTier(100)).toBe(100);
    expect(getPixelSeasonPointsToNextTier(3000)).toBe(0);
  });

  it('caps progress at 100', () => {
    expect(getPixelSeasonProgressPct(1500)).toBe(50);
    expect(getPixelSeasonProgressPct(9999)).toBe(100);
  });

  it('lists claimable free tiers', () => {
    expect(getClaimableFreeTiers(0, [])).toEqual([]);
    expect(getClaimableFreeTiers(250, [])).toEqual([1, 2]);
    expect(getClaimableFreeTiers(250, [1])).toEqual([2]);
  });

  it('gates premium tiers behind the premium flag', () => {
    expect(getClaimablePremiumTiers(3000, [], false)).toEqual([]);
    expect(getClaimablePremiumTiers(300, [], true)).toEqual([3]);
    expect(getClaimablePremiumTiers(300, [3], true)).toEqual([]);
  });

  it('resolves reward by tier', () => {
    expect(getPixelSeasonFreeReward(1)?.tier).toBe(1);
    expect(getPixelSeasonFreeReward(31)).toBeUndefined();
    expect(getPixelSeasonPremiumReward(3)?.type).toBe('palette');
    expect(getPixelSeasonPremiumReward(4)).toBeUndefined();
  });
});

describe('season leaderboard', () => {
  it('is deterministic, sorted and contains the player', () => {
    const first = buildPixelSeasonLeaderboard('2026-01-05', 'Test Hero', 1200);
    const second = buildPixelSeasonLeaderboard('2026-01-05', 'Test Hero', 1200);
    expect(first).toEqual(second);
    expect(first).toHaveLength(6);
    expect(first.some((entry) => entry.isPlayer && entry.name === 'Test Hero')).toBe(true);
    for (let i = 1; i < first.length; i++) {
      expect(first[i - 1].points).toBeGreaterThanOrEqual(first[i].points);
      expect(first[i].rank).toBe(i + 1);
    }
  });
});
