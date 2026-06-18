import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Arena from '../../pages/Arena'
import { useGame } from '../../context/GameContext'
import { useConnectionGate } from '../../hooks/useConnectionGate'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Character } from '../../types/Character'

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

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>
const mockUseConnectionGate = useConnectionGate as unknown as ReturnType<typeof vi.fn>
const mockUseOnlineStatus = useOnlineStatus as unknown as ReturnType<typeof vi.fn>

const mockCharacter: Character = {
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 3,
  experience: 120,
  strength: 8,
  vitality: 6,
  dexterity: 7,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 40,
  maxHp: 40,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: Date.now(),
  id: 'test-id',
}

describe('Arena offline mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(false),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    })
  })

  it('shows offline banner and disables fight when device is offline', () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: true,
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
    })

    const { getByText, getByRole, queryByRole, getAllByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()

    // Toggle to PvP mode (default is PvE)
    fireEvent.click(getByRole('switch', { name: /PvP mode/i }))

    const fightButton = getAllByRole('button').find(b => b.textContent === 'OFFLINE')
    expect(fightButton).toBeDefined()
    expect(fightButton).toBeDisabled()

    // Retry button was removed from banner
    expect(queryByRole('button', { name: /RETRY/i })).toBeNull()
  })

  it('remains in offline mode when database is unavailable', () => {
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: false,
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
    })

    const { getByText, getByRole, queryByRole, getAllByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()

    // Toggle to PvP mode (default is PvE)
    fireEvent.click(getByRole('switch', { name: /PvP mode/i }))

    const fightButton = getAllByRole('button').find(b => b.textContent === 'OFFLINE')
    expect(fightButton).toBeDefined()
    expect(fightButton).toBeDisabled()

    // Retry button was removed from banner
    expect(queryByRole('button', { name: /RETRY/i })).toBeNull()
  })
})
