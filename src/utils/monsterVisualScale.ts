import { MonsterId } from '../data/monsterAssets'

export const MONSTER_VISUAL_SCALE: Record<MonsterId, number> = {
  slime: 0.7,
  wolf: 0.85,
  goblin: 0.9,
  skeleton: 0.95,
  wraith: 1.0,
  ogre: 1.2,
  chimera: 1.3,
  dragon_spawn: 1.5,
}

export function monsterScaleFor(monsterId: MonsterId, charScale: number): number {
  return Math.round((charScale + 2) * MONSTER_VISUAL_SCALE[monsterId])
}

export function getMonsterVisualScale(monsterId: MonsterId, charScale: number): number {
  return monsterScaleFor(monsterId, charScale)
}
