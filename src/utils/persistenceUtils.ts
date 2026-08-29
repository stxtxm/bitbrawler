import { Character, PendingFightOpponent } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';
import { getTotalXpForLevel } from './xpUtils';
import { getHpForVitality } from './statUtils';

// ─── Constants ───────────────────────────────────────────────────────────────

export const LOCAL_STORAGE_KEY = 'bitbrawler_active_char';
export const INVENTORY_CAPACITY = 24;
export const COMBAT_LOG_HISTORY_CAP = 20;

// ─── Normalization ───────────────────────────────────────────────────────────

const MIGRATION_STAT_POINTS_KEY = 'bitbrawler_migration_statpoints_1';
const BASE = GAME_RULES.STATS.BASE_VALUE;

export const normalizeCharacter = (character: Character): Character => {
  const normalized = {
    ...character,
    focus: character.focus ?? BASE,
    autoMode: character.autoMode ?? false,
    statPoints: character.statPoints ?? 0,
    inventory: character.inventory ?? [],
    lastLootRoll: character.lastLootRoll ?? 0,
    lootboxStreak: character.lootboxStreak ?? 0,
    lootboxPityCount: character.lootboxPityCount ?? 0,
    pveFightsLeft: character.pveFightsLeft ?? 5,
    incomingFightHistory: character.incomingFightHistory ?? [],
    equippedItems: character.equippedItems ?? { weapon: null, armor: null, accessory: null },
    idleStreak: character.idleStreak ?? 0,
    idleMaxStreak: character.idleMaxStreak ?? 0,
    idleTotalKills: character.idleTotalKills ?? 0,
    idleTotalXp: character.idleTotalXp ?? 0,
    lastIdleCheck: character.lastIdleCheck ?? 0,
    lastActive: character.lastActive ?? 0,
    essence: character.essence ?? 0,
    itemUpgrades: character.itemUpgrades ?? {},
    medalProgress: character.medalProgress ?? {},
    medalInventoryBonus: character.medalInventoryBonus ?? 0,
    medalXpBonus: character.medalXpBonus ?? 0,
    medalTitle: character.medalTitle ?? undefined,
    medalAura: character.medalAura ?? false,
    monsterKills: character.monsterKills ?? {},
    achievementProgress: character.achievementProgress ?? {},
    achievementTitle: character.achievementTitle ?? undefined,
    achievementXpBonus: character.achievementXpBonus ?? 0,
    achievementEssenceBonus: character.achievementEssenceBonus ?? 0,
    achievementCosmetics: character.achievementCosmetics ?? [],
    bossProgress: character.bossProgress ? {
      ...character.bossProgress,
      pityStacks: character.bossProgress.pityStacks ?? 0,
      consolationCount: character.bossProgress.consolationCount ?? 0,
    } : undefined,
    bossProgresses: (() => {
      const anyChar = character as any;
      if (anyChar.bossProgresses) {
        const mapped: any = {};
        for (const [k, v] of Object.entries(anyChar.bossProgresses as Record<string, any>)) {
          mapped[k] = v ? { ...v, pityStacks: v.pityStacks ?? 0, consolationCount: v.consolationCount ?? 0 } : v;
        }
        return mapped;
      }
      if (character.bossProgress) {
        return { void_titan: { ...character.bossProgress, pityStacks: character.bossProgress.pityStacks ?? 0, consolationCount: character.bossProgress.consolationCount ?? 0 } };
      }
      return undefined;
    })(),
    abyssalBossProgress: (() => {
      const anyChar = character as any;
      const raw = anyChar.abyssalBossProgress ?? anyChar.bossProgresses?.abyssal_monarch;
      if (!raw) return undefined;
      return { ...raw, pityStacks: raw.pityStacks ?? 0, consolationCount: raw.consolationCount ?? 0 };
    })(),
  } as any;

  // Upward-only level healing: if experience justifies a HIGHER level than
  // stored (legacy incoherent snapshots), snap up to the curve. This kills
  // repeated catch-up bursts (level-up FX replayed every kill). Never nerfs:
  // levels earned under older/generous curves are preserved as-is.
  const curveLevel = (() => {
    let l = 1;
    while (l < 99 && getTotalXpForLevel(l + 1) <= (normalized.experience ?? 0)) l++;
    return l;
  })();
  if (curveLevel > normalized.level) {
    normalized.level = curveLevel;
    const canonicalMaxHp = getHpForVitality(normalized.vitality || 0, curveLevel);
    const previousMaxHp = normalized.maxHp || 0;
    normalized.maxHp = Math.max(previousMaxHp, canonicalMaxHp);
    normalized.hp = Math.min(
      (normalized.hp || 0) + Math.max(0, canonicalMaxHp - previousMaxHp),
      normalized.maxHp
    );
  }

  // One-time migration: idle combat never granted stat points before the fix.
  // If all core stats are at base value (never allocated) and statPoints is 0,
  // the player leveled up through idle without ever receiving points.
  const allAtBase =
    character.strength <= BASE &&
    character.vitality <= BASE &&
    character.dexterity <= BASE &&
    character.luck <= BASE &&
    character.intelligence <= BASE &&
    (character.focus ?? BASE) <= BASE;

  if (normalized.statPoints === 0 && normalized.level > 1 && allAtBase) {
    try {
      if (!localStorage.getItem(MIGRATION_STAT_POINTS_KEY)) {
        normalized.statPoints = (normalized.level - 1) * GAME_RULES.STATS.POINTS_PER_LEVEL;
        localStorage.setItem(MIGRATION_STAT_POINTS_KEY, '1');
      }
    } catch {
      // localStorage may be unavailable
    }
  }

  return normalized;
};

// ─── Pending Fight Helpers ───────────────────────────────────────────────────

export const buildPendingOpponent = (opponent: Character): PendingFightOpponent => {
  const base: PendingFightOpponent = {
    name: opponent.name,
    gender: opponent.gender,
    seed: opponent.seed,
    appearance: opponent.appearance,
    level: opponent.level,
    experience: opponent.experience,
    strength: opponent.strength,
    vitality: opponent.vitality,
    dexterity: opponent.dexterity,
    luck: opponent.luck,
    intelligence: opponent.intelligence,
    focus: opponent.focus ?? GAME_RULES.STATS.BASE_VALUE,
    hp: opponent.hp,
    maxHp: opponent.maxHp,
    wins: opponent.wins || 0,
    losses: opponent.losses || 0,
    fightsLeft: opponent.fightsLeft || 0,
    lastFightReset: opponent.lastFightReset || Date.now(),
    inventory: opponent.inventory ?? [],
    equippedItems: opponent.equippedItems ?? { weapon: null, armor: null, accessory: null },
  };

  if (opponent.id) {
    base.id = opponent.id;
  }

  if (typeof opponent.isBot === 'boolean') {
    base.isBot = opponent.isBot;
  }

  return base;
};

export const hydratePendingOpponent = (snapshot: PendingFightOpponent): Character => {
  return normalizeCharacter({
    seed: snapshot.seed,
    appearance: snapshot.appearance,
    name: snapshot.name,
    gender: snapshot.gender,
    level: snapshot.level,
    experience: snapshot.experience ?? 0,
    strength: snapshot.strength,
    vitality: snapshot.vitality,
    dexterity: snapshot.dexterity,
    luck: snapshot.luck,
    intelligence: snapshot.intelligence,
    focus: snapshot.focus ?? GAME_RULES.STATS.BASE_VALUE,
    hp: snapshot.hp,
    maxHp: snapshot.maxHp,
    wins: snapshot.wins ?? 0,
    losses: snapshot.losses ?? 0,
    fightsLeft: snapshot.fightsLeft ?? 0,
    lastFightReset: snapshot.lastFightReset ?? Date.now(),
    id: snapshot.id,
    isBot: snapshot.isBot,
    inventory: snapshot.inventory ?? [],
    equippedItems: snapshot.equippedItems ?? { weapon: null, armor: null, accessory: null },
  });
};

// ─── Local Storage Persistence ───────────────────────────────────────────────

export const clearLocalData = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
};

export const saveLocalData = (character: Character) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(character));
};

export const loadLocalData = (): Character | null => {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch {
    clearLocalData();
    return null;
  }
};

// ─── Sync Result Type ────────────────────────────────────────────────────────

export type SyncResult =
  | { status: 'ok'; character: Character }
  | { status: 'missing' }
  | { status: 'error' };

// ─── Monotonic progress guard ───────────────────────────────────────────────
// Async writers (medal checks resolving after later ticks, offline merges)
// can carry STALE snapshots. Persisting them would REGRESS level/experience,
// which replays catch-up bursts (and the level-up FX) on every kill.
// Rule: the higher-experience side owns the coherent level/hp block;
// independent counters take the true max.

export function coerceMonotonicProgress<T extends {
  id?: string;
  experience?: number; level?: number; hp?: number; maxHp?: number;
  idleTotalXp?: number; idleTotalKills?: number;
}>(incoming: T, current?: T | null): T {
  // Identity guard: the monotonic rule only applies WITHIN one character.
  // A freshly created / newly logged-in character (different id) must never
  // inherit the previous character's progression.
  if (!current || !current.id || !incoming.id || incoming.id !== current.id) return incoming;
  if (typeof current.experience !== 'number') return incoming;
  const incExp = incoming.experience ?? 0;
  const curExp = current.experience;
  if (incExp >= curExp) return incoming;

  // Current owns more XP -> adopt its whole progression block
  return {
    ...incoming,
    experience: curExp,
    level: Math.max(incoming.level ?? 1, current.level ?? 1),
    hp: Math.max(incoming.hp ?? 0, current.hp ?? 0),
    maxHp: Math.max(incoming.maxHp ?? 0, current.maxHp ?? 0),
    idleTotalXp: Math.max(incoming.idleTotalXp ?? 0, current.idleTotalXp ?? 0),
    idleTotalKills: Math.max(incoming.idleTotalKills ?? 0, current.idleTotalKills ?? 0),
  } as T;
}
