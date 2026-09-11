import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePassProgress } from '../../hooks/usePassProgress'
import { clearPassProgress } from '../../utils/passStorage'
import { SEASONAL_PASS_TIERS } from '../../data/seasonalPass'

const mockCharacter = {
  id: 'char-test',
  seed: 'seed-test',
  name: 'Hero',
  gender: 'male' as const,
  level: 5,
  experience: 0,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 0,
  itemUpgrades: {},
}

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(() => ({ activeCharacter: mockCharacter })),
}))

const SEASON = '2026-09'

describe('usePassProgress hook', () => {
  beforeEach(() => {
    clearPassProgress()
    localStorage.clear()
  })

  it('starts with 0 xp and tier 0', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    expect(result.current.passXp).toBe(0)
    expect(result.current.currentTier).toBe(0)
    expect(result.current.progressPct).toBe(0)
    expect(result.current.claimed).toEqual([])
  })

  it('addPassXp increments xp and updates tier', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(100)
    })
    expect(result.current.passXp).toBe(100)
    expect(result.current.currentTier).toBe(1)
  })

  it('addPassXp accumulates and progresses through tiers', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    const tier5Xp = SEASONAL_PASS_TIERS[4].xpRequired
    act(() => {
      result.current.addPassXp(tier5Xp)
    })
    expect(result.current.currentTier).toBe(5)
    expect(result.current.progressPct).toBeGreaterThan(0)
  })

  it('progressPct reflects xp proportion', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(result.current.maxXp)
    })
    expect(result.current.progressPct).toBe(100)
  })

  it('claimTier succeeds when tier unlocked', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(SEASONAL_PASS_TIERS[0].xpRequired)
    })
    let claimed = false
    act(() => {
      claimed = result.current.claimTier(1)
    })
    expect(claimed).toBe(true)
    expect(result.current.claimed).toContain(1)
    expect(result.current.isClaimed(1)).toBe(true)
  })

  it('claimTier fails when tier not unlocked', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    let claimed = true
    act(() => {
      claimed = result.current.claimTier(5)
    })
    expect(claimed).toBe(false)
    expect(result.current.claimed).not.toContain(5)
  })

  it('claimTier fails when already claimed', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(SEASONAL_PASS_TIERS[0].xpRequired)
    })
    act(() => {
      result.current.claimTier(1)
    })
    let second = true
    act(() => {
      second = result.current.claimTier(1)
    })
    expect(second).toBe(false)
  })

  it('canClaim returns false for locked or claimed tiers', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    expect(result.current.canClaim(1)).toBe(false)
    act(() => {
      result.current.addPassXp(SEASONAL_PASS_TIERS[0].xpRequired)
    })
    expect(result.current.canClaim(1)).toBe(true)
    act(() => {
      result.current.claimTier(1)
    })
    expect(result.current.canClaim(1)).toBe(false)
  })

  it('persists to localStorage and reloads', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(250)
      result.current.claimTier(1)
    })
    const { result: result2 } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    expect(result2.current.passXp).toBe(250)
    expect(result2.current.claimed).toContain(1)
  })

  it('resetProgress clears xp and claimed', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(500)
      result.current.claimTier(1)
    })
    act(() => {
      result.current.resetProgress()
    })
    expect(result.current.passXp).toBe(0)
    expect(result.current.claimed).toEqual([])
    expect(result.current.currentTier).toBe(0)
  })

  it('ignores negative addPassXp', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(-100)
    })
    expect(result.current.passXp).toBe(0)
  })

  it('exposes correct maxXp and maxTier', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    expect(result.current.maxXp).toBe(SEASONAL_PASS_TIERS[19].xpRequired)
    expect(result.current.maxTier).toBe(20)
    expect(result.current.tiers).toHaveLength(20)
  })

  it('xpToNext and nextTierXp computed correctly at 0', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    expect(result.current.nextTierXp).toBe(SEASONAL_PASS_TIERS[0].xpRequired)
    expect(result.current.xpToNext).toBe(SEASONAL_PASS_TIERS[0].xpRequired)
  })

  it('nextTierXp is null at max', () => {
    const { result } = renderHook(() => usePassProgress({ seasonId: SEASON }))
    act(() => {
      result.current.addPassXp(result.current.maxXp)
    })
    expect(result.current.nextTierXp).toBeNull()
    expect(result.current.xpToNext).toBe(0)
  })
})
