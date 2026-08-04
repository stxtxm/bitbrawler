import { Character } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';
import { BOSS_ID, getBossDef } from '../data/bossAssets';
import { shouldResetDaily } from './dailyReset';
import { simulateCombat } from './combatUtils';

// ─── Raid Boss Progress ──────────────────────────────────────────────────────
// The boss is a single persistent HP pool per character. Each "attack" runs a
// full combat; on a loss the boss KEEPS its remaining HP (persisted across
// attacks and across days), and the daily gauge (BOSS.MAX_DAILY_ATTACKS) is
// refilled at each Paris-day reset.

export interface BossProgress {
  bossId: string;
  attacksLeft: number;
  lastAttackReset: number;
  bossHp: number;
  bossMaxHp: number;
  bossLevel: number;
  totalKills: number;
  lastKillAt?: number;
  firstEncounterAt: number;
}

export function isBossUnlocked(level: number): boolean {
  return level >= GAME_RULES.BOSS.UNLOCK_LEVEL;
}

/** Build the boss combatant scaled off the attacking player. */
export function buildBossCharacter(player: Character, bossHp?: number): Character {
  const def = getBossDef()!;
  const level = player.level + GAME_RULES.BOSS.LEVEL_BOOST;
  const mult = GAME_RULES.BOSS.STAT_MULTIPLIER;
  const maxHp = Math.max(1, Math.round(player.maxHp * GAME_RULES.BOSS.HP_MULTIPLIER));

  return {
    seed: `boss_${def.id}`,
    name: def.name,
    gender: 'male' as const,
    level,
    experience: 0,
    strength: Math.max(1, Math.round(player.strength * mult)),
    vitality: Math.max(1, Math.round(player.vitality * mult)),
    dexterity: Math.max(1, Math.round(player.dexterity * mult)),
    luck: Math.max(1, Math.round(player.luck * mult)),
    intelligence: Math.max(1, Math.round(player.intelligence * mult)),
    focus: Math.max(1, Math.round(player.focus * mult)),
    hp: bossHp ?? maxHp,
    maxHp,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    lastFightReset: Date.now(),
    isBot: true,
    equippedItems: { weapon: null, armor: null, accessory: null },
  };
}

/** Fresh boss cycle — full HP pool at the player's current level. */
export function createBossProgress(player: Character, now = Date.now()): BossProgress {
  const boss = buildBossCharacter(player);
  return {
    bossId: BOSS_ID,
    attacksLeft: GAME_RULES.BOSS.MAX_DAILY_ATTACKS,
    lastAttackReset: now,
    bossHp: boss.maxHp,
    bossMaxHp: boss.maxHp,
    bossLevel: boss.level,
    totalKills: 0,
    firstEncounterAt: now,
  };
}

/** Refill the daily attack gauge if the Paris day rolled over. */
export function ensureBossDailyReset(
  progress: BossProgress,
  now = Date.now(),
): BossProgress {
  if (shouldResetDaily(progress.lastAttackReset, now)) {
    return {
      ...progress,
      attacksLeft: GAME_RULES.BOSS.MAX_DAILY_ATTACKS,
      lastAttackReset: now,
    };
  }
  return progress;
}

export function getBossAttacksLeft(
  progress: BossProgress | undefined,
  now = Date.now(),
): number {
  if (!progress) return GAME_RULES.BOSS.MAX_DAILY_ATTACKS;
  return ensureBossDailyReset(progress, now).attacksLeft;
}

export interface BossAttackResolution {
  progress: BossProgress;
  killed: boolean;
  damageDealt: number;
}

/**
 * Resolve one boss attack.
 * - win (boss HP reached 0): new cycle starts, remaining daily attacks carry over.
 * - loss: the boss keeps the HP it had at the end of the combat.
 */
export function resolveBossAttack(
  player: Character,
  progress: BossProgress,
  finalBossHp: number,
  won: boolean,
  now = Date.now(),
): BossAttackResolution {
  const reset = ensureBossDailyReset(progress, now);
  const attacksLeft = Math.max(0, reset.attacksLeft - 1);
  const damageDealt = Math.max(0, reset.bossHp - finalBossHp);

  if (won) {
    const next = createBossProgress(player, now);
    return {
      progress: {
        ...next,
        attacksLeft,
        lastAttackReset: reset.lastAttackReset,
        totalKills: reset.totalKills + 1,
        lastKillAt: now,
        firstEncounterAt: reset.firstEncounterAt,
      },
      killed: true,
      damageDealt,
    };
  }

  return {
    progress: {
      ...reset,
      attacksLeft,
      bossHp: Math.max(0, finalBossHp),
    },
    killed: false,
    damageDealt,
  };
}

/** Deterministic XP reward for a boss kill (no RNG variance in the payout). */
export function getBossKillXp(player: Character): number {
  const levelScaling = 1 + (player.level - 1) * 0.06;
  return Math.round(
    GAME_RULES.COMBAT.XP_WIN * levelScaling * GAME_RULES.BOSS.XP_MODIFIER,
  );
}

/** Full rewards for a boss attack. Only a kill grants rewards. */
export function getBossRewards(
  player: Character,
  killed: boolean,
): { xpGained: number; essenceGained: number } {
  if (!killed) return { xpGained: 0, essenceGained: 0 };
  return {
    xpGained: getBossKillXp(player),
    essenceGained: GAME_RULES.BOSS.ESSENCE_REWARD,
  };
}

/** Simulate one boss attack; returns the outcome and the boss's remaining HP. */
export function simulateBossAttack(
  player: Character,
  progress: BossProgress,
): { won: boolean; bossHpLeft: number; damageDealt: number } {
  const boss = buildBossCharacter(player, progress.bossHp);
  const result = simulateCombat(player, boss);
  const lastSnapshot = result.timeline[result.timeline.length - 1];
  const bossHpLeft = result.winner === 'attacker'
    ? 0
    : (lastSnapshot?.defenderHp ?? progress.bossHp);
  return {
    won: result.winner === 'attacker',
    bossHpLeft,
    damageDealt: Math.max(0, progress.bossHp - bossHpLeft),
  };
}
