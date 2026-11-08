import { Character } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';
import { ABYSSAL_BOSS_ID, BOSS_ID, BossId, getBossDef } from '../data/bossAssets';
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
export function getBossTier(bossId: BossId = BOSS_ID) {
  return (GAME_RULES.BOSS_TIERS as any)[bossId] ?? GAME_RULES.BOSS;
}

export function getBossPhase(playerLevel: number, bossId: BossId = BOSS_ID): 1 | 2 | 3 {
  if (bossId !== BOSS_ID) return 3;
  const phases = (GAME_RULES as any).BOSS_ACCESSIBILITY?.void_titan;
  if (!phases) return 3;
  if (playerLevel <= phases.PHASE_1.MAX_LEVEL) return 1;
  if (playerLevel <= phases.PHASE_2.MAX_LEVEL) return 2;
  return 3;
}

export function getBossPhaseConfig(playerLevel: number, bossId: BossId = BOSS_ID) {
  if (bossId !== BOSS_ID) {
    return { hpFactor: 1, statFactor: 1, essenceReward: getBossTier(bossId).ESSENCE_REWARD };
  }
  const phases = (GAME_RULES as any).BOSS_ACCESSIBILITY?.void_titan;
  if (!phases) {
    return { hpFactor: 1, statFactor: 1, essenceReward: GAME_RULES.BOSS.ESSENCE_REWARD };
  }
  const phase = getBossPhase(playerLevel, bossId);
  if (phase === 1) return { hpFactor: phases.PHASE_1.HP_FACTOR, statFactor: phases.PHASE_1.STAT_FACTOR, essenceReward: phases.PHASE_1.ESSENCE_REWARD };
  if (phase === 2) return { hpFactor: phases.PHASE_2.HP_FACTOR, statFactor: phases.PHASE_2.STAT_FACTOR, essenceReward: phases.PHASE_2.ESSENCE_REWARD };
  return { hpFactor: phases.PHASE_3.HP_FACTOR, statFactor: phases.PHASE_3.STAT_FACTOR, essenceReward: phases.PHASE_3.ESSENCE_REWARD };
}

export function getBossPityReduction(stacks: number, bossId: BossId = BOSS_ID): number {
  const tier: any = getBossTier(bossId);
  const stepDefeats = tier.PITY_STEP_DEFEATS ?? GAME_RULES.BOSS.PITY_STEP_DEFEATS ?? 3;
  const stepReduction = tier.PITY_STEP_REDUCTION ?? GAME_RULES.BOSS.PITY_STEP_REDUCTION ?? 0.2;
  const cap = tier.PITY_CAP ?? GAME_RULES.BOSS.PITY_CAP ?? 0.6;
  const safeStacks = Math.max(0, stacks);
  const steps = Math.floor(safeStacks / stepDefeats);
  return Math.min(cap, steps * stepReduction);
}

export function isBossUnlocked(level: number, bossId: BossId = BOSS_ID): boolean {
  const tier: any = getBossTier(bossId);
  return level >= tier.UNLOCK_LEVEL;
}

export function isBossUnlockedForCharacter(character: Character, bossId: BossId = BOSS_ID): boolean {
  const tier: any = getBossTier(bossId);
  if (character.level < tier.UNLOCK_LEVEL) return false;
  if (tier.REQUIRES_KILLS && tier.REQUIRES_KILLS > 0) {
    const voidProgress = getBossProgressForId(character, BOSS_ID);
    const kills = voidProgress?.totalKills ?? character.bossProgress?.totalKills ?? 0;
    if (kills < tier.REQUIRES_KILLS) return false;
  }
  return true;
}

export function getBossProgressForId(character: Character, bossId: BossId): BossProgress | undefined {
  const anyChar = character as any;
  if (anyChar.bossProgresses && anyChar.bossProgresses[bossId]) return anyChar.bossProgresses[bossId] as BossProgress;
  if (bossId === ABYSSAL_BOSS_ID && anyChar.abyssalBossProgress) return anyChar.abyssalBossProgress as BossProgress;
  if (bossId === BOSS_ID && anyChar.bossProgress) return anyChar.bossProgress as BossProgress;
  return undefined;
}

export function setBossProgressForId(character: Character, progress: BossProgress): Character {
  const anyChar = character as any;
  const bossId = progress.bossId as BossId;
  const nextProgresses: Record<string, BossProgress> = { ...(anyChar.bossProgresses ?? {}) };
  nextProgresses[bossId] = progress;
  const next: any = { ...character, bossProgresses: nextProgresses };
  if (bossId === BOSS_ID) next.bossProgress = progress;
  if (bossId === ABYSSAL_BOSS_ID) next.abyssalBossProgress = progress;
  return next as Character;
}

export function getBossPityStacks(progress?: BossProgress): number {
  return progress?.pityStacks ?? 0;
}

export function getBossEffectiveMultiplier(stacks: number, bossId: BossId = BOSS_ID, playerLevel?: number): number {
  const tier: any = getBossTier(bossId);
  const phase = playerLevel != null ? getBossPhaseConfig(playerLevel, bossId) : { hpFactor: 1 };
  const base = tier.HP_MULTIPLIER * (phase.hpFactor ?? 1);
  const reduction = getBossPityReduction(stacks, bossId);
  return Math.max(0.01, base * (1 - reduction));
}

export function getBossEffectiveMaxHp(player: Character, pityStacks: number, bossId: BossId = BOSS_ID): number {
  const mult = getBossEffectiveMultiplier(pityStacks, bossId, player.level);
  return Math.max(1, Math.round(player.maxHp * mult));
}

export function getBossPityReductionPct(progress?: BossProgress, bossId: BossId = BOSS_ID): number {
  const stacks = getBossPityStacks(progress);
  if (stacks <= 0) return 0;
  return Math.round(getBossPityReduction(stacks, progress?.bossId as BossId ?? bossId) * 100);
}

export function canGrantConsolation(progress: BossProgress | undefined, now = Date.now()): boolean {
  if (!progress) return true;
  const reset = ensureBossDailyReset(progress, now);
  const tier: any = getBossTier(progress.bossId as BossId);
  return (reset.consolationCount ?? 0) < (tier.CONSOLATION_CAP ?? GAME_RULES.BOSS.CONSOLATION_CAP);
}

export function buildBossCharacter(player: Character, bossHp?: number, bossIdOrPity: BossId | number = BOSS_ID, pityStacksParam = 0): Character {
  let bossId: BossId = BOSS_ID;
  let pityStacks = 0;
  if (typeof bossIdOrPity === 'number') {
    bossId = BOSS_ID;
    pityStacks = bossIdOrPity;
  } else {
    bossId = bossIdOrPity as BossId;
    pityStacks = pityStacksParam;
  }
  const def = getBossDef(bossId)!;
  const tier: any = getBossTier(bossId);
  const phase = getBossPhaseConfig(player.level, bossId);
  const level = player.level + tier.LEVEL_BOOST;
  const mult = tier.STAT_MULTIPLIER * (phase.statFactor ?? 1);
  const maxHp = getBossEffectiveMaxHp(player, pityStacks, bossId);

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

export function createBossProgress(player: Character, now: any = Date.now(), bossIdOrPity: BossId | number = BOSS_ID, pityStacksParam = 0): BossProgress {
  let bossId: BossId = BOSS_ID;
  let pityStacks = 0;
  let effectiveNow = Date.now();
  if (typeof now === 'number' && typeof bossIdOrPity === 'number') {
    effectiveNow = now;
    pityStacks = bossIdOrPity;
  } else if (typeof bossIdOrPity === 'number') {
    effectiveNow = now as number;
    bossId = BOSS_ID;
    pityStacks = bossIdOrPity;
  } else if (typeof bossIdOrPity === 'string') {
    effectiveNow = typeof now === 'number' ? now : Date.now();
    bossId = bossIdOrPity as BossId;
    pityStacks = pityStacksParam;
  } else {
    effectiveNow = typeof now === 'number' ? now : Date.now();
  }
  const effectiveStacks = Math.max(0, pityStacks);
  const boss = buildBossCharacter(player, undefined, bossId, effectiveStacks);
  const tier: any = getBossTier(bossId);
  return {
    bossId,
    attacksLeft: tier.MAX_DAILY_ATTACKS,
    lastAttackReset: effectiveNow,
    bossHp: boss.maxHp,
    bossMaxHp: boss.maxHp,
    bossLevel: boss.level,
    totalKills: 0,
    firstEncounterAt: effectiveNow,
    pityStacks: effectiveStacks,
    consolationCount: 0,
  };
}

export function ensureBossDailyReset(
  progress: BossProgress,
  now = Date.now(),
): BossProgress {
  if (shouldResetDaily(progress.lastAttackReset, now)) {
    const tier: any = getBossTier(progress.bossId as BossId);
    return {
      ...progress,
      attacksLeft: tier.MAX_DAILY_ATTACKS,
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
  const bossId = progress.bossId as BossId;

  if (won) {
    const next = createBossProgress(player, now, bossId, 0);
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
  const newMaxHp = getBossEffectiveMaxHp(player, newStacks, bossId);
  const clampedHp = Math.min(Math.max(0, finalBossHp), newMaxHp);
  const alreadyRewarded = reset.consolationCount ?? 0;
  const tier: any = getBossTier(bossId);
  const canGrant = alreadyRewarded < (tier.CONSOLATION_CAP ?? GAME_RULES.BOSS.CONSOLATION_CAP);
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

export function getBossKillXp(player: Character, bossId: BossId = BOSS_ID): number {
  const tier: any = getBossTier(bossId);
  const levelScaling = 1 + (player.level - 1) * 0.06;
  return Math.round(
    GAME_RULES.COMBAT.XP_WIN * levelScaling * tier.XP_MODIFIER,
  );
}

export function getBossKillEssence(player: Character, bossId: BossId = BOSS_ID): number {
  if (bossId === BOSS_ID) {
    return getBossPhaseConfig(player.level, bossId).essenceReward;
  }
  const tier: any = getBossTier(bossId);
  return tier.ESSENCE_REWARD;
}

export function getBossRewards(
  player: Character,
  killed: boolean,
  bossIdOrProgress: BossId | BossProgress = BOSS_ID,
  now = Date.now(),
): { xpGained: number; essenceGained: number } {
  let bossId: BossId = BOSS_ID;
  let progress: BossProgress | undefined;
  if (typeof bossIdOrProgress === 'string') {
    bossId = bossIdOrProgress as BossId;
  } else if (bossIdOrProgress && typeof bossIdOrProgress === 'object' && 'bossId' in bossIdOrProgress) {
    progress = bossIdOrProgress as BossProgress;
    bossId = progress.bossId as BossId;
  }
  if (killed) {
    return { xpGained: getBossKillXp(player, bossId), essenceGained: getBossKillEssence(player, bossId) };
  }
  const tier: any = getBossTier(bossId);
  const canGrant = progress ? canGrantConsolation(progress, now) : true;
  const baseConsolation = tier.CONSOLATION_ESSENCE ?? GAME_RULES.BOSS.CONSOLATION_ESSENCE;
  const killEssence = getBossKillEssence(player, bossId);
  const tierEssence = tier.ESSENCE_REWARD ?? GAME_RULES.BOSS.ESSENCE_REWARD;
  const consolation = bossId === BOSS_ID && tierEssence > 0
    ? Math.round(baseConsolation * (killEssence / tierEssence))
    : baseConsolation;
  return { xpGained: 0, essenceGained: canGrant ? consolation : 0 };
}

export function getBossConsolationEssence(progress: BossProgress | undefined, now = Date.now(), player?: Character): number {
  if (!progress) return GAME_RULES.BOSS.CONSOLATION_ESSENCE;
  const bossId = progress.bossId as BossId;
  const tier: any = getBossTier(bossId);
  const baseConsolation = tier.CONSOLATION_ESSENCE ?? GAME_RULES.BOSS.CONSOLATION_ESSENCE;
  if (!canGrantConsolation(progress, now)) return 0;
  if (player && bossId === BOSS_ID) {
    const killEssence = getBossKillEssence(player, bossId);
    const tierEssence = tier.ESSENCE_REWARD ?? GAME_RULES.BOSS.ESSENCE_REWARD;
    return tierEssence > 0 ? Math.round(baseConsolation * (killEssence / tierEssence)) : baseConsolation;
  }
  return baseConsolation;
}

export function simulateBossAttack(
  player: Character,
  progress: BossProgress,
): { won: boolean; bossHpLeft: number; damageDealt: number } {
  const pityStacks = getBossPityStacks(progress);
  const bossId = progress.bossId as BossId;
  const boss = buildBossCharacter(player, progress.bossHp, bossId, pityStacks);
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
