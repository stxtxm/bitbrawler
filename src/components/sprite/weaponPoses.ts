import type { SpriteAnimKind } from './spriteTypes';

/**
 * Weapon pivot per animation frame, in pixels of horizontal drift per row
 * above the palm. The grip itself never moves: this is a rotation around the
 * hand, not a translation of the weapon.
 *
 * Values are deliberately small. The sprite is 24px wide and the weapon is
 * held on the right edge, so the forward strike keeps the blade near vertical
 * instead of pushing its point off the grid.
 */
export const WEAPON_TILTS: Record<SpriteAnimKind, readonly number[]> = {
  idle: [0],
  run: [0.05, 0.14, 0.05, -0.05, -0.14, -0.05],
  attack: [0, -0.5, -0.5, -0.35, -0.35],
  hit: [0, 0.18, 0.08],
  victory: [0, -0.2, -0.35, -0.1],
};

export function weaponTiltFor(anim: SpriteAnimKind, frameIdx: number): number {
  const tilts = WEAPON_TILTS[anim];
  return tilts[frameIdx % tilts.length] ?? 0;
}
