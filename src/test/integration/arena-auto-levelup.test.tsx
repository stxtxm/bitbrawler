import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent } from '@testing-library/react'
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

vi.mock('../../hooks/useIdleCombat', () => ({
  useIdleCombat: () => ({
    idleState: {
      isRunning: true, combatLog: [], currentMonsterName: null, currentMonsterId: null,
      currentResult: null, lastActiveTimestamp: Date.now(), totalIdleXpGained: 0,
      totalIdleFights: 0, totalIdleWins: 0,
    },
    offlineGains: null,
    dismissOfflineRecap: vi.fn(),
  }),
}))

vi.mock('../../utils/statUtils', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    autoAllocateStatPoints: vi.fn((character: Character, _points: number) => ({
      ...character,
      statPoints: 0,
    })),
  }
})

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

describe('Arena auto-mode level-up overlay', () => {
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

  it('calls setCharacter and clearXpNotifications when auto-allocating in auto-mode', () => {
    const clearXpNotifications = vi.fn()
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: true, statPoints: 3 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications,
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    // The auto-allocate effect should have fired (setCharacter was called)
    expect(setCharacter).toHaveBeenCalled()
    const updatedChar = setCharacter.mock.calls[0][0] as Character
    expect(updatedChar.statPoints).toBe(0)

    // The fix should also call clearXpNotifications to dismiss the overlay
    expect(clearXpNotifications).toHaveBeenCalled()
  })

  it('does not auto-allocate when auto-mode is off (manual mode)', () => {
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: false, statPoints: 3 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    // Auto-allocate should NOT fire in manual mode
    expect(setCharacter).not.toHaveBeenCalled()
  })

  it('does not auto-allocate when there are no stat points', () => {
    const setCharacter = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: true, statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter,
    })

    renderWithRouter(<Arena />)

    // Auto-allocate should NOT fire when statPoints is 0
    expect(setCharacter).not.toHaveBeenCalled()
  })

  it('shows AUTO MODE button when auto-mode is on with zero stat points after level-up', () => {
    // Simulate end state: auto-mode, no stat points (already allocated)
    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: true, statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter: vi.fn(),
    })

    const { getByRole, queryByText, getAllByRole } = renderWithRouter(<Arena />)

    // The SPEND POINT button should NOT appear (no pending stat points)
    expect(queryByText('SPEND POINT')).toBeNull()

    // Toggle to PvP mode (default is PvE)
    fireEvent.click(getByRole('switch', { name: /PvP mode/i }))

    // The fight button should show AUTO MODE and be disabled
    const fightButton = getAllByRole('button').find(b => b.textContent === 'AUTO MODE')
    expect(fightButton).toBeDefined()
    expect(fightButton).toBeDisabled()
  })

  it('defensive: does not render level-up overlay when autoMode is on with zero stat points', () => {
    // Edge case: lastLevelUp is set (triggers showLevelUp=true) but
    // autoMode is on and statPoints are already 0 (auto-allocated server-side).
    // The defensive useEffect should dismiss the overlay immediately.
    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: true, statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter: vi.fn(),
    })

    const { queryByText } = renderWithRouter(<Arena />)

    // The level-up overlay should not be rendered at all
    expect(queryByText('LEVEL UP')).toBeNull()
    expect(queryByText('SPEND POINT')).toBeNull()
  })

  it('defensive: calls clearXpNotifications when autoMode on with stat points already zero', () => {
    // The defensive useEffect should clear XP notifications
    // when auto-mode is active and character has no pending stat points
    // even if the level-up overlay was triggered by a previous event.
    const clearXpNotifications = vi.fn()

    mockUseGame.mockReturnValue({
      activeCharacter: makeCharacter({ autoMode: true, statPoints: 0 }),
      logout: vi.fn(),
      useFight: vi.fn(),
      startMatchmaking: vi.fn(),
      lastXpGain: null,
      lastLevelUp: Date.now(),
      clearXpNotifications,
      dbAvailable: true,
      saveStatAllocations: vi.fn(),
      rollLootbox: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
      setCharacter: vi.fn(),
    })

    renderWithRouter(<Arena />)

    // The defensive useEffect should have called clearXpNotifications
    expect(clearXpNotifications).toHaveBeenCalled()
  })
})
