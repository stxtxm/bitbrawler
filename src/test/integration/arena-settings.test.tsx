import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, act } from '@testing-library/react'
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

const mockCharacter: Character = {
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
  firestoreId: 'auto-id',
  isBot: false,
  fightHistory: [
    {
      date: Date.now() - 60_000,
      opponentName: 'RIVAL',
      won: true,
      xpGained: 100,
    },
  ],
  incomingFightHistory: [
    {
      date: Date.now() - 30_000,
      attackerName: 'NIGHT HUNTER',
      attackerIsBot: true,
      won: false,
      source: 'bot',
    },
  ],
}

describe('Arena settings modal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      connectionModal: { open: false, message: '' },
    })
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: true,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn().mockResolvedValue(mockCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })
  })

  it('opens settings modal when gear is clicked', () => {
    const { getByLabelText, getByText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    expect(getByText('SETTINGS')).toBeInTheDocument()
  })

  it('toggles auto mode when switch is clicked', async () => {
    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })

    await act(async () => {
      fireEvent.click(autoSwitch)
    })

    const { setAutoMode } = mockUseGame.mock.results[0].value
    expect(setAutoMode).toHaveBeenCalledWith(true)
  })

  it('opens combat logs within settings', () => {
    const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    fireEvent.click(getByText('VIEW LOGS'))

    expect(getByText('COMBAT LOGS')).toBeInTheDocument()
    expect(queryByText('SETTINGS')).toBeNull()
  })

  it('requires confirmation before deleting character', async () => {
    const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const deleteButton = getByText('DELETE')
    fireEvent.click(deleteButton)

    expect(queryByText('CONFIRM DELETE')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(getByText('CONFIRM DELETE'))
    })

    const { deleteCharacter } = mockUseGame.mock.results[0].value
    expect(deleteCharacter).toHaveBeenCalled()
  })

  it('hides attacker type and xp details in combat logs', () => {
    const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    fireEvent.click(getByText('VIEW LOGS'))

    expect(getByText('ATTACKED BY NIGHT HUNTER')).toBeInTheDocument()
    expect(queryByText(/\[BOT\]/i)).toBeNull()
    expect(queryByText(/\[PLAYER\]/i)).toBeNull()
    expect(queryByText(/^NO XP$/i)).toBeNull()
    expect(queryByText(/\+\d+\s*XP/i)).toBeNull()
  })
})
