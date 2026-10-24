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
  getXpRequiredForNextLevel,
  getTotalXpForLevel,
  parseProgressionCurve,
  parseResultXpPopup,
} from '../../utils/qa-bot-helpers'

describe('qa-bot-helpers combat speed', () => {
  describe('constants', () => {
    it('exports correct storage key', () => {
      expect(COMBAT_SPEED_STORAGE_KEY).toBe('bitbrawler_combat_speed')
    })
    it('exports options [1,2]', () => {
      expect(COMBAT_SPEED_OPTIONS).toEqual([1, 2])
    })
    it('exports toggle selectors', () => {
      expect(COMBAT_SPEED_TOGGLE_SELECTOR).toBe('.combat-speed-toggle')
      expect(COMBAT_SPEED_SETTINGS_SELECTOR).toBe('button[aria-label="Combat speed"]')
    })
  })

  describe('isCombatSpeed', () => {
    it('returns true for 1 and 2', () => {
      expect(isCombatSpeed(1)).toBe(true)
      expect(isCombatSpeed(2)).toBe(true)
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
    it('returns 1 or 2 when valid', () => {
      expect(parseCombatSpeed(1)).toBe(1)
      expect(parseCombatSpeed(2)).toBe(2)
    })
    it('returns null for invalid', () => {
      expect(parseCombatSpeed(0)).toBeNull()
      expect(parseCombatSpeed(3)).toBeNull()
      expect(parseCombatSpeed(null)).toBeNull()
      expect(parseCombatSpeed('1')).toBeNull()
    })
  })

  describe('parseCombatSpeedText', () => {
    it('parses x1 and x2 variants', () => {
      expect(parseCombatSpeedText('x1')).toBe(1)
      expect(parseCombatSpeedText('x2')).toBe(2)
      expect(parseCombatSpeedText('⏩ x1')).toBe(1)
      expect(parseCombatSpeedText('⏩ x2')).toBe(2)
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
    })
  })

  describe('getCombatSpeedFromStorageRaw', () => {
    it('parses valid JSON stored values', () => {
      expect(getCombatSpeedFromStorageRaw('1')).toBe(1)
      expect(getCombatSpeedFromStorageRaw('2')).toBe(2)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(1))).toBe(1)
      expect(getCombatSpeedFromStorageRaw(JSON.stringify(2))).toBe(2)
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
    it('toggles 1 -> 2 and 2 -> 1', () => {
      expect(nextCombatSpeed(1)).toBe(2)
      expect(nextCombatSpeed(2)).toBe(1)
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
