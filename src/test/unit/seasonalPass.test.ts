import { describe, it, expect } from 'vitest'
import {
  SEASONAL_PASS_TIERS,
  PASS_MAX_TIER,
  PASS_MAX_XP,
  getPassTierForXp,
  getPassTier,
  getPassProgressPct,
  getNextTierXp,
  getXpToNextTier,
  PASS_XP_SOURCES,
} from '../../data/seasonalPass'

describe('seasonalPass config', () => {
  it('has exactly 20 tiers', () => {
    expect(SEASONAL_PASS_TIERS).toHaveLength(20)
    expect(PASS_MAX_TIER).toBe(20)
  })

  it('tiers are sequential level 1..20', () => {
    SEASONAL_PASS_TIERS.forEach((t, i) => {
      expect(t.level).toBe(i + 1)
    })
  })

  it('xpRequired is strictly increasing', () => {
    for (let i = 1; i < SEASONAL_PASS_TIERS.length; i++) {
      expect(SEASONAL_PASS_TIERS[i].xpRequired).toBeGreaterThan(SEASONAL_PASS_TIERS[i - 1].xpRequired)
    }
  })

  it('reward types are only essence | reroll | pity | biome_token', () => {
    const allowed = new Set(['essence', 'reroll', 'pity', 'biome_token'])
    SEASONAL_PASS_TIERS.forEach(t => {
      expect(allowed.has(t.reward.type)).toBe(true)
      expect(t.reward.amount).toBeGreaterThan(0)
    })
  })

  it('contains essence rewards with amounts 5/10/15', () => {
    const essenceAmounts = SEASONAL_PASS_TIERS.filter(t => t.reward.type === 'essence').map(t => t.reward.amount)
    expect(essenceAmounts.length).toBeGreaterThan(0)
    essenceAmounts.forEach(a => expect([5, 10, 15].includes(a)).toBe(true))
  })

  it('contains at least one reroll reward', () => {
    expect(SEASONAL_PASS_TIERS.some(t => t.reward.type === 'reroll')).toBe(true)
  })

  it('contains at least one pity reward with amount 2', () => {
    const pity = SEASONAL_PASS_TIERS.filter(t => t.reward.type === 'pity')
    expect(pity.length).toBeGreaterThan(0)
    pity.forEach(p => expect(p.reward.amount).toBe(2))
  })

  it('contains at least one biome_token reward', () => {
    expect(SEASONAL_PASS_TIERS.some(t => t.reward.type === 'biome_token')).toBe(true)
  })

  it('PASS_MAX_XP equals last tier xpRequired', () => {
    expect(PASS_MAX_XP).toBe(SEASONAL_PASS_TIERS[19].xpRequired)
  })

  it('PASS_XP_SOURCES has fight, forge, idle', () => {
    expect(PASS_XP_SOURCES.fight).toBeGreaterThan(0)
    expect(PASS_XP_SOURCES.forge).toBeGreaterThan(0)
    expect(PASS_XP_SOURCES.idle).toBeGreaterThan(0)
  })
})

describe('getPassTierForXp', () => {
  it('returns 0 when xp is 0', () => {
    expect(getPassTierForXp(0)).toBe(0)
  })

  it('returns 1 when xp equals first tier requirement', () => {
    expect(getPassTierForXp(SEASONAL_PASS_TIERS[0].xpRequired)).toBe(1)
  })

  it('returns correct tier for xp between thresholds', () => {
    const t1 = SEASONAL_PASS_TIERS[0].xpRequired
    expect(getPassTierForXp(t1 - 1)).toBe(0)
    expect(getPassTierForXp(t1)).toBe(1)
    const t5 = SEASONAL_PASS_TIERS[4].xpRequired
    expect(getPassTierForXp(t5)).toBe(5)
    expect(getPassTierForXp(t5 - 1)).toBe(4)
  })

  it('returns 20 when xp >= max', () => {
    expect(getPassTierForXp(PASS_MAX_XP)).toBe(20)
    expect(getPassTierForXp(PASS_MAX_XP + 1000)).toBe(20)
  })
})

describe('getPassProgressPct', () => {
  it('returns 0 at 0 xp', () => {
    expect(getPassProgressPct(0)).toBe(0)
  })

  it('returns 100 at max xp', () => {
    expect(getPassProgressPct(PASS_MAX_XP)).toBe(100)
    expect(getPassProgressPct(PASS_MAX_XP + 500)).toBe(100)
  })

  it('returns proportional percentage', () => {
    const half = Math.floor(PASS_MAX_XP / 2)
    const pct = getPassProgressPct(half)
    expect(pct).toBeGreaterThan(40)
    expect(pct).toBeLessThan(60)
  })
})

describe('getNextTierXp / getXpToNextTier', () => {
  it('returns first tier xp when at 0', () => {
    expect(getNextTierXp(0)).toBe(SEASONAL_PASS_TIERS[0].xpRequired)
    expect(getXpToNextTier(0)).toBe(SEASONAL_PASS_TIERS[0].xpRequired)
  })

  it('returns null / 0 when at max', () => {
    expect(getNextTierXp(PASS_MAX_XP)).toBeNull()
    expect(getXpToNextTier(PASS_MAX_XP)).toBe(0)
  })

  it('returns correct next tier after tier 5', () => {
    const xp = SEASONAL_PASS_TIERS[4].xpRequired
    expect(getNextTierXp(xp)).toBe(SEASONAL_PASS_TIERS[5].xpRequired)
  })
})

describe('getPassTier', () => {
  it('returns tier by level', () => {
    expect(getPassTier(1)?.level).toBe(1)
    expect(getPassTier(20)?.level).toBe(20)
  })

  it('returns undefined for invalid level', () => {
    expect(getPassTier(99)).toBeUndefined()
    expect(getPassTier(0)).toBeUndefined()
  })
})
