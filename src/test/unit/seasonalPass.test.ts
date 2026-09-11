import { describe, it, expect } from 'vitest'
import {
  PASS_MAX_LEVEL,
  PASS_XP_PER_LEVEL,
  PASS_SEASON_DAYS,
  PASS_XP_SOURCES,
  PASS_LEVELS,
  getPassLevel,
  getPassRewards,
  getPassLevelDef,
  getPassProgress,
  getSeasonWindowForPass,
} from '../../data/seasonalPass'

describe('seasonalPass config', () => {
  it('expose 20 paliers avec xpRequired croissant', () => {
    expect(PASS_LEVELS).toHaveLength(20)
    expect(PASS_MAX_LEVEL).toBe(20)
    for (let i = 1; i < PASS_LEVELS.length; i++) {
      expect(PASS_LEVELS[i].xpRequired).toBeGreaterThan(PASS_LEVELS[i - 1].xpRequired)
      expect(PASS_LEVELS[i].level).toBe(i + 1)
    }
  })

  it('season duree 30j et xp sources definies', () => {
    expect(PASS_SEASON_DAYS).toBe(30)
    expect(PASS_XP_PER_LEVEL).toBeGreaterThan(0)
    expect(PASS_XP_SOURCES.fight).toBeGreaterThan(0)
    expect(PASS_XP_SOURCES.forge).toBeGreaterThan(0)
    expect(PASS_XP_SOURCES.idleClaim).toBeGreaterThan(0)
  })

  it('rewards couvrent essence 5/10/15, reroll, pity -2, biome_token', () => {
    const types = new Set(PASS_LEVELS.map(l => l.reward.type))
    expect(types.has('essence')).toBe(true)
    expect(types.has('reroll')).toBe(true)
    expect(types.has('pity')).toBe(true)
    expect(types.has('biome_token')).toBe(true)
    const essenceAmounts = PASS_LEVELS.filter(l => l.reward.type === 'essence').map(l => l.reward.amount)
    expect(essenceAmounts).toContain(5)
    expect(essenceAmounts).toContain(10)
    expect(essenceAmounts).toContain(15)
    const pityRewards = PASS_LEVELS.filter(l => l.reward.type === 'pity')
    expect(pityRewards.length).toBeGreaterThan(0)
    expect(pityRewards.every(r => r.reward.amount === 2)).toBe(true)
    const rerollRewards = PASS_LEVELS.filter(l => l.reward.type === 'reroll')
    expect(rerollRewards.length).toBeGreaterThan(0)
    const biomeRewards = PASS_LEVELS.filter(l => l.reward.type === 'biome_token')
    expect(biomeRewards.length).toBeGreaterThan(0)
  })

  it('pas de premium paywall — types autorises uniquement', () => {
    const allowed = new Set(['essence', 'reroll', 'pity', 'biome_token'])
    for (const lvl of PASS_LEVELS) {
      expect(allowed.has(lvl.reward.type)).toBe(true)
    }
  })

  describe('getPassLevel', () => {
    it('0 xp => level 0', () => expect(getPassLevel(0)).toBe(0))
    it('xp negatif => 0', () => expect(getPassLevel(-10)).toBe(0))
    it('juste sous seuil => level inferieur', () => {
      expect(getPassLevel(99)).toBe(0)
      expect(getPassLevel(199)).toBe(1)
    })
    it('seuils exacts', () => {
      expect(getPassLevel(100)).toBe(1)
      expect(getPassLevel(200)).toBe(2)
      expect(getPassLevel(1000)).toBe(10)
      expect(getPassLevel(2000)).toBe(20)
    })
    it('cap a 20 meme si xp enorme', () => {
      expect(getPassLevel(9999)).toBe(20)
      expect(getPassLevel(1_000_000)).toBe(20)
    })
    it('xp non fini => 0', () => {
      expect(getPassLevel(NaN)).toBe(0)
      expect(getPassLevel(Infinity)).toBe(0)
    })
  })

  describe('getPassRewards', () => {
    it('retourne reward pour chaque level valide', () => {
      for (let lvl = 1; lvl <= 20; lvl++) {
        const r = getPassRewards(lvl)
        expect(r).not.toBeNull()
        expect(r!.type).toBeDefined()
        expect(r!.amount).toBeGreaterThan(0)
      }
    })
    it('hors bornes => null', () => {
      expect(getPassRewards(0)).toBeNull()
      expect(getPassRewards(21)).toBeNull()
      expect(getPassRewards(-1)).toBeNull()
      expect(getPassRewards(1.5)).toBeNull()
    })
    it('coherence avec PASS_LEVELS', () => {
      expect(getPassRewards(1)).toEqual(PASS_LEVELS[0].reward)
      expect(getPassRewards(20)).toEqual(PASS_LEVELS[19].reward)
    })
  })

  describe('getPassLevelDef', () => {
    it('retourne def pour level valide', () => {
      const def = getPassLevelDef(5)
      expect(def).not.toBeNull()
      expect(def!.level).toBe(5)
    })
    it('null hors bornes', () => {
      expect(getPassLevelDef(0)).toBeNull()
      expect(getPassLevelDef(21)).toBeNull()
    })
  })

  describe('getPassProgress', () => {
    it('level 0 progression', () => {
      const p = getPassProgress(0)
      expect(p.level).toBe(0)
      expect(p.nextXp).toBe(100)
      expect(p.progress).toBe(0)
    })
    it('mid-level progress', () => {
      const p = getPassProgress(150)
      expect(p.level).toBe(1)
      expect(p.nextXp).toBe(200)
      expect(p.progress).toBeCloseTo(0.5)
    })
    it('max level => nextXp null et progress 1', () => {
      const p = getPassProgress(2000)
      expect(p.level).toBe(20)
      expect(p.nextXp).toBeNull()
      expect(p.progress).toBe(1)
    })
  })

  describe('getSeasonWindowForPass', () => {
    it('retourne seasonId et fenetre 30j', () => {
      const w = getSeasonWindowForPass(new Date(Date.UTC(2026, 0, 15)))
      expect(w.seasonId).toMatch(/^season-\d+$/)
      const diff = w.end.getTime() - w.start.getTime()
      expect(diff).toBe(30 * 24 * 60 * 60 * 1000)
    })
  })
})
