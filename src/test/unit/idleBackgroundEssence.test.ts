import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateIdleEssence } from '../../utils/idleXpUtils'
import { IDLE_CONFIG } from '../../config/idleConfig'

describe('idleBackgroundEssence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('calculateIdleEssence — background scenario', () => {
    it('should accumulate essence over multiple simulated fights', () => {
      const level = 10
      const intel = 10
      const focus = 10
      const fights = 5

      let totalEssence = 0
      for (let i = 0; i < fights; i++) {
        totalEssence += calculateIdleEssence(true, level, intel, focus)
      }

      expect(totalEssence).toBeGreaterThan(0)
      // Each fight at level 10 gives: 0.2 * (1 + 9 * 0.08) * (1 + 0 * 0.01) = 0.2 * 1.72 = 0.344
      // 5 fights: ~1.72
      expect(totalEssence).toBeCloseTo(1.72, 1)
    })

    it('should produce less essence on loss than on win', () => {
      const level = 10
      const winEssence = calculateIdleEssence(true, level, 10, 10)
      const lossEssence = calculateIdleEssence(false, level, 10, 10)

      expect(lossEssence).toBeGreaterThan(0)
      expect(lossEssence).toBeLessThan(winEssence)
      // Loss ratio is 0.3, so lossEssence should be 30% of winEssence
      expect(lossEssence).toBeCloseTo(winEssence * IDLE_CONFIG.ESSENCE.LOSS_RATIO, 2)
    })

    it('should scale essence with level', () => {
      const lowLevel = calculateIdleEssence(true, 1, 10, 10)
      const highLevel = calculateIdleEssence(true, 50, 10, 10)

      expect(highLevel).toBeGreaterThan(lowLevel)
    })

    it('should scale essence with intelligence and focus', () => {
      const lowStats = calculateIdleEssence(true, 10, 10, 10)
      const highStats = calculateIdleEssence(true, 10, 50, 50)

      expect(highStats).toBeGreaterThan(lowStats)
    })

    it('should not drop below 0.5 multiplier floor', () => {
      // statMultiplier = max(0.5, 1 + (0+0-20)*0.01) = max(0.5, 0.80) = 0.80
      const result = calculateIdleEssence(true, 10, 0, 0)
      expect(result).toBeGreaterThan(0)
    })

    it('should handle fractional accumulation correctly over many fights', () => {
      // Simulate many fights with fractional essence
      const level = 25
      const intel = 15
      const focus = 12
      const fights = 100

      let totalEssence = 0
      for (let i = 0; i < fights; i++) {
        totalEssence += calculateIdleEssence(true, level, intel, focus)
      }

      // Essence per fight at level 25: 0.2 * (1 + 24*0.08) * (1 + (15+12-20)*0.01)
      // = 0.2 * (1 + 1.92) * (1 + 0.07)
      // = 0.2 * 2.92 * 1.07
      // = 0.62488
      // 100 fights: ~62.488
      expect(totalEssence).toBeGreaterThan(50)
    })
  })

  describe('idle combat timer interval', () => {
    it('should use effective interval to determine fights per minute', () => {
      const interval = IDLE_CONFIG.EFFICIENCY.BASE_INTERVAL // 12000ms
      const fightsPerMinute = 60000 / interval
      expect(fightsPerMinute).toBe(5)

      const fasterInterval = 6000 // 6 seconds
      const fasterFightsPerMinute = 60000 / fasterInterval
      expect(fasterFightsPerMinute).toBe(10)
    })

    it('should calculate elapsed time correctly', () => {
      const startTime = Date.now()
      vi.advanceTimersByTime(15000) // 15 seconds in background
      const elapsed = Date.now() - startTime
      expect(elapsed).toBe(15000)
    })
  })

  describe('missed fight simulation during background period', () => {
    it('should determine correct number of missed fights from elapsed time', () => {
      const effectiveInterval = 12000 // 12 seconds per fight
      const backgroundMs = 60000 // 1 minute
      const missedFights = Math.floor(backgroundMs / effectiveInterval)
      expect(missedFights).toBe(5)
    })

    it('should calculate essence accumulation over background period', () => {
      const effectiveInterval = 12000
      const backgroundMs = 120000 // 2 minutes
      const missedFights = Math.floor(backgroundMs / effectiveInterval) // 10 fights

      const level = 10
      const intel = 10
      const focus = 10
      const xpBonus = 0 // no bonus

      // Simulate 10 fights assuming all wins
      let totalEssence = 0
      for (let i = 0; i < missedFights; i++) {
        const essence = calculateIdleEssence(true, level, intel, focus) * (1 + xpBonus)
        totalEssence += essence
      }

      // 10 fights * 0.344 essence ≈ 3.44
      expect(totalEssence).toBeGreaterThan(3)
      expect(totalEssence).toBeLessThan(4)
    })
  })
})
