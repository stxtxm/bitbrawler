import { describe, it, expect } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';
import {
  BossProgress,
  createBossProgress,
  simulateBossAttack,
} from '../../utils/bossUtils';

const makePlayer = (overrides: Record<string, any> = {}): Character => ({
  seed: 'player-test',
  name: 'Test Player',
  gender: 'male' as const,
  level: overrides.level ?? 30,
  experience: 0,
  strength: overrides.strength ?? 17,
  vitality: overrides.vitality ?? 17,
  dexterity: overrides.dexterity ?? 16,
  luck: overrides.luck ?? 16,
  intelligence: overrides.intelligence ?? 16,
  focus: overrides.focus ?? 17,
  hp: overrides.hp ?? 584,
  maxHp: overrides.maxHp ?? 584,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  equippedItems: { weapon: null, armor: null, accessory: null },
});

function simulateCampaign(
  player: Character,
  maxDays: number,
  now = Date.UTC(2026, 0, 15, 12, 0, 0),
): number | null {
  const DAY = 24 * 60 * 60 * 1000;
  let progress: BossProgress = createBossProgress(player, now);

  for (let day = 1; day <= maxDays; day++) {
    for (let attack = 0; attack < GAME_RULES.BOSS.MAX_DAILY_ATTACKS; attack++) {
      const outcome = simulateBossAttack(player, progress);
      if (outcome.won) return day;
      progress = {
        ...progress,
        bossHp: outcome.bossHpLeft,
        attacksLeft: progress.attacksLeft - 1,
      };
    }
    progress = {
      ...progress,
      attacksLeft: GAME_RULES.BOSS.MAX_DAILY_ATTACKS,
      lastAttackReset: now + day * DAY,
    };
  }
  return null;
}

const RUNS = 200;
const MAX_DAYS = 10;

function summarize(killDays: (number | null)[]): {
  day1KillRate: number;
  medianKillDay: number;
  killRateByDay10: number;
} {
  const kills = killDays.filter((d): d is number => d !== null).sort((a, b) => a - b);
  const day1 = kills.filter((d) => d <= 1).length;
  return {
    day1KillRate: day1 / RUNS,
    medianKillDay: kills.length ? kills[Math.floor(kills.length / 2)] : Infinity,
    killRateByDay10: kills.length / RUNS,
  };
}

describe('Boss PvE accessibility tiers (#1360)', () => {
  it('Phase 1 (30-40) is accessible for a balanced level-30 player', () => {
    const player = makePlayer({ level: 30 });
    const killDays = Array.from({ length: RUNS }, () => simulateCampaign(player, MAX_DAYS));
    const stats = summarize(killDays);

    expect(stats.killRateByDay10).toBeGreaterThan(0.8);
    expect(stats.medianKillDay).toBeLessThanOrEqual(5);
  });

  it('Phase 3 (61+) remains a multi-day challenge', () => {
    const player = makePlayer({
      level: 61,
      strength: 37, vitality: 37, dexterity: 36, luck: 36, intelligence: 36, focus: 37,
      hp: 1100, maxHp: 1100,
    });
    const killDays = Array.from({ length: RUNS }, () => simulateCampaign(player, MAX_DAYS));
    const stats = summarize(killDays);

    expect(stats.day1KillRate).toBeLessThan(0.15);
    expect(stats.killRateByDay10).toBeGreaterThan(0.8);
  });
});
