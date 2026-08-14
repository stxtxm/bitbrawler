import { MonsterId } from '../data/monsterAssets'

export const MONSTER_VISUAL_SCALE: Record<MonsterId, number> = {
  slime: 0.5,
  cinder_imp: 0.5,
  wolf: 0.65,
  lava_hound: 0.7,
  goblin: 0.7,
  skeleton: 0.75,
  wraith: 0.8,
  ogre: 0.9,
  chimera: 1.0,
  magma_golem: 1.1,
  dragon_spawn: 1.15,
}

export function monsterScaleFor(monsterId: MonsterId, charScale: number): number {
  // Respect mobile screens (where charScale is lower, e.g. < 6) so they don't shrink too much
  const modifier = charScale < 6 ? 1.5 : 1.1;
  return Math.round((charScale + 1) * MONSTER_VISUAL_SCALE[monsterId] * modifier)
}

export function getMonsterVisualScale(monsterId: MonsterId, charScale: number): number {
  return monsterScaleFor(monsterId, charScale)
}
