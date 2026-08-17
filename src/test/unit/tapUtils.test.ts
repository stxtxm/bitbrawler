import { describe, it, expect } from 'vitest';
import {
  computeTapEssence,
  computeTapDamage,
  tapsToKill,
  isTapPhase,
} from '../../utils/tapUtils';
import { TAP_CONFIG } from '../../config/tapConfig';
import { calculateIdleEssence } from '../../utils/idleXpUtils';

describe('tapUtils — tap-to-damage idle PvE', () => {
  describe('computeTapEssence', () => {
    it('grants at least MIN_TAP_ESSENCE even at level 1', () => {
      const essence = computeTapEssence(1);
      expect(essence).toBeGreaterThanOrEqual(TAP_CONFIG.MIN_TAP_ESSENCE);
    });

    it('scales with player level (higher level → more essence per tap)', () => {
      const low = computeTapEssence(5);
      const high = computeTapEssence(50);
      expect(high).toBeGreaterThan(low);
    });

    it('scales with intelligence and focus stats', () => {
      const base = computeTapEssence(10, 10, 10);
      const boosted = computeTapEssence(10, 30, 30);
      expect(boosted).toBeGreaterThan(base);
    });

    it('is a fraction of the kill essence (active tap must not beat a full idle kill)', () => {
      const level = 10;
      const killEssence = calculateIdleEssence(true, level, 10, 10);
      const perTap = computeTapEssence(level, 10, 10);
      expect(perTap).toBeLessThan(killEssence);
    });

    it('keeps full float precision (accumulation over a fight must stay exact)', () => {
      const essence = computeTapEssence(20);
      expect(Number.isFinite(essence)).toBe(true);
      expect(essence).toBeGreaterThanOrEqual(TAP_CONFIG.MIN_TAP_ESSENCE);
    });
  });

  describe('computeTapDamage', () => {
    it('removes TAP_DAMAGE_RATIO of the monster max HP per tap', () => {
      const monsterMaxHp = 1000;
      const damage = computeTapDamage(monsterMaxHp);
      expect(damage).toBe(Math.round(monsterMaxHp * TAP_CONFIG.TAP_DAMAGE_RATIO));
    });

    it('never returns 0 damage even for tiny monsters', () => {
      expect(computeTapDamage(1)).toBeGreaterThanOrEqual(1);
      expect(computeTapDamage(5)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('tapsToKill', () => {
    it('kills the monster within the per-fight tap budget (config sanity)', () => {
      // The whole tap mechanic relies on being able to kill the monster
      // before MAX_TAPS_PER_FIGHT runs out — otherwise taps would never
      // produce an early win.
      expect(TAP_CONFIG.MAX_TAPS_PER_FIGHT).toBeGreaterThanOrEqual(
        tapsToKill(1),
      );
      expect(TAP_CONFIG.MAX_TAPS_PER_FIGHT).toBeGreaterThanOrEqual(
        tapsToKill(5000),
      );
    });

    it('rounds up the required taps', () => {
      // 8% per tap → 1000 HP monster needs ceil(1/0.08) = 13 taps
      expect(tapsToKill(1000)).toBe(13);
      expect(tapsToKill(1250)).toBe(13);
      expect(tapsToKill(1300)).toBe(13);
    });
  });

  describe('isTapPhase', () => {
    it('allows taps during monster_appears and combat', () => {
      expect(isTapPhase('monster_appears')).toBe(true);
      expect(isTapPhase('combat')).toBe(true);
    });

    it('blocks taps during running and result', () => {
      expect(isTapPhase('running')).toBe(false);
      expect(isTapPhase('result')).toBe(false);
    });
  });
});
