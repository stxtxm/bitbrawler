import { describe, it, expect, vi, beforeEach } from 'vitest'
import Arena from '../../pages/Arena'
import { useGame } from '../../context/GameContext'
import { useConnectionGate } from '../../hooks/useConnectionGate'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Character } from '../../types/Character'
import { renderWithRouter } from '../utils/router'

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}))

vi.mock('../../hooks/useConnectionGate', () => ({
  useConnectionGate: vi.fn(),
}))

vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>
const mockUseConnectionGate = useConnectionGate as unknown as ReturnType<typeof vi.fn>
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  seed: 'test-seed',
  name: 'Auto Hero',
  gender: 'male',
  level: 4,
  experience: 160,
  strength: 8,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 45,
  maxHp: 45,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: Date.now(),
  id: 'auto-id',
  isBot: false,
  autoMode: false,
  statPoints: 0,
  ...overrides,
})

describe('Arena auto-level-up', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    })
  })

  it('auto-allocates stat points when statPoints > 0 (no autoMode required)', () => {
    const clearXpNotifications = vi.fn()
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ statPoints: 3 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications,
      dbAvailable: true,
      saveStatAllocations: vi.fn().mockResolvedValue(null),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    expect(setCharacter).toHaveBeenCalled()
    const updatedChar = setCharacter.mock.calls[0][0] as Character
    expect(updatedChar.statPoints).toBe(0)
  })

  it('does not auto-allocate when statPoints is 0', () => {
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn().mockResolvedValue(null),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    expect(setCharacter).not.toHaveBeenCalled()
  })

  it('no longer shows level-up overlay or SPEND POINT badge', () => {
    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn().mockResolvedValue(null),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter: vi.fn(),
    })

    const { queryByText } = renderWithRouter(<Arena />)

    expect(queryByText('LEVEL UP')).toBeNull()
    expect(queryByText('SPEND POINT')).toBeNull()
  })

  it('calls saveStatAllocations with the allocated stats', () => {
    const saveStatAllocations = vi.fn().mockResolvedValue(null)
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ statPoints: 1 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations,
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    expect(saveStatAllocations).toHaveBeenCalled()
  })
})
