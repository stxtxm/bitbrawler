import { GAME_RULES } from '../config/gameRules';
import { Character, FightHistory } from '../types/Character';
import { ItemRarity } from '../types/Item';

export interface RecoveryQuest {
  triggeredAt: number;
  expiresAt: number;
  lossesAtTrigger: number;
  completed: boolean;
  claimed: boolean;
}

export interface RecoveryReward {
  essence: number;
  recoveries: number;
}

const QUEST_PREFIX = 'recovery_quest';
const ATLAS_PREFIX = 'comeback_atlas';

const questMemory = new Map<string, RecoveryQuest>();
const atlasMemory = new Map<string, number>();

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined;
  } catch {
    return false;
  }
}

function questKey(characterId: string): string {
  return `${QUEST_PREFIX}_${characterId}`;
}

function atlasKey(characterId: string): string {
  return `${ATLAS_PREFIX}_${characterId}`;
}

export function getConsecutiveLosses(history: FightHistory[] | undefined): number {
  if (!history || history.length === 0) return 0;
  let losses = 0;
  for (const entry of history) {
    if (entry.won) break;
    losses++;
  }
  return losses;
}

export function getSecondWindEssence(consecutiveLosses: number, won: boolean): number {
  if (won) return 0;
  const safe = Number.isFinite(consecutiveLosses) ? Math.max(0, Math.floor(consecutiveLosses)) : 0;
  if (safe <= 0) return 0;
  return Math.min(safe * GAME_RULES.COMEBACK.SECOND_WIND_PER_LOSS, GAME_RULES.COMEBACK.SECOND_WIND_CAP);
}

export function isLossPityFloorActive(consecutiveLosses: number): boolean {
  return consecutiveLosses >= GAME_RULES.COMEBACK.LOSS_PITY_FLOOR_LOSSES;
}

export function getLossPityMinRarity(consecutiveLosses: number): ItemRarity | null {
  return isLossPityFloorActive(consecutiveLosses) ? 'uncommon' : null;
}

function readQuest(characterId: string): RecoveryQuest | null {
  const mem = questMemory.get(questKey(characterId));
  if (mem) return { ...mem };
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(questKey(characterId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecoveryQuest;
    if (typeof parsed.triggeredAt !== 'number' || typeof parsed.expiresAt !== 'number') return null;
    questMemory.set(questKey(characterId), { ...parsed });
    return { ...parsed };
  } catch {
    return null;
  }
}

function writeQuest(characterId: string, quest: RecoveryQuest): void {
  questMemory.set(questKey(characterId), { ...quest });
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(questKey(characterId), JSON.stringify(quest));
  } catch {
  }
}

function removeQuest(characterId: string): void {
  questMemory.delete(questKey(characterId));
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(questKey(characterId));
  } catch {
  }
}

function pruneExpired(characterId: string, now: number): RecoveryQuest | null {
  const quest = readQuest(characterId);
  if (!quest) return null;
  if (!quest.completed && now > quest.expiresAt) {
    removeQuest(characterId);
    return null;
  }
  return quest;
}

export function startRecoveryQuest(characterId: string, consecutiveLosses: number, now: number = Date.now()): RecoveryQuest | null {
  if (consecutiveLosses < GAME_RULES.COMEBACK.RECOVERY_QUEST_TRIGGER_LOSSES) return null;
  const existing = pruneExpired(characterId, now);
  if (existing && !existing.completed) return { ...existing };
  const quest: RecoveryQuest = {
    triggeredAt: now,
    expiresAt: now + GAME_RULES.COMEBACK.RECOVERY_QUEST_WINDOW_MS,
    lossesAtTrigger: consecutiveLosses,
    completed: false,
    claimed: false,
  };
  writeQuest(characterId, quest);
  return { ...quest };
}

export function getRecoveryQuest(characterId: string, now: number = Date.now()): RecoveryQuest | null {
  return pruneExpired(characterId, now);
}

export function isRecoveryQuestActive(characterId: string, now: number = Date.now()): boolean {
  const quest = pruneExpired(characterId, now);
  return quest !== null && !quest.completed;
}

export function completeRecoveryQuest(characterId: string, won: boolean, now: number = Date.now()): RecoveryReward | null {
  if (!won) return null;
  const quest = pruneExpired(characterId, now);
  if (!quest || quest.completed) return null;
  const done: RecoveryQuest = { ...quest, completed: true, claimed: true };
  removeQuest(characterId);
  writeQuest(characterId, done);
  removeQuest(characterId);
  return { essence: GAME_RULES.COMEBACK.RECOVERY_QUEST_ESSENCE, recoveries: 1 };
}

export function clearRecoveryQuest(characterId: string): void {
  removeQuest(characterId);
}

export function loadRecoveries(characterId: string): number {
  const mem = atlasMemory.get(atlasKey(characterId));
  if (mem !== undefined) return mem;
  if (!storageAvailable()) return 0;
  try {
    const raw = localStorage.getItem(atlasKey(characterId));
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    atlasMemory.set(atlasKey(characterId), parsed);
    return parsed;
  } catch {
    return 0;
  }
}

export function recordRecovery(character: Character): number {
  const id = character.id ?? character.seed;
  const next = loadRecoveries(id) + 1;
  atlasMemory.set(atlasKey(id), next);
  if (storageAvailable()) {
    try {
      localStorage.setItem(atlasKey(id), String(next));
    } catch {
    }
  }
  return next;
}

export function getComebackBadge(recoveries: number): string | null {
  if (recoveries >= 12) return 'comeback_hero';
  if (recoveries >= 5) return 'comeback_regular';
  if (recoveries >= 1) return 'comeback_rookie';
  return null;
}
