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
    const { getByLabelText, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Settings'))
    expect(getByText('SETTINGS')).toBeInTheDocument()
  })

  it('toggles auto mode when switch is clicked', async () => {
    const { getByLabelText, getByRole } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })

    await act(async () => {
      fireEvent.click(autoSwitch)
    })

    const { setAutoMode } = mockUseGame.mock.results[0].value
    expect(setAutoMode).toHaveBeenCalledWith(true)
  })

  it('requires confirmation before deleting character', async () => {
    const { getByLabelText, getByText, queryByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

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
})
