import { describe, it, expect } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import { getBiomeMonsterPool } from '../../data/biomes';
import {
  SURGE_ROTATION,
  ACTIVE_SURGE,
  BURST_ACTIVE,
  getActiveSurge,
  isBurstActive,
  getEffectivePveXpModifier,
  getSurgeMonsterPool,
  isSurgeMonster,
  getEssenceSurgeMultiplier,
  getDailyBountyTarget,
  getBountyProgress,
  isBountyCompleted,
  getWeekIndex,
} from '../../data/liveOps';
import { calculateIdleEssence, calculateIdleEssenceForMonster } from '../../utils/idleXpUtils';

function parisDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

describe('liveOps rotation', () => {
  it('exposes SURGE_ROTATION volcanic → forest → desert → abyss', () => {
    expect(SURGE_ROTATION).toEqual(['volcanic', 'forest', 'desert', 'abyssal']);
  });

  it('exposes LIVEOPS constants', () => {
    expect(GAME_RULES.LIVEOPS.XP_SURGE_MODIFIER).toBe(3.1);
    expect(GAME_RULES.LIVEOPS.ESSENCE_SURGE_BONUS).toBe(0.25);
    expect(GAME_RULES.PVE.XP_MODIFIER).toBe(2.5);
  });

  it('exposes ACTIVE_SURGE and BURST_ACTIVE constants', () => {
    expect([null, ...SURGE_ROTATION]).toContain(ACTIVE_SURGE);
    expect(typeof BURST_ACTIVE).toBe('boolean');
    expect(BURST_ACTIVE).toBe(ACTIVE_SURGE === null);
  });

  it('getActiveSurge is deterministic per week (same Paris week → same surge)', () => {
    const monday = parisDate(2024, 1, 1);
    const wednesday = parisDate(2024, 1, 3);
    const sunday = parisDate(2024, 1, 7);
    expect(getActiveSurge(monday)).toBe(getActiveSurge(wednesday));
    expect(getActiveSurge(monday)).toBe(getActiveSurge(sunday));
  });

  it('alternates surge / burst every week (pendulum)', () => {
    const week0 = parisDate(2024, 1, 1);
    const week1 = parisDate(2024, 1, 8);
    const week2 = parisDate(2024, 1, 15);
    const week3 = parisDate(2024, 1, 22);
    expect(getActiveSurge(week0)).toBe('volcanic');
    expect(getActiveSurge(week1)).toBeNull();
    expect(isBurstActive(week1)).toBe(true);
    expect(getActiveSurge(week2)).toBe('forest');
    expect(getActiveSurge(week3)).toBeNull();
  });

  it('cycles through 4 biomes every 8 weeks', () => {
    const dates = [
      parisDate(2024, 1, 1),
      parisDate(2024, 1, 15),
      parisDate(2024, 1, 29),
      parisDate(2024, 2, 12),
      parisDate(2024, 2, 26),
    ];
    expect(dates.map((d) => getActiveSurge(d))).toEqual(['volcanic', 'forest', 'desert', 'abyssal', 'volcanic']);
  });

  it('accepts number timestamp as well as Date', () => {
    const d = parisDate(2024, 1, 1);
    expect(getActiveSurge(d.getTime())).toBe(getActiveSurge(d));
    expect(isBurstActive(d.getTime())).toBe(isBurstActive(d));
  });

  it('getWeekIndex is stable within same Paris day', () => {
    const morning = new Date(Date.UTC(2024, 0, 1, 6, 0, 0));
    const evening = new Date(Date.UTC(2024, 0, 1, 22, 0, 0));
    expect(getWeekIndex(morning)).toBe(getWeekIndex(evening));
  });
});

describe('liveOps PVE XP surge', () => {
  it('returns 3.1 during surge week and 2.5 during burst week', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const burstDate = parisDate(2024, 1, 8);
    expect(getEffectivePveXpModifier(surgeDate)).toBe(3.1);
    expect(getEffectivePveXpModifier(burstDate)).toBe(2.5);
  });

  it('is deterministic for same day', () => {
    const d = parisDate(2024, 1, 1);
    expect(getEffectivePveXpModifier(d)).toBe(getEffectivePveXpModifier(new Date(d.getTime() + 3600000)));
  });
});

describe('liveOps essence surge +25% on 3 exclusive monsters', () => {
  it('applies +25% multiplier only to surge pool monsters', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const pool = getSurgeMonsterPool(surgeDate);
    expect(pool.length).toBe(3);
    pool.forEach((id) => {
      expect(isSurgeMonster(id, surgeDate)).toBe(true);
      expect(getEssenceSurgeMultiplier(id, surgeDate)).toBe(1.25);
    });
    const nonSurge = getBiomeMonsterPool('plains').find((id) => !pool.includes(id));
    if (nonSurge) {
      expect(isSurgeMonster(nonSurge, surgeDate)).toBe(false);
      expect(getEssenceSurgeMultiplier(nonSurge, surgeDate)).toBe(1);
    }
  });

  it('returns 1 during burst week for any monster', () => {
    const burstDate = parisDate(2024, 1, 8);
    expect(getSurgeMonsterPool(burstDate)).toEqual([]);
    expect(getEssenceSurgeMultiplier('magma_golem', burstDate)).toBe(1);
    expect(isSurgeMonster('magma_golem', burstDate)).toBe(false);
  });

  it('verifiable via calculateIdleEssenceForMonster', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const pool = getSurgeMonsterPool(surgeDate);
    const surgeMonster = pool[0];
    const base = calculateIdleEssence(true, 10, 10, 10);
    const boosted = calculateIdleEssenceForMonster(true, 10, surgeMonster, 10, 10, surgeDate);
    expect(boosted).toBeCloseTo(base * 1.25, 5);
    const nonSurgeEssence = calculateIdleEssenceForMonster(true, 10, 'goblin' as any, 10, 10, burstDate());
    function burstDate() { return parisDate(2024, 1, 8); }
    const base2 = calculateIdleEssence(true, 10, 10, 10);
    expect(nonSurgeEssence).toBeCloseTo(base2, 5);
  });

  it('each surge pool contains exactly 3 monsters', () => {
    const surgeDates = [
      parisDate(2024, 1, 1),
      parisDate(2024, 1, 15),
      parisDate(2024, 1, 29),
      parisDate(2024, 2, 12),
    ];
    surgeDates.forEach((d) => {
      const pool = getSurgeMonsterPool(d);
      expect(pool.length).toBe(3);
      pool.forEach((id) => expect(typeof id).toBe('string'));
    });
  });
});

describe('liveOps daily bounty kill 3× [biome monster] → +1 pass XP', () => {
  it('returns null target during burst week', () => {
    const burstDate = parisDate(2024, 1, 8);
    expect(getDailyBountyTarget(burstDate)).toBeNull();
    expect(getBountyProgress({}, burstDate).completed).toBe(false);
    expect(isBountyCompleted({}, burstDate)).toBe(false);
  });

  it('requires 3 kills of surge pool monsters', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const target = getDailyBountyTarget(surgeDate);
    expect(target).not.toBeNull();
    expect(target!.required).toBe(3);
    expect(target!.monsterPool.length).toBe(3);
    const pool = target!.monsterPool;
    expect(getBountyProgress({ [pool[0]]: 2 }, surgeDate).completed).toBe(false);
    expect(getBountyProgress({ [pool[0]]: 2, [pool[1]]: 1 }, surgeDate).completed).toBe(true);
    expect(isBountyCompleted({ [pool[0]]: 3 }, surgeDate)).toBe(true);
    expect(isBountyCompleted({ [pool[0]]: 1, [pool[1]]: 1, [pool[2]]: 1 }, surgeDate)).toBe(true);
  });

  it('counts only surge pool kills', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const pool = getSurgeMonsterPool(surgeDate);
    const nonSurgeKill = { goblin: 10 } as Record<string, number>;
    if (!pool.includes('goblin' as any)) {
      expect(getBountyProgress(nonSurgeKill, surgeDate).completed).toBe(false);
    }
  });

  it('reuses monsterPool from biomes.ts', () => {
    const surgeDate = parisDate(2024, 1, 1);
    const target = getDailyBountyTarget(surgeDate);
    expect(target!.monsterPool).toEqual(getBiomeMonsterPool(target!.biomeId));
  });
});
