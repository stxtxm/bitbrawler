import { ScenePhase } from '../types/IdleCombat';

/**
 * Tap-to-damage configuration for the idle PvE scene.
 *
 * Active play (tapping the monster) sits ON TOP of the auto idle loop:
 * - Each tap removes TAP_DAMAGE_RATIO of the monster's max HP → once the
 *   accumulated tap damage reaches the monster HP, the fight resolves as an
 *   early WIN (same rewards as a natural win + the essence tapped).
 * - Each tap also grants a small essence trickle (fraction of the kill
 *   essence), so actively watching the scene is slightly more rewarding
 *   than AFK idle without ever beating a full kill.
 * - MAX_TAPS_PER_FIGHT bounds both the damage and the essence economy —
 *   taps are session-active only, offline/cron gains are untouched.
 */
export const TAP_CONFIG = {
  /** Hard cap of taps per fight — bounds damage AND essence per fight. */
  MAX_TAPS_PER_FIGHT: 15,
  /** Fraction of the monster max HP removed per tap. 13 taps kill. */
  TAP_DAMAGE_RATIO: 0.08,
  /** Fraction of the kill essence granted per tap (active-play bonus). */
  ESSENCE_PER_TAP_RATIO: 0.05,
  /** Floor for the per-tap essence so low-level taps still feel rewarding. */
  MIN_TAP_ESSENCE: 0.01,
  /** Phases during which tapping the monster has an effect. */
  ACTIVE_PHASES: ['monster_appears', 'combat'] as readonly ScenePhase[],
} as const;
