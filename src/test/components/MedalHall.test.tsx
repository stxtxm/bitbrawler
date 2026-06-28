import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../utils/router';
import MedalHall from '../../pages/MedalHall';
import { useGame } from '../../context/GameContext';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

const mockDefaultProgress = () => {
  const progress: Record<string, { completed: boolean; progress: number; unlockedAt?: number }> = {};
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

  it('renders medal category sections', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('Loot')).toBeInTheDocument();
    expect(screen.getByText('Progression')).toBeInTheDocument();
    expect(screen.getByText('Special')).toBeInTheDocument();
  });

  it('renders medal count progress', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText(/Medals:/)).toBeInTheDocument();
  });

  it('shows 0/17 when no medals are unlocked', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText(/0 \/ 17/)).toBeInTheDocument();
  });

  it('shows unlocked count when medals are unlocked', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        medalProgress: {
          ...mockDefaultProgress(),
          first_blood: { completed: true, progress: 1, unlockedAt: Date.now() },
          brawler: { completed: true, progress: 10, unlockedAt: Date.now() },
        },
      },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText(/2 \/ 17/)).toBeInTheDocument();
  });

  it('displays BACK button', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: { medalProgress: mockDefaultProgress() },
    });

    renderWithRouter(<MedalHall />);
    expect(screen.getByText('BACK')).toBeInTheDocument();
  });
});
