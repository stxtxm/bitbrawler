import { describe, it, expect } from 'vitest';
import {
  calcFaith,
  faithPerHour,
  calcIdolCost,
  getFaithBonus,
  IdolType,
} from '../../utils/prestigeUtils';

describe('prestigeUtils', () => {
  describe('calcFaith', () => {
    it('returns 0 for 0 xp', () => {
      expect(calcFaith(0)).toBe(0);
    });
    it('returns 0 for xp below SCALE', () => {
      expect(calcFaith(99_999)).toBe(0);
    });
    it('returns 1 for exactly 100k', () => {
      expect(calcFaith(100_000)).toBe(1);
    });
    it('returns 2 for 400k (4x xp -> 2x faith)', () => {
      expect(calcFaith(400_000)).toBe(2);
    });
    it('returns 3 for 900k', () => {
      expect(calcFaith(900_000)).toBe(3);
    });
    it('returns 4 for 1.6M', () => {
      expect(calcFaith(1_600_000)).toBe(4);
    });
    it('returns 0 for negative xp', () => {
      expect(calcFaith(-100)).toBe(0);
    });
    it('returns 0 for NaN xp', () => {
      expect(calcFaith(NaN)).toBe(0);
    });
    it('square-root curve: doubling faith requires ~4x xp', () => {
      expect(calcFaith(100_000)).toBe(1);
      expect(calcFaith(400_000)).toBe(2);
      expect(calcFaith(1_600_000)).toBe(4);
      expect(calcFaith(6_400_000)).toBe(8);
    });
  });

  describe('faithPerHour', () => {
    it('returns 0 when hours <= 0', () => {
      expect(faithPerHour(10, 0)).toBe(0);
      expect(faithPerHour(10, -5)).toBe(0);
    });
    it('calculates faith per hour correctly', () => {
      expect(faithPerHour(10, 2)).toBe(5);
      expect(faithPerHour(4, 2)).toBe(2);
    });
    it('handles fractions', () => {
      expect(faithPerHour(3, 2)).toBeCloseTo(1.5);
      expect(faithPerHour(1, 3)).toBeCloseTo(0.333, 2);
    });
    it('returns 0 for zero faith', () => {
      expect(faithPerHour(0, 5)).toBe(0);
    });
    it('returns finite number for large values', () => {
      const v = faithPerHour(1000, 10);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBe(100);
    });
  });

  describe('calcIdolCost', () => {
    it('cost level 0 is 10', () => {
      expect(calcIdolCost(0)).toBe(10);
    });
    it('cost level 1 is 15', () => {
      expect(calcIdolCost(1)).toBe(15);
    });
    it('cost level 5 is 75 (steep 1.5^level)', () => {
      expect(calcIdolCost(5)).toBe(75);
    });
    it('is steep: each level costs more than previous', () => {
      for (let i = 0; i < 10; i++) {
        expect(calcIdolCost(i + 1)).toBeGreaterThan(calcIdolCost(i));
      }
    });
    it('growth factor approx 1.5', () => {
      expect(calcIdolCost(2)).toBe(22);
      expect(calcIdolCost(3)).toBe(33);
      expect(calcIdolCost(10)).toBe(576);
    });
    it('returns 10 for negative level', () => {
      expect(calcIdolCost(-1)).toBe(10);
    });
  });

  describe('getFaithBonus', () => {
    it('returns 1 for 0 faith', () => {
      expect(getFaithBonus(0)).toBe(1);
    });
    it('is linear +2% per faith', () => {
      expect(getFaithBonus(1)).toBeCloseTo(1.02);
      expect(getFaithBonus(10)).toBeCloseTo(1.2);
      expect(getFaithBonus(50)).toBeCloseTo(2.0);
    });
    it('never returns NaN or Infinity', () => {
      expect(Number.isFinite(getFaithBonus(0))).toBe(true);
      expect(Number.isFinite(getFaithBonus(1000))).toBe(true);
      expect(Number.isFinite(getFaithBonus(NaN))).toBe(true);
      expect(Number.isFinite(getFaithBonus(Infinity))).toBe(true);
    });
    it('clamps negative faith to 1', () => {
      expect(getFaithBonus(-5)).toBe(1);
    });
  });

  describe('IdolType', () => {
    it('has 6 idol types', () => {
      expect(Object.values(IdolType)).toHaveLength(6);
    });
    it('contains expected idol types', () => {
      expect(IdolType.GENERATOR).toBeDefined();
      expect(IdolType.TAP).toBeDefined();
      expect(IdolType.GLOBAL).toBeDefined();
      expect(IdolType.CRIT).toBeDefined();
      expect(IdolType.FAITH_GAIN).toBeDefined();
      expect(IdolType.IDLE).toBeDefined();
    });
  });
});
