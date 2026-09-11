import { getSurgeBiome } from '../data/liveOps';
import { GAME_RULES } from '../config/gameRules';
import { calculateIdleEssence } from './idleXpUtils';
import { getDailyResetKey } from './dailyReset';
import type { MonsterId } from '../data/monsterAssets';

export const SURGE_XP_MODIFIER = 3.1;
export const SURGE_ESSENCE_MULTIPLIER = 1.25;
export const BOUNTY_TARGET = 3;
export const BOUNTY_PASS_XP = 1;

const BOUNTY_PREFIX = 'biomeSurge_bounty_';

export function getBountyStorageKey(date: Date = new Date()): string {
  return `${BOUNTY_PREFIX}${getDailyResetKey(date.getTime())}`;
}

function readCount(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeCount(key: string, count: number): void {
  try {
    localStorage.setItem(key, String(count));
  } catch {
    return;
  }
}

export function isSurgeMonster(monsterId: MonsterId, date: Date = new Date()): boolean {
  const surge = getSurgeBiome(date);
  return surge.monsterPool.includes(monsterId);
}

export function getPveXpModifier(monsterId: MonsterId, date: Date = new Date()): number {
  return isSurgeMonster(monsterId, date) ? SURGE_XP_MODIFIER : GAME_RULES.PVE.XP_MODIFIER;
}

export function getSurgeEssenceMultiplier(monsterId: MonsterId, date: Date = new Date()): number {
  return isSurgeMonster(monsterId, date) ? SURGE_ESSENCE_MULTIPLIER : 1;
}

export function calculateIdleEssenceWithSurge(
  won: boolean,
  playerLevel: number,
  intelligence: number | undefined,
  focus: number | undefined,
  monsterId: MonsterId,
  date: Date = new Date()
): number {
  const base = calculateIdleEssence(won, playerLevel, intelligence, focus);
  return base * getSurgeEssenceMultiplier(monsterId, date);
}

export function getBountyProgress(date: Date = new Date()): number {
  return readCount(getBountyStorageKey(date));
}

export function isBountyCompleted(date: Date = new Date()): boolean {
  return getBountyProgress(date) >= BOUNTY_TARGET;
}

export function resetBountyProgress(date: Date = new Date()): void {
  try {
    localStorage.removeItem(getBountyStorageKey(date));
  } catch {
    return;
  }
}

export function incrementBountyProgress(
  monsterId: MonsterId,
  date: Date = new Date()
): { count: number; completed: boolean; justCompleted: boolean; shouldGrantPassXp: boolean } {
  if (!isSurgeMonster(monsterId, date)) {
    const count = getBountyProgress(date);
    return { count, completed: count >= BOUNTY_TARGET, justCompleted: false, shouldGrantPassXp: false };
  }
  const key = getBountyStorageKey(date);
  const current = readCount(key);
  if (current >= BOUNTY_TARGET) {
    return { count: current, completed: true, justCompleted: false, shouldGrantPassXp: false };
  }
  const next = Math.min(current + 1, BOUNTY_TARGET);
  writeCount(key, next);
  const completed = next >= BOUNTY_TARGET;
  const justCompleted = completed && current < BOUNTY_TARGET;
  return { count: next, completed, justCompleted, shouldGrantPassXp: justCompleted };
}
