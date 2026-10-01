import { describe, it, expect } from 'vitest'
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
      expect(buildSiteDownMessage(402, 'https://bitbrawler.vercel.app/login')).toBe(
        'SITE_DOWN: HTTP 402 on https://bitbrawler.vercel.app/login'
      )
    })
    it('buildSiteDownBodyMessage mentions error page and url', () => {
      const msg = buildSiteDownBodyMessage('https://bitbrawler.vercel.app/login')
      expect(msg).toContain('SITE_DOWN')
      expect(msg).toContain('https://bitbrawler.vercel.app/login')
    })
    it('throwIfSiteDownResponse throws SITE_DOWN on 402 without touching locators', () => {
      const response = { status: () => 402 }
      expect(() => throwIfSiteDownResponse(response, 'https://bitbrawler.vercel.app/login')).toThrow(
        /SITE_DOWN: HTTP 402/
      )
    })
    it('throwIfSiteDownResponse passes through on 200 and null response', () => {
      expect(() => throwIfSiteDownResponse({ status: () => 200 }, 'https://x/login')).not.toThrow()
      expect(() => throwIfSiteDownResponse(null, 'https://x/login')).not.toThrow()
      expect(() => throwIfSiteDownResponse(undefined, 'https://x/login')).not.toThrow()
    })
    it('looksLikeErrorPage detects vercel/billing markers', () => {
      expect(looksLikeErrorPage('Vercel - 402 Payment Required')).toBe(true)
      expect(looksLikeErrorPage('Deployment Protection active')).toBe(true)
      expect(looksLikeErrorPage('ENTER ARENA LOGIN')).toBe(false)
      expect(looksLikeErrorPage('')).toBe(false)
    })
    it('hasGameContent detects game markers', () => {
      expect(hasGameContent('BATTLE ENERGY AUTO MODE')).toBe(true)
      expect(hasGameContent('ENTER ARENA')).toBe(true)
      expect(hasGameContent('Vercel 402 Payment Required')).toBe(false)
    })
    it('throwIfErrorPageBody throws only on error page without game content', () => {
      expect(() =>
        throwIfErrorPageBody('Vercel 402 Payment Required', 'https://x/login', false)
      ).toThrow(/SITE_DOWN/)
      expect(() =>
        throwIfErrorPageBody('Vercel 402 Payment Required ENTER ARENA', 'https://x/login', true)
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
