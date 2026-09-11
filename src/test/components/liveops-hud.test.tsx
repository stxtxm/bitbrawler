import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LiveOpsHud, getBiomeVariantPalette, formatBurstCountdown, getMonsterPaletteForBiome } from '../../components/arena/LiveOpsHud'
import { MONSTER_PALETTES } from '../../data/monsterAssets'

describe('LiveOpsHud', () => {
  it('is hidden when no surge and no burst', () => {
    const { container } = render(<LiveOpsHud activeSurge={null} burstActive={false} burstEndsAt={null} surgeModifier={1.25} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('liveops-hud')).toBeNull()
  })

  it('shows surge badge when activeSurge set', () => {
    render(<LiveOpsHud activeSurge="volcanic" burstActive={false} burstEndsAt={null} surgeModifier={1.25} />)
    expect(screen.getByTestId('liveops-hud')).toBeInTheDocument()
    expect(screen.getByTestId('liveops-surge-badge')).toBeInTheDocument()
    expect(screen.getByText(/Biome Surge: Volcanic/)).toBeInTheDocument()
    expect(screen.getByText(/\+25% essence idle/)).toBeInTheDocument()
  })

  it('shows surge badge for plains with +25% label', () => {
    render(<LiveOpsHud activeSurge="plains" burstActive={false} burstEndsAt={null} surgeModifier={1.25} />)
    expect(screen.getByText(/Plains/)).toBeInTheDocument()
    expect(screen.getByText(/\+25%/)).toBeInTheDocument()
  })

  it('shows burst countdown when active', () => {
    const now = Date.now()
    const endsAt = now + 3600 * 1000 + 5000
    render(<LiveOpsHud activeSurge={null} burstActive burstEndsAt={endsAt} surgeModifier={1.25} />)
    expect(screen.getByTestId('liveops-burst-countdown')).toBeInTheDocument()
    expect(screen.getByText(/BURST/)).toBeInTheDocument()
  })

  it('shows both surge and burst when both active', () => {
    const now = Date.now()
    const endsAt = now + 7200 * 1000
    render(<LiveOpsHud activeSurge="abyssal" burstActive burstEndsAt={endsAt} surgeModifier={1.25} />)
    expect(screen.getByTestId('liveops-surge-badge')).toBeInTheDocument()
    expect(screen.getByTestId('liveops-burst-countdown')).toBeInTheDocument()
    expect(screen.getByText(/Abyssal Rift/)).toBeInTheDocument()
  })

  it('hides burst when burstActive false even if endsAt set', () => {
    const endsAt = Date.now() + 10000
    render(<LiveOpsHud activeSurge={null} burstActive={false} burstEndsAt={endsAt} surgeModifier={1.25} />)
    expect(screen.queryByTestId('liveops-burst-countdown')).toBeNull()
    expect(screen.queryByTestId('liveops-hud')).toBeNull()
  })

  it('reuses 8-bit wood styling via shop-panel class', () => {
    render(<LiveOpsHud activeSurge="volcanic" burstActive={false} burstEndsAt={null} surgeModifier={1.25} />)
    expect(screen.getByTestId('liveops-hud').className).toContain('shop-panel')
  })

  it('applies surgeModifier percent correctly', () => {
    render(<LiveOpsHud activeSurge="volcanic" burstActive={false} burstEndsAt={null} surgeModifier={1.5} />)
    expect(screen.getByText(/\+50%/)).toBeInTheDocument()
  })
})

describe('palette swaps', () => {
  it('returns distinct palette for volcanic vs plains', () => {
    const plains = getBiomeVariantPalette('goblin', 'plains')
    const volcanic = getBiomeVariantPalette('goblin', 'volcanic')
    expect(plains).not.toEqual(volcanic)
    expect(plains[1]).not.toBe(volcanic[1])
  })

  it('keeps transparent entries untouched', () => {
    const volcanic = getBiomeVariantPalette('goblin', 'volcanic')
    expect(volcanic[0]).toBe('transparent')
  })

  it('provides alias getMonsterPaletteForBiome', () => {
    const a = getBiomeVariantPalette('magma_golem', 'abyssal')
    const b = getMonsterPaletteForBiome('magma_golem', 'abyssal')
    expect(a).toEqual(b)
  })

  it('forest and desert produce variant palettes without new assets', () => {
    const base = MONSTER_PALETTES['goblin']
    const forest = getBiomeVariantPalette('goblin', 'plains' as any)
    const desert = getBiomeVariantPalette('goblin', 'volcanic' as any)
    expect(Object.keys(forest).length).toBe(Object.keys(base).length)
    expect(Object.keys(desert).length).toBe(Object.keys(base).length)
  })
})

describe('formatBurstCountdown', () => {
  it('formats hh:mm:ss when less than a day', () => {
    const now = Date.UTC(2026, 0, 2, 12, 0, 0)
    const ends = now + (2 * 3600 + 5 * 60 + 9) * 1000
    expect(formatBurstCountdown(ends, now)).toBe('02:05:09')
  })

  it('formats with days when >=24h', () => {
    const now = Date.UTC(2026, 0, 2, 12, 0, 0)
    const ends = now + (26 * 3600 + 1 * 60) * 1000
    expect(formatBurstCountdown(ends, now)).toBe('1j 02:01:00')
  })

  it('clamps to 00:00:00 when expired', () => {
    const now = Date.UTC(2026, 0, 2, 12, 0, 0)
    const ends = now - 1000
    expect(formatBurstCountdown(ends, now)).toBe('00:00:00')
  })
})
