import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Arena from '../../pages/Arena'
import { useGame } from '../../context/GameContext'
import { useConnectionGate } from '../../hooks/useConnectionGate'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { Character } from '../../types/Character'
import { renderWithRouter } from '../utils/router'

// Track openModal calls for offline mode tests
const mockOpenModal = vi.fn()

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
  id: 'auto-id',
  isBot: false,
  autoMode: false,
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
    mockOpenModal.mockClear()
    mockUseConnectionGate.mockReturnValue({
      ensureConnection: vi.fn().mockResolvedValue(true),
      openModal: mockOpenModal,
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
      dbAvailable: true,
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

  it('renders auto mode as enabled from character state', () => {
    mockUseGame.mockReturnValue({
      activeCharacter: { ...mockCharacter, autoMode: true },
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
      setAutoMode: vi.fn().mockResolvedValue({ ...mockCharacter, autoMode: true }),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    expect(getByRole('switch', { name: 'Auto mode' })).toHaveAttribute('aria-checked', 'true')
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

  it('hides attacker type and xp details in combat logs', async () => {
    const { getByLabelText, getByText, queryByText } = renderWithRouter(<Arena />)

    const user = userEvent.setup()
    const pvpToggle = screen.getAllByRole('switch', { name: 'PvP mode' })[0]
    await user.click(pvpToggle)

    fireEvent.click(getByLabelText('Settings'))
    fireEvent.click(getByText('VIEW LOGS'))

    expect(getByText('ATTACKED BY NIGHT HUNTER')).toBeInTheDocument()
    expect(queryByText(/\[BOT\]/i)).toBeNull()
    expect(queryByText(/\[PLAYER\]/i)).toBeNull()
    expect(queryByText(/\+\d+\s*XP/i)).toBeNull()
  })

  it('disables fight button and shows AUTO MODE when auto mode is on', async () => {
    mockUseGame.mockReturnValue({
      activeCharacter: { ...mockCharacter, autoMode: true },
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
      setAutoMode: vi.fn().mockResolvedValue({ ...mockCharacter, autoMode: true }),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByRole } = renderWithRouter(<Arena />)

    const user = userEvent.setup()
    const pvpToggle = screen.getAllByRole('switch', { name: 'PvP mode' })[0]
    await user.click(pvpToggle)

    const fightButton = getByRole('button', { name: 'AUTO MODE' })
    expect(fightButton).toBeDisabled()
  })

  it('shows FIGHT! when auto mode is off and has energy', async () => {
    const { getByRole } = renderWithRouter(<Arena />)

    const user = userEvent.setup()
    const pvpToggle = screen.getAllByRole('switch', { name: 'PvP mode' })[0]
    await user.click(pvpToggle)

    const fightButton = getByRole('button', { name: 'FIGHT!' })
    expect(fightButton).not.toBeDisabled()
  })

  it('renders auto mode and sound switches as distinct elements in settings', () => {
    const { getByLabelText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))

    // Both switches should exist with distinct aria-labels
    const autoSwitch = screen.getByRole('switch', { name: 'Auto mode' })
    const soundSwitch = screen.getByRole('switch', { name: 'Sound' })

    expect(autoSwitch).toBeInTheDocument()
    expect(soundSwitch).toBeInTheDocument()
    expect(autoSwitch).not.toBe(soundSwitch)

    // Auto mode switch has the pixel-switch class
    expect(autoSwitch.className).toContain('pixel-switch')
    expect(soundSwitch.className).toContain('pixel-switch')

    // Each switch has aria-checked
    expect(autoSwitch).toHaveAttribute('aria-checked')
    expect(soundSwitch).toHaveAttribute('aria-checked')
  })

  it('sound toggle click does not trigger auto mode change', () => {
    mockUseGame.mockReturnValue({
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
      setAutoMode: vi.fn().mockResolvedValue(mockCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByLabelText } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))

    const soundSwitch = screen.getByRole('switch', { name: 'Sound' })
    fireEvent.click(soundSwitch)

    // setAutoMode should NOT have been called by clicking the sound switch
    const { setAutoMode } = mockUseGame.mock.results[0].value
    expect(setAutoMode).not.toHaveBeenCalled()
  })

  it('disables auto-mode switch in offline mode (dbAvailable false)', () => {
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: false,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn().mockResolvedValue(mockCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })
    expect(autoSwitch).toBeDisabled()
  })

  it('disables auto-mode switch in offline mode (useOnlineStatus false)', () => {
    mockUseOnlineStatus.mockReturnValue(false)

    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })
    expect(autoSwitch).toBeDisabled()
  })

  it('does not call setAutoMode when clicking disabled auto-mode switch in offline mode', async () => {
    mockUseGame.mockReturnValue({
      activeCharacter: mockCharacter,
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: false,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn().mockResolvedValue(mockCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })

    // Button is disabled, so its onClick handler won't fire
    expect(autoSwitch).toBeDisabled()

    // Attempt click — disabled buttons don't trigger handlers in React
    await act(async () => {
      fireEvent.click(autoSwitch)
    })

    // setAutoMode should NOT have been called (disabled button prevents it)
    const { setAutoMode } = mockUseGame.mock.results[0].value
    expect(setAutoMode).not.toHaveBeenCalled()
  })

  it('renders auto-mode switch with correct aria-checked even when disabled in offline mode', () => {
    mockUseGame.mockReturnValue({
      activeCharacter: { ...mockCharacter, autoMode: true },
      logout: vi.fn(),
      useFight: vi.fn(),
      findOpponent: vi.fn(),
      lastXpGain: null,
      lastLevelUp: null,
      clearXpNotifications: vi.fn(),
      dbAvailable: false,
      retryConnection: vi.fn(),
      allocateStatPoint: vi.fn(),
      rollLootbox: vi.fn(),
      startMatchmaking: vi.fn(),
      setAutoMode: vi.fn().mockResolvedValue(mockCharacter),
      deleteCharacter: vi.fn().mockResolvedValue(true),
    })

    const { getByLabelText, getByRole } = renderWithRouter(<Arena />)

    fireEvent.click(getByLabelText('Settings'))
    const autoSwitch = getByRole('switch', { name: 'Auto mode' })
    // Switch should show the correct state (true) even though disabled
    expect(autoSwitch).toHaveAttribute('aria-checked', 'true')
    expect(autoSwitch).toBeDisabled()
  })
})
