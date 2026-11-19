import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Character } from '../../types/Character'
import {
  ACTIVE_WIN_BONUS,
  countActiveWinsToday,
  getActiveWinXpMultiplier,
} from '../../utils/activeBonusUtils'

const NOW = new Date('2026-11-19T12:00:00Z')
const TODAY = NOW.getTime()
const YESTERDAY = new Date('2026-11-18T12:00:00Z').getTime()

const makeCharacter = (overrides?: Partial<Character>): Character => ({
  seed: 'seed',
  name: 'Hero',
  gender: 'male',
  level: 10,
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
  lastFightReset: TODAY,
  fightHistory: [],
  ...overrides,
})

const win = (date: number) => ({ date, opponentName: 'Foe', won: true })
const loss = (date: number) => ({ date, opponentName: 'Foe', won: false })

describe('active win XP bonus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('grants the multiplier to a win with no fight history', () => {
    const char = makeCharacter()
    expect(getActiveWinXpMultiplier(char, true)).toBe(ACTIVE_WIN_BONUS.XP_MULTIPLIER)
  })

  it('never boosts a loss', () => {
    const char = makeCharacter()
    expect(getActiveWinXpMultiplier(char, false)).toBe(1)
  })

  it('keeps the multiplier for the first three wins of the day', () => {
    for (const wins of [1, 2]) {
      const history = Array.from({ length: wins }, () => win(TODAY))
      expect(getActiveWinXpMultiplier(makeCharacter({ fightHistory: history }), true)).toBe(
        ACTIVE_WIN_BONUS.XP_MULTIPLIER,
      )
    }
  })

  it('drops the multiplier once the third win of the day is recorded', () => {
    const history = [win(TODAY), win(TODAY), win(TODAY)]
    expect(getActiveWinXpMultiplier(makeCharacter({ fightHistory: history }), true)).toBe(1)
  })

  it('ignores wins from a previous day', () => {
    const history = [win(YESTERDAY), win(YESTERDAY), win(YESTERDAY), win(TODAY)]
    expect(countActiveWinsToday(makeCharacter({ fightHistory: history }))).toBe(1)
    expect(getActiveWinXpMultiplier(makeCharacter({ fightHistory: history }), true)).toBe(
      ACTIVE_WIN_BONUS.XP_MULTIPLIER,
    )
  })

  it('ignores losses when counting the daily wins', () => {
    const history = [loss(TODAY), loss(TODAY), win(TODAY)]
    expect(countActiveWinsToday(makeCharacter({ fightHistory: history }))).toBe(1)
  })

  it('uses the Paris day boundary, not the UTC one', () => {
    const beforeParisMidnight = new Date('2026-11-18T22:30:00Z').getTime()
    vi.setSystemTime(new Date('2026-11-18T22:45:00Z'))
    const history = [win(beforeParisMidnight)]
    expect(countActiveWinsToday(makeCharacter({ fightHistory: history }))).toBe(1)

    vi.setSystemTime(new Date('2026-11-18T23:30:00Z'))
    expect(countActiveWinsToday(makeCharacter({ fightHistory: history }))).toBe(0)
  })
})
