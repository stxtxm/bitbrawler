import { TAP_CONFIG } from '../config/tapConfig';
import { ScenePhase } from '../types/IdleCombat';
import { calculateIdleEssence } from './idleXpUtils';

/**
 * Essence granted by one tap during an idle PvE fight. A fraction of the
 * kill essence (scaled by level + INT/FOC like the kill itself), floored
 * at MIN_TAP_ESSENCE — active tapping is a small bonus, never a farm that
 * outpaces the idle loop.
 */
export function computeTapEssence(
  playerLevel: number,
  intelligence?: number,
  focus?: number,
): number {
  const perTap =
    calculateIdleEssence(true, playerLevel, intelligence, focus) *
    TAP_CONFIG.ESSENCE_PER_TAP_RATIO;
  // No rounding here: the hook accumulates taps over a fight and must keep
  // exact values (the UI rounds for display). Rounding per tap to 2 decimals
  // made low-level stat scaling invisible (0.02 == 0.02).
  return Math.max(TAP_CONFIG.MIN_TAP_ESSENCE, perTap);
}

/**
 * Damage dealt by one tap as a fraction of the monster max HP. Ratio-based
 * (not flat) so the number of taps needed to kill stays constant at every
 * level, and player stats keep scaling the kill essence instead.
 */
export function computeTapDamage(monsterMaxHp: number): number {
  return Math.max(1, Math.round(monsterMaxHp * TAP_CONFIG.TAP_DAMAGE_RATIO));
}

/** Number of taps required to kill a monster of the given max HP. */
export function tapsToKill(monsterMaxHp: number): number {
  return Math.ceil(monsterMaxHp / computeTapDamage(monsterMaxHp));
}

/** Whether taps are allowed during the given scene phase. */
export function isTapPhase(phase: ScenePhase): boolean {
  return (TAP_CONFIG.ACTIVE_PHASES as readonly string[]).includes(phase);
}
