import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadPassProgress,
  savePassProgress,
  clearPassProgress,
  addPassXpStorage,
  claimPassTierStorage,
  isPassTierClaimed,
  getPassStorageKey,
} from '../../utils/passStorage'

const SEASON = '2026-09'
const CHAR = 'char-123'

describe('passStorage', () => {
  beforeEach(() => {
    clearPassProgress()
    localStorage.clear()
  })

  it('returns default progress when nothing stored', () => {
    expect(loadPassProgress(SEASON, CHAR)).toEqual({ xp: 0, claimed: [] })
  })

  it('saves and loads progress', () => {
    savePassProgress(SEASON, { xp: 250, claimed: [1, 2] }, CHAR)
    expect(loadPassProgress(SEASON, CHAR)).toEqual({ xp: 250, claimed: [1, 2] })
  })

  it('storage key includes season and character', () => {
    expect(getPassStorageKey(SEASON, CHAR)).toBe(`pass_progress_${SEASON}_${CHAR}`)
    expect(getPassStorageKey(SEASON)).toBe(`pass_progress_${SEASON}`)
  })

  it('isolates progress per season', () => {
    savePassProgress('2026-09', { xp: 100, claimed: [1] }, CHAR)
    savePassProgress('2026-10', { xp: 500, claimed: [1, 2, 3] }, CHAR)
    expect(loadPassProgress('2026-09', CHAR).xp).toBe(100)
    expect(loadPassProgress('2026-10', CHAR).xp).toBe(500)
  })

  it('isolates progress per character', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [1] }, 'char-A')
    savePassProgress(SEASON, { xp: 900, claimed: [1, 2] }, 'char-B')
    expect(loadPassProgress(SEASON, 'char-A').xp).toBe(100)
    expect(loadPassProgress(SEASON, 'char-B').xp).toBe(900)
  })

  it('persists to localStorage', () => {
    savePassProgress(SEASON, { xp: 300, claimed: [1] }, CHAR)
    const raw = localStorage.getItem(getPassStorageKey(SEASON, CHAR))
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).xp).toBe(300)
  })

  it('clearPassProgress removes specific season+char', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [1] }, CHAR)
    savePassProgress(SEASON, { xp: 200, claimed: [2] }, 'other')
    clearPassProgress(SEASON, CHAR)
    expect(loadPassProgress(SEASON, CHAR)).toEqual({ xp: 0, claimed: [] })
    expect(loadPassProgress(SEASON, 'other')).toEqual({ xp: 200, claimed: [2] })
  })

  it('clearPassProgress without args clears all', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [] }, CHAR)
    savePassProgress('2026-10', { xp: 200, claimed: [] }, CHAR)
    clearPassProgress()
    expect(loadPassProgress(SEASON, CHAR)).toEqual({ xp: 0, claimed: [] })
    expect(loadPassProgress('2026-10', CHAR)).toEqual({ xp: 0, claimed: [] })
  })

  it('addPassXpStorage increments xp', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [] }, CHAR)
    const next = addPassXpStorage(SEASON, 50, CHAR)
    expect(next.xp).toBe(150)
    expect(loadPassProgress(SEASON, CHAR).xp).toBe(150)
  })

  it('addPassXpStorage ignores negative amount', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [] }, CHAR)
    const next = addPassXpStorage(SEASON, -20, CHAR)
    expect(next.xp).toBe(100)
  })

  it('claimPassTierStorage adds tier to claimed', () => {
    savePassProgress(SEASON, { xp: 500, claimed: [] }, CHAR)
    expect(claimPassTierStorage(SEASON, 2, CHAR)).toBe(true)
    expect(loadPassProgress(SEASON, CHAR).claimed).toContain(2)
  })

  it('claimPassTierStorage returns false if already claimed', () => {
    savePassProgress(SEASON, { xp: 500, claimed: [2] }, CHAR)
    expect(claimPassTierStorage(SEASON, 2, CHAR)).toBe(false)
  })

  it('claimPassTierStorage sorts claimed tiers', () => {
    savePassProgress(SEASON, { xp: 500, claimed: [5] }, CHAR)
    claimPassTierStorage(SEASON, 2, CHAR)
    expect(loadPassProgress(SEASON, CHAR).claimed).toEqual([2, 5])
  })

  it('isPassTierClaimed works', () => {
    savePassProgress(SEASON, { xp: 100, claimed: [3] }, CHAR)
    expect(isPassTierClaimed(SEASON, 3, CHAR)).toBe(true)
    expect(isPassTierClaimed(SEASON, 4, CHAR)).toBe(false)
  })
})
