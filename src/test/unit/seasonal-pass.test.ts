import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  PASS_SEASON_DAYS,
  PASS_MAX_LEVEL,
  PASS_XP_PER_LEVEL,
  PASS_XP_PER_FIGHT,
  PASS_XP_PER_FORGE,
  PASS_XP_PER_IDLE_CLAIM,
  PASS_REWARDS,
  getPassLevel,
  getPassRewards,
  getPassThreshold,
  getPassProgress,
  canClaimPassReward,
  getClaimableRewards,
} from '../../data/seasonalPass'
import {
  PASS_STORAGE_KEY,
  getStoredPassProgress,
  setStoredPassProgress,
  addStoredPassXp,
  claimStoredPassReward,
  resetStoredPassProgress,
  usePassProgress,
} from '../../hooks/usePassProgress'

const mockCharacter = {
  id: 'test-char-id',
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
  lastFightReset: 0,
}

vi.mock('../../context/GameContext', () => ({
  useGame: () => ({
    activeCharacter: mockCharacter,
  }),
}))

describe('seasonalPass config', () => {
  it('season is 30 days free track', () => {
    expect(PASS_SEASON_DAYS).toBe(30)
    expect(PASS_MAX_LEVEL).toBe(20)
    expect(PASS_XP_PER_LEVEL).toBe(100)
  })

  it('xp sources are dataclassed without new currency', () => {
    expect(PASS_XP_PER_FIGHT).toBe(10)
    expect(PASS_XP_PER_FORGE).toBe(5)
    expect(PASS_XP_PER_IDLE_CLAIM).toBe(15)
  })

  it('has exactly 20 rewards one per level', () => {
    expect(PASS_REWARDS).toHaveLength(20)
    const levels = PASS_REWARDS.map(r => r.level).sort((a, b) => a - b)
    expect(levels).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('rewards only use free track types essence reroll pity biome_token', () => {
    const allowed = new Set(['essence', 'reroll', 'pity', 'biome_token'])
    for (const r of PASS_REWARDS) {
      expect(allowed.has(r.type)).toBe(true)
    }
  })

  it('essence rewards use 5/10/15 amounts only', () => {
    const essenceRewards = PASS_REWARDS.filter(r => r.type === 'essence')
    expect(essenceRewards.length).toBeGreaterThan(0)
    for (const r of essenceRewards) {
      expect([5, 10, 15]).toContain(r.amount)
    }
  })

  it('contains at least one reroll, one pity -2 and one biome token', () => {
    expect(PASS_REWARDS.some(r => r.type === 'reroll')).toBe(true)
    expect(PASS_REWARDS.some(r => r.type === 'pity' && r.amount === 2)).toBe(true)
    expect(PASS_REWARDS.some(r => r.type === 'biome_token')).toBe(true)
  })

  it('no premium paywall type exists', () => {
    const hasPremium = PASS_REWARDS.some(r => (r as any).premium)
    expect(hasPremium).toBe(false)
  })
})

describe('getPassLevel', () => {
  it('returns 0 at 0 xp', () => {
    expect(getPassLevel(0)).toBe(0)
  })
  it('returns 0 for negative xp', () => {
    expect(getPassLevel(-10)).toBe(0)
  })
  it('returns 0 for NaN', () => {
    expect(getPassLevel(NaN)).toBe(0)
  })
  it('returns 1 at 100 xp', () => {
    expect(getPassLevel(100)).toBe(1)
  })
  it('returns 1 at 150 xp', () => {
    expect(getPassLevel(150)).toBe(1)
  })
  it('returns 2 at 200 xp', () => {
    expect(getPassLevel(200)).toBe(2)
  })
  it('returns 20 at 2000 xp (max)', () => {
    expect(getPassLevel(2000)).toBe(20)
  })
  it('caps at 20 beyond max xp', () => {
    expect(getPassLevel(9999)).toBe(20)
  })
})

describe('getPassRewards', () => {
  it('returns reward for valid level 1', () => {
    const r = getPassRewards(1)
    expect(r).not.toBeNull()
    expect(r?.level).toBe(1)
  })
  it('returns reward for valid level 20', () => {
    const r = getPassRewards(20)
    expect(r).not.toBeNull()
    expect(r?.level).toBe(20)
  })
  it('returns null for level 0', () => {
    expect(getPassRewards(0)).toBeNull()
  })
  it('returns null for level 21', () => {
    expect(getPassRewards(21)).toBeNull()
  })
  it('returns null for non integer', () => {
    expect(getPassRewards(1.5 as any)).toBeNull()
  })
})

describe('getPassThreshold', () => {
  it('returns 0 for level 0', () => {
    expect(getPassThreshold(0)).toBe(0)
  })
  it('returns 100 for level 1', () => {
    expect(getPassThreshold(1)).toBe(100)
  })
  it('returns 2000 for level 20', () => {
    expect(getPassThreshold(20)).toBe(2000)
  })
  it('caps beyond max', () => {
    expect(getPassThreshold(99)).toBe(2000)
  })
})

describe('getPassProgress', () => {
  it('reports level 0 at 0 xp', () => {
    const p = getPassProgress(0)
    expect(p.level).toBe(0)
    expect(p.xpIntoLevel).toBe(0)
    expect(p.xpForNext).toBe(100)
  })
  it('reports correct xpIntoLevel', () => {
    const p = getPassProgress(150)
    expect(p.level).toBe(1)
    expect(p.xpIntoLevel).toBe(50)
    expect(p.xpForNext).toBe(50)
  })
  it('reports 100 percent at max', () => {
    const p = getPassProgress(2000)
    expect(p.level).toBe(20)
    expect(p.percent).toBe(100)
    expect(p.xpForNext).toBe(0)
  })
})

describe('canClaimPassReward and getClaimableRewards', () => {
  it('cannot claim locked level', () => {
    expect(canClaimPassReward(5, 100, [])).toBe(false)
  })
  it('can claim unlocked level', () => {
    expect(canClaimPassReward(1, 100, [])).toBe(true)
  })
  it('cannot claim already claimed', () => {
    expect(canClaimPassReward(1, 200, [1])).toBe(false)
  })
  it('getClaimableRewards filters correctly', () => {
    const claimable = getClaimableRewards(250, [])
    expect(claimable.map(r => r.level)).toEqual([1, 2])
  })
  it('getClaimableRewards excludes claimed', () => {
    const claimable = getClaimableRewards(250, [1])
    expect(claimable.map(r => r.level)).toEqual([2])
  })
})

describe('usePassProgress storage', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStoredPassProgress('test-char-id')
  })

  it('starts at 0 xp and no claimed', () => {
    const s = getStoredPassProgress('test-char-id')
    expect(s.xp).toBe(0)
    expect(s.claimed).toEqual([])
  })

  it('persists xp via localStorage pattern like useSound', () => {
    addStoredPassXp('test-char-id', 50)
    const raw = JSON.parse(localStorage.getItem(PASS_STORAGE_KEY) ?? '{}')
    expect(raw['test-char-id'].xp).toBe(50)
  })

  it('accumulates xp', () => {
    addStoredPassXp('test-char-id', 100)
    addStoredPassXp('test-char-id', 50)
    expect(getStoredPassProgress('test-char-id').xp).toBe(150)
  })

  it('claim succeeds when level reached', () => {
    addStoredPassXp('test-char-id', 100)
    const ok = claimStoredPassReward('test-char-id', 1)
    expect(ok).toBe(true)
    expect(getStoredPassProgress('test-char-id').claimed).toContain(1)
  })

  it('claim fails when locked', () => {
    const ok = claimStoredPassReward('test-char-id', 5)
    expect(ok).toBe(false)
  })

  it('claim fails twice', () => {
    addStoredPassXp('test-char-id', 200)
    expect(claimStoredPassReward('test-char-id', 1)).toBe(true)
    expect(claimStoredPassReward('test-char-id', 1)).toBe(false)
  })

  it('setStoredPassProgress sanitizes negative xp', () => {
    setStoredPassProgress('test-char-id', { xp: -10, claimed: [1] } as any)
    expect(getStoredPassProgress('test-char-id').xp).toBe(0)
  })

  it('isolates characters', () => {
    addStoredPassXp('test-char-id', 100)
    addStoredPassXp('other-id', 500)
    expect(getStoredPassProgress('test-char-id').xp).toBe(100)
    expect(getStoredPassProgress('other-id').xp).toBe(500)
  })
})

describe('usePassProgress hook', () => {
  beforeEach(() => {
    localStorage.clear()
    resetStoredPassProgress('test-char-id')
  })

  it('exposes level derived from xp', () => {
    setStoredPassProgress('test-char-id', { xp: 250, claimed: [] })
    const { result } = renderHook(() => usePassProgress())
    expect(result.current.level).toBe(2)
    expect(result.current.xp).toBe(250)
  })

  it('addXp increments xp and level', () => {
    const { result } = renderHook(() => usePassProgress())
    act(() => {
      result.current.addXp(100)
    })
    expect(result.current.xp).toBe(100)
    expect(result.current.level).toBe(1)
  })

  it('addFightXp uses PASS_XP_PER_FIGHT', () => {
    const { result } = renderHook(() => usePassProgress())
    act(() => {
      result.current.addFightXp()
    })
    expect(result.current.xp).toBe(PASS_XP_PER_FIGHT)
  })

  it('addForgeXp and addIdleClaimXp work', () => {
    const { result } = renderHook(() => usePassProgress())
    act(() => {
      result.current.addForgeXp()
    })
    expect(result.current.xp).toBe(PASS_XP_PER_FORGE)
    act(() => {
      result.current.addIdleClaimXp()
    })
    expect(result.current.xp).toBe(PASS_XP_PER_FORGE + PASS_XP_PER_IDLE_CLAIM)
  })

  it('claimReward via hook', () => {
    const { result } = renderHook(() => usePassProgress())
    act(() => {
      result.current.addXp(200)
    })
    let ok = false
    act(() => {
      ok = result.current.claimReward(1)
    })
    expect(ok).toBe(true)
    expect(result.current.claimed).toContain(1)
  })

  it('canClaim reflects hook state', () => {
    setStoredPassProgress('test-char-id', { xp: 150, claimed: [] })
    const { result } = renderHook(() => usePassProgress())
    expect(result.current.canClaim(1)).toBe(true)
    expect(result.current.canClaim(2)).toBe(false)
  })
})
