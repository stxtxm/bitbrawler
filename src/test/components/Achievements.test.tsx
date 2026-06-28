import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../utils/router';
import Achievements from '../../pages/Achievements';

// Mock GameContext
vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

import { useGame } from '../../context/GameContext';

describe('Achievements Page', () => {
  it('shows empty state when no active character', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: null,
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText('NO CHARACTER FOUND')).toBeInTheDocument();
    expect(screen.getByText('Create a character to start earning achievements.')).toBeInTheDocument();
  });

  it('renders the page header when character exists', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {},
      },
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText('ACHIEVEMENTS')).toBeInTheDocument();
    expect(screen.getByText('COMPLETIONIST PROGRESS')).toBeInTheDocument();
  });

  it('shows stats bar with completion counts', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {},
      },
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText(/0 \/ \d+ achievements completed/)).toBeInTheDocument();
  });

  it('shows category sections', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {},
      },
    });

    renderWithRouter(<Achievements />);
    // Combat should be visible (has achievements)
    expect(screen.getByText('Combat')).toBeInTheDocument();
    // Collection should be visible
    expect(screen.getByText('Collection')).toBeInTheDocument();
    // Leveling should be visible
    expect(screen.getByText('Leveling')).toBeInTheDocument();
  });

  it('shows BACK TO MENU button', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {},
      },
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText('BACK TO MENU')).toBeInTheDocument();
  });

  it('shows secret category only when progress exists', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {},
      },
    });

    renderWithRouter(<Achievements />);
    // Secret should not be visible when no progress
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('shows secret category when progress exists', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: {
        name: 'Hero',
        level: 5,
        achievementProgress: {
          lucky_break: { completed: false, progress: 1, target: 1 },
        },
      },
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('shows CREATE CHARACTER button in empty state', () => {
    (useGame as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCharacter: null,
    });

    renderWithRouter(<Achievements />);
    expect(screen.getByText('CREATE CHARACTER')).toBeInTheDocument();
  });
});
