import { describe, it, expect } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';
import { BOSS_ID, getBossDef } from '../../data/bossAssets';
import { Character } from '../../types/Character';
import {
  BossProgress,
  isBossUnlocked,
  buildBossCharacter,
  createBossProgress,
  ensureBossDailyReset,
  getBossAttacksLeft,
  resolveBossAttack,
  getBossKillXp,
  getBossRewards,
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
  wins: overrides.wins ?? 10,
  losses: overrides.losses ?? 2,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  equippedItems: { weapon: null, armor: null, accessory: null },
});

const DAY = 24 * 60 * 60 * 1000;

describe('isBossUnlocked', () => {
  it('locks below the unlock level', () => {
    expect(isBossUnlocked(GAME_RULES.BOSS.UNLOCK_LEVEL - 1)).toBe(false);
    expect(isBossUnlocked(1)).toBe(false);
  });

  it('unlocks at and above the unlock level', () => {
    expect(isBossUnlocked(GAME_RULES.BOSS.UNLOCK_LEVEL)).toBe(true);
    expect(isBossUnlocked(50)).toBe(true);
  });
});

describe('buildBossCharacter', () => {
  it('scales stats off the player (STAT_MULTIPLIER, phase-adjusted)', () => {
    const player = makePlayer({ level: 30 });
    const boss = buildBossCharacter(player);
    const phaseStat = GAME_RULES.BOSS.STAT_MULTIPLIER * 0.5;

    expect(boss.strength).toBe(Math.max(1, Math.round(player.strength * phaseStat)));
    expect(boss.vitality).toBe(Math.max(1, Math.round(player.vitality * phaseStat)));
    expect(boss.dexterity).toBe(Math.max(1, Math.round(player.dexterity * phaseStat)));
    expect(boss.focus).toBe(Math.max(1, Math.round(player.focus * phaseStat)));
  });

  it('uses normal stats in Phase 3', () => {
    const player = makePlayer({ level: 65 });
    const boss = buildBossCharacter(player);

    expect(boss.strength).toBe(Math.max(1, Math.round(player.strength * GAME_RULES.BOSS.STAT_MULTIPLIER)));
  });

  it('sets the persistent HP pool from maxHp * HP_MULTIPLIER (phase-adjusted)', () => {
    const player = makePlayer({ level: 30 });
    const boss = buildBossCharacter(player);

    expect(boss.maxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER * 0.25));
  });

  it('applies Phase 3 HP at high level (no phase reduction)', () => {
    const player = makePlayer({ level: 65 });
    const boss = buildBossCharacter(player);

    expect(boss.maxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
  });

  it('fights at playerLevel + LEVEL_BOOST', () => {
    const boss = buildBossCharacter(makePlayer({ level: 30 }));
    expect(boss.level).toBe(30 + GAME_RULES.BOSS.LEVEL_BOOST);
  });

  it('uses the provided persistent HP when given', () => {
    const player = makePlayer({ level: 30 });
    const boss = buildBossCharacter(player, 1234);
    expect(boss.hp).toBe(1234);
    expect(boss.maxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER * 0.25));
  });

  it('starts at full HP when not provided', () => {
    const player = makePlayer();
    const boss = buildBossCharacter(player);
    expect(boss.hp).toBe(boss.maxHp);
  });

  it('uses the boss asset identity and is a bot without equipment', () => {
    const def = getBossDef()!;
    const boss = buildBossCharacter(makePlayer());
    expect(boss.name).toBe(def.name);
    expect(boss.isBot).toBe(true);
    expect(boss.equippedItems).toEqual({ weapon: null, armor: null, accessory: null });
    expect(boss.seed).toBe(`boss_${def.id}`);
  });
});

describe('createBossProgress', () => {
  it('creates a fresh full-HP cycle with max daily attacks (Phase 1)', () => {
    const player = makePlayer({ level: 30 });
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    const progress = createBossProgress(player, now);

    expect(progress.bossId).toBe(BOSS_ID);
    expect(progress.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS);
    expect(progress.bossHp).toBe(progress.bossMaxHp);
    expect(progress.bossHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER * 0.25));
    expect(progress.bossLevel).toBe(player.level + GAME_RULES.BOSS.LEVEL_BOOST);
    expect(progress.totalKills).toBe(0);
    expect(progress.lastAttackReset).toBe(now);
    expect(progress.firstEncounterAt).toBe(now);
  });
});

describe('ensureBossDailyReset / getBossAttacksLeft', () => {
  const sameDay = Date.UTC(2026, 0, 15, 12, 0, 0);
  const nextDay = Date.UTC(2026, 0, 16, 12, 0, 0);

  const progress: BossProgress = {
    bossId: BOSS_ID,
    attacksLeft: 2,
    lastAttackReset: sameDay,
    bossHp: 4000,
    bossMaxHp: 7008,
    bossLevel: 32,
    totalKills: 1,
    firstEncounterAt: sameDay,
  };

  it('keeps the gauge when still the same Paris day', () => {
    expect(ensureBossDailyReset(progress, sameDay)).toEqual(progress);
    expect(getBossAttacksLeft(progress, sameDay)).toBe(2);
  });

  it('refills the gauge when the Paris day rolls over', () => {
    const reset = ensureBossDailyReset(progress, nextDay);
    expect(reset.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS);
    expect(reset.lastAttackReset).toBe(nextDay);
    expect(getBossAttacksLeft(progress, nextDay)).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS);
  });

  it('preserves the boss HP pool across the daily reset', () => {
    const reset = ensureBossDailyReset(progress, nextDay);
    expect(reset.bossHp).toBe(4000);
    expect(reset.bossMaxHp).toBe(7008);
    expect(reset.totalKills).toBe(1);
  });

  it('returns the max gauge when no progress exists yet', () => {
    expect(getBossAttacksLeft(undefined, sameDay)).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS);
  });
});

describe('resolveBossAttack', () => {
  const player = makePlayer({ level: 65 });
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);
  const fullHp = Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER);

  const base: BossProgress = {
    bossId: BOSS_ID,
    attacksLeft: 5,
    lastAttackReset: now,
    bossHp: fullHp,
    bossMaxHp: fullHp,
    bossLevel: 67,
    totalKills: 0,
    firstEncounterAt: now,
  };

  it('on a loss: consumes an attack and keeps the remaining HP (pity kicks in at 3 defeats)', () => {
    const result = resolveBossAttack(player, base, 5120, false, now);

    expect(result.killed).toBe(false);
    expect(result.damageDealt).toBe(fullHp - 5120);
    expect(result.progress.attacksLeft).toBe(4);
    expect(result.progress.bossHp).toBe(5120);
    expect(result.progress.totalKills).toBe(0);
    expect(result.progress.pityStacks).toBe(1);
    expect(result.progress.bossMaxHp).toBe(fullHp);
  });

  it('on a win: starts a new cycle, counts the kill, and keeps remaining attacks', () => {
    const result = resolveBossAttack(player, base, 0, true, now);

    expect(result.killed).toBe(true);
    expect(result.damageDealt).toBe(fullHp);
    expect(result.progress.attacksLeft).toBe(4);
    expect(result.progress.totalKills).toBe(1);
    expect(result.progress.lastKillAt).toBe(now);
    expect(result.progress.firstEncounterAt).toBe(now);
    expect(result.progress.bossHp).toBe(result.progress.bossMaxHp);
    expect(result.progress.bossHp).toBe(fullHp);
  });

  it('refills the daily gauge before consuming when the day rolled over', () => {
    const nextDay = now + DAY;
    const result = resolveBossAttack(player, { ...base, attacksLeft: 0 }, 3000, false, nextDay);

    expect(result.progress.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS - 1);
    expect(result.progress.lastAttackReset).toBe(nextDay);
  });

  it('never goes below zero attacks', () => {
    const result = resolveBossAttack(player, { ...base, attacksLeft: 0 }, 3000, false, now);
    expect(result.progress.attacksLeft).toBe(0);
  });

  it('clamps boss HP at zero on a loss when the boss HP hit exactly 0', () => {
    const result = resolveBossAttack(player, base, 0, false, now);
    expect(result.progress.bossHp).toBe(0);
    expect(result.killed).toBe(false);
  });

  it('a win after a previous kill increments the kill counter from the stored progress', () => {
    const prev = { ...base, totalKills: 3, bossHp: 2000 };
    const result = resolveBossAttack(player, prev, 0, true, now);
    expect(result.progress.totalKills).toBe(4);
  });
});

describe('getBossKillXp / getBossRewards', () => {
  it('pays deterministic XP = XP_WIN * levelScaling * XP_MODIFIER', () => {
    const player = makePlayer({ level: 30 });
    const levelScaling = 1 + (player.level - 1) * 0.06;
    const expected = Math.round(GAME_RULES.COMBAT.XP_WIN * levelScaling * GAME_RULES.BOSS.XP_MODIFIER);

    expect(getBossKillXp(player)).toBe(expected);
  });

  it('scales boss XP with player level', () => {
    expect(getBossKillXp(makePlayer({ level: 40 }))).toBeGreaterThan(getBossKillXp(makePlayer({ level: 30 })));
  });

  it('is a large payout vs a regular fight win', () => {
    expect(getBossKillXp(makePlayer({ level: 30 }))).toBeGreaterThan(GAME_RULES.COMBAT.XP_WIN);
  });

  it('grants phase-aware essence on kill and scaled consolation on defeat (capped)', () => {
    const phase1 = makePlayer({ level: 30 });
    expect(getBossRewards(phase1, true)).toEqual({
      xpGained: getBossKillXp(phase1),
      essenceGained: 30,
    });
    expect(getBossRewards(phase1, false)).toEqual({ xpGained: 0, essenceGained: 8 });
    const phase3 = makePlayer({ level: 65 });
    expect(getBossRewards(phase3, true)).toEqual({
      xpGained: getBossKillXp(phase3),
      essenceGained: 60,
    });
    expect(getBossRewards(phase3, false)).toEqual({ xpGained: 0, essenceGained: 15 });
    const cappedProgress: BossProgress = {
      bossId: BOSS_ID,
      attacksLeft: 5,
      lastAttackReset: Date.now(),
      bossHp: 4000,
      bossMaxHp: 7008,
      bossLevel: 32,
      totalKills: 0,
      firstEncounterAt: Date.now(),
      pityStacks: 6,
      consolationCount: GAME_RULES.BOSS.CONSOLATION_CAP,
    };
    expect(getBossRewards(makePlayer({ level: 30 }), false, cappedProgress)).toEqual({ xpGained: 0, essenceGained: 0 });
  });
});

describe('boss pity & consolation', () => {
  it('applies stepwise pity: -20% at 3 defeats, -40% at 6, capped at -60%', () => {
    const player = makePlayer({ maxHp: 792, hp: 792, level: 65 });
    let progress = createBossProgress(player);
    const baseMax = progress.bossMaxHp;
    expect(baseMax).toBe(Math.round(792 * GAME_RULES.BOSS.HP_MULTIPLIER));
    for (let i = 1; i <= 2; i++) {
      progress = resolveBossAttack(player, progress, Math.max(1, progress.bossHp - 100), false).progress;
    }
    expect(progress.bossMaxHp).toBe(baseMax);
    for (let i = 3; i <= 5; i++) {
      progress = resolveBossAttack(player, progress, Math.max(1, progress.bossHp - 100), false).progress;
    }
    expect(progress.pityStacks).toBe(5);
    expect(progress.bossMaxHp).toBe(Math.round(baseMax * 0.8));
    for (let i = 6; i <= 6; i++) {
      progress = resolveBossAttack(player, progress, Math.max(1, progress.bossHp - 10), false).progress;
    }
    expect(progress.pityStacks).toBe(6);
    expect(progress.bossMaxHp).toBe(Math.round(baseMax * 0.6));
    for (let i = 7; i <= 12; i++) {
      progress = resolveBossAttack(player, progress, Math.max(1, progress.bossHp - 10), false).progress;
    }
    expect(progress.bossMaxHp).toBe(Math.round(baseMax * 0.4));
  });

  it('resets pity on kill', () => {
    const player = makePlayer({ level: 30 });
    let progress = createBossProgress(player);
    for (let i = 0; i < 3; i++) {
      progress = resolveBossAttack(player, progress, Math.max(1, progress.bossHp - 50), false).progress;
    }
    expect(progress.pityStacks).toBe(3);
    const killed = resolveBossAttack(player, progress, 0, true);
    expect(killed.progress.pityStacks).toBe(0);
    expect(killed.progress.bossMaxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER * 0.25));
    expect(killed.progress.consolationCount).toBe(0);
  });

  it('caps consolation at CONSOLATION_CAP per day and resets on daily reset', () => {
    const player = makePlayer({ level: 65 });
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    let progress = createBossProgress(player, now);
    for (let i = 0; i < GAME_RULES.BOSS.CONSOLATION_CAP; i++) {
      const rewards = getBossRewards(player, false, progress, now);
      expect(rewards.essenceGained).toBe(GAME_RULES.BOSS.CONSOLATION_ESSENCE);
      progress = resolveBossAttack(player, progress, progress.bossHp - 10, false, now).progress;
    }
    expect(getBossRewards(player, false, progress, now).essenceGained).toBe(0);
    const nextDay = now + 24 * 60 * 60 * 1000;
    expect(getBossRewards(player, false, progress, nextDay).essenceGained).toBe(GAME_RULES.BOSS.CONSOLATION_ESSENCE);
  });

  it('buildBossCharacter respects pityStacks for maxHp (stepwise)', () => {
    const player = makePlayer({ maxHp: 792, level: 65 });
    const boss0 = buildBossCharacter(player, undefined, 0);
    const boss3 = buildBossCharacter(player, undefined, 3);
    const boss6 = buildBossCharacter(player, undefined, 6);
    expect(boss3.maxHp).toBe(Math.round(boss0.maxHp * 0.8));
    expect(boss6.maxHp).toBe(Math.round(boss0.maxHp * 0.6));
  });
});

describe('simulateBossAttack', () => {
  it('returns a valid outcome with boss HP never above the pool', () => {
    const player = makePlayer();
    const progress = createBossProgress(player);
    const outcome = simulateBossAttack(player, progress);

    expect(['won', 'bossHpLeft', 'damageDealt']).toEqual(Object.keys(outcome));
    expect(outcome.bossHpLeft).toBeGreaterThanOrEqual(0);
    expect(outcome.bossHpLeft).toBeLessThanOrEqual(progress.bossHp);
    expect(outcome.damageDealt).toBeGreaterThanOrEqual(0);
    expect(outcome.damageDealt).toBe(progress.bossHp - outcome.bossHpLeft);
  });

  it('reports a kill (bossHpLeft 0) when the boss HP pool is depleted', () => {
    // A boss whose remaining pool is 1 HP dies on the first hit, even for a
    // normal player — this is the "final blow" of a raid cycle.
    const player = makePlayer();
    const progress = createBossProgress(player);
    const outcome = simulateBossAttack(player, { ...progress, bossHp: 1 });

    expect(outcome.won).toBe(true);
    expect(outcome.bossHpLeft).toBe(0);
    expect(outcome.damageDealt).toBe(1);
  });

  it('damages the boss on a loss (persistent pool drops)', () => {
    const player = makePlayer();
    const progress = createBossProgress(player);
    const outcome = simulateBossAttack(player, progress);

    if (!outcome.won) {
      expect(outcome.bossHpLeft).toBeLessThan(progress.bossHp);
    }
  });
});
