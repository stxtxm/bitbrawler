import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../utils/router';
import { MedalCard } from '../../components/MedalCard';
import { MedalDef, MedalProgress } from '../../utils/medalUtils';

const mockMedalDef: MedalDef = {
  id: 'brawler',
  category: 'combat',
  name: 'Brawler',
  description: 'Prove yourself as a real brawler',
  condition: 'Win 10 fights total',
  icon: 'strength',
  requiredProgress: 10,
  reward: { type: 'stat_point', label: '+1 permanent STR', stat: 'strength', value: 1 },
};

describe('MedalCard', () => {
  it('renders medal name and description', () => {
    const progress: MedalProgress = { completed: false, progress: 5 };
    renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    expect(screen.getByText('Brawler')).toBeInTheDocument();
    expect(screen.getByText('Prove yourself as a real brawler')).toBeInTheDocument();
  });

  it('renders progress bar text (e.g., 5/10)', () => {
    const progress: MedalProgress = { completed: false, progress: 5 };
    renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    expect(screen.getByText('5/10')).toBeInTheDocument();
  });

  it('renders reward text', () => {
    const progress: MedalProgress = { completed: false, progress: 5 };
    renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    expect(screen.getByText('+1 permanent STR')).toBeInTheDocument();
  });

  it('renders unlocked state with gold border class', () => {
    const progress: MedalProgress = { completed: true, progress: 10, unlockedAt: Date.now() };
    const { container } = renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    const card = container.querySelector('.medal-card');
    expect(card).toHaveClass('medal-card--unlocked');
    expect(card).not.toHaveClass('medal-card--locked');
    expect(card).not.toHaveClass('medal-card--in-progress');
  });

  it('renders in-progress state with partial progress bar', () => {
    const progress: MedalProgress = { completed: false, progress: 5 };
    const { container } = renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    const card = container.querySelector('.medal-card');
    expect(card).toHaveClass('medal-card--in-progress');

    const progressBar = container.querySelector('.medal-card__progress-fill');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('renders locked state with reduced opacity', () => {
    const progress: MedalProgress = { completed: false, progress: 0 };
    const { container } = renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    const card = container.querySelector('.medal-card');
    expect(card).toHaveClass('medal-card--locked');
    expect(card).not.toHaveClass('medal-card--unlocked');
  });

  it('renders full progress bar when completed', () => {
    const progress: MedalProgress = { completed: true, progress: 10, unlockedAt: Date.now() };
    const { container } = renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    const progressBar = container.querySelector('.medal-card__progress-fill');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('renders 0/requiredProgress when progress is 0', () => {
    const progress: MedalProgress = { completed: false, progress: 0 };
    renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    expect(screen.getByText('0/10')).toBeInTheDocument();
  });

  it('renders hidden medals with reduced opacity', () => {
    const hiddenMedal: MedalDef = { ...mockMedalDef, hidden: true };
    const progress: MedalProgress = { completed: false, progress: 0 };
    const { container } = renderWithRouter(<MedalCard medalDef={hiddenMedal} progress={progress} />);

    const card = container.querySelector('.medal-card');
    expect(card).toHaveClass('medal-card--hidden');
  });

  it('renders medal icon with PixelIcon', () => {
    const progress: MedalProgress = { completed: false, progress: 5 };
    const { container } = renderWithRouter(<MedalCard medalDef={mockMedalDef} progress={progress} />);

    const iconWrapper = container.querySelector('.pixel-icon-wrapper');
    expect(iconWrapper).toBeInTheDocument();
  });
});
