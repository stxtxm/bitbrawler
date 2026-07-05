import { describe, it, expect } from 'vitest';
import {
  calculatePveProgress,
  calculateProgressionProgress,
} from '../../utils/medalUtils';

describe('calculatePveProgress', () => {
  it('returns all medals as incomplete with no kills', () => {
    const result = calculatePveProgress({}, 0);
    const keys = Object.keys(result);
    expect(keys.length).toBe(19);
    keys.forEach(key => {
      expect(result[key].completed).toBe(false);
      expect(result[key].progress).toBe(0);
    });
  });

  it('tracks goblin kills for tier 1 medal', () => {
    const result = calculatePveProgress({ goblin: 3 }, 0);
    expect(result.hunter_goblin_5.completed).toBe(false);
    expect(result.hunter_goblin_5.progress).toBe(3);
  });

  it('completes goblin tier 1 at 5 kills', () => {
    const result = calculatePveProgress({ goblin: 5 }, 0);
    expect(result.hunter_goblin_5.completed).toBe(true);
    expect(result.hunter_goblin_5.progress).toBe(5);
  });

  it('completes goblin tier 2 at 25 kills', () => {
    const result = calculatePveProgress({ goblin: 25 }, 0);
    expect(result.hunter_goblin_5.completed).toBe(true);
    expect(result.hunter_goblin_25.completed).toBe(true);
  });

  it('tracks all 8 monster types', () => {
    const monsterIds = ['goblin', 'ogre', 'wraith', 'slime', 'wolf', 'skeleton', 'chimera', 'dragon_spawn'];
    const kills: Record<string, number> = {};
    monsterIds.forEach(id => { kills[id] = 10; });

    const result = calculatePveProgress(kills, 0);
    monsterIds.forEach(id => {
      expect(result[`hunter_${id}_5`].completed).toBe(true);
      expect(result[`hunter_${id}_25`].completed).toBe(false);
    });
  });

  it('tracks PvE streak medals', () => {
    const result = calculatePveProgress({}, 7);
    expect(result.pve_streak_3.completed).toBe(true);
    expect(result.pve_streak_5.completed).toBe(true);
    expect(result.pve_streak_10.completed).toBe(false);
    expect(result.pve_streak_10.progress).toBe(7);
  });

  it('completes pve_streak_10 at streak 10', () => {
    const result = calculatePveProgress({}, 10);
    expect(result.pve_streak_10.completed).toBe(true);
  });

  it('caps progress at target', () => {
    const result = calculatePveProgress({ goblin: 100 }, 0);
    expect(result.hunter_goblin_5.progress).toBe(5);
    expect(result.hunter_goblin_25.progress).toBe(25);
  });
});

describe('calculateProgressionProgress (extended)', () => {
  it('returns existing medals unchanged at level 20', () => {
    const result = calculateProgressionProgress(20, 0);
    expect(result.growing_strong.completed).toBe(true);
    expect(result.peak_performance.completed).toBe(true);
    expect(result.level_master.completed).toBe(true);
  });

  it('high_level_30 is incomplete at level 29', () => {
    const result = calculateProgressionProgress(29, 0);
    expect(result.high_level_30.completed).toBe(false);
  });

  it('high_level_30 completes at level 30', () => {
    const result = calculateProgressionProgress(30, 0);
    expect(result.high_level_30.completed).toBe(true);
  });

  it('high_level_50 completes at level 50', () => {
    const result = calculateProgressionProgress(50, 0);
    expect(result.high_level_50.completed).toBe(true);
  });

  it('high_level_75 completes at level 75', () => {
    const result = calculateProgressionProgress(75, 0);
    expect(result.high_level_75.completed).toBe(true);
  });

  it('high_level_100 completes at level 100', () => {
    const result = calculateProgressionProgress(100, 0);
    expect(result.high_level_100.completed).toBe(true);
  });

  it('high_level_150 completes at level 150', () => {
    const result = calculateProgressionProgress(150, 0);
    expect(result.high_level_150.completed).toBe(true);
  });

  it('high_level_200 completes at level 200', () => {
    const result = calculateProgressionProgress(200, 0);
    expect(result.high_level_200.completed).toBe(true);
  });

  it('all high-level medals progress at level 300', () => {
    const result = calculateProgressionProgress(300, 0);
    expect(result.high_level_30.completed).toBe(true);
    expect(result.high_level_50.completed).toBe(true);
    expect(result.high_level_75.completed).toBe(true);
    expect(result.high_level_100.completed).toBe(true);
    expect(result.high_level_150.completed).toBe(true);
    expect(result.high_level_200.completed).toBe(true);
  });

  it('progress caps at target', () => {
    const result = calculateProgressionProgress(300, 0);
    expect(result.high_level_200.progress).toBe(200);
  });
});
