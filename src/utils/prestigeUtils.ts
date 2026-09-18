export enum IdolType {
  GENERATOR = 'GENERATOR',
  TAP = 'TAP',
  GLOBAL = 'GLOBAL',
  CRIT = 'CRIT',
  FAITH_GAIN = 'FAITH_GAIN',
  IDLE = 'IDLE',
}

const FAITH_SCALE = 100_000;
const FAITH_BONUS_RATE = 0.02;
const IDOL_BASE = 10;
const IDOL_GROWTH = 1.5;

export function calcFaith(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < FAITH_SCALE) return 0;
  return Math.floor(Math.sqrt(totalXp / FAITH_SCALE));
}

export function faithPerHour(faith: number, hours: number): number {
  if (!Number.isFinite(faith) || !Number.isFinite(hours) || hours <= 0) return 0;
  return faith / hours;
}

export function calcIdolCost(level: number): number {
  if (!Number.isFinite(level) || level <= 0) return IDOL_BASE;
  return Math.floor(IDOL_BASE * Math.pow(IDOL_GROWTH, level));
}

export function getFaithBonus(faith: number): number {
  if (!Number.isFinite(faith) || faith <= 0) return 1;
  return 1 + faith * FAITH_BONUS_RATE;
}
