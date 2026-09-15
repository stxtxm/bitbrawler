import { Character } from '../types/Character';
import { TROPHY_DEFS, TROPHY_IDS, TROPHY_CATEGORIES } from '../data/trophies';
import type { TrophyDef } from '../data/trophies';
import { isWithinZonedHourWindow } from './timezoneUtils';

export type { TrophyDef, TrophyCategory, RewardTier } from '../data/trophies';
export { TROPHY_DEFS, TROPHY_IDS, TROPHY_CATEGORIES };

export interface TrophyContext {
  now?: Date;
  fireDancerWins?: number;
  salvageEpicCount?: number;
  fusionCount?: number;
  fusionLuckyCount?: number;
  shopPurchaseCount?: number;
  pveWins?: number;
  flawlessWin?: boolean;
  comebackWin?: boolean;
  legendaryCount?: number;
  maxUpgradeLevel?: number;
  idleStreak?: number;
  monsterKills?: Record<string, number>;
  bossProgresses?: Record<string, unknown> | Map<string, unknown>;
}

type TrophyCharacter = Character & { trophies?: string[] };

function getConsecutiveWins(history: Character['fightHistory']): number {
  if (!history || history.length === 0) return 0;
  let streak = 0;
  for (const entry of history) {
    if (entry.won) streak++;
    else break;
  }
  return streak;
}

function getMonsterKills(source: Record<string, number> | undefined, id: string): number {
  if (!source) return 0;
  if (source[id] !== undefined) return source[id];
  const lower = id.toLowerCase();
  const upper = id.toUpperCase();
  if (source[lower] !== undefined) return source[lower];
  if (source[upper] !== undefined) return source[upper];
  for (const key of Object.keys(source)) {
    if (key.toLowerCase() === lower) return source[key];
  }
  return 0;
}

function hasAnyBossKill(character: TrophyCharacter, context: TrophyContext): boolean {
  const ctxProgresses = context.bossProgresses as unknown;
  if (ctxProgresses) {
    if (ctxProgresses instanceof Map) {
      if (ctxProgresses.size >= 1) return true;
    } else if (typeof ctxProgresses === 'object') {
      if (Object.keys(ctxProgresses as Record<string, unknown>).length >= 1) return true;
    }
  }
  const anyChar = character as unknown as Record<string, unknown>;
  const progresses = anyChar['bossProgresses'] as Record<string, unknown> | undefined;
  if (progresses && Object.keys(progresses).length >= 1) return true;
  const abyssal = anyChar['abyssalBossProgress'] as { totalKills?: number } | undefined;
  if (abyssal && (abyssal.totalKills ?? 0) >= 1) return true;
  const legacy = anyChar['bossProgress'] as { totalKills?: number } | undefined;
  if (legacy && (legacy.totalKills ?? 0) >= 1) return true;
  return false;
}

function hasAbyssalKill(character: TrophyCharacter, context: TrophyContext): boolean {
  const ctxProgresses = context.bossProgresses as unknown;
  if (ctxProgresses) {
    if (ctxProgresses instanceof Map) {
      if (ctxProgresses.has('abyssal_monarch') || ctxProgresses.has('ABYSSAL_MONARCH')) return true;
    } else if (typeof ctxProgresses === 'object') {
      const rec = ctxProgresses as Record<string, unknown>;
      if (rec['abyssal_monarch'] || rec['ABYSSAL_MONARCH'] || rec['abyssal']) return true;
    }
  }
  const anyChar = character as unknown as Record<string, unknown>;
  const progresses = anyChar['bossProgresses'] as Record<string, { totalKills?: number }> | undefined;
  if (progresses) {
    if (progresses['abyssal_monarch'] && (progresses['abyssal_monarch'].totalKills ?? 0) >= 1) return true;
    if (progresses['ABYSSAL_MONARCH'] && (progresses['ABYSSAL_MONARCH'].totalKills ?? 0) >= 1) return true;
  }
  const abyssal = anyChar['abyssalBossProgress'] as { totalKills?: number } | undefined;
  if (abyssal && (abyssal.totalKills ?? 0) >= 1) return true;
  return false;
}

export const getTrophyDefs = (): TrophyDef[] => TROPHY_DEFS;

export const isTrophyUnlocked = (character: TrophyCharacter, trophyId: string): boolean => {
  return character.trophies?.includes(trophyId) ?? false;
};

export const getTrophyProgress = (character: TrophyCharacter): { unlocked: number; total: number } => {
  const unlocked = character.trophies?.length ?? 0;
  return { unlocked, total: TROPHY_DEFS.length };
};

export const getTrophyHint = (trophyId: string, unlockedSet: Set<string>): string => {
  const def = TROPHY_DEFS.find(d => d.id === trophyId);
  if (!def) return '???';
  if (!def.hidden) return def.hint;
  if (unlockedSet.has(trophyId)) return def.hint;
  const idx = TROPHY_DEFS.findIndex(d => d.id === trophyId);
  if (idx <= 0) return '???';
  const prevId = TROPHY_DEFS[idx - 1].id;
  const nextId = idx + 1 < TROPHY_DEFS.length ? TROPHY_DEFS[idx + 1].id : null;
  const neighborUnlocked = unlockedSet.has(prevId) || (nextId !== null && unlockedSet.has(nextId));
  if (neighborUnlocked) return def.hint;
  return '???';
};

const trophyPredicates: Record<string, (character: TrophyCharacter, context: TrophyContext) => boolean> = {
  fire_dancer: (character, context) => {
    if (context.fireDancerWins !== undefined) return context.fireDancerWins >= 3;
    const wins = character.fightHistory?.filter(h => h.won).length ?? 0;
    const hasWeapon = character.equippedItems?.weapon !== null && character.equippedItems?.weapon !== undefined;
    return wins >= 3 && hasWeapon;
  },
  midnight_brawler: (character, context) => {
    const wins = character.wins ?? 0;
    if (wins < 1) return false;
    const date = context.now ?? new Date();
    return isWithinZonedHourWindow(date, 'Europe/Paris', 22, 2);
  },
  salvage_sage: (_character, context) => {
    return (context.salvageEpicCount ?? 0) >= 5;
  },
  volcanic_scout: (character, context) => {
    const killsSource = context.monsterKills ?? character.monsterKills;
    const kills = getMonsterKills(killsSource as Record<string, number> | undefined, 'magma_golem');
    return kills >= 1 && hasAnyBossKill(character, context);
  },
  perfect_5: (character) => {
    return getConsecutiveWins(character.fightHistory) >= 5;
  },
  iron_will: (character) => {
    return (character.wins ?? 0) >= 10;
  },
  abyssal_slayer: (character, context) => {
    return hasAbyssalKill(character, context);
  },
  fusion_alchemist: (_character, context) => {
    return (context.fusionCount ?? 0) >= 5;
  },
  lucky_fusion: (_character, context) => {
    return (context.fusionLuckyCount ?? 0) >= 1;
  },
  shop_initiate: (_character, context) => {
    return (context.shopPurchaseCount ?? 0) >= 1;
  },
  level_seeker: (character) => {
    return (character.level ?? 1) >= 20;
  },
  essence_hoarder: (character) => {
    return (character.essence ?? 0) >= 1000;
  },
  flawless_duelist: (_character, context) => {
    return context.flawlessWin === true;
  },
  comeback_hero: (_character, context) => {
    return context.comebackWin === true;
  },
  goblin_hunter: (character, context) => {
    const killsSource = context.monsterKills ?? character.monsterKills;
    return getMonsterKills(killsSource as Record<string, number> | undefined, 'goblin') >= 10;
  },
  lava_hound_hunter: (character, context) => {
    const killsSource = context.monsterKills ?? character.monsterKills;
    return getMonsterKills(killsSource as Record<string, number> | undefined, 'lava_hound') >= 5;
  },
  chimera_bane: (character, context) => {
    const killsSource = context.monsterKills ?? character.monsterKills;
    return getMonsterKills(killsSource as Record<string, number> | undefined, 'chimera') >= 5;
  },
  legendary_collector: (_character, context) => {
    return (context.legendaryCount ?? 0) >= 1;
  },
  upgrade_master: (_character, context) => {
    return (context.maxUpgradeLevel ?? 0) >= 5;
  },
  idle_streaker: (character, context) => {
    const streak = context.idleStreak ?? character.idleStreak ?? 0;
    return streak >= 3;
  },
};

export const checkTrophies = (character: TrophyCharacter, context: TrophyContext = {}): string[] => {
  const owned = new Set(character.trophies ?? []);
  const newlyUnlocked: string[] = [];
  for (const def of TROPHY_DEFS) {
    if (owned.has(def.id)) continue;
    const predicate = trophyPredicates[def.id];
    if (!predicate) continue;
    if (predicate(character, context)) {
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
};
