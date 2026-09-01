import { Character } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';
import { BOSS_ID, getBossDef } from '../data/bossAssets';
import { shouldResetDaily } from './dailyReset';
import { simulateCombat } from './combatUtils';

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
  pityStacks?: number;
  consolationCount?: number;
}

export function isBossUnlocked(level: number): boolean {
  return level >= GAME_RULES.BOSS.UNLOCK_LEVEL;
}

export function getBossPityStacks(progress?: BossProgress): number {
  return progress?.pityStacks ?? 0;
}

export function getBossEffectiveMultiplier(stacks: number): number {
  const base = GAME_RULES.BOSS.HP_MULTIPLIER;
  const reduction = GAME_RULES.BOSS.PITY_HP_REDUCTION;
  const floor = GAME_RULES.BOSS.PITY_FLOOR;
  const raw = base * Math.pow(1 - reduction, Math.max(0, stacks));
  return Math.max(floor, raw);
}

export function getBossEffectiveMaxHp(player: Character, pityStacks: number): number {
  const mult = getBossEffectiveMultiplier(pityStacks);
  return Math.max(1, Math.round(player.maxHp * mult));
}

export function getBossPityReductionPct(progress?: BossProgress): number {
  const stacks = getBossPityStacks(progress);
  if (stacks <= 0) return 0;
  const base = GAME_RULES.BOSS.HP_MULTIPLIER;
  const effective = getBossEffectiveMultiplier(stacks);
  return Math.round((1 - effective / base) * 100);
}

export function canGrantConsolation(progress: BossProgress | undefined, now = Date.now()): boolean {
  if (!progress) return true;
  const reset = ensureBossDailyReset(progress, now);
  return (reset.consolationCount ?? 0) < GAME_RULES.BOSS.CONSOLATION_CAP;
}

export function buildBossCharacter(player: Character, bossHp?: number, pityStacks = 0): Character {
  const def = getBossDef()!;
  const level = player.level + GAME_RULES.BOSS.LEVEL_BOOST;
  const mult = GAME_RULES.BOSS.STAT_MULTIPLIER;
  const maxHp = getBossEffectiveMaxHp(player, pityStacks);

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

export function createBossProgress(player: Character, now = Date.now(), pityStacks = 0): BossProgress {
  const effectiveStacks = Math.max(0, pityStacks);
  const boss = buildBossCharacter(player, undefined, effectiveStacks);
  return {
    bossId: BOSS_ID,
    attacksLeft: GAME_RULES.BOSS.MAX_DAILY_ATTACKS,
    lastAttackReset: now,
    bossHp: boss.maxHp,
    bossMaxHp: boss.maxHp,
    bossLevel: boss.level,
    totalKills: 0,
    firstEncounterAt: now,
    pityStacks: effectiveStacks,
    consolationCount: 0,
  };
}

export function ensureBossDailyReset(
  progress: BossProgress,
  now = Date.now(),
): BossProgress {
  if (shouldResetDaily(progress.lastAttackReset, now)) {
    return {
      ...progress,
      attacksLeft: GAME_RULES.BOSS.MAX_DAILY_ATTACKS,
      lastAttackReset: now,
      consolationCount: 0,
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
  const currentStacks = getBossPityStacks(reset);

  if (won) {
    const next = createBossProgress(player, now, 0);
    return {
      progress: {
        ...next,
        attacksLeft,
        lastAttackReset: reset.lastAttackReset,
        totalKills: reset.totalKills + 1,
        lastKillAt: now,
        firstEncounterAt: reset.firstEncounterAt,
        pityStacks: 0,
        consolationCount: 0,
      },
      killed: true,
      damageDealt,
    };
  }

  const newStacks = currentStacks + 1;
  const newMaxHp = getBossEffectiveMaxHp(player, newStacks);
  const clampedHp = Math.min(Math.max(0, finalBossHp), newMaxHp);
  const alreadyRewarded = reset.consolationCount ?? 0;
  const canGrant = alreadyRewarded < GAME_RULES.BOSS.CONSOLATION_CAP;
  const newConsolationCount = canGrant ? alreadyRewarded + 1 : alreadyRewarded;

  return {
    progress: {
      ...reset,
      attacksLeft,
      bossHp: clampedHp,
      bossMaxHp: newMaxHp,
      pityStacks: newStacks,
      consolationCount: newConsolationCount,
    },
    killed: false,
    damageDealt,
  };
}

export function getBossKillXp(player: Character): number {
  const levelScaling = 1 + (player.level - 1) * 0.06;
  return Math.round(
    GAME_RULES.COMBAT.XP_WIN * levelScaling * GAME_RULES.BOSS.XP_MODIFIER,
  );
}

export function getBossRewards(
  player: Character,
  killed: boolean,
  progress?: BossProgress,
  now = Date.now(),
): { xpGained: number; essenceGained: number } {
  if (killed) return { xpGained: getBossKillXp(player), essenceGained: GAME_RULES.BOSS.ESSENCE_REWARD };
  const canGrant = progress ? canGrantConsolation(progress, now) : true;
  return { xpGained: 0, essenceGained: canGrant ? GAME_RULES.BOSS.CONSOLATION_ESSENCE : 0 };
}

export function getBossConsolationEssence(progress: BossProgress | undefined, now = Date.now()): number {
  if (!progress) return GAME_RULES.BOSS.CONSOLATION_ESSENCE;
  return canGrantConsolation(progress, now) ? GAME_RULES.BOSS.CONSOLATION_ESSENCE : 0;
}

export function simulateBossAttack(
  player: Character,
  progress: BossProgress,
): { won: boolean; bossHpLeft: number; damageDealt: number } {
  const pityStacks = getBossPityStacks(progress);
  const boss = buildBossCharacter(player, progress.bossHp, pityStacks);
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
