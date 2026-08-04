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
  it('scales stats off the player (STAT_MULTIPLIER)', () => {
    const player = makePlayer();
    const boss = buildBossCharacter(player);

    expect(boss.strength).toBe(Math.max(1, Math.round(player.strength * GAME_RULES.BOSS.STAT_MULTIPLIER)));
    expect(boss.vitality).toBe(Math.max(1, Math.round(player.vitality * GAME_RULES.BOSS.STAT_MULTIPLIER)));
    expect(boss.dexterity).toBe(Math.max(1, Math.round(player.dexterity * GAME_RULES.BOSS.STAT_MULTIPLIER)));
    expect(boss.focus).toBe(Math.max(1, Math.round(player.focus * GAME_RULES.BOSS.STAT_MULTIPLIER)));
  });

  it('sets the persistent HP pool from maxHp * HP_MULTIPLIER', () => {
    const player = makePlayer();
    const boss = buildBossCharacter(player);

    expect(boss.maxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
  });

  it('fights at playerLevel + LEVEL_BOOST', () => {
    const boss = buildBossCharacter(makePlayer({ level: 30 }));
    expect(boss.level).toBe(30 + GAME_RULES.BOSS.LEVEL_BOOST);
  });

  it('uses the provided persistent HP when given', () => {
    const player = makePlayer();
    const boss = buildBossCharacter(player, 1234);
    expect(boss.hp).toBe(1234);
    expect(boss.maxHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
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
  it('creates a fresh full-HP cycle with max daily attacks', () => {
    const player = makePlayer();
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    const progress = createBossProgress(player, now);

    expect(progress.bossId).toBe(BOSS_ID);
    expect(progress.attacksLeft).toBe(GAME_RULES.BOSS.MAX_DAILY_ATTACKS);
    expect(progress.bossHp).toBe(progress.bossMaxHp);
    expect(progress.bossHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
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
  const player = makePlayer();
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  const base: BossProgress = {
    bossId: BOSS_ID,
    attacksLeft: 5,
    lastAttackReset: now,
    bossHp: 7008,
    bossMaxHp: 7008,
    bossLevel: 32,
    totalKills: 0,
    firstEncounterAt: now,
  };

  it('on a loss: consumes an attack and keeps the remaining HP', () => {
    const result = resolveBossAttack(player, base, 5120, false, now);

    expect(result.killed).toBe(false);
    expect(result.damageDealt).toBe(7008 - 5120);
    expect(result.progress.attacksLeft).toBe(4);
    expect(result.progress.bossHp).toBe(5120);
    expect(result.progress.totalKills).toBe(0);
    expect(result.progress.bossMaxHp).toBe(7008);
  });

  it('on a win: starts a new cycle, counts the kill, and keeps remaining attacks', () => {
    const result = resolveBossAttack(player, base, 0, true, now);

    expect(result.killed).toBe(true);
    expect(result.damageDealt).toBe(7008);
    expect(result.progress.attacksLeft).toBe(4);
    expect(result.progress.totalKills).toBe(1);
    expect(result.progress.lastKillAt).toBe(now);
    expect(result.progress.firstEncounterAt).toBe(now);
    // fresh cycle: full HP at the player's current level
    expect(result.progress.bossHp).toBe(result.progress.bossMaxHp);
    expect(result.progress.bossHp).toBe(Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));
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

  it('grants essence only on a kill', () => {
    expect(getBossRewards(makePlayer(), true)).toEqual({
      xpGained: getBossKillXp(makePlayer()),
      essenceGained: GAME_RULES.BOSS.ESSENCE_REWARD,
    });
    expect(getBossRewards(makePlayer(), false)).toEqual({ xpGained: 0, essenceGained: 0 });
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
