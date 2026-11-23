import { describe, it, expect } from 'vitest'
import {
  getXpRequiredForNextLevel as getGameXpRequiredForNextLevel,
  getTotalXpForLevel as getGameTotalXpForLevel,
} from '../../utils/xpUtils'
import {
  COMBAT_SPEED_STORAGE_KEY,
  COMBAT_SPEED_OPTIONS,
  isCombatSpeed,
  parseCombatSpeed,
  parseCombatSpeedText,
  getCombatSpeedFromStorageRaw,
  nextCombatSpeed,
  COMBAT_SPEED_TOGGLE_SELECTOR,
  COMBAT_SPEED_SETTINGS_SELECTOR,
  SITE_DOWN_ERROR_PREFIX,
  isSiteDownStatus,
  looksLikeErrorPage,
  hasGameContent,
  buildSiteDownMessage,
  buildSiteDownBodyMessage,
  throwIfSiteDownResponse,
  throwIfErrorPageBody,
  classifyRunError,
  QA_CHARACTER_TYPE_FRESH,
  QA_CHARACTER_TYPE_PERSISTENT,
  resolveReusableDailyCharacter,
  shouldReplaceExhaustedCharacter,
  isQaRunFailed,
  classifyQaRunErrors,
  isRunDataComplete,
  getXpRequiredForNextLevel,
  getTotalXpForLevel,
  parseProgressionCurve,
  parseResultXpPopup,
  selectFleetMember,
} from '../../utils/qa-bot-helpers'

describe('qa-bot-helpers combat speed', () => {
  describe('constants', () => {
    it('exports correct storage key', () => {
      expect(COMBAT_SPEED_STORAGE_KEY).toBe('bitbrawler_combat_speed')
    })
    it('exports options [1,2,4]', () => {
      expect(COMBAT_SPEED_OPTIONS).toEqual([1, 2, 4])
    })
    it('exports toggle selectors', () => {
      expect(COMBAT_SPEED_TOGGLE_SELECTOR).toBe('.combat-speed-toggle')
      expect(COMBAT_SPEED_SETTINGS_SELECTOR).toBe('[role="radiogroup"][aria-label="Combat speed"]')
    })
  })

  describe('isCombatSpeed', () => {
    it('returns true for 1, 2 and 4', () => {
      expect(isCombatSpeed(1)).toBe(true)
      expect(isCombatSpeed(2)).toBe(true)
      expect(isCombatSpeed(4)).toBe(true)
    })
    it('returns false for other numbers', () => {
      expect(isCombatSpeed(0)).toBe(false)
      expect(isCombatSpeed(3)).toBe(false)
      expect(isCombatSpeed(null)).toBe(false)
      expect(isCombatSpeed('2')).toBe(false)
      expect(isCombatSpeed(undefined)).toBe(false)
    })
  })

  describe('parseCombatSpeed', () => {
    it('returns 1, 2 or 4 when valid', () => {
      expect(parseCombatSpeed(1)).toBe(1)
      expect(parseCombatSpeed(2)).toBe(2)
      expect(parseCombatSpeed(4)).toBe(4)
    })
    it('returns null for invalid', () => {
      expect(parseCombatSpeed(0)).toBeNull()
      expect(parseCombatSpeed(3)).toBeNull()
      expect(parseCombatSpeed(null)).toBeNull()
      expect(parseCombatSpeed('1')).toBeNull()
    })
  })

  describe('parseCombatSpeedText', () => {
    it('parses x1, x2 and x4 variants', () => {
      expect(parseCombatSpeedText('x1')).toBe(1)
      expect(parseCombatSpeedText('x2')).toBe(2)
      expect(parseCombatSpeedText('x4')).toBe(4)
      expect(parseCombatSpeedText('⏩ x1')).toBe(1)
      expect(parseCombatSpeedText('⏩ x2')).toBe(2)
      expect(parseCombatSpeedText('»» x4 »»')).toBe(4)
      expect(parseCombatSpeedText('COMBAT SPEED x2')).toBe(2)
    })
    it('is case-insensitive and tolerant of spaces', () => {
      expect(parseCombatSpeedText('X1')).toBe(1)
      expect(parseCombatSpeedText('x 2')).toBe(2)
    })
    it('returns null for no match', () => {
      expect(parseCombatSpeedText('no speed')).toBeNull()
      expect(parseCombatSpeedText('')).toBeNull()
      expect(parseCombatSpeedText('x3')).toBeNull()
      expect(parseCombatSpeedText('x5')).toBeNull()
    })
  })

  describe('getCombatSpeedFromStorageRaw', () => {
    it('parses valid JSON stored values', () => {
      expect(getCombatSpeedFromStorageRaw('1')).toBe(1)
      expect(getCombatSpeedFromStorageRaw('2')).toBe(2)
      expect(getCombatSpeedFromStorageRaw('4')).toBe(4)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(1))).toBe(1)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(2))).toBe(2)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(4))).toBe(4)
    })
    it('falls back to 1 for null/invalid', () => {
      expect(getCombatSpeedFromStorageRaw(null)).toBe(1)
      expect(getCombatSpeedFromStorageRaw('')).toBe(1)
      expect(getCombatSpeedFromStorageRaw('3')).toBe(1)
      expect(getCombatSpeedFromStorageRaw('invalid')).toBe(1)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(3))).toBe(1)
    })
  })

  describe('nextCombatSpeed', () => {
    it('cycles 1 -> 2 -> 4 -> 1', () => {
      expect(nextCombatSpeed(1)).toBe(2)
      expect(nextCombatSpeed(2)).toBe(4)
      expect(nextCombatSpeed(4)).toBe(1)
    })
    it('falls back to 1 for invalid input', () => {
      expect(nextCombatSpeed(3 as unknown as number)).toBe(1)
      expect(nextCombatSpeed(null as unknown as number)).toBe(1)
    })
  })

  describe('SITE_DOWN fail-fast (#1121)', () => {
    it('exposes SITE_DOWN prefix constant', () => {
      expect(SITE_DOWN_ERROR_PREFIX).toBe('SITE_DOWN')
    })
    it('isSiteDownStatus flags 4xx/5xx only', () => {
      expect(isSiteDownStatus(402)).toBe(true)
      expect(isSiteDownStatus(500)).toBe(true)
      expect(isSiteDownStatus(200)).toBe(false)
      expect(isSiteDownStatus(302)).toBe(false)
      expect(isSiteDownStatus(null)).toBe(false)
      expect(isSiteDownStatus(undefined)).toBe(false)
    })
    it('buildSiteDownMessage formats HTTP status and url', () => {
      expect(buildSiteDownMessage(402, 'https://bitbrawler.pages.dev/login')).toBe(
        'SITE_DOWN: HTTP 402 on https://bitbrawler.pages.dev/login'
      )
    })
    it('buildSiteDownBodyMessage mentions error page and url', () => {
      const msg = buildSiteDownBodyMessage('https://bitbrawler.pages.dev/login')
      expect(msg).toContain('SITE_DOWN')
      expect(msg).toContain('https://bitbrawler.pages.dev/login')
    })
    it('throwIfSiteDownResponse throws SITE_DOWN on 402 without touching locators', () => {
      const response = { status: () => 402 }
      expect(() => throwIfSiteDownResponse(response, 'https://bitbrawler.pages.dev/login')).toThrow(
        /SITE_DOWN: HTTP 402/
      )
    })
    it('throwIfSiteDownResponse passes through on 200 and null response', () => {
      expect(() => throwIfSiteDownResponse({ status: () => 200 }, 'https://x/login')).not.toThrow()
      expect(() => throwIfSiteDownResponse(null, 'https://x/login')).not.toThrow()
      expect(() => throwIfSiteDownResponse(undefined, 'https://x/login')).not.toThrow()
    })
    it('looksLikeErrorPage detects billing and hosting-error markers', () => {
      expect(looksLikeErrorPage('402 Payment Required')).toBe(true)
      expect(looksLikeErrorPage('Deployment Protection active')).toBe(true)
      // Cloudflare Pages : la Function idle peut mourir avec un "error code:
      // 1101" que rien d'autre dans la page ne signale.
      expect(looksLikeErrorPage('error code: 1101')).toBe(true)
      expect(looksLikeErrorPage('DEPLOYMENT_DISABLED')).toBe(true)
      expect(looksLikeErrorPage('ENTER ARENA LOGIN')).toBe(false)
      expect(looksLikeErrorPage('')).toBe(false)
    })
    it('hasGameContent detects game markers', () => {
      expect(hasGameContent('BATTLE ENERGY AUTO MODE')).toBe(true)
      expect(hasGameContent('ENTER ARENA')).toBe(true)
      expect(hasGameContent('402 Payment Required')).toBe(false)
    })
    it('throwIfErrorPageBody throws only on error page without game content', () => {
      expect(() =>
        throwIfErrorPageBody('402 Payment Required', 'https://x/login', false)
      ).toThrow(/SITE_DOWN/)
      expect(() =>
        throwIfErrorPageBody('402 Payment Required ENTER ARENA', 'https://x/login', true)
      ).not.toThrow()
      expect(() => throwIfErrorPageBody('BATTLE ENERGY', 'https://x/login', true)).not.toThrow()
    })
    it('classifyRunError distinguishes site_down from flaky_locator', () => {
      expect(classifyRunError('SITE_DOWN: HTTP 402 on https://x')).toBe('site_down')
      expect(classifyRunError('locator.waitFor: Timeout 10000ms exceeded input[type="text"]')).toBe(
        'flaky_locator'
      )
      expect(classifyRunError('Fight 1: timeout waiting for result')).toBe('other')
    })
  })

  describe('runRecord combat_speed field', () => {
    it('captures combat_speed in record shape', () => {
      const runRecord: { combat_speed: number } = { combat_speed: 2 }
      expect(runRecord.combat_speed).toBe(2)
      expect([1, 2]).toContain(runRecord.combat_speed)
    })
    it('defaults to 1 when toggle absent (fallback)', () => {
      const fallback = getCombatSpeedFromStorageRaw(null)
      expect(fallback).toBe(1)
    })
  })
})

describe('qa-bot-helpers fresh day character reuse (#1241)', () => {
  describe('character type constants', () => {
    it('exposes fresh and persistent character types', () => {
      expect(QA_CHARACTER_TYPE_FRESH).toBe('fresh')
      expect(QA_CHARACTER_TYPE_PERSISTENT).toBe('persistent')
    })
  })

  describe('resolveReusableDailyCharacter', () => {
    it('reuses the same-day fresh fighter even when its energy is exhausted', () => {
      expect(resolveReusableDailyCharacter({
        run: '2026-10-19',
        character: 'QA-FRESH-4821',
        character_type: 'fresh',
        exhausted: true,
      }, '2026-10-19')).toBe('QA-FRESH-4821')
    })

    it('does not reuse a fresh fighter from a previous day', () => {
      expect(resolveReusableDailyCharacter({
        run: '2026-10-18',
        character: 'QA-FRESH-4821',
        character_type: 'fresh',
        exhausted: false,
      }, '2026-10-19')).toBeNull()
    })

    it('never reuses a persistent fighter on a fresh day', () => {
      expect(resolveReusableDailyCharacter({
        run: '2026-10-19',
        character: 'QA-PERSIST',
        character_type: 'persistent',
        exhausted: false,
      }, '2026-10-19')).toBeNull()
    })

    it('does not reuse legacy state without character_type', () => {
      expect(resolveReusableDailyCharacter({
        run: '2026-10-19',
        character: 'LEGACY-FIGHTER',
        exhausted: false,
      }, '2026-10-19')).toBeNull()
    })

    it('returns null for missing or invalid state', () => {
      expect(resolveReusableDailyCharacter(null, '2026-10-19')).toBeNull()
      expect(resolveReusableDailyCharacter(undefined, '2026-10-19')).toBeNull()
      expect(resolveReusableDailyCharacter({}, '2026-10-19')).toBeNull()
      expect(resolveReusableDailyCharacter({ run: '2026-10-19', character: '', character_type: 'fresh' }, '2026-10-19')).toBeNull()
    })
  })

  describe('shouldReplaceExhaustedCharacter', () => {
    it('keeps the fresh fighter across runs (idle/lootbox observation only)', () => {
      expect(shouldReplaceExhaustedCharacter('fresh')).toBe(false)
    })

    it('keeps the persistent fighter across runs', () => {
      expect(shouldReplaceExhaustedCharacter('persistent')).toBe(false)
    })

    it('replaces legacy daily fighters without a long-lived character type', () => {
      expect(shouldReplaceExhaustedCharacter(null)).toBe(true)
      expect(shouldReplaceExhaustedCharacter(undefined)).toBe(true)
      expect(shouldReplaceExhaustedCharacter('other')).toBe(true)
    })
  })
})

describe('qa-bot-helpers progression curve (#1283)', () => {
  it('mirrors the game XP curve constants', () => {
    expect(getXpRequiredForNextLevel(1)).toBe(120)
    expect(getXpRequiredForNextLevel(2)).toBe(376)
    expect(getXpRequiredForNextLevel(5)).toBe(1707)
    expect(getTotalXpForLevel(1)).toBe(0)
    expect(getTotalXpForLevel(5)).toBe(2412)
  })

  it('parses the ExperienceBar text into level, total XP, next threshold and percent', () => {
    expect(parseProgressionCurve('42 / 189 XP', 3)).toEqual({
      level: 3,
      total_xp: 496 + 42,
      xp_for_next: 189,
      percent: 22.2,
    })
  })

  it('rounds the percentage to one decimal', () => {
    expect(parseProgressionCurve('21 / 189 XP', 3)?.percent).toBe(11.1)
  })

  it('returns null when the level is unknown', () => {
    expect(parseProgressionCurve('42 / 189 XP', null)).toBeNull()
  })

  it('returns null for the MAX LEVEL display', () => {
    expect(parseProgressionCurve('MAX LEVEL', 99)).toBeNull()
  })

  it('returns null when the text has no XP bar pattern', () => {
    expect(parseProgressionCurve('', 3)).toBeNull()
    expect(parseProgressionCurve('BATTLE ENERGY 5/5 AVAILABLE', 3)).toBeNull()
  })

  it('returns null when the next-level threshold is zero', () => {
    expect(parseProgressionCurve('0 / 0 XP', 3)).toBeNull()
  })

  it('clamps the percentage to 100', () => {
    expect(parseProgressionCurve('250 / 189 XP', 3)?.percent).toBe(100)
  })
})

describe('qa-bot-helpers XP curve sync with xpUtils (#1290)', () => {
  const levels = Array.from({ length: 99 }, (_, index) => index + 1)

  it('mirrors getXpRequiredForNextLevel for levels 1 to 99', () => {
    const mismatches = levels
      .filter((level) => getXpRequiredForNextLevel(level) !== getGameXpRequiredForNextLevel(level))
      .map((level) => ({
        level,
        qa: getXpRequiredForNextLevel(level),
        game: getGameXpRequiredForNextLevel(level),
      }))

    expect(mismatches).toEqual([])
  })

  it('mirrors getTotalXpForLevel for levels 1 to 99', () => {
    const mismatches = levels
      .filter((level) => getTotalXpForLevel(level) !== getGameTotalXpForLevel(level))
      .map((level) => ({
        level,
        qa: getTotalXpForLevel(level),
        game: getGameTotalXpForLevel(level),
      }))

    expect(mismatches).toEqual([])
  })

  it('locks Infinity for the next-level requirement at max level', () => {
    expect(getXpRequiredForNextLevel(99)).toBe(Infinity)
    expect(getGameXpRequiredForNextLevel(99)).toBe(Infinity)
  })
})

describe('qa-bot-helpers result XP popup (#1312)', () => {
  it('returns 0 when a boss defeat popup says BOSS REMAINS', () => {
    expect(parseResultXpPopup('BOSS REMAINS')).toBe(0)
    expect(parseResultXpPopup('  Boss remains  ')).toBe(0)
  })

  it('reads the result popup XP instead of a stale arena popup', () => {
    const staleArenaPopup = '+574 XP'
    const resultPopup = '+160 XP'
    expect(staleArenaPopup).toContain('+574 XP')
    expect(parseResultXpPopup(resultPopup)).toBe(160)
  })

  it('accepts the exact +N XP format only', () => {
    expect(parseResultXpPopup('+120 XP')).toBe(120)
    expect(parseResultXpPopup('+0 XP')).toBe(0)
    expect(parseResultXpPopup('X +120 XP')).toBeNull()
    expect(parseResultXpPopup('+120 XP BONUS')).toBeNull()
    expect(parseResultXpPopup('+120')).toBeNull()
    expect(parseResultXpPopup('BATTLE ENERGY 5/5')).toBeNull()
  })

  it('returns null when the popup text is missing', () => {
    expect(parseResultXpPopup('')).toBeNull()
    expect(parseResultXpPopup(null)).toBeNull()
    expect(parseResultXpPopup(undefined)).toBeNull()
  })
})

describe('qa-bot-helpers isRunDataComplete (#1387 Phase 2.3)', () => {
  const complete = {
    character: 'QA-FRESH',
    initial_level: 2,
    final_stats: { level: 3, xp: 150, wins: 3, losses: 0 },
    fights: [{ result: 'victory' as const, xp: 50 }],
  }

  it('returns true for a run with fights + initial_level + final_stats.level', () => {
    expect(isRunDataComplete(complete)).toBe(true)
  })

  it('returns false when there are no fights', () => {
    expect(isRunDataComplete({ ...complete, fights: [] })).toBe(false)
    expect(isRunDataComplete({ ...complete, fights: null })).toBe(false)
  })

  it('returns false when the character name is missing', () => {
    expect(isRunDataComplete({ ...complete, character: '' })).toBe(false)
    expect(isRunDataComplete({ ...complete, character: null })).toBe(false)
  })

  it('returns false when initial_level is missing or not a finite number', () => {
    expect(isRunDataComplete({ ...complete, initial_level: null })).toBe(false)
    expect(isRunDataComplete({ ...complete, initial_level: undefined })).toBe(false)
  })

  it('returns false when final_stats or final_stats.level is missing', () => {
    expect(isRunDataComplete({ ...complete, final_stats: null })).toBe(false)
    expect(isRunDataComplete({ ...complete, final_stats: { level: null } })).toBe(false)
  })

  it('returns false for null/undefined records', () => {
    expect(isRunDataComplete(null)).toBe(false)
    expect(isRunDataComplete(undefined)).toBe(false)
  })
})

describe('qa-bot-helpers isQaRunFailed (#1387 Phase 2.2)', () => {
  it('returns true when the run recorded errors', () => {
    expect(isQaRunFailed({ errors: ['some error'] })).toBe(true)
  })

  it('returns true when the run produced no fights', () => {
    expect(isQaRunFailed({ errors: [], fights: [] })).toBe(true)
    expect(isQaRunFailed({})).toBe(true)
  })

  it('returns false when the run has fights and no errors', () => {
    expect(isQaRunFailed({ errors: [], fights: [{ result: 'victory', xp: 10 }] })).toBe(false)
  })

  it('returns false for null/undefined records', () => {
    expect(isQaRunFailed(null)).toBe(false)
  })
})

describe('qa-bot-helpers classifyQaRunErrors (#1387 Phase 2.1)', () => {
  it('returns [] when the record has no errors or is nullish', () => {
    expect(classifyQaRunErrors({ errors: [] })).toEqual([])
    expect(classifyQaRunErrors(null)).toEqual([])
    expect(classifyQaRunErrors({})).toEqual([])
  })

  it('classifies timeout, connection, login, site-down and browser patterns', () => {
    const patterns = classifyQaRunErrors({
      errors: [
        'waiting for locator("button").first() timed out',
        'fetch failed',
        'Login required — please log in again',
        'SITE_DOWN: HTTP 502 on https://bitbrawler.pages.dev',
        'waitFor locator selector timeout',
      ],
    })
    expect(patterns).toEqual(['browser_error', 'connection_error', 'login_failure', 'site_down', 'timeout'])
  })

  it('falls back to ["other"] for unmatched errors', () => {
    expect(classifyQaRunErrors({ errors: ['something unexpected'] })).toEqual(['other'])
    expect(classifyQaRunErrors({ errors: [''] })).toEqual(['other'])
  })
})

interface FleetMemberConfig {
  name: string
  minLevel?: number
  maxLevel?: number
}

interface FleetMemberState {
  last_run?: string
  created_at?: string
  level?: number
}

interface FleetState {
  fleet?: Record<string, FleetMemberState>
}

const ROTATION_FLEET: FleetMemberConfig[] = [
  { name: 'QA-FRESH', minLevel: 1, maxLevel: 5 },
  { name: 'QA-MID', minLevel: 15, maxLevel: 25 },
  { name: 'QA-END', minLevel: 30, maxLevel: 99 },
]

describe('qa-bot-helpers selectFleetMember (#1405)', () => {
  it('rotates through every member three times over nine runs', () => {
    const state: FleetState = {
      fleet: {
        'QA-FRESH': { level: 3 },
        'QA-MID': { level: 20 },
        'QA-END': { level: 40 },
      },
    }
    const picks: string[] = []
    for (let run = 0; run < 9; run++) {
      const result = selectFleetMember(state, ROTATION_FLEET)
      expect(result.member).not.toBeNull()
      const name = result.member?.name ?? ''
      picks.push(name)
      const lastRun = new Date(Date.UTC(2026, 0, 1, 0, run)).toISOString()
      state.fleet = {
        ...state.fleet,
        [name]: { ...state.fleet?.[name], last_run: lastRun },
      }
    }
    expect(picks.filter((name) => name === 'QA-FRESH')).toHaveLength(3)
    expect(picks.filter((name) => name === 'QA-MID')).toHaveLength(3)
    expect(picks.filter((name) => name === 'QA-END')).toHaveLength(3)
  })

  it('never picks a member with a more recent last_run while another is older', () => {
    const state: FleetState = {
      fleet: {
        'QA-FRESH': { level: 3, last_run: '2026-01-01T00:00:00.000Z' },
        'QA-MID': { level: 20, last_run: '2026-01-02T00:00:00.000Z' },
        'QA-END': { level: 40, last_run: '2026-01-03T00:00:00.000Z' },
      },
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = selectFleetMember(state, ROTATION_FLEET)
      expect(result.member?.name).toBe('QA-FRESH')
    }
  })

  it('treats an empty or missing last_run as the oldest', () => {
    const state: FleetState = {
      fleet: {
        'QA-FRESH': { level: 3, last_run: '2026-01-05T00:00:00.000Z' },
        'QA-MID': { level: 20, last_run: '' },
        'QA-END': { level: 40, last_run: '2026-01-06T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, ROTATION_FLEET)
    expect(result.member?.name).toBe('QA-MID')
  })

  it('breaks a last_run tie in favour of the member inside its band', () => {
    const fleet: FleetMemberConfig[] = [
      { name: 'OUT', minLevel: 1, maxLevel: 5 },
      { name: 'IN', minLevel: 15, maxLevel: 25 },
    ]
    const state: FleetState = {
      fleet: {
        OUT: { level: 40, last_run: '2026-01-01T00:00:00.000Z' },
        IN: { level: 20, last_run: '2026-01-01T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, fleet)
    expect(result.member?.name).toBe('IN')
    expect(result.bandViolation).toBeNull()
  })

  it('breaks a remaining tie on the oldest created_at', () => {
    const fleet: FleetMemberConfig[] = [
      { name: 'FIRST', minLevel: 1, maxLevel: 99 },
      { name: 'SECOND', minLevel: 1, maxLevel: 99 },
    ]
    const state: FleetState = {
      fleet: {
        FIRST: { level: 10, last_run: '2026-01-01T00:00:00.000Z', created_at: '2026-01-02T00:00:00.000Z' },
        SECOND: { level: 10, last_run: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, fleet)
    expect(result.member?.name).toBe('SECOND')
  })

  it('falls back to the config index instead of alphabetical order', () => {
    const fleet: FleetMemberConfig[] = [
      { name: 'ZETA', minLevel: 1, maxLevel: 99 },
      { name: 'ALPHA', minLevel: 1, maxLevel: 99 },
    ]
    const state: FleetState = {
      fleet: {
        ZETA: { level: 10, last_run: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' },
        ALPHA: { level: 10, last_run: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, fleet)
    expect(result.member?.name).toBe('ZETA')
  })

  it('reports a band violation when the selected member is out of its band', () => {
    const state: FleetState = {
      fleet: {
        'QA-END': { level: 2, last_run: '2026-01-01T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, [ROTATION_FLEET[2]])
    expect(result.member?.name).toBe('QA-END')
    expect(result.bandViolation).toEqual({
      member: ROTATION_FLEET[2],
      level: 2,
      minLevel: 30,
      maxLevel: 99,
    })
  })

  it('returns a null band violation when the level is inside the band', () => {
    const state: FleetState = {
      fleet: {
        'QA-MID': { level: 20, last_run: '2026-01-01T00:00:00.000Z' },
      },
    }
    const result = selectFleetMember(state, [ROTATION_FLEET[1]])
    expect(result.member?.name).toBe('QA-MID')
    expect(result.bandViolation).toBeNull()
  })

  it('returns null member and violation for an empty or disabled fleet', () => {
    expect(selectFleetMember({}, [])).toEqual({ member: null, bandViolation: null })
    expect(selectFleetMember({}, null)).toEqual({ member: null, bandViolation: null })
  })
})
