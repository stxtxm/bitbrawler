import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IDLE_CONFIG } from '../../config/idleConfig'
import { calculateIdleEssence } from '../../utils/idleXpUtils'

describe('idleConfig — essence economy tuning #930', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  it('ESSENCE.BASE_RATE is 0.18 (+20% vs 0.15)', () => {
    expect(IDLE_CONFIG.ESSENCE.BASE_RATE).toBe(0.18)
  })

  it('ESSENCE.LOSS_RATIO remains 0.3', () => {
    expect(IDLE_CONFIG.ESSENCE.LOSS_RATIO).toBe(0.3)
  })

  it('ESSENCE.LEVEL_SCALE remains 0.03', () => {
    expect(IDLE_CONFIG.ESSENCE.LEVEL_SCALE).toBe(0.03)
  })

  it('calculateIdleEssence win at level 10 uses 0.18 base', () => {
    const essence = calculateIdleEssence(true, 10, 10, 10)
    expect(essence).toBeCloseTo(0.18 * (1 + 9 * 0.03), 5)
  })

  it('calculateIdleEssence loss at level 10 is 30% of win', () => {
    const win = calculateIdleEssence(true, 10, 10, 10)
    const loss = calculateIdleEssence(false, 10, 10, 10)
    expect(loss).toBeCloseTo(win * 0.3, 5)
  })

  it('5 wins at level 10 total ~1.14', () => {
    let total = 0
    for (let i = 0; i < 5; i++) total += calculateIdleEssence(true, 10, 10, 10)
    expect(total).toBeCloseTo(1.14, 1)
  })

  it('doubles idle essence for levels 1-5 (QA-FRESH early game, #1388)', () => {
    const maxLevel = IDLE_CONFIG.ESSENCE.EARLY_GAME_MAX_LEVEL
    const mult = IDLE_CONFIG.ESSENCE.EARLY_GAME_MULT
    expect(mult).toBe(2)
    for (let level = 1; level <= maxLevel; level++) {
      const boosted = calculateIdleEssence(true, level, 10, 10)
      const expected = 0.18 * (1 + (level - 1) * 0.03) * mult
      expect(boosted).toBeCloseTo(expected, 5)
    }
  })

  it('keeps the early-game boost out of level 6 and above (non-regression)', () => {
    const level = IDLE_CONFIG.ESSENCE.EARLY_GAME_MAX_LEVEL + 1
    const essence = calculateIdleEssence(true, level, 10, 10)
    expect(essence).toBeCloseTo(0.18 * (1 + (level - 1) * 0.03), 5)
  })
})
