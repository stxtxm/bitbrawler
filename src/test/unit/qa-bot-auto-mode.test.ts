import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  AUTO_MODE_ARENA_LABEL,
  classifyArenaSkipReason,
  determineNextFightType,
  isAutoModeArenaStatus,
  resolveRunPvpSinceLastPve,
} from '../../utils/qa-bot-helpers'

describe('isAutoModeArenaStatus', () => {
  it('is true only on the AUTO MODE label', () => {
    expect(AUTO_MODE_ARENA_LABEL).toBe('AUTO MODE')
    expect(isAutoModeArenaStatus({ fightButtonLabel: 'AUTO MODE' })).toBe(true)
    expect(isAutoModeArenaStatus({ fightButtonLabel: ' auto mode ' })).toBe(true)
  })

  it('rejects fight CTAs and missing status', () => {
    expect(isAutoModeArenaStatus({ fightButtonLabel: 'FIGHT!' })).toBe(false)
    expect(isAutoModeArenaStatus({ fightButtonLabel: 'ATTACK BOSS' })).toBe(false)
    expect(isAutoModeArenaStatus({ fightButtonLabel: 'AUTO MODE READY' })).toBe(false)
    expect(isAutoModeArenaStatus({})).toBe(false)
    expect(isAutoModeArenaStatus(null)).toBe(false)
    expect(isAutoModeArenaStatus(undefined)).toBe(false)
  })
})

describe('classifyArenaSkipReason', () => {
  it('classifies AUTO MODE before looking at energy', () => {
    expect(classifyArenaSkipReason({ fightsAvailable: 5, fightButtonLabel: 'AUTO MODE' })).toBe('auto_mode')
    expect(classifyArenaSkipReason({ fightsAvailable: 0, fightButtonLabel: 'AUTO MODE' })).toBe('auto_mode')
  })

  it('classifies empty energy as no_energy', () => {
    expect(classifyArenaSkipReason({ fightsAvailable: 0, fightButtonLabel: 'REST NOW' })).toBe('no_energy')
  })

  it('never reports exhausted while fights are available', () => {
    const reason = classifyArenaSkipReason({ fightsAvailable: 5, fightButtonLabel: 'FIGHT!' })
    expect(reason).not.toBe('exhausted')
    expect(reason).toBe('not_attackable')
  })

  it('reports exhausted only when energy cannot be read', () => {
    expect(classifyArenaSkipReason({ fightsAvailable: null, fightButtonLabel: 'REST NOW' })).toBe('exhausted')
    expect(classifyArenaSkipReason()).toBe('exhausted')
  })
})

describe('resolveRunPvpSinceLastPve', () => {
  it('resets the cycle on a new day', () => {
    expect(resolveRunPvpSinceLastPve({ run: '2026-10-30', pvp_since_last_pve: 2 }, '2026-10-31')).toBe(0)
  })

  it('carries the counter across runs of the same day', () => {
    expect(resolveRunPvpSinceLastPve({ run: '2026-10-31', pvp_since_last_pve: 2 }, '2026-10-31')).toBe(2)
  })

  it('falls back to zero on missing or invalid state', () => {
    expect(resolveRunPvpSinceLastPve(null, '2026-10-31')).toBe(0)
    expect(resolveRunPvpSinceLastPve(undefined, '2026-10-31')).toBe(0)
    expect(resolveRunPvpSinceLastPve({ run: '2026-10-31', pvp_since_last_pve: -1 }, '2026-10-31')).toBe(0)
    expect(resolveRunPvpSinceLastPve({ run: '2026-10-31', pvp_since_last_pve: 'x' as unknown as number }, '2026-10-31')).toBe(0)
  })
})

describe('PvE selection across one-fight runs', () => {
  it('selects PvE on every third run when fightsPerRun is 1', () => {
    let counter = 0
    const types: string[] = []
    for (let run = 0; run < 6; run++) {
      const decision = determineNextFightType(counter, 0.33, false)
      types.push(decision.type)
      counter = decision.pvpSinceLastPve
    }
    expect(types).toEqual(['pvp', 'pvp', 'pve', 'pvp', 'pvp', 'pve'])
    expect(types.filter(type => type === 'pve')).toHaveLength(2)
  })

  it('keeps pveOnly working', () => {
    expect(determineNextFightType(0, 0.33, true).type).toBe('pve')
  })
})

describe('qa-bot auto mode contract', () => {
  const source = readFileSync(join(process.cwd(), 'qa', 'qa-bot.mjs'), 'utf-8')

  function extractAsyncFunction(name: string): string {
    const start = source.indexOf(`async function ${name}(`)
    expect(start).toBeGreaterThan(-1)
    const bodyStart = source.indexOf('{', start)
    let depth = 0
    for (let i = bodyStart; i < source.length; i++) {
      if (source[i] === '{') depth++
      else if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    throw new Error(`unterminated async function ${name}`)
  }

  it('never enables auto mode on the QA character', () => {
    expect(source).not.toContain('syncAutoMode(page, true)')
    expect(source).toContain('runRecord.auto_mode_enabled = false')
    expect(source).toContain('syncAutoMode(page, false)')
  })

  it('returns the verified aria-checked state after toggling', () => {
    const fn = extractAsyncFunction('syncAutoMode')
    expect(fn).toContain("getAttribute('aria-checked')")
    expect(fn).toContain('return verified')
    expect(fn).not.toMatch(/return true\s*\n\}/)
  })

  it('detects AUTO MODE at the start of the run and retries after reload', () => {
    const fn = extractAsyncFunction('disableAutoModeAtRunStart')
    expect(fn).toContain('isAutoModeArenaStatus(')
    expect(fn).toContain('syncAutoMode(page, false)')
    expect(fn).toContain('retryArenaReload(page)')
    expect(fn).toContain("'auto_mode'")
  })

  it('uses the auto-mode aware classifier and persists the PvE counter', () => {
    expect(source).toContain('classifyArenaSkipReason(')
    expect(source).toContain('isAutoModeArenaStatus(')
    expect(source).toContain('resolveRunPvpSinceLastPve(')
    expect(source).toContain('pvp_since_last_pve')
  })
})
