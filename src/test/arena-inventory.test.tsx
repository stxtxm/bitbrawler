import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Arena from '../pages/Arena'
import { useGame } from '../context/GameContext'
import { useConnectionGate } from '../hooks/useConnectionGate'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { Character } from '../types/Character'

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}))

vi.mock('../hooks/useConnectionGate', () => ({
  useConnectionGate: vi.fn(),
}))

vi.mock('../hooks/useOnlineStatus', () => ({
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

describe('Arena inventory modal', () => {
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
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: true,
      retryConnection: vi.fn(),
    })
  })

  it('opens inventory modal when backpack is clicked', () => {
    const { getByLabelText, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))
    expect(getByText('INVENTORY')).toBeInTheDocument()
  })

  it('closes inventory modal when close button is clicked', () => {
    const { getByLabelText, queryByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))
    fireEvent.click(getByLabelText('Close inventory'))
    expect(queryByText('INVENTORY')).toBeNull()
  })
})
