import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { PassTrack } from '../../components/pass/PassTrack'
import { SEASONAL_PASS_TIERS } from '../../data/seasonalPass'

const baseProps = {
  seasonId: '2026-09',
  passXp: 0,
  currentTier: 0,
  progressPct: 0,
  claimed: [] as number[],
  tiers: SEASONAL_PASS_TIERS,
  maxXp: SEASONAL_PASS_TIERS[19].xpRequired,
  xpToNext: SEASONAL_PASS_TIERS[0].xpRequired,
  onClaim: vi.fn(),
  onClose: vi.fn(),
}

describe('PassTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders mastery pass title', () => {
    render(<PassTrack {...baseProps} />)
    expect(screen.getByText(/MASTERY PASS/)).toBeTruthy()
  })

  it('renders season label', () => {
    render(<PassTrack {...baseProps} seasonId="2026-09" />)
    expect(screen.getByText(/2026-09/)).toBeTruthy()
  })

  it('renders 20 tier cards', () => {
    render(<PassTrack {...baseProps} />)
    for (let i = 1; i <= 20; i++) {
      expect(screen.getByTestId(`pass-tier-${i}`)).toBeTruthy()
    }
  })

  it('shows progress bar with correct percentage', () => {
    render(<PassTrack {...baseProps} progressPct={42} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
  })

  it('displays tier level and xpRequired for each tier', () => {
    render(<PassTrack {...baseProps} />)
    expect(screen.getByText('LVL 1')).toBeTruthy()
    expect(screen.getByText('LVL 20')).toBeTruthy()
    expect(screen.getByText(`${SEASONAL_PASS_TIERS[0].xpRequired} XP`)).toBeTruthy()
  })

  it('shows LOCKED buttons when no xp', () => {
    render(<PassTrack {...baseProps} passXp={0} />)
    const lockBtns = screen.getAllByText('LOCKED')
    expect(lockBtns.length).toBe(20)
  })

  it('shows CLAIM button for unlocked unclaimed tier', () => {
    const xp = SEASONAL_PASS_TIERS[0].xpRequired
    render(<PassTrack {...baseProps} passXp={xp} currentTier={1} />)
    const claimBtns = screen.getAllByText('CLAIM')
    expect(claimBtns.length).toBeGreaterThanOrEqual(1)
    expect(claimBtns[0]).not.toBeDisabled()
  })

  it('shows CLAIMED for already claimed tier', () => {
    const xp = SEASONAL_PASS_TIERS[0].xpRequired
    render(<PassTrack {...baseProps} passXp={xp} currentTier={1} claimed={[1]} />)
    expect(screen.getByText('CLAIMED')).toBeTruthy()
  })

  it('calls onClaim when clicking CLAIM', () => {
    const onClaim = vi.fn()
    const xp = SEASONAL_PASS_TIERS[2].xpRequired
    render(<PassTrack {...baseProps} passXp={xp} currentTier={3} onClaim={onClaim} />)
    const claimBtns = screen.getAllByRole('button', { name: /claim tier/i })
    const unlocked = claimBtns.find(b => !b.hasAttribute('disabled'))
    expect(unlocked).toBeTruthy()
    fireEvent.click(unlocked!)
    expect(onClaim).toHaveBeenCalled()
  })

  it('disables CLAIM for locked tiers', () => {
    render(<PassTrack {...baseProps} passXp={0} />)
    const btns = screen.getAllByRole('button', { name: /claim tier/i })
    btns.forEach(b => expect(b).toBeDisabled())
  })

  it('shows reward type for each tier', () => {
    render(<PassTrack {...baseProps} />)
    const hasEssence = screen.getAllByText('essence').length > 0
    const hasReroll = screen.getAllByText('reroll').length > 0
    const hasPity = screen.getAllByText('pity').length > 0
    const hasBiome = screen.getAllByText('biome_token').length > 0
    expect(hasEssence).toBe(true)
    expect(hasReroll).toBe(true)
    expect(hasPity).toBe(true)
    expect(hasBiome).toBe(true)
  })

  it('shows current tier and xp in header', () => {
    render(<PassTrack {...baseProps} passXp={500} currentTier={3} />)
    expect(screen.getByText(/Tier 3 \/ 20/)).toBeTruthy()
    expect(screen.getByText(/500 \/ 4900 XP/)).toBeTruthy()
  })

  it('shows xpToNext when not max', () => {
    render(<PassTrack {...baseProps} passXp={0} xpToNext={100} />)
    expect(screen.getByText(/100 XP → prochain palier/)).toBeTruthy()
  })

  it('shows MAX when at max xp', () => {
    render(<PassTrack {...baseProps} passXp={4900} xpToNext={0} progressPct={100} />)
    expect(screen.getByText('MAX')).toBeTruthy()
  })

  it('renders close button and calls onClose', () => {
    const onClose = vi.fn()
    render(<PassTrack {...baseProps} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /close pass/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('uses .pass-* classes', () => {
    const { container } = render(<PassTrack {...baseProps} />)
    expect(container.querySelector('.pass-panel')).toBeTruthy()
    expect(container.querySelector('.pass-track')).toBeTruthy()
    expect(container.querySelector('.pass-progress-bar')).toBeTruthy()
    expect(container.querySelector('.pass-tier-card')).toBeTruthy()
  })
})
