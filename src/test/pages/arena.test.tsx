import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, act, within, screen, waitFor } from '@testing-library/react'
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
  inventory: [],
  lastLootRoll: 0,
}

function makeConnectionGateMock() {
  return {
    ensureConnection: vi.fn().mockResolvedValue(true),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    connectionModal: { open: false, message: '' },
  }
}

function makeGameMock(overrides: Record<string, unknown> = {}) {
  return {
    activeCharacter: mockCharacter,
    logout: vi.fn(),
    useFight: vi.fn(),
    lastXpGain: null,
    lastLevelUp: null,
    clearXpNotifications: vi.fn(),
    dbAvailable: true,
    allocateStatPoint: vi.fn(),
    rollLootbox: vi.fn(),
    startMatchmaking: vi.fn(),
    setAutoMode: vi.fn(),
    deleteCharacter: vi.fn(),
    ...overrides,
  }
}

describe('Arena page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseConnectionGate.mockReturnValue(makeConnectionGateMock())
    mockUseGame.mockReturnValue(makeGameMock())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ──────────────────────────────────────────────
  //  RENDERING TESTS
  // ──────────────────────────────────────────────

  describe('rendering', () => {
    it('renders character name and level', () => {
      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('Test Hero')).toBeInTheDocument()
      expect(getByText('LVL')).toBeInTheDocument()
      expect(getByText('3')).toBeInTheDocument()
    })

    it('renders XP bar with correct progress display', () => {
      const { getByText, container } = renderWithRouter(<Arena />)

      expect(getByText('EXP')).toBeInTheDocument()
      expect(getByText(/\/.*XP/)).toBeInTheDocument()

      const xpBar = container.querySelector('.xp-bar')
      expect(xpBar).toBeInTheDocument()
      expect(xpBar).toHaveStyle({ width: expect.stringMatching(/\d+%/) })
    })

    it('renders HP bar with character maxHp value', () => {
      const { getByText, container } = renderWithRouter(<Arena />)

      expect(getByText('HP')).toBeInTheDocument()
      expect(getByText('40')).toBeInTheDocument()
      const hpBar = container.querySelector('.hp-bar')
      expect(hpBar).toBeInTheDocument()
      expect(hpBar).toHaveStyle({ width: '100%' })
    })

    it('renders all six compact stat labels and values', () => {
      const { getByText, container } = renderWithRouter(<Arena />)

      const statsGrid = container.querySelector('.stats-grid-compact')
      expect(statsGrid).not.toBeNull()

      const labels = ['STR', 'VIT', 'DEX', 'LUK', 'INT', 'FOC']
      labels.forEach((label) => {
        expect(getByText(label)).toBeInTheDocument()
      })

      // Stat values (use getAllByText for values that may duplicate)
      expect(getByText('8')).toBeInTheDocument() // strength
      expect(getByText('6')).toBeInTheDocument() // vitality
      expect(getByText('7')).toBeInTheDocument() // dexterity
      expect(container.querySelectorAll('.compact-stat-value').length).toBe(6)
    })

    it('renders the character avatar (PixelCharacter)', () => {
      const { container } = renderWithRouter(<Arena />)

      const avatarBox = container.querySelector('.avatar-box')
      expect(avatarBox).not.toBeNull()
      const svg = avatarBox?.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('renders header action buttons (settings, inventory, logout)', () => {
      const { getByLabelText } = renderWithRouter(<Arena />)

      expect(getByLabelText('Settings')).toBeInTheDocument()
      expect(getByLabelText('Inventory')).toBeInTheDocument()
    })

    it('shows fight button enabled when online and has fights left', () => {
      const { getByRole } = renderWithRouter(<Arena />)

      const fightButton = getByRole('button', { name: 'FIGHT!' })
      expect(fightButton).toBeInTheDocument()
      expect(fightButton).not.toBeDisabled()
    })

    it('shows daily battle energy status with pips', () => {
      const { getByText, container } = renderWithRouter(<Arena />)

      expect(getByText('BATTLE ENERGY')).toBeInTheDocument()
      expect(getByText('3 / 5 AVAILABLE')).toBeInTheDocument()

      const pips = container.querySelectorAll('.mini-pip')
      expect(pips.length).toBe(5)
      const activePips = container.querySelectorAll('.mini-pip.active')
      const usedPips = container.querySelectorAll('.mini-pip.used')
      expect(activePips.length).toBe(3)
      expect(usedPips.length).toBe(2)
    })

    it('does not show level-up overlay by default', () => {
      const { queryByText } = renderWithRouter(<Arena />)

      expect(queryByText('LEVEL UP')).toBeNull()
      expect(queryByText('NEW RANK!')).toBeNull()
    })

    it('does not show SPEND POINT button when statPoints is 0', () => {
      const { queryByText } = renderWithRouter(<Arena />)

      expect(queryByText('SPEND POINT')).toBeNull()
    })

    it('applies equipment bonuses to displayed stats', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: ['rusty_sword'] },
      }))

      const { getByText } = renderWithRouter(<Arena />)

      // rusty_sword adds +1 strength, so 8 + 1 = 9
      expect(getByText('9')).toBeInTheDocument()
    })
  })

  // ──────────────────────────────────────────────
  //  INTERACTION TESTS
  // ──────────────────────────────────────────────

  describe('interactions', () => {
    it('shows matchmaking state on fight button click', async () => {
      mockUseGame.mockReturnValue(makeGameMock({
        startMatchmaking: vi.fn().mockImplementation(
          () => new Promise(() => {}) // never resolves — keeps matchmaking active
        ),
      }))

      const { getByRole } = renderWithRouter(<Arena />)

      const fightButton = getByRole('button', { name: 'FIGHT!' })
      fireEvent.click(fightButton)

      await waitFor(() => {
        expect(screen.getByText('SEARCHING...')).toBeInTheDocument()
      })
    })

    it('opens inventory modal when backpack button is clicked', () => {
      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('INVENTORY')).toBeInTheDocument()
    })

    it('closes inventory modal when close button is clicked', () => {
      const { getByLabelText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(queryByText('INVENTORY')).toBeInTheDocument()

      fireEvent.click(getByLabelText('Close inventory'))
      expect(queryByText('INVENTORY')).toBeNull()
    })

    it('shows lootbox roll button in inventory modal', () => {
      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('DAILY LOOTBOX')).toBeInTheDocument()
    })

    it('rolls lootbox and shows reward overlay', async () => {
      // Use fake timers so we can advance the 900ms setTimeout inside handleLootboxRoll
      const futureDate = new Date('2025-06-15T12:00:00Z')
      vi.useFakeTimers({ now: futureDate })

      const mockItem = {
        id: 'rusty_sword',
        name: 'Rusty Sword',
        slot: 'weapon' as const,
        rarity: 'common' as const,
        stats: { strength: 1 },
        pixels: [[1, 0], [0, 1]],
        requiredLevel: 1,
      }

      mockUseGame.mockReturnValue(makeGameMock({
        rollLootbox: vi.fn().mockResolvedValue(mockItem),
      }))

      mockUseConnectionGate.mockReturnValue(makeConnectionGateMock())

      const { getByLabelText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      const lootboxBtn = screen.getByLabelText('Daily lootbox roll')

      // Ensure button is enabled
      expect(lootboxBtn).toBeEnabled()

      fireEvent.click(lootboxBtn)

      // Advance timers to trigger the 900ms setTimeout + flush microtasks
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      // The reward overlay should now be visible
      const overlay = screen.getByRole('dialog', { name: 'Lootbox reward' })
      expect(within(overlay).getByText('NEW ITEM')).toBeInTheDocument()
      expect(within(overlay).getByText('Rusty Sword')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('opens settings modal when gear button is clicked', () => {
      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      expect(getByText('SETTINGS')).toBeInTheDocument()
    })

    it('toggles auto mode in settings', async () => {
      const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      const autoSwitch = getByRole('switch', { name: 'Auto mode' })
      expect(autoSwitch).toBeInTheDocument()

      fireEvent.click(autoSwitch)

      await waitFor(() => {
        // Grab the mock return value that was set during render
        const gameMock = mockUseGame.mock.results[0].value
        expect(gameMock.setAutoMode).toHaveBeenCalledWith(true)
      })
    })

    it('shows auto mode switch state as OFF by default', () => {
      const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      const autoSwitch = getByRole('switch', { name: 'Auto mode' })
      expect(autoSwitch).toHaveAttribute('aria-checked', 'false')
    })

    it('shows auto mode switch as ON when character is bot', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, isBot: true },
      }))

      const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      const autoSwitch = getByRole('switch', { name: 'Auto mode' })
      expect(autoSwitch).toHaveAttribute('aria-checked', 'true')
    })

    it('opens combat logs from settings', () => {
      const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('VIEW LOGS'))

      expect(getByText('COMBAT LOGS')).toBeInTheDocument()
      expect(queryByText('SETTINGS')).toBeNull()
    })

    it('navigates back to main settings from combat logs', () => {
      const { getByLabelText, getByText, container } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('VIEW LOGS'))

      // In logs view, the title h2 is "COMBAT LOGS"
      const logsTitle = container.querySelector('.settings-title-row h2')
      expect(logsTitle?.textContent).toBe('COMBAT LOGS')

      fireEvent.click(getByText('BACK'))

      // After going back, the title reverts to SETTINGS
      const settingsTitle = container.querySelector('.settings-title-row h2')
      expect(settingsTitle?.textContent).toBe('SETTINGS')
      // The COMBAT LOGS section label exists in main view too
      expect(getByText('VIEW LOGS')).toBeInTheDocument()
    })

    it('requires confirmation before deleting character', async () => {
      mockUseGame.mockReturnValue(makeGameMock({
        deleteCharacter: vi.fn().mockResolvedValue(true),
      }))

      const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('DELETE'))
      expect(queryByText('CONFIRM DELETE')).toBeInTheDocument()

      fireEvent.click(getByText('CONFIRM DELETE'))

      await waitFor(() => {
        const gameMock = mockUseGame.mock.results[0].value
        expect(gameMock.deleteCharacter).toHaveBeenCalled()
      })
    })

    it('cancels character deletion when CANCEL is clicked', () => {
      const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('DELETE'))
      expect(queryByText('CONFIRM DELETE')).toBeInTheDocument()

      fireEvent.click(getByText('CANCEL'))
      expect(queryByText('CONFIRM DELETE')).toBeNull()
      expect(getByText('DELETE')).toBeInTheDocument()
    })

    it('shows SPEND POINT button when character has stat points', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 2 },
      }))

      const { getByText } = renderWithRouter(<Arena />)
      expect(getByText('SPEND POINT')).toBeInTheDocument()
    })

    it('shows level-up overlay when lastLevelUp is set', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 2 },
        lastLevelUp: { newLevel: 5, levelsGained: 2, statPointsGained: 2 },
      }))

      const { getByText } = renderWithRouter(<Arena />)
      expect(getByText('LEVEL UP')).toBeInTheDocument()
      expect(getByText('NEW RANK!')).toBeInTheDocument()
      expect(getByText('POINTS TO SPEND')).toBeInTheDocument()
    })

    it('allows stat allocation in level-up overlay', async () => {
      const allocateStatPoint = vi.fn().mockResolvedValue(undefined)

      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 2 },
        lastLevelUp: { newLevel: 5, levelsGained: 2, statPointsGained: 2 },
        allocateStatPoint,
      }))

      renderWithRouter(<Arena />)

      expect(screen.getByText('LEVEL UP')).toBeInTheDocument()

      // Click the + button for STR (has aria-label="Increase STR")
      fireEvent.click(screen.getByLabelText('Increase STR'))

      await waitFor(() => {
        expect(allocateStatPoint).toHaveBeenCalledWith('strength')
      })
    })

    it('closes level-up overlay when APPLY is clicked with no stat points left', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 0 },
        lastLevelUp: { newLevel: 5, levelsGained: 2, statPointsGained: 2 },
      }))

      const { getByText, queryByText } = renderWithRouter(<Arena />)

      expect(getByText('LEVEL UP')).toBeInTheDocument()

      fireEvent.click(getByText('APPLY'))

      expect(queryByText('LEVEL UP')).toBeNull()
    })

    it('defers level-up overlay when LATER is clicked', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 2 },
        lastLevelUp: { newLevel: 5, levelsGained: 2, statPointsGained: 2 },
      }))

      const { getByText, queryByText } = renderWithRouter(<Arena />)

      expect(getByText('LEVEL UP')).toBeInTheDocument()

      fireEvent.click(getByText('LATER'))

      expect(queryByText('LEVEL UP')).toBeNull()
    })

    it('shows item details in inventory when hovering an item', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: ['rusty_sword'] },
      }))

      const { getByLabelText, getByText, container } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))

      // Hover over the item slot
      const itemSlot = container.querySelector('.inventory-slot.item-slot')
      expect(itemSlot).not.toBeNull()

      fireEvent.mouseEnter(itemSlot!)

      // Item details should show the item name and bonuses
      expect(getByText('Rusty Sword')).toBeInTheDocument()
      expect(getByText('WEAPON')).toBeInTheDocument()
      expect(getByText('COMMON')).toBeInTheDocument()
    })

    it('shows total bonus summary when equipment is equipped', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: ['rusty_sword'] },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))

      expect(getByText('TOTAL BONUS')).toBeInTheDocument()
    })

    it('does not show total bonus when there are no bonuses', () => {
      const { getByLabelText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(queryByText('TOTAL BONUS')).toBeNull()
    })

    it('shows XP gain popup when lastXpGain is set', () => {
      vi.useFakeTimers()

      mockUseGame.mockReturnValue(makeGameMock({
        lastXpGain: 50,
      }))

      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('+50 XP')).toBeInTheDocument()

      vi.useRealTimers()
    })

    it('shows combat view when fight is initiated', async () => {
      const opponent: Character = {
        seed: 'opp-seed',
        name: 'Rival',
        gender: 'female',
        level: 3,
        experience: 100,
        strength: 7,
        vitality: 5,
        dexterity: 6,
        luck: 4,
        intelligence: 5,
        focus: 4,
        hp: 35,
        maxHp: 35,
        wins: 1,
        losses: 1,
        fightsLeft: 2,
        lastFightReset: Date.now(),
        id: 'opp-id',
      }

      mockUseGame.mockReturnValue(makeGameMock({
        startMatchmaking: vi.fn().mockResolvedValue({
          opponent,
          matchType: 'balanced',
          candidates: [opponent],
        }),
      }))

      const { getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByRole('button', { name: 'FIGHT!' }))

      await waitFor(() => {
        expect(screen.getByText('BALANCED MATCH')).toBeInTheDocument()
      })
    })
  })

  // ──────────────────────────────────────────────
  //  STATE TESTS
  // ──────────────────────────────────────────────

  describe('states', () => {
    it('shows offline banner when device is offline', () => {
      mockUseOnlineStatus.mockReturnValue(false)

      const { getByText, getByRole } = renderWithRouter(<Arena />)

      expect(getByText('OFFLINE MODE')).toBeInTheDocument()
      const fightButton = getByRole('button', { name: 'OFFLINE' })
      expect(fightButton).toBeDisabled()
    })

    it('shows offline state when dbAvailable is false despite being online', () => {
      mockUseOnlineStatus.mockReturnValue(true)
      mockUseGame.mockReturnValue(makeGameMock({ dbAvailable: false }))

      const { getByText, getByRole } = renderWithRouter(<Arena />)

      expect(getByText('OFFLINE MODE')).toBeInTheDocument()
      const fightButton = getByRole('button', { name: 'OFFLINE' })
      expect(fightButton).toBeDisabled()
    })

    it('shows RESOLVING... when character has pending fight', () => {
      const pendingCharacter: Character = {
        ...mockCharacter,
        pendingFight: {
          status: 'matched',
          startedAt: Date.now(),
          opponent: {
            name: 'Pending Opponent',
            gender: 'male',
            seed: 'pending-seed',
            level: 3,
            experience: 100,
            strength: 5,
            vitality: 5,
            dexterity: 5,
            luck: 5,
            intelligence: 5,
            focus: 5,
            hp: 30,
            maxHp: 30,
            wins: 0,
            losses: 0,
            fightsLeft: 5,
            lastFightReset: Date.now(),
          },
        },
      }

      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: pendingCharacter,
      }))

      const { getByRole } = renderWithRouter(<Arena />)

      const fightButton = getByRole('button', { name: 'RESOLVING...' })
      expect(fightButton).toBeDisabled()
    })

    it('shows REST NOW when fightsLeft is 0', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, fightsLeft: 0 },
      }))

      const { getByRole } = renderWithRouter(<Arena />)

      const fightButton = getByRole('button', { name: 'REST NOW' })
      expect(fightButton).toBeDisabled()
    })

    it('shows max level badge when character is max level', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, level: 99, experience: 999999 },
      }))

      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('★ MAX LEVEL ★')).toBeInTheDocument()
    })

    it('shows INVENTORY FULL when inventory is at capacity', () => {
      const fullInventory = Array.from({ length: 24 }, (_, i) => `item_${i}`)

      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: fullInventory },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('INVENTORY FULL')).toBeInTheDocument()
    })

    it('shows inventory slot count', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: ['rusty_sword'] },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('1/24 SLOTS')).toBeInTheDocument()
    })

    it('disables lootbox button when already rolled today', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, lastLootRoll: Date.now() },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      const lootboxBtn = getByText('COME BACK TOMORROW')
      expect(lootboxBtn).toBeInTheDocument()
      expect(lootboxBtn.closest('button')).toBeDisabled()
    })

    it('shows level-up overlay when statPoints > 0 and overlay was deferred', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 1 },
        lastLevelUp: null,
      }))

      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('LEVEL UP')).toBeInTheDocument()
      expect(getByText('CHOOSE A STAT')).toBeInTheDocument()
    })

    it('shows points warning in level-up when offline', () => {
      mockUseOnlineStatus.mockReturnValue(false)
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, statPoints: 2 },
        lastLevelUp: { newLevel: 5, levelsGained: 2, statPointsGained: 2 },
      }))

      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('LEVEL UP')).toBeInTheDocument()
      expect(getByText('CONNECT TO ASSIGN POINTS')).toBeInTheDocument()
    })

    it('disables fight button during matchmaking', async () => {
      mockUseGame.mockReturnValue(makeGameMock({
        startMatchmaking: vi.fn().mockImplementation(
          () => new Promise(() => {})
        ),
      }))

      const { getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByRole('button', { name: 'FIGHT!' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'SEARCHING...' })).toBeDisabled()
      })
    })

    it('shows combat history entries in settings logs', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: {
          ...mockCharacter,
          fightHistory: [
            {
              date: Date.now() - 60000,
              opponentName: 'RIVAL',
              won: true,
              xpGained: 100,
            },
          ],
          incomingFightHistory: [
            {
              date: Date.now() - 30000,
              attackerName: 'NIGHT HUNTER',
              won: false,
              source: 'bot',
            },
          ],
        },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('VIEW LOGS'))

      expect(getByText('WIN')).toBeInTheDocument()
      expect(getByText('VS RIVAL')).toBeInTheDocument()
      expect(getByText('HIT')).toBeInTheDocument()
      expect(getByText('ATTACKED BY NIGHT HUNTER')).toBeInTheDocument()
      expect(getByText('LAST 20 ENCOUNTERS')).toBeInTheDocument()
    })

    it('shows empty history message when no combat activity', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: {
          ...mockCharacter,
          fightHistory: [],
          incomingFightHistory: [],
        },
      }))

      const { getByLabelText, getByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      fireEvent.click(getByText('VIEW LOGS'))

      expect(getByText('NO COMBAT ACTIVITY YET')).toBeInTheDocument()
    })

    it('shows XP gain popup for 2 seconds then hides it', async () => {
      vi.useFakeTimers()

      mockUseGame.mockReturnValue(makeGameMock({
        lastXpGain: 75,
      }))

      const { getByText, queryByText } = renderWithRouter(<Arena />)

      expect(getByText('+75 XP')).toBeInTheDocument()

      await act(async () => {
        vi.advanceTimersByTime(2500)
      })

      expect(queryByText('+75 XP')).toBeNull()

      vi.useRealTimers()
    })

    it('shows MAX XP display for max level character', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, level: 99, experience: 999999 },
      }))

      const { getByText } = renderWithRouter(<Arena />)

      expect(getByText('MAX LEVEL')).toBeInTheDocument()
    })

    it('resets inventory hover/select when inventory closes', () => {
      mockUseGame.mockReturnValue(makeGameMock({
        activeCharacter: { ...mockCharacter, inventory: ['rusty_sword'] },
      }))

      const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('INVENTORY')).toBeInTheDocument()

      fireEvent.click(getByLabelText('Close inventory'))
      expect(queryByText('INVENTORY')).toBeNull()

      // Reopen and verify no item is previewed
      fireEvent.click(getByLabelText('Inventory'))
      expect(getByText('TAP AN ITEM TO VIEW BONUSES')).toBeInTheDocument()
    })

    it('disables auto mode toggle when offline', () => {
      mockUseOnlineStatus.mockReturnValue(false)
      mockUseGame.mockReturnValue(makeGameMock({ dbAvailable: true }))

      const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

      fireEvent.click(getByLabelText('Settings'))
      const autoSwitch = getByRole('switch', { name: 'Auto mode' })
      expect(autoSwitch).toBeDisabled()
    })
  })
})
