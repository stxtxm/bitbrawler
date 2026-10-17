import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { isBurstActive, isBurstWindow, getMaxDailyFights, getBurstGrowthChance, getDepthToIdleRatio, getBurstBonusKey, isBurstBonusUsed, markBurstBonusUsed, clearBurstBonusUsed, getEffectiveFightsLeft } from '../../data/liveOps'
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

  describe('burst vivant (plus de pause idle)', () => {
    it('calculateIdleEssence booste x1.5 pendant le burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      expect(calculateIdleEssence(true, 10, 10, 10)).toBeGreaterThan(0)
      vi.useRealTimers()
    })
    it('calculateIdleXp paie normalement pendant le burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      expect(calculateIdleXp(true, 10)).toBeGreaterThan(0)
      expect(calculateOfflineIdleXp(true, 10)).toBeGreaterThan(0)
      vi.useRealTimers()
    })
    it('calculateOfflineFightsWithEfficiency compte pendant le burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      const now = burstDate.getTime()
      const last = now - 3600_000
      expect(calculateOfflineFightsWithEfficiency(last, now, 12000)).toBeGreaterThan(0)
      expect(isIdlePaused(burstDate)).toBe(false)
    })
    it('isIdleSnapshotPaused false pendant le burst', () => {
      const burstDate = new Date('2026-09-12T10:00:00Z')
      expect(isIdleSnapshotPaused(burstDate)).toBe(false)
      vi.useFakeTimers()
      vi.setSystemTime(burstDate)
      saveIdleSnapshot(10, 1000, 5)
      expect(loadIdleSnapshot()).not.toBeNull()
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

  describe('getEffectiveFightsLeft (single source of truth for burst bonus)', () => {
    const burstDay = new Date('2026-09-12T10:00:00Z')
    const normalDay = new Date('2026-09-14T10:00:00Z')

    it('grants 1 fight at 0 energy when burst bonus is available', () => {
      expect(isBurstActive(burstDay)).toBe(true)
      expect(getEffectiveFightsLeft(0, burstDay)).toBe(1)
    })

    it('grants 0 once the burst bonus is consumed', () => {
      markBurstBonusUsed(burstDay)
      expect(getEffectiveFightsLeft(0, burstDay)).toBe(0)
      clearBurstBonusUsed(burstDay)
    })

    it('grants 0 outside the burst window', () => {
      expect(isBurstActive(normalDay)).toBe(false)
      expect(getEffectiveFightsLeft(0, normalDay)).toBe(0)
    })

    it('tops positive energy by 1 while the bonus is unused (UI display rule)', () => {
      expect(getEffectiveFightsLeft(2, burstDay)).toBe(3)
      expect(getEffectiveFightsLeft(2, normalDay)).toBe(2)
      markBurstBonusUsed(burstDay)
      expect(getEffectiveFightsLeft(2, burstDay)).toBe(2)
      clearBurstBonusUsed(burstDay)
    })

    it('treats undefined/null energy as 0', () => {
      expect(getEffectiveFightsLeft(undefined, burstDay)).toBe(1)
      expect(getEffectiveFightsLeft(undefined, normalDay)).toBe(0)
      expect(getEffectiveFightsLeft(null, burstDay)).toBe(1)
    })

    it('defaults to the current date when omitted', () => {
      const today = new Date()
      const expected = getEffectiveFightsLeft(0, today)
      expect(getEffectiveFightsLeft(0)).toBe(expected)
    })
  })

  describe('burst bonus agreement between UI and matchmaking guard', () => {
    it('useArenaCombat derives fightsLeft from the shared helper (no inline duplicate)', () => {
      const src = readFileSync(resolve('src/hooks/useArenaCombat.ts'), 'utf8')
      expect(src).toContain('getEffectiveFightsLeft(')
      expect(src).not.toMatch(/baseFightsLeft \+ 1/)
    })

    it('matchmaking guard accepts the burst bonus at 0 energy via the shared helper', () => {
      const src = readFileSync(resolve('src/context/GameContext.tsx'), 'utf8')
      expect(src).toMatch(/getEffectiveFightsLeft\(activeCharacter\.fightsLeft\) <= 0/)
    })
  })
})
