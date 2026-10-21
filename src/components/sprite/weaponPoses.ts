import type { SpriteAnimKind } from './spriteTypes';

/**
 * Angle of the whole weapon around the palm, in radians. 0 = vertical,
 * positive = tip leans outboard (to the right for the player fighter).
 *
 * The weapon is a rigid object: every frame uses one angle for the entire
 * blade/shaft/head, instead of shearing each row independently. That keeps a
 * sword straight and stops the old "rubber band" look.
 *
 * The grid is only 24px wide and the weapon is held on the right edge, so the
 * strike cannot be a full 90° slash without pushing the tip off-screen. The
 * body/hand carries most of the motion; the weapon angle reinforces it.
 */
export const WEAPON_REST_ANGLE = 0.34;

export const WEAPON_ANGLES: Record<SpriteAnimKind, readonly number[]> = {
  idle: [WEAPON_REST_ANGLE],
  // No free wrist wobble while running: the hand is glued to the body, so a
  // weapon that rotates by itself reads as a floppy rubber prop. The whole
  // silhouette already bobs with the run cycle.
  run: [WEAPON_REST_ANGLE],
  // Chamber inward, then drive the weapon out with the punch. The values stay
  // small enough for the 24px grid and for the mace head to clear the edge.
  attack: [WEAPON_REST_ANGLE, 0.1, 0.05, 0.14, 0.12],
  hit: [WEAPON_REST_ANGLE, 0.46, 0.38],
  victory: [WEAPON_REST_ANGLE, 0.2, 0.08, 0.24],
};

export function weaponAngleFor(anim: SpriteAnimKind, frameIdx: number): number {
  const angles = WEAPON_ANGLES[anim];
  return angles[frameIdx % angles.length] ?? WEAPON_REST_ANGLE;
}
