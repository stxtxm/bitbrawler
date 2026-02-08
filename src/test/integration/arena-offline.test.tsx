import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
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
  firestoreId: 'test-id',
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
      firebaseAvailable: true,
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
    })

    const { getByText, getByRole, queryByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()
    const fightButton = getByRole('button', { name: 'OFFLINE' })
    expect(fightButton).toBeDisabled()

    // Retry button was removed from banner
    expect(queryByRole('button', { name: /RETRY/i })).toBeNull()
  })

  it('remains in offline mode when Firebase is unavailable', () => {
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: false,
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
    })

    const { getByText, getByRole, queryByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()
    const fightButton = getByRole('button', { name: 'OFFLINE' })
    expect(fightButton).toBeDisabled()

    // Retry button was removed from banner
    expect(queryByRole('button', { name: /RETRY/i })).toBeNull()
  })
})
