import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, within } from '@testing-library/react'
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
  lastLootRoll: 0,
  inventory: [],
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
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      firebaseAvailable: true,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('shows lootbox reward overlay after rolling', async () => {
    vi.useFakeTimers()

    const mockItem = {
      id: 'rusty_sword',
      name: 'Rusty Sword',
      slot: 'weapon',
      rarity: 'common',
      stats: { strength: 1 },
      pixels: [[1, 0], [0, 1]],
      requiredLevel: 1,
    }

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
      rollLootbox: vi.fn().mockResolvedValue(mockItem),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn(),
      deleteCharacter: vi.fn(),
    })

    const { getByLabelText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))
    fireEvent.click(getByLabelText('Daily lootbox roll'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    const overlay = getByLabelText('Lootbox reward')
    expect(within(overlay).getByText('NEW ITEM')).toBeInTheDocument()
    expect(within(overlay).getByText('Rusty Sword')).toBeInTheDocument()
  })
})
