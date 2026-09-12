import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isBurstActive, isBurstWindow, getMaxDailyFights, getBurstGrowthChance, getDepthToIdleRatio, getBurstBonusKey, isBurstBonusUsed, markBurstBonusUsed, clearBurstBonusUsed } from '../../data/liveOps'
import { GAME_RULES } from '../../config/gameRules'
import { calculateIdleEssence, calculateIdleXp, calculateOfflineIdleXp } from '../../utils/idleXpUtils'
import { calculateOfflineFightsWithEfficiency, isIdlePaused } from '../../utils/idleEfficiencyUtils'
import { isIdleSnapshotPaused, saveIdleSnapshot, loadIdleSnapshot } from '../../utils/idleSnapshotUtils'
import { BURST_MUTATORS, getStoredBurstMutator, setStoredBurstMutator, clearStoredBurstMutator, getBurstMutatorDef, applyBurstMutatorToStats, BURST_MUTATOR_STORAGE_KEY } from '../../utils/burstMutator'

describe('Weekend Active Burst 72h', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('isBurstActive Paris ven 18h -> dim 18h', () => {
    it('detects friday 18h Paris as burst', () => {
      const d = new Date('2026-09-11T16:00:00Z')
      expect(isBurstActive(d)).toBe(true)
      expect(isBurstWindow(d)).toBe(true)
    })
    it('friday 17:59 Paris not burst', () => {
      const d = new Date('2026-09-11T15:59:00Z')
      expect(isBurstActive(d)).toBe(false)
    })
    it('saturday any hour burst', () => {
      const d = new Date('2026-09-12T10:00:00Z')
      expect(isBurstActive(d)).toBe(true)
    })
    it('sunday before 18 burst', () => {
      const d = new Date('2026-09-13T15:00:00Z')
      expect(isBurstActive(d)).toBe(true)
    })
    it('sunday 18 Paris not burst', () => {
      const d = new Date('2026-09-13T16:00:00Z')
      expect(isBurstActive(d)).toBe(false)
    })
    it('monday not burst', () => {
      const d = new Date('2026-09-14T10:00:00Z')
      expect(isBurstActive(d)).toBe(false)
    })
  })

  describe('getMaxDailyFights', () => {
    it('returns 6 during burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      expect(getMaxDailyFights(burstDate)).toBe(6)
    })
    it('returns 5 outside burst', () => {
      const normal = new Date('2026-09-14T10:00:00Z')
      expect(getMaxDailyFights(normal)).toBe(5)
    })
    it('equals GAME_RULES +1 during burst', () => {
      const burst = new Date('2026-09-12T12:00:00Z')
      expect(getMaxDailyFights(burst)).toBe(GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1)
    })
  })

  describe('idle pause 0.15 BASE_RATE', () => {
    it('calculateIdleEssence returns 0 during burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      expect(calculateIdleEssence(true, 10, 10, 10)).toBe(0)
      expect(calculateIdleEssence(false, 10, 10, 10)).toBe(0)
      vi.useRealTimers()
    })
    it('calculateIdleXp returns 0 during burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      expect(calculateIdleXp(true, 10)).toBe(0)
      expect(calculateOfflineIdleXp(true, 10)).toBe(0)
      vi.useRealTimers()
    })
    it('calculateOfflineFightsWithEfficiency returns 0 during burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      const now = burstDate.getTime()
      const last = now - 3600_000
      expect(calculateOfflineFightsWithEfficiency(last, now, 12000)).toBe(0)
      expect(isIdlePaused(burstDate)).toBe(true)
    })
    it('isIdleSnapshotPaused true during burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      expect(isIdleSnapshotPaused(burstDate)).toBe(true)
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      saveIdleSnapshot(10, 1000, 5)
      expect(loadIdleSnapshot()).toBeNull()
      vi.useRealTimers()
    })
    it('idle returns normal outside burst', () => {
      const normal = new Date('2026-09-14T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(normal)
      expect(calculateIdleEssence(true, 10, 10, 10)).toBeGreaterThan(0)
      expect(calculateIdleXp(true, 10)).toBeGreaterThan(0)
      vi.useRealTimers()
      expect(isIdlePaused(normal)).toBe(false)
      expect(isIdleSnapshotPaused(normal)).toBe(false)
    })
  })

  describe('burst mutator', () => {
    it('has 3 mutators +10% offense vs -10% defense etc', () => {
      expect(BURST_MUTATORS).toHaveLength(3)
      const offense = BURST_MUTATORS.find(m => m.id === 'offense')!
      expect(offense.offenseMod).toBe(1.1)
      expect(offense.defenseMod).toBe(0.9)
    })
    it('persists via localStorage pattern useSound', () => {
      setStoredBurstMutator('offense')
      expect(getStoredBurstMutator()).toBe('offense')
      expect(localStorage.getItem(BURST_MUTATOR_STORAGE_KEY)).toBe('offense')
      expect(getBurstMutatorDef('offense')?.label).toContain('offense')
    })
    it('clear mutator', () => {
      setStoredBurstMutator('defense')
      clearStoredBurstMutator()
      expect(getStoredBurstMutator()).toBeNull()
    })
    it('applyBurstMutatorToStats applies 10% mods', () => {
      const stats = { offense: 100, defense: 100, speed: 100 }
      const modded = applyBurstMutatorToStats(stats, 'offense')
      expect(modded.offense).toBeCloseTo(110)
      expect(modded.defense).toBeCloseTo(90)
      expect(modded.speed).toBe(100)
    })
    it('invalid mutator ignored', () => {
      const stats = { offense: 50, defense: 50, speed: 50 }
      expect(applyBurstMutatorToStats(stats, null)).toEqual(stats)
    })
  })

  describe('gameRules burst tweaks', () => {
    it('BOTS.BURST_GROWTH_CHANCE exists and > base', () => {
      expect(GAME_RULES.BOTS.BURST_GROWTH_CHANCE).toBeGreaterThan(GAME_RULES.BOTS.GROWTH_CHANCE)
    })
    it('getBurstGrowthChance returns burst chance during burst', () => {
      const burst = new Date('2026-09-12T10:00:00Z')
      const normal = new Date('2026-09-14T10:00:00Z')
      expect(getBurstGrowthChance(burst)).toBe(GAME_RULES.BOTS.BURST_GROWTH_CHANCE)
      expect(getBurstGrowthChance(normal)).toBe(GAME_RULES.BOTS.GROWTH_CHANCE)
    })
    it('depth-to-idle ratio measurement', () => {
      expect(getDepthToIdleRatio(10, 2)).toBe(5)
      expect(getDepthToIdleRatio(5, 0)).toBe(5)
    })
    it('burst bonus used flag per Paris day', () => {
      const d = new Date('2026-09-12T10:00:00Z')
      expect(isBurstBonusUsed(d)).toBe(false)
      markBurstBonusUsed(d)
      expect(isBurstBonusUsed(d)).toBe(true)
      clearBurstBonusUsed(d)
      expect(isBurstBonusUsed(d)).toBe(false)
      expect(getBurstBonusKey(d)).toContain('bitbrawler_burst_bonus_')
    })
  })
})
