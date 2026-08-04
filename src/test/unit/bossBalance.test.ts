import { describe, it, expect } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import { Character } from '../../types/Character';
import {
  BossProgress,
  createBossProgress,
  simulateBossAttack,
} from '../../utils/bossUtils';

// ─── Balance harness ─────────────────────────────────────────────────────────
// Simulates full boss cycles: 5 attacks/day (reset each Paris day), the HP pool
// persists across attacks and days, a kill starts a fresh cycle. Used to verify
// the boss is neither trivial (day-1 kill) nor unkillable (no kill within days).

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

/** Returns the 1-indexed day the boss dies (null if still alive after maxDays). */
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

const RUNS = 250;
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

describe('Boss PvE balance (Monte-Carlo)', () => {
  it('a balanced level-30 player cannot one-day the boss but can kill it within days', () => {
    const player = makePlayer({ level: 30 });
    const killDays = Array.from({ length: RUNS }, () => simulateCampaign(player, MAX_DAYS));
    const stats = summarize(killDays);

    // The boss must not be trivially killable on day one.
    expect(stats.day1KillRate).toBeLessThan(0.1);
    // But it must die within a reasonable campaign window for a normal player.
    expect(stats.killRateByDay10).toBeGreaterThan(0.9);
    // Design goal: kill in ~2-4 days of attacks.
    expect(stats.medianKillDay).toBeLessThanOrEqual(6);
  });

  it('a strong level-40 player kills the boss no slower than a level-30 player', () => {
    const strong = makePlayer({
      level: 40,
      strength: 27, vitality: 27, dexterity: 26, luck: 26, intelligence: 26, focus: 27,
      hp: 784, maxHp: 784,
    });
    const balanced = makePlayer({ level: 30 });
    const strongKills = Array.from({ length: RUNS }, () => simulateCampaign(strong, MAX_DAYS));
    const balancedKills = Array.from({ length: RUNS }, () => simulateCampaign(balanced, MAX_DAYS));
    const strongStats = summarize(strongKills);
    const balancedStats = summarize(balancedKills);

    expect(strongStats.medianKillDay).toBeLessThanOrEqual(balancedStats.medianKillDay + 1);
  });

  it('the boss can never be bursted down in a single day (persistent-pool design)', () => {
    // The pool is 12x the player's maxHp while the boss always scales 1.2x with
    // the player, so no realistic (or even overpowered) profile can deplete it
    // within one daily attack gauge. This guards against accidental balance
    // changes making the boss a one-day farm.
    const god = makePlayer({
      level: 60,
      strength: 999, vitality: 999, dexterity: 500, focus: 500, luck: 500, intelligence: 500,
      hp: 1000, maxHp: 1000,
    });
    const killDays = Array.from({ length: 100 }, () => simulateCampaign(god, 1));
    const stats = summarize(killDays);
    expect(stats.day1KillRate).toBeLessThan(0.1);
  });
});
