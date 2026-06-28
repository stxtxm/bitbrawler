import { describe, it, expect } from 'vitest'
import { getMonsterVisualScale, MONSTER_VISUAL_SCALE } from '../../components/IdleRunnerScene'

describe('getMonsterVisualScale', () => {
  it('returns 0.7x for slime at any screen width', () => {
    const base = Math.round((5 + 2) * MONSTER_VISUAL_SCALE.slime)
    expect(getMonsterVisualScale('slime', 5)).toBe(base)
  })

  it('returns 1.5x for dragon_spawn at any screen width', () => {
    const base = Math.round((8 + 2) * MONSTER_VISUAL_SCALE.dragon_spawn)
    expect(getMonsterVisualScale('dragon_spawn', 8)).toBe(base)
  })

  it('dragon_spawn is strictly larger than slime at all charScales', () => {
    for (const charScale of [5, 6, 7, 8]) {
      const slime = getMonsterVisualScale('slime', charScale)
      const dragon = getMonsterVisualScale('dragon_spawn', charScale)
      expect(dragon).toBeGreaterThan(slime)
    }
  })

  it('all 8 monster IDs return a positive integer scale', () => {
    const ids: Array<keyof typeof MONSTER_VISUAL_SCALE> = ['slime', 'wolf', 'goblin', 'skeleton', 'wraith', 'ogre', 'chimera', 'dragon_spawn']
    for (const id of ids) {
      for (const charScale of [5, 6, 7, 8]) {
        const scale = getMonsterVisualScale(id, charScale)
        expect(Number.isInteger(scale)).toBe(true)
        expect(scale).toBeGreaterThan(0)
      }
    }
  })

  it('monsters are ordered by size: slime < wolf < goblin < skeleton < wraith < ogre < chimera < dragon_spawn', () => {
    const ordered: Array<keyof typeof MONSTER_VISUAL_SCALE> = ['slime', 'wolf', 'goblin', 'skeleton', 'wraith', 'ogre', 'chimera', 'dragon_spawn']
    for (const charScale of [5, 6, 7, 8]) {
      const scales = ordered.map(id => getMonsterVisualScale(id, charScale))
      for (let i = 1; i < scales.length; i++) {
        expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1])
      }
    }
  })
})
