import { describe, it, expect } from 'vitest'
import { IDLE_CONFIG } from '../../config/idleConfig'
import {
  calculateOfflineFights,
  calculateOfflineFightsWithEfficiency,
} from '../../utils/idleEfficiencyUtils'
import {
  OFFLINE_FIGHTS_PER_DAY,
  IDLE_SWEEP_WINDOW_MS,
  MAX_OFFLINE_HOURS,
  calculateOfflineFightsWithEfficiency as serverOfflineFights,
} from '../../../api/idle-processor'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const INTERVAL = 12_000

describe('offline idle volume budget', () => {
  it('exposes a per-day fight budget and a sweep window on the client config', () => {
    expect(IDLE_CONFIG.OFFLINE_FIGHTS_PER_DAY).toBe(120)
    expect(IDLE_CONFIG.IDLE_SWEEP_WINDOW_MS).toBe(12 * 60 * 1000)
  })

  it('keeps the server constants in sync with the client config', () => {
    expect(OFFLINE_FIGHTS_PER_DAY).toBe(IDLE_CONFIG.OFFLINE_FIGHTS_PER_DAY)
    expect(IDLE_SWEEP_WINDOW_MS).toBe(IDLE_CONFIG.IDLE_SWEEP_WINDOW_MS)
    expect(MAX_OFFLINE_HOURS).toBe(IDLE_CONFIG.MAX_OFFLINE_HOURS)
  })

  it('pays nothing for a zero or negative absence', () => {
    expect(calculateOfflineFights(0, INTERVAL)).toBe(0)
    expect(calculateOfflineFights(-5000, INTERVAL)).toBe(0)
  })

  it('credits one fight per sweep window instead of one per idle interval', () => {
    expect(calculateOfflineFights(IDLE_CONFIG.IDLE_SWEEP_WINDOW_MS, INTERVAL)).toBe(1)
    expect(calculateOfflineFights(2 * IDLE_CONFIG.IDLE_SWEEP_WINDOW_MS, INTERVAL)).toBe(2)
  })

  it('keeps the daily total under the budget', () => {
    expect(calculateOfflineFights(DAY, INTERVAL)).toBeLessThanOrEqual(OFFLINE_FIGHTS_PER_DAY)
    for (let hours = 1; hours <= 24; hours++) {
      const fights = calculateOfflineFights(hours * HOUR, INTERVAL)
      const budget = Math.floor((hours * HOUR * OFFLINE_FIGHTS_PER_DAY) / DAY)
      expect(fights).toBeLessThanOrEqual(budget)
    }
  })

  it('never exceeds MAX_IDLE_FIGHTS for a multi-day absence', () => {
    expect(calculateOfflineFights(5 * DAY, INTERVAL)).toBeLessThanOrEqual(IDLE_CONFIG.MAX_IDLE_FIGHTS)
  })

  it('reduces a full day of offline fights from thousands to the budget', () => {
    const beforeBudget = Math.floor(DAY / INTERVAL)
    expect(beforeBudget).toBeGreaterThan(6000)
    expect(calculateOfflineFights(DAY, INTERVAL)).toBeLessThan(beforeBudget / 50)
  })

  it('mirrors the server fight count for every absence length', () => {
    const start = 1_700_000_000_000
    for (const elapsed of [0, 60_000, 12 * 60_000, HOUR, 8 * HOUR, DAY, 3 * DAY]) {
      expect(serverOfflineFights(start, start + elapsed, INTERVAL)).toBe(
        calculateOfflineFightsWithEfficiency(start, start + elapsed, INTERVAL),
      )
    }
  })
})
