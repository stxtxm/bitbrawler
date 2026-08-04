import { describe, it, expect, vi } from 'vitest'
import {
  calculateIdleXp,
  calculateOfflineIdleXp,
  calculateIdleEssence,
  calculateOfflineFights,
} from '../../utils/idleXpUtils'
import { IDLE_CONFIG } from '../../config/idleConfig'

describe('idleXpUtils', () => {
  describe('calculateOfflineIdleXp', () => {
    it('should be exactly half of active idle XP per fight (fixed variance)', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      try {
        expect(calculateOfflineIdleXp(true, 1)).toBe(Math.floor(calculateIdleXp(true, 1) * IDLE_CONFIG.OFFLINE_XP_MODIFIER))
        expect(calculateOfflineIdleXp(false, 10)).toBe(Math.floor(calculateIdleXp(false, 10) * IDLE_CONFIG.OFFLINE_XP_MODIFIER))
      } finally {
        spy.mockRestore()
      }
    })

    it('should always be less than active idle XP', () => {
      for (const level of [1, 5, 10, 20]) {
        expect(calculateOfflineIdleXp(true, level)).toBeLessThanOrEqual(calculateIdleXp(true, level))
        expect(calculateOfflineIdleXp(false, level)).toBeLessThanOrEqual(calculateIdleXp(false, level))
      }
    })

    it('should be positive for wins and losses at any level', () => {
      for (const level of [1, 10, 50]) {
        expect(calculateOfflineIdleXp(true, level)).toBeGreaterThan(0)
        expect(calculateOfflineIdleXp(false, level)).toBeGreaterThan(0)
      }
    })

    it('should scale with level', () => {
      expect(calculateOfflineIdleXp(true, 20)).toBeGreaterThan(calculateOfflineIdleXp(true, 1))
    })
  })

  describe('calculateIdleXp', () => {
    it('should apply XP_MODIFIER to fight XP', () => {
      expect(calculateIdleXp(true, 1)).toBeLessThanOrEqual(Math.floor(90 * 1.1 * IDLE_CONFIG.XP_MODIFIER))
      expect(calculateIdleXp(true, 1)).toBeGreaterThan(0)
    })
  })

  describe('calculateIdleEssence', () => {
    it('should give more essence on win than loss', () => {
      expect(calculateIdleEssence(true, 5)).toBeGreaterThan(calculateIdleEssence(false, 5))
    })

    it('should scale with level', () => {
      expect(calculateIdleEssence(true, 20)).toBeGreaterThan(calculateIdleEssence(true, 1))
    })
  })

  describe('calculateOfflineFights', () => {
    it('should return 0 for zero timestamp', () => {
      expect(calculateOfflineFights(0, Date.now())).toBe(0)
    })

    it('should return 0 when now <= lastTimestamp', () => {
      expect(calculateOfflineFights(1000, 500)).toBe(0)
    })

    it('should calculate fights for elapsed time', () => {
      expect(calculateOfflineFights(1, 1 + IDLE_CONFIG.TIMER_INTERVAL * 3)).toBe(3)
    })

    it('should cap at MAX_IDLE_FIGHTS', () => {
      const farPast = Date.now() - 24 * 60 * 60 * 1000 * 10
      expect(calculateOfflineFights(farPast, Date.now())).toBeLessThanOrEqual(IDLE_CONFIG.MAX_IDLE_FIGHTS)
    })
  })
})
