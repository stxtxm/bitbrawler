import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPixelSeasonCharacterDelta,
  trackPixelSeasonCharacter,
} from '../../utils/pixelSeasonTracking';
import {
  clearPixelSeasonState,
  loadPixelSeasonState,
} from '../../utils/pixelSeasonStorage';

const SEASON = '2026-01-05';
const CHAR = 'char-track';

describe('pixelSeasonTracking', () => {
  beforeEach(() => {
    clearPixelSeasonState();
    localStorage.clear();
  });

  it('derives fight and idle gains from character counters', () => {
    const delta = getPixelSeasonCharacterDelta(
      { wins: 10, idleTotalKills: 20, idleStreak: 4 },
      { wins: 13, idleTotalKills: 27, idleStreak: 7 },
    );
    expect(delta.fight).toBe(3);
    expect(delta.idle).toBe(7);
    expect(delta.streak).toBe(7);
  });

  it('never produces negative deltas on regressions', () => {
    const delta = getPixelSeasonCharacterDelta(
      { wins: 10, idleTotalKills: 20, idleStreak: 4 },
      { wins: 8, idleTotalKills: 15, idleStreak: 0 },
    );
    expect(delta.fight).toBe(0);
    expect(delta.idle).toBe(0);
    expect(delta.streak).toBe(0);
  });

  it('does not track a first observation', () => {
    const tracked = trackPixelSeasonCharacter(
      null,
      { id: CHAR, wins: 50, idleTotalKills: 100, idleStreak: 5 },
      SEASON,
    );
    expect(tracked).toBe(false);
    expect(loadPixelSeasonState(SEASON, CHAR).counters.fight).toBe(0);
  });

  it('records gains into season storage', () => {
    const tracked = trackPixelSeasonCharacter(
      { id: CHAR, wins: 2, idleTotalKills: 5, idleStreak: 1 },
      { id: CHAR, wins: 3, idleTotalKills: 7, idleStreak: 3 },
      SEASON,
    );
    expect(tracked).toBe(true);
    const state = loadPixelSeasonState(SEASON, CHAR);
    expect(state.counters.fight).toBe(1);
    expect(state.counters.idle).toBe(2);
    expect(state.counters.streak).toBe(3);
  });

  it('skips writes when nothing changed', () => {
    const tracked = trackPixelSeasonCharacter(
      { id: CHAR, wins: 2, idleTotalKills: 5 },
      { id: CHAR, wins: 2, idleTotalKills: 5 },
      SEASON,
    );
    expect(tracked).toBe(false);
  });
});
