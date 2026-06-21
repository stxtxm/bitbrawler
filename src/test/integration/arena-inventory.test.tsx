import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Arena from '../../pages/Arena'
import { useGame } from '../../context/GameContext'
import { useConnectionGate } from '../../hooks/useConnectionGate'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Character } from '../../types/Character'
import { ESSENCE_YIELD } from '../../data/forgeConstants'

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
  id: 'test-id',
  lastLootRoll: 0,
  inventory: [],
}

function makeDefaultGameMock(overrides: Record<string, unknown> = {}) {
  return {
    activeCharacter: mockCharacter,
    logout: vi.fn(),
    useFight: vi.fn(),
    findOpponent: vi.fn(),
    lastXpGain: null,
    lastLevelUp: null,
    clearXpNotifications: vi.fn(),
    dbAvailable: true,
    retryConnection: vi.fn(),
    allocateStatPoint: vi.fn(),
    rollLootbox: vi.fn(),
    startMatchmaking: vi.fn(),
    setAutoMode: vi.fn(),
    deleteCharacter: vi.fn(),
    salvageItems: vi.fn(),
    setCharacter: vi.fn(),
    saveEquipment: vi.fn().mockResolvedValue(null),
    syncCharacterToBackend: vi.fn(),
    essence: 0,
    ...overrides,
  }
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
    mockUseGame.mockReturnValue(makeDefaultGameMock())
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

    mockUseGame.mockReturnValue(makeDefaultGameMock({
      rollLootbox: vi.fn().mockResolvedValue(mockItem),
    }))

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

  // ─── Forge Integration Tests ──────────────────────────────────────────────

  it('shows upgrade level badge on items with upgrades', () => {
    const charWithUpgrades: Character = {
      ...mockCharacter,
      inventory: ['rusty_sword'],
      itemUpgrades: { rusty_sword: 2 },
      essence: 50,
    }
    mockUseGame.mockReturnValue(makeDefaultGameMock({
      activeCharacter: charWithUpgrades,
      essence: 50,
    }))

    const { getByLabelText, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))
    expect(getByText('+2')).toBeInTheDocument()
  })

  it('shows salvage button and essence yield when item is selected and onSalvage is provided', () => {
    const salvageItems = vi.fn().mockResolvedValue({
      ...mockCharacter,
      inventory: [],
      essence: ESSENCE_YIELD.common,
    })
    const charWithItem: Character = {
      ...mockCharacter,
      inventory: ['rusty_sword'],
      essence: ESSENCE_YIELD.common + 5,
    }
    mockUseGame.mockReturnValue(makeDefaultGameMock({
      activeCharacter: charWithItem,
      essence: ESSENCE_YIELD.common + 5,
      salvageItems,
    }))

    const { getByLabelText, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))

    // Click on the rusty sword to select it (it's the only item)
    const equipBtn = getByLabelText('Equip Rusty Sword')
    fireEvent.click(equipBtn)

    // Now the detail view should show salvage info
    expect(getByText('SALVAGE YIELD')).toBeInTheDocument()
    expect(getByText(new RegExp(`${ESSENCE_YIELD.common} Essence`))).toBeInTheDocument()
    expect(getByText('SALVAGE')).toBeInTheDocument()
  })

  it('shows essence total display when essence > 0', () => {
    const charWithEssence: Character = {
      ...mockCharacter,
      inventory: ['rusty_sword'],
      essence: 42,
    }
    mockUseGame.mockReturnValue(makeDefaultGameMock({
      activeCharacter: charWithEssence,
      essence: 42,
    }))

    const { getByLabelText, getByText } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Arena />
      </MemoryRouter>
    )

    fireEvent.click(getByLabelText('Inventory'))

    // Click item to select it and view details (essence total shows in detail view)
    const equipBtn = getByLabelText('Equip Rusty Sword')
    fireEvent.click(equipBtn)

    // Essence total should be visible
    expect(getByText('42')).toBeInTheDocument()
    expect(getByText('ESSENCE')).toBeInTheDocument()
  })
})
