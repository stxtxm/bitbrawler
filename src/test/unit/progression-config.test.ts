import { describe, it, expect } from 'vitest';
import {
  PROGRESSION_GATES,
  isFeatureUnlocked,
  getUnlockStatus,
} from '../../config/progressionConfig';

describe('progressionConfig', () => {
  it('PVP_UNLOCK_LEVEL is 5', () => {
    expect(PROGRESSION_GATES.PVP_UNLOCK_LEVEL).toBe(5);
  });

  it('FORGE_UNLOCK_LEVEL is 10', () => {
    expect(PROGRESSION_GATES.FORGE_UNLOCK_LEVEL).toBe(10);
  });

  it('FUSION_UNLOCK_LEVEL is 15', () => {
    expect(PROGRESSION_GATES.FUSION_UNLOCK_LEVEL).toBe(15);
  });

  it('SHOP_UNLOCK_LEVEL is 20', () => {
    expect(PROGRESSION_GATES.SHOP_UNLOCK_LEVEL).toBe(20);
  });

  it('isFeatureUnlocked returns false when level is below threshold', () => {
    expect(isFeatureUnlocked(4, 5)).toBe(false);
  });

  it('isFeatureUnlocked returns true when level meets threshold', () => {
    expect(isFeatureUnlocked(5, 5)).toBe(true);
  });

  it('isFeatureUnlocked returns true when level exceeds threshold', () => {
    expect(isFeatureUnlocked(10, 5)).toBe(true);
  });

  it('isFeatureUnlocked returns true at level 1 for level 1 gates', () => {
    expect(isFeatureUnlocked(1, 1)).toBe(true);
  });

  it('getUnlockStatus returns correct object when locked', () => {
    const status = getUnlockStatus(3, 5);
    expect(status.unlocked).toBe(false);
    expect(status.level).toBe(5);
  });

  it('getUnlockStatus returns correct object when unlocked', () => {
    const status = getUnlockStatus(10, 5);
    expect(status.unlocked).toBe(true);
    expect(status.level).toBe(5);
  });

  it('all gates have positive values', () => {
    const gates = Object.values(PROGRESSION_GATES);
    gates.forEach(value => {
      expect(value).toBeGreaterThan(0);
    });
  });
});
