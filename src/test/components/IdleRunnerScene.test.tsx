import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IdleRunnerScene } from '../../components/IdleRunnerScene'

// Mock PixelCharacter — renders a simple div with provided props
vi.mock('../../components/PixelCharacter', () => ({
  PixelCharacter: ({ seed }: { seed: string }) => (
    <div data-testid="pixel-character" data-seed={seed}>CHAR</div>
  ),
}))

// Mock PixelMonster — renders a simple div
vi.mock('../../components/PixelMonster', () => ({
  PixelMonster: ({ monsterId }: { monsterId: string }) => (
    <div data-testid="pixel-monster" data-monster={monsterId}>MONSTER</div>
  ),
}))

// Mock ParticleSystem
vi.mock('../../utils/particleSystem', () => ({
  ParticleSystem: class {
    mount() { /* noop */ }
    destroy() { /* noop */ }
    emit() { /* noop */ }
  },
}))

// Mock useLowPerformanceMode
vi.mock('../../hooks/useLowPerformanceMode', () => ({
  useLowPerformanceMode: () => false,
}))

// Mock monsterVisualScale
vi.mock('../../utils/monsterVisualScale', () => ({
  monsterScaleFor: () => 1,
}))

describe('IdleRunnerScene', () => {
  const defaultProps = {
    character: {
      seed: 'test-seed',
      gender: 'male' as const,
      level: 5,
      name: 'Hero',
      experience: 120,
      strength: 8,
      vitality: 7,
      dexterity: 6,
      luck: 5,
      intelligence: 4,
      focus: 5,
      hp: 50,
      maxHp: 50,
      wins: 0,
      losses: 0,
      fightsLeft: 3,
      lastFightReset: Date.now(),
    },
    currentMonster: 'goblin' as const,
    scenePhase: 'running' as const,
    lastCombatResult: null,
    lastCombatXp: 0,
    offlineGains: null,
    onClearOfflineGains: vi.fn(),
    recentLevelUp: null,
    currentStreak: 0,
    streakMilestone: null,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    defaultProps.onClearOfflineGains.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows level-up FX when recentLevelUp is provided', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 6, isMilestone: false }}
      />,
    )

    // The level-up glow should be visible
    const container = screen.getByText('LVL 6')
    expect(container).toBeInTheDocument()
    expect(container.className).toContain('levelup-float-lvl')
  })

  it('does not show level-up FX when recentLevelUp is null', () => {
    render(<IdleRunnerScene {...defaultProps} />)

    expect(screen.queryByText(/LVL/)).not.toBeInTheDocument()
  })

  it('shows milestone ceremony for milestone levels', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 10, isMilestone: true }}
      />,
    )

    const lvlText = screen.getByText('LVL 10')
    expect(lvlText).toBeInTheDocument()
    // Milestone should render — the float text is present
    expect(screen.getByText('⬆')).toBeInTheDocument()
  })

  it('dismisses level-up FX when clicking on the container', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 6, isMilestone: false }}
      />,
    )

    // Level-up FX should be visible initially
    expect(screen.getByText('LVL 6')).toBeInTheDocument()

    // Click on the idle runner box container
    const container = screen.getByText('LVL 6').closest('.idle-runner-box')
    expect(container).not.toBeNull()
    if (container) {
      fireEvent.click(container)
    }

    // Level-up FX should be dismissed immediately
    expect(screen.queryByText('LVL 6')).not.toBeInTheDocument()
  })

  it('dismisses level-up FX after 2000ms auto-dismiss timer', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 6, isMilestone: false }}
      />,
    )

    // Level-up FX should be visible initially
    expect(screen.getByText('LVL 6')).toBeInTheDocument()

    // Fast-forward 2000ms
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Level-up FX should be dismissed by auto-timer
    expect(screen.queryByText('LVL 6')).not.toBeInTheDocument()
  })

  it('does not render the legacy level-up-pop-overlay class', () => {
    const { container } = render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 6, isMilestone: false }}
      />,
    )

    expect(container.querySelector('.level-up-pop-overlay')).toBeNull()
  })

  it('does not render card-shine element', () => {
    const { container } = render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 6, isMilestone: false }}
      />,
    )

    expect(container.querySelector('.card-shine')).toBeNull()
  })

  it('shows no Continue button when level-up FX is active (auto-dismiss + tap instead)', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        recentLevelUp={{ newLevel: 5, isMilestone: false }}
      />,
    )

    expect(screen.getByText('LVL 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument()
  })

  it('renders the offline gains popup with a CLAIM REWARDS button', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        offlineGains={{ fights: 12, xp: 500, levels: 2, essence: 3.5, timeAway: 3600000 }}
      />,
    )

    expect(screen.getByText(/WELCOME BACK/i)).toBeInTheDocument()
    expect(screen.getByText('+500')).toBeInTheDocument()
    expect(screen.getByText(/1h 0m/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /claim rewards/i })).toBeInTheDocument()
  })

  it('dismisses the offline popup when clicking CLAIM REWARDS', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        offlineGains={{ fights: 12, xp: 500, levels: 2, essence: 3.5, timeAway: 3600000 }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /claim rewards/i }))

    expect(defaultProps.onClearOfflineGains).toHaveBeenCalled()
  })

  it('dismisses the offline popup when tapping it', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        offlineGains={{ fights: 12, xp: 500, levels: 2, essence: 3.5, timeAway: 3600000 }}
      />,
    )

    const popup = screen.getByText(/WELCOME BACK/i).closest('.idle-offline-notification')
    expect(popup).not.toBeNull()
    if (popup) {
      fireEvent.click(popup)
    }

    expect(defaultProps.onClearOfflineGains).toHaveBeenCalled()
  })

  it('does not auto-dismiss the offline popup without a click', () => {
    render(
      <IdleRunnerScene
        {...defaultProps}
        offlineGains={{ fights: 12, xp: 500, levels: 2, essence: 3.5, timeAway: 3600000 }}
      />,
    )

    expect(screen.getByText(/WELCOME BACK/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(screen.getByText(/WELCOME BACK/i)).toBeInTheDocument()
    expect(defaultProps.onClearOfflineGains).not.toHaveBeenCalled()
  })
})
