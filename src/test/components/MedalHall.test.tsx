import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../utils/router';
import MedalHall from '../../pages/MedalHall';
import { useGame } from '../../context/GameContext';

// Mock useGame
vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

const mockDefaultProgress = () => {
  const progress: Record<string, { completed: boolean; progress: number; unlockedAt?: number }> = {};
  // All medals start at 0
  const medalIds = [
    'first_blood', 'brawler', 'warrior', 'legend', 'unstoppable', 'comeback_king',
    'collector', 'rare_hunter', 'epic_seeker', 'fully_equipped',
    'growing_strong', 'peak_performance', 'level_master', 'veteran',
    'lucky_day', 'glass_cannon', 'pacifist',
  ];
  for (const id of medalIds) {
    progress[id] = { completed: false, progress: 0 };
  }
  return progress;
};

describe('MedalHall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText('Medal Hall')).toBeInTheDocument();
  });

  it('renders completion counter (0/17 when none unlocked)', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText(/Medals/)).toHaveTextContent('0 / 17');
  });

  it('renders correct completion count when medals are unlocked', () => {
    const progress = mockDefaultProgress();
    progress.first_blood = { completed: true, progress: 1, unlockedAt: Date.now() };
    progress.growing_strong = { completed: true, progress: 5, unlockedAt: Date.now() };

    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: progress },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText(/Medals/)).toHaveTextContent('2 / 17');
  });

  it('renders category sections', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Loot')).toBeInTheDocument();
    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(screen.getByText('Special')).toBeInTheDocument();
  });

  it('renders medal cards within each category', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);

    // Combat medals: First Blood, Brawler, Warrior, Legend, Unstoppable, Comeback King
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.getByText('Brawler')).toBeInTheDocument();
    expect(screen.getByText('Warrior')).toBeInTheDocument();

    // Loot medals
    expect(screen.getByText('Collector')).toBeInTheDocument();

    // Progression medals
    expect(screen.getByText('Growing Strong')).toBeInTheDocument();
  });

  it('renders back button to home', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);

    const backLink = screen.getByRole('link', { name: /back/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('renders reward text on medal cards', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);

    // First Blood reward: +1 permanent HP
    expect(screen.getByText('+1 permanent HP')).toBeInTheDocument();
  });

  it('shows empty state when no active character', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: null,
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText('Medal Hall')).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 17/)).toBeInTheDocument();
  });
});
