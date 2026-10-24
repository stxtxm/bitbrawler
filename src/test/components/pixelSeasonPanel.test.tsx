import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PixelSeasonPanel } from '../../components/pass/PixelSeasonPanel';
import { useGame } from '../../context/GameContext';
import {
  clearPixelSeasonState,
  loadPixelSeasonState,
  recordPixelSeasonAction,
  unlockPixelSeasonPremium,
} from '../../utils/pixelSeasonStorage';
import {
  PIXEL_SEASON_FREE_REWARDS,
  PIXEL_SEASON_PREMIUM_REWARDS,
  PIXEL_SEASON_THEMES,
} from '../../data/pixelSeason';
import Forge from '../../pages/Forge';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({ notify: vi.fn() }),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;

const SEASON = '2026-01-05';
const ACTIVE_NOW = new Date('2026-01-10T12:00:00Z');
const CHAR_ID = 'char-season';

function setupGame() {
  mockUseGame.mockReturnValue({
    activeCharacter: {
      id: CHAR_ID,
      name: 'Season Hero',
      level: 5,
      inventory: [],
      itemUpgrades: {},
    },
    essence: 100,
    salvageItems: vi.fn(),
    fuseItems: vi.fn(),
    upgradeItem: vi.fn(),
  });
}

function renderPanel() {
  return render(<PixelSeasonPanel now={ACTIVE_NOW} onClose={vi.fn()} />);
}

describe('PixelSeasonPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPixelSeasonState();
    localStorage.clear();
    setupGame();
  });

  it('renders the season hub with its theme and calendar', () => {
    renderPanel();
    expect(screen.getByText('PIXEL SEASON')).toBeInTheDocument();
    expect(screen.getByText(PIXEL_SEASON_THEMES[0].name)).toBeInTheDocument();
    expect(screen.getByText(/Saison 2026-01-05/)).toBeInTheDocument();
    expect(screen.getByText(/9 jours restants/i)).toBeInTheDocument();
  });

  it('renders the progress bar at tier 0', () => {
    renderPanel();
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText(/Tier 0 \/ 30/)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 3000 PTS/)).toBeInTheDocument();
  });

  it('renders every mission', () => {
    renderPanel();
    expect(screen.getByTestId('season-mission-fight-1')).toBeInTheDocument();
    expect(screen.getByTestId('season-mission-salvage-1')).toBeInTheDocument();
    expect(screen.getByTestId('season-mission-idle-1')).toBeInTheDocument();
    expect(screen.getByTestId('season-mission-streak-1')).toBeInTheDocument();
    expect(screen.getByText('Gagner 20 combats')).toBeInTheDocument();
  });

  it('renders the 30 free tiers and 10 premium tiers', () => {
    renderPanel();
    for (const reward of PIXEL_SEASON_FREE_REWARDS) {
      expect(screen.getByTestId(`season-free-tier-${reward.tier}`)).toBeInTheDocument();
    }
    for (const reward of PIXEL_SEASON_PREMIUM_REWARDS) {
      expect(screen.getByTestId(`season-premium-tier-${reward.tier}`)).toBeInTheDocument();
    }
  });

  it('disables free claims when locked', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Claim free tier 1' })).toBeDisabled();
  });

  it('claims an unlocked free tier', () => {
    recordPixelSeasonAction(CHAR_ID, 'fight', 20, SEASON);
    renderPanel();
    const card = screen.getByTestId('season-free-tier-1');
    const button = within(card).getByRole('button', { name: 'Claim free tier 1' });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(within(card).getByText('CLAIMED')).toBeInTheDocument();
    expect(loadPixelSeasonState(SEASON, CHAR_ID).claimedFree).toContain(1);
  });

  it('shows the premium track as locked by default', () => {
    recordPixelSeasonAction(CHAR_ID, 'fight', 20, SEASON);
    recordPixelSeasonAction(CHAR_ID, 'salvage', 10, SEASON);
    renderPanel();
    expect(screen.getByText(/PREMIUM VERROUILLE/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim premium tier 3' })).toBeDisabled();
  });

  it('claims premium cosmetics once unlocked', () => {
    recordPixelSeasonAction(CHAR_ID, 'fight', 20, SEASON);
    recordPixelSeasonAction(CHAR_ID, 'salvage', 10, SEASON);
    unlockPixelSeasonPremium(CHAR_ID, SEASON);
    renderPanel();
    const card = screen.getByTestId('season-premium-tier-3');
    fireEvent.click(within(card).getByRole('button', { name: 'Claim premium tier 3' }));
    expect(within(card).getByText('CLAIMED')).toBeInTheDocument();
  });

  it('renders the seasonal leaderboard with the player', () => {
    renderPanel();
    expect(screen.getByText('LIGUE SAISONNIERE')).toBeInTheDocument();
    expect(screen.getByText(/Season Hero/)).toBeInTheDocument();
  });

  it('calls onClose', () => {
    const onClose = vi.fn();
    render(<PixelSeasonPanel now={ACTIVE_NOW} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close season pass/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Forge season tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPixelSeasonState();
    localStorage.clear();
    setupGame();
  });

  it('opens the pixel season hub from the forge', () => {
    render(
      <MemoryRouter initialEntries={['/forge']}>
        <Forge />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /season/i }));
    expect(screen.getByText('PIXEL SEASON')).toBeInTheDocument();
  });
});
