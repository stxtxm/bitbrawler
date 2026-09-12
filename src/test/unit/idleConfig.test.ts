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
  it('ESSENCE.BASE_RATE is 0.15 (+25% vs 0.12)', () => {
    expect(IDLE_CONFIG.ESSENCE.BASE_RATE).toBe(0.15)
  })

  it('ESSENCE.LOSS_RATIO remains 0.3', () => {
    expect(IDLE_CONFIG.ESSENCE.LOSS_RATIO).toBe(0.3)
  })

  it('ESSENCE.LEVEL_SCALE remains 0.03', () => {
    expect(IDLE_CONFIG.ESSENCE.LEVEL_SCALE).toBe(0.03)
  })

  it('calculateIdleEssence win at level 10 uses 0.15 base', () => {
    const essence = calculateIdleEssence(true, 10, 10, 10)
    expect(essence).toBeCloseTo(0.15 * (1 + 9 * 0.03), 5)
  })

  it('calculateIdleEssence loss at level 10 is 30% of win', () => {
    const win = calculateIdleEssence(true, 10, 10, 10)
    const loss = calculateIdleEssence(false, 10, 10, 10)
    expect(loss).toBeCloseTo(win * 0.3, 5)
  })

  it('5 wins at level 10 total ~0.95', () => {
    let total = 0
    for (let i = 0; i < 5; i++) total += calculateIdleEssence(true, 10, 10, 10)
    expect(total).toBeCloseTo(0.95, 1)
  })
})
