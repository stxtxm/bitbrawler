import { Character, PendingFightOpponent } from '../types/Character';
import { GAME_RULES } from '../config/gameRules';

// ─── Constants ───────────────────────────────────────────────────────────────

export const LOCAL_STORAGE_KEY = 'bitbrawler_active_char';
export const INVENTORY_CAPACITY = 24;
export const COMBAT_LOG_HISTORY_CAP = 20;

// ─── Normalization ───────────────────────────────────────────────────────────

export const normalizeCharacter = (character: Character): Character => {
  return {
    ...character,
    focus: character.focus ?? GAME_RULES.STATS.BASE_VALUE,
    autoMode: character.autoMode ?? false,
    statPoints: character.statPoints ?? 0,
    inventory: character.inventory ?? [],
    lastLootRoll: character.lastLootRoll ?? 0,
    incomingFightHistory: character.incomingFightHistory ?? [],
  };
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
    inventory: opponent.inventory ?? []
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
    inventory: snapshot.inventory ?? []
  });
};

export const calculatePendingFightXp = (player: Character, opponent: Character, won: boolean): number => {
  const baseXp = won ? GAME_RULES.COMBAT.XP_WIN : GAME_RULES.COMBAT.XP_LOSS;
  return Math.round(baseXp * (1 + (opponent.level - player.level) * 0.1));
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
