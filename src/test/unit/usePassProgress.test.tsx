import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getPassSnapshot, addPassXp, setPassXp, claimPassReward, resetPassProgress } from '../../hooks/usePassProgress'
import { usePassProgress } from '../../hooks/usePassProgress'
import * as GameContext from '../../context/GameContext'

const STORAGE_KEY = 'bitbrawler_pass_progress'

function mockGame(passProgress?: { xp: number; claimed: number[]; seasonId?: string }) {
  const char = passProgress ? { id: '1', name: 'Test', passProgress } as any : null
  vi.spyOn(GameContext, 'useGame').mockReturnValue({
    activeCharacter: char,
    loading: false,
    dbAvailable: true,
    lastXpGain: null,
    lastLevelUp: null,
    login: vi.fn(),
    logout: vi.fn(),
    setCharacter: vi.fn(),
    updatePushSubscription: vi.fn(),
    retryConnection: vi.fn(),
    useFight: vi.fn(),
    useBossFight: vi.fn(),
    findOpponent: vi.fn(),
    startMatchmaking: vi.fn(),
    clearXpNotifications: vi.fn(),
    allocateStatPoint: vi.fn(),
    saveStatAllocations: vi.fn(),
    saveEquipment: vi.fn(),
    rollLootbox: vi.fn(),
    setAutoMode: vi.fn(),
    deleteCharacter: vi.fn(),
    syncCharacterToBackend: vi.fn(),
    essence: 0,
    addEssence: vi.fn(),
    spendEssence: vi.fn(),
    salvageItems: vi.fn(),
    fuseItems: vi.fn(),
    upgradeItem: vi.fn(),
    buyShopOffer: vi.fn(),
    rerollShopOffers: vi.fn(),
    lastUnlockedMedal: null,
    clearMedalNotification: vi.fn(),
    pityCount: 0,
  } as any)
}

describe('usePassProgress pure exports', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPassProgress()
    vi.restoreAllMocks()
  })

  it('getPassSnapshot default 0', () => {
    const s = getPassSnapshot()
    expect(s.xp).toBe(0)
    expect(s.claimed).toEqual([])
    expect(s.seasonId).toMatch(/^season-\d+$/)
  })

  it('setPassXp persiste en localStorage', () => {
    setPassXp(250)
    expect(getPassSnapshot().xp).toBe(250)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(raw.xp).toBe(250)
  })

  it('addPassXp incremente', () => {
    setPassXp(100)
    addPassXp(50)
    expect(getPassSnapshot().xp).toBe(150)
    addPassXp(10)
    expect(getPassSnapshot().xp).toBe(160)
  })

  it('addPassXp ignore valeurs invalides', () => {
    setPassXp(100)
    addPassXp(-5)
    expect(getPassSnapshot().xp).toBe(100)
    addPassXp(NaN)
    expect(getPassSnapshot().xp).toBe(100)
  })

  it('claimPassReward bloque si level non atteint', () => {
    setPassXp(50)
    const res = claimPassReward(1)
    expect(res).toBeNull()
    expect(getPassSnapshot().claimed).toEqual([])
  })

  it('claimPassReward reussit quand level atteint', () => {
    setPassXp(150)
    const res = claimPassReward(1)
    expect(res).not.toBeNull()
    expect(res!.claimed).toContain(1)
  })

  it('claimPassReward bloque double claim', () => {
    setPassXp(500)
    claimPassReward(1)
    const second = claimPassReward(1)
    expect(second).toBeNull()
    expect(getPassSnapshot().claimed.filter(v => v === 1)).toHaveLength(1)
  })

  it('claimPassReward hors bornes => null', () => {
    setPassXp(5000)
    expect(claimPassReward(0)).toBeNull()
    expect(claimPassReward(21)).toBeNull()
  })

  it('reset vide xp et claimed', () => {
    setPassXp(300)
    claimPassReward(1)
    claimPassReward(2)
    resetPassProgress()
    const s = getPassSnapshot()
    expect(s.xp).toBe(0)
    expect(s.claimed).toEqual([])
  })

  it('persistance via localStorage pattern useSound', () => {
    setPassXp(200)
    claimPassReward(1)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(raw.xp).toBe(200)
    expect(raw.claimed).toContain(1)
    expect(raw.seasonId).toBeDefined()
  })
})

describe('usePassProgress hook', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPassProgress()
    vi.restoreAllMocks()
  })

  it('expose xp, level, nextXp, progress depuis localStorage', () => {
    mockGame()
    setPassXp(150)
    const { result } = renderHook(() => usePassProgress())
    expect(result.current.xp).toBe(150)
    expect(result.current.level).toBe(1)
    expect(result.current.nextXp).toBe(200)
    expect(result.current.progress).toBeCloseTo(0.5)
  })

  it('reutilise useGame sans nouveau systeme', () => {
    mockGame({ xp: 300, claimed: [1, 2] })
    setPassXp(100)
    const { result } = renderHook(() => usePassProgress())
    expect(result.current.xp).toBe(300)
    expect(result.current.claimed).toEqual(expect.arrayContaining([1, 2]))
  })

  it('addXp met a jour le hook', () => {
    mockGame()
    const { result } = renderHook(() => usePassProgress())
    act(() => { result.current.addXp(120) })
    expect(result.current.xp).toBe(120)
    expect(result.current.level).toBe(1)
  })

  it('claim via hook', () => {
    mockGame()
    const { result } = renderHook(() => usePassProgress())
    act(() => { result.current.addXp(250) })
    act(() => { result.current.claim(2) })
    expect(result.current.claimed).toContain(2)
  })

  it('canClaim false si deja claim ou level non atteint', () => {
    mockGame()
    const { result } = renderHook(() => usePassProgress())
    act(() => { result.current.addXp(150) })
    expect(result.current.canClaim(1)).toBe(true)
    expect(result.current.canClaim(5)).toBe(false)
    act(() => { result.current.claim(1) })
    expect(result.current.canClaim(1)).toBe(false)
  })

  it('merge max xp entre local et remote (pas de migration)', () => {
    setPassXp(500)
    mockGame({ xp: 200, claimed: [1] })
    const { result } = renderHook(() => usePassProgress())
    expect(result.current.xp).toBe(500)
    expect(result.current.claimed).toContain(1)
  })

  it('persistance locale: deux hooks partagent le meme state', () => {
    mockGame()
    const { result: a } = renderHook(() => usePassProgress())
    const { result: b } = renderHook(() => usePassProgress())
    act(() => { a.current.addXp(100) })
    expect(b.current.xp).toBe(100)
  })
})
