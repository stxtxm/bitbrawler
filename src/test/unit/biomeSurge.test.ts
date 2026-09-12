import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import { BIOMES } from '../../data/biomes';
import { getSurgeBiome, getSurgeBiomeId } from '../../data/liveOps';
import {
  SURGE_XP_MODIFIER,
  SURGE_ESSENCE_MULTIPLIER,
  BOUNTY_TARGET,
  isSurgeMonster,
  getPveXpModifier,
  getSurgeEssenceMultiplier,
  calculateIdleEssenceWithSurge,
  getBountyStorageKey,
  getBountyProgress,
  incrementBountyProgress,
  isBountyCompleted,
  resetBountyProgress,
} from '../../utils/biomeSurge';
import { calculateIdleEssence } from '../../utils/idleXpUtils';
import { getDailyResetKey } from '../../utils/dailyReset';

describe('Weekly Biome Surge', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getSurgeBiome rotation', () => {
    it('returns a valid biome for any date', () => {
      const biome = getSurgeBiome(new Date('2026-09-11T10:00:00Z'));
      expect(BIOMES.map((b) => b.id)).toContain(biome.id);
    });

    it('is deterministic for same date', () => {
      const d = new Date('2026-03-15T12:00:00Z');
      expect(getSurgeBiome(d).id).toBe(getSurgeBiome(d).id);
      expect(getSurgeBiomeId(d)).toBe(getSurgeBiome(d).id);
    });

    it('rotates through biomes across weeks', () => {
      const ids = new Set<string>();
      const base = new Date('2026-01-01T00:00:00Z');
      for (let w = 0; w < 6; w++) {
        const d = new Date(base.getTime() + w * 7 * 24 * 3600 * 1000);
        ids.add(getSurgeBiome(d).id);
      }
      expect(ids.size).toBeGreaterThan(1);
      expect(ids.size).toBeLessThanOrEqual(BIOMES.length);
    });

    it('stays stable within same week', () => {
      const monday = new Date('2026-02-02T10:00:00Z');
      const tuesday = new Date('2026-02-03T10:00:00Z');
      expect(getSurgeBiome(monday).id).toBe(getSurgeBiome(tuesday).id);
    });
  });

  describe('XP modifier', () => {
    it('BASE PVE XP_MODIFIER is 2.5', () => {
      expect(GAME_RULES.PVE.XP_MODIFIER).toBe(2.5);
    });

    it('SURGE_XP_MODIFIER is 3.1', () => {
      expect(SURGE_XP_MODIFIER).toBe(3.1);
    });

    it('returns surge modifier for surge monster, base otherwise', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeBiome = getSurgeBiome(date);
      const surgeMonster = surgeBiome.monsterPool[0];
      const nonSurgeMonster = BIOMES.find((b) => b.id !== surgeBiome.id)!.monsterPool[0];
      expect(isSurgeMonster(surgeMonster, date)).toBe(true);
      expect(isSurgeMonster(nonSurgeMonster, date)).toBe(false);
      expect(getPveXpModifier(surgeMonster, date)).toBe(3.1);
      expect(getPveXpModifier(nonSurgeMonster, date)).toBe(2.5);
    });

    it('isSurgeMonster returns false for unknown monster', () => {
      expect(isSurgeMonster('unknown' as never, new Date('2026-09-11T10:00:00Z'))).toBe(false);
    });
  });

  describe('essence boost +25%', () => {
    it('SURGE_ESSENCE_MULTIPLIER is 1.25', () => {
      expect(SURGE_ESSENCE_MULTIPLIER).toBe(1.25);
    });

    it('getSurgeEssenceMultiplier returns 1.25 for surge monster, 1 otherwise', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeBiome = getSurgeBiome(date);
      const surgeMonster = surgeBiome.monsterPool[0];
      const nonSurgeMonster = BIOMES.find((b) => b.id !== surgeBiome.id)!.monsterPool[0];
      expect(getSurgeEssenceMultiplier(surgeMonster, date)).toBe(1.25);
      expect(getSurgeEssenceMultiplier(nonSurgeMonster, date)).toBe(1);
    });

    it('calculateIdleEssenceWithSurge boosts essence by 25% for surge monster', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeBiome = getSurgeBiome(date);
      const surgeMonster = surgeBiome.monsterPool[0];
      const nonSurgeMonster = BIOMES.find((b) => b.id !== surgeBiome.id)!.monsterPool[0];
      const base = calculateIdleEssence(true, 10, 10, 10);
      const boosted = calculateIdleEssenceWithSurge(true, 10, 10, 10, surgeMonster, date);
      const normal = calculateIdleEssenceWithSurge(true, 10, 10, 10, nonSurgeMonster, date);
      expect(boosted).toBeCloseTo(base * 1.25, 5);
      expect(normal).toBeCloseTo(base, 5);
    });

    it('boost applies to losses as well', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeMonster = getSurgeBiome(date).monsterPool[0];
      const baseLoss = calculateIdleEssence(false, 10, 10, 10);
      const boostedLoss = calculateIdleEssenceWithSurge(false, 10, 10, 10, surgeMonster, date);
      expect(boostedLoss).toBeCloseTo(baseLoss * 1.25, 5);
    });
  });

  describe('daily bounty', () => {
    it('BOUNTY_TARGET is 3', () => {
      expect(BOUNTY_TARGET).toBe(3);
    });

    it('getBountyStorageKey uses getDailyResetKey', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const expected = `biomeSurge_bounty_${getDailyResetKey(date.getTime())}`;
      expect(getBountyStorageKey(date)).toBe(expected);
    });

    it('starts at 0 each new day', () => {
      const today = new Date('2026-09-11T10:00:00Z');
      expect(getBountyProgress(today)).toBe(0);
    });

    it('increments only for surge monsters', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeBiome = getSurgeBiome(date);
      const surgeMonster = surgeBiome.monsterPool[0];
      const nonSurgeMonster = BIOMES.find((b) => b.id !== surgeBiome.id)!.monsterPool[0];
      incrementBountyProgress(nonSurgeMonster, date);
      expect(getBountyProgress(date)).toBe(0);
      incrementBountyProgress(surgeMonster, date);
      expect(getBountyProgress(date)).toBe(1);
      incrementBountyProgress(surgeMonster, date);
      expect(getBountyProgress(date)).toBe(2);
    });

    it('caps at 3 and reports completion', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeMonster = getSurgeBiome(date).monsterPool[0];
      incrementBountyProgress(surgeMonster, date);
      incrementBountyProgress(surgeMonster, date);
      const third = incrementBountyProgress(surgeMonster, date);
      expect(third.count).toBe(3);
      expect(third.completed).toBe(true);
      expect(third.justCompleted).toBe(true);
      expect(isBountyCompleted(date)).toBe(true);
      const fourth = incrementBountyProgress(surgeMonster, date);
      expect(fourth.count).toBe(3);
      expect(fourth.justCompleted).toBe(false);
    });

    it('resets on new day via daily key', () => {
      const day1 = new Date('2026-09-11T10:00:00Z');
      const day2 = new Date('2026-09-12T10:00:00Z');
      const surgeMonster1 = getSurgeBiome(day1).monsterPool[0];
      incrementBountyProgress(surgeMonster1, day1);
      incrementBountyProgress(surgeMonster1, day1);
      expect(getBountyProgress(day1)).toBe(2);
      expect(getBountyProgress(day2)).toBe(0);
      isBountyCompleted(day1);
      expect(isBountyCompleted(day2)).toBe(false);
    });

    it('resetBountyProgress clears today', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeMonster = getSurgeBiome(date).monsterPool[0];
      incrementBountyProgress(surgeMonster, date);
      incrementBountyProgress(surgeMonster, date);
      resetBountyProgress(date);
      expect(getBountyProgress(date)).toBe(0);
    });

    it('increment returns shouldGrantPassXp only on first completion', () => {
      const date = new Date('2026-09-11T10:00:00Z');
      const surgeMonster = getSurgeBiome(date).monsterPool[0];
      expect(incrementBountyProgress(surgeMonster, date).shouldGrantPassXp).toBe(false);
      expect(incrementBountyProgress(surgeMonster, date).shouldGrantPassXp).toBe(false);
      expect(incrementBountyProgress(surgeMonster, date).shouldGrantPassXp).toBe(true);
      expect(incrementBountyProgress(surgeMonster, date).shouldGrantPassXp).toBe(false);
    });
  });
});
