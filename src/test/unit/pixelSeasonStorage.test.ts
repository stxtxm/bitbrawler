import { describe, it, expect, beforeEach } from 'vitest';
import {
  PIXEL_SEASON_STORAGE_PREFIX,
  getPixelSeasonStorageKey,
  loadPixelSeasonState,
  savePixelSeasonState,
  clearPixelSeasonState,
  recordPixelSeasonAction,
  recordPixelSeasonDelta,
  claimPixelSeasonFreeTier,
  claimPixelSeasonPremiumTier,
  unlockPixelSeasonPremium,
  subscribePixelSeason,
} from '../../utils/pixelSeasonStorage';

const SEASON = '2026-01-05';
const CHAR = 'char-123';

describe('pixelSeasonStorage', () => {
  beforeEach(() => {
    clearPixelSeasonState();
    localStorage.clear();
  });

  it('returns an empty state when nothing is stored', () => {
    const state = loadPixelSeasonState(SEASON, CHAR);
    expect(state.seasonId).toBe(SEASON);
    expect(state.counters).toEqual({ fight: 0, salvage: 0, idle: 0, streak: 0 });
    expect(state.claimedFree).toEqual([]);
    expect(state.claimedPremium).toEqual([]);
    expect(state.premiumUnlocked).toBe(false);
  });

  it('uses a season and character scoped key', () => {
    expect(getPixelSeasonStorageKey(SEASON, CHAR)).toBe(`${PIXEL_SEASON_STORAGE_PREFIX}_${SEASON}_${CHAR}`);
    expect(getPixelSeasonStorageKey(SEASON)).toBe(`${PIXEL_SEASON_STORAGE_PREFIX}_${SEASON}`);
  });

  it('persists state to localStorage', () => {
    savePixelSeasonState({
      seasonId: SEASON,
      counters: { fight: 3, salvage: 1, idle: 2, streak: 5 },
      claimedFree: [1],
      claimedPremium: [],
      premiumUnlocked: true,
    }, CHAR);
    const raw = localStorage.getItem(getPixelSeasonStorageKey(SEASON, CHAR));
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).counters.fight).toBe(3);
    expect(loadPixelSeasonState(SEASON, CHAR).premiumUnlocked).toBe(true);
  });

  it('records actions additively', () => {
    recordPixelSeasonAction(CHAR, 'fight', 2, SEASON);
    recordPixelSeasonAction(CHAR, 'fight', 3, SEASON);
    recordPixelSeasonAction(CHAR, 'salvage', 1, SEASON);
    const state = loadPixelSeasonState(SEASON, CHAR);
    expect(state.counters.fight).toBe(5);
    expect(state.counters.salvage).toBe(1);
  });

  it('records streak as a maximum, never a regression', () => {
    recordPixelSeasonAction(CHAR, 'streak', 12, SEASON);
    recordPixelSeasonAction(CHAR, 'streak', 4, SEASON);
    expect(loadPixelSeasonState(SEASON, CHAR).counters.streak).toBe(12);
  });

  it('ignores negative and non finite amounts', () => {
    recordPixelSeasonAction(CHAR, 'fight', -10, SEASON);
    recordPixelSeasonAction(CHAR, 'fight', Number.NaN, SEASON);
    expect(loadPixelSeasonState(SEASON, CHAR).counters.fight).toBe(0);
  });

  it('records a delta across several counters', () => {
    recordPixelSeasonDelta(CHAR, { fight: 2, idle: 4, streak: 8 }, SEASON);
    const state = loadPixelSeasonState(SEASON, CHAR);
    expect(state.counters.fight).toBe(2);
    expect(state.counters.idle).toBe(4);
    expect(state.counters.streak).toBe(8);
  });

  it('isolates characters and seasons', () => {
    recordPixelSeasonAction('char-A', 'fight', 20, SEASON);
    recordPixelSeasonAction('char-B', 'fight', 40, SEASON);
    recordPixelSeasonAction('char-A', 'fight', 90, '2026-01-21');
    expect(loadPixelSeasonState(SEASON, 'char-A').counters.fight).toBe(20);
    expect(loadPixelSeasonState(SEASON, 'char-B').counters.fight).toBe(40);
    expect(loadPixelSeasonState('2026-01-21', 'char-A').counters.fight).toBe(90);
  });

  it('claims a free tier once the threshold is reached', () => {
    expect(claimPixelSeasonFreeTier(CHAR, 1, SEASON)).toBe(false);
    recordPixelSeasonAction(CHAR, 'fight', 20, SEASON);
    expect(claimPixelSeasonFreeTier(CHAR, 1, SEASON)).toBe(true);
    expect(claimPixelSeasonFreeTier(CHAR, 1, SEASON)).toBe(false);
    expect(loadPixelSeasonState(SEASON, CHAR).claimedFree).toEqual([1]);
  });

  it('rejects out of range tiers', () => {
    recordPixelSeasonAction(CHAR, 'fight', 90, SEASON);
    recordPixelSeasonAction(CHAR, 'salvage', 40, SEASON);
    expect(claimPixelSeasonFreeTier(CHAR, 0, SEASON)).toBe(false);
    expect(claimPixelSeasonFreeTier(CHAR, 31, SEASON)).toBe(false);
  });

  it('keeps premium rewards locked until premium is unlocked', () => {
    recordPixelSeasonAction(CHAR, 'fight', 20, SEASON);
    recordPixelSeasonAction(CHAR, 'salvage', 10, SEASON);
    expect(claimPixelSeasonPremiumTier(CHAR, 3, SEASON)).toBe(false);
    unlockPixelSeasonPremium(CHAR, SEASON);
    expect(claimPixelSeasonPremiumTier(CHAR, 3, SEASON)).toBe(true);
    expect(loadPixelSeasonState(SEASON, CHAR).claimedPremium).toEqual([3]);
  });

  it('notifies subscribers when progress changes', () => {
    let calls = 0;
    const unsubscribe = subscribePixelSeason(() => { calls += 1; });
    recordPixelSeasonAction(CHAR, 'fight', 1, SEASON);
    expect(calls).toBeGreaterThan(0);
    unsubscribe();
    const before = calls;
    recordPixelSeasonAction(CHAR, 'fight', 1, SEASON);
    expect(calls).toBe(before);
  });
});
