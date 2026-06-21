import { Character, PendingFightOpponent } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';
import { getDefaultMedalProgress } from './medalUtils';

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
    medalProgress: character.medalProgress ?? getDefaultMedalProgress(),
    medalInventoryBonus: character.medalInventoryBonus ?? 0,
    medalXpBonus: character.medalXpBonus ?? 0,
    medalAura: character.medalAura ?? false,
    sessionCount: character.sessionCount ?? 0,
    lastSessionDate: character.lastSessionDate ?? 0,
  };

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
