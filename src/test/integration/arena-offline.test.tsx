import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
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
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: true,
      retryConnection: vi.fn(),
    })

    const { getByText, getByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()
    const fightButton = getByRole('button', { name: 'OFFLINE' })
    expect(fightButton).toBeDisabled()
    const retryButton = getByRole('button', { name: 'Retry connection' })
    expect(retryButton).toBeDisabled()
  })

  it('allows retry when online but Firebase is unavailable', async () => {
    mockUseOnlineStatus.mockReturnValue(true)
    const retryConnection = vi.fn().mockResolvedValue(false)
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: false,
      retryConnection,
    })

    const { getByText, getByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    expect(getByText('OFFLINE MODE')).toBeInTheDocument()
    const retryButton = getByRole('button', { name: 'Retry connection' })
    expect(retryButton).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(retryButton)
      await Promise.resolve()
    })
    expect(retryConnection).toHaveBeenCalled()
  })
})
