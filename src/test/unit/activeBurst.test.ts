import { describe, it, expect } from 'vitest'
import { GAME_RULES } from '../../config/gameRules'

describe('Active Burst — pendulum micro-hunt', () => {
  it('expose getEffectiveMaxFights : 5 hors burst, 6 pendant burst', async () => {
    const { getEffectiveMaxFights } = await import('../../data/liveOps')
    expect(getEffectiveMaxFights(false)).toBe(GAME_RULES.COMBAT.MAX_DAILY_FIGHTS)
    expect(getEffectiveMaxFights(true)).toBe(6)
    expect(getEffectiveMaxFights(true)).toBe(GAME_RULES.COMBAT.MAX_DAILY_FIGHTS + 1)
  })

  it('idlePaused miroir de BURST_ACTIVE', async () => {
    const { isBurstActive, isIdlePaused } = await import('../../data/liveOps')
    const burstDate = new Date('2026-09-12T12:00:00+02:00')
    const normalDate = new Date('2026-09-15T12:00:00+02:00')
    expect(isIdlePaused(burstDate)).toBe(isBurstActive(burstDate))
    expect(isIdlePaused(normalDate)).toBe(isBurstActive(normalDate))
    expect(isBurstActive(burstDate)).toBe(true)
  })

  it('burst actif ven 18h Paris -> dim 18h Paris uniquement en semaine burst', async () => {
    const { isBurstActive } = await import('../../data/liveOps')
    const friday19 = new Date('2026-09-11T19:00:00+02:00')
    const saturday12 = new Date('2026-09-12T12:00:00+02:00')
    const sunday17 = new Date('2026-09-13T17:59:00+02:00')
    const sunday19 = new Date('2026-09-13T19:00:00+02:00')
    const friday17 = new Date('2026-09-11T17:00:00+02:00')
    const thursday = new Date('2026-09-10T12:00:00+02:00')
    expect(isBurstActive(friday19)).toBe(true)
    expect(isBurstActive(saturday12)).toBe(true)
    expect(isBurstActive(sunday17)).toBe(true)
    expect(isBurstActive(sunday19)).toBe(false)
    expect(isBurstActive(friday17)).toBe(false)
    expect(isBurstActive(thursday)).toBe(false)
  })

  it('alternance pendulum semaine paire = surge, impaire = burst, jamais concurrent', async () => {
    const { isBurstActive, getActiveSurge } = await import('../../data/liveOps')
    const fridayWeek1 = new Date('2026-09-11T19:00:00+02:00')
    const fridayWeek2 = new Date('2026-09-18T19:00:00+02:00')
    const burst1 = isBurstActive(fridayWeek1)
    const burst2 = isBurstActive(fridayWeek2)
    expect(burst1 !== burst2).toBe(true)
    if (burst1) expect(getActiveSurge(fridayWeek1)).toBe(null)
    if (burst2) expect(getActiveSurge(fridayWeek2)).toBe(null)
    if (!burst1) expect(getActiveSurge(fridayWeek1) !== null).toBe(true)
    if (!burst2) expect(getActiveSurge(fridayWeek2) !== null).toBe(true)
    const surgeMon = getActiveSurge(new Date('2026-09-15T12:00:00+02:00'))
    expect(surgeMon !== null).toBe(true)
  })

  it('mutateur appliqué modifie offense / defense / xp', async () => {
    const { BURST_MUTATORS, applyBurstMutator } = await import('../../data/liveOps')
    expect(BURST_MUTATORS).toHaveLength(3)
    const ids = BURST_MUTATORS.map(m => m.id)
    expect(ids).toContain('offense')
    expect(ids).toContain('defense')
    expect(ids).toContain('xp')
    const baseStats = { offense: 100, defense: 100, xp: 100 }
    const offense = applyBurstMutator(baseStats, 'offense')
    expect(offense.offense).toBeGreaterThan(baseStats.offense)
    expect(offense.offense).toBe(110)
    const defense = applyBurstMutator(baseStats, 'defense')
    expect(defense.defense).toBeLessThan(baseStats.defense)
    const xp = applyBurstMutator(baseStats, 'xp')
    expect(xp.xp).toBeGreaterThan(baseStats.xp)
    expect(xp.xp).toBe(115)
  })

  it('log depthToIdleRatio pendant burst via console.debug', async () => {
    const { logDepthToIdleRatio } = await import('../../data/liveOps')
    const orig = console.debug
    let logged = ''
    console.debug = (...args: unknown[]) => { logged = String(args[0]) }
    logDepthToIdleRatio(8, 2, new Date('2026-09-12T12:00:00+02:00'))
    expect(logged).toContain('depthToIdleRatio')
    console.debug = orig
    let notLogged = ''
    console.debug = (...args: unknown[]) => { notLogged += String(args[0]) }
    logDepthToIdleRatio(8, 2, new Date('2026-09-15T12:00:00+02:00'))
    expect(notLogged).toBe('')
    console.debug = orig
  })
})
