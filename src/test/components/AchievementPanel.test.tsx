import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import AchievementPanel from '../../components/AchievementPanel';
import { renderWithRouter } from '../utils/router';
import type { AchievementDef, AchievementProgressMap } from '../../utils/achievementUtils';

const combatDefs: AchievementDef[] = [
  {
    id: 'first_blood',
    category: 'combat',
    name: 'First Blood',
    description: 'Win your first fight',
    icon: 'sword',
    target: 1,
    reward: { type: 'essence', label: '+50 Essence', value: 50 },
  },
  {
    id: 'brawler',
    category: 'combat',
    name: 'Brawler',
    description: 'Win 10 fights',
    icon: 'strength',
    target: 10,
    reward: { type: 'stat_point', label: '+1 STR', stat: 'strength', value: 1 },
  },
  {
    id: 'warrior',
    category: 'combat',
    name: 'Warrior',
    description: 'Win 50 fights',
    icon: 'trophy',
    target: 50,
    reward: { type: 'stat_point', label: '+1 VIT', stat: 'vitality', value: 1 },
  },
];

const progress: AchievementProgressMap = {
  first_blood: { completed: true, progress: 1, target: 1 },
  brawler: { completed: false, progress: 5, target: 10 },
  warrior: { completed: false, progress: 0, target: 50 },
};

describe('AchievementPanel', () => {
  it('renders achievement rows in full mode', () => {
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={progress} />,
    );
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.getByText('Brawler')).toBeInTheDocument();
  });

  it('shows progress text', () => {
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={progress} />,
    );
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });

  it('shows completed checkmark', () => {
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={progress} />,
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows reward label', () => {
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={progress} />,
    );
    expect(screen.getByText('+50 Essence')).toBeInTheDocument();
    expect(screen.getByText('+1 STR')).toBeInTheDocument();
  });

  it('sorts by nearest completion in full mode', () => {
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={progress} />,
    );
    // brawler (5/10 = 50%) should appear before warrior (0/50 = 0%)
    const rows = screen.getAllByText(/\/ /); // matches progress text like "5 / 10" and "0 / 50"
    expect(rows[0]).toHaveTextContent('5 / 10'); // closest to completion first
  });

  it('shows limited achievements in full mode (up to 6)', () => {
    const manyDefs = Array.from({ length: 10 }, (_, i) => ({
      id: `ach_${i}`,
      category: 'combat' as const,
      name: `Achievement ${i}`,
      description: `Description ${i}`,
      icon: 'sword',
      target: 10,
      reward: { type: 'essence' as const, label: `+${i} Essence`, value: i },
    }));
    const emptyProgress: AchievementProgressMap = {};
    renderWithRouter(
      <AchievementPanel achievements={manyDefs} progress={emptyProgress} />,
    );
    // Should show max 6 rows + empty state would show if 0, but we have 10
    const visibleRows = screen.getAllByText(/Achievement \d/);
    expect(visibleRows.length).toBeLessThanOrEqual(6);
  });

  it('shows empty state when no achievements', () => {
    renderWithRouter(
      <AchievementPanel achievements={[]} progress={{}} />,
    );
    expect(screen.getByText(/no achievements yet/i)).toBeInTheDocument();
  });

  it('shows compact mode with completed achievements', () => {
    const completedProgress: AchievementProgressMap = {
      first_blood: { completed: true, progress: 1, target: 1 },
      brawler: { completed: false, progress: 5, target: 10 },
    };
    renderWithRouter(
      <AchievementPanel achievements={combatDefs} progress={completedProgress} compact />,
    );
    // Should show only completed in compact mode
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    // Brawler is not completed, should not show in compact
    expect(screen.queryByText('Brawler')).not.toBeInTheDocument();
  });

  it('shows View All link in compact mode when there are more achievements', () => {
    const legend: AchievementDef = {
      id: 'legend',
      category: 'combat',
      name: 'Legend',
      description: 'Win 100 fights',
      icon: 'trophy',
      target: 100,
      reward: { type: 'title', label: 'The Legend' },
    };
    const manyDefs = [...combatDefs, legend];
    renderWithRouter(
      <AchievementPanel achievements={manyDefs} progress={progress} compact />,
    );
    expect(screen.getByText('View All →')).toBeInTheDocument();
  });

  it('links View All to /achievements', () => {
    const legend: AchievementDef = {
      id: 'legend',
      category: 'combat',
      name: 'Legend',
      description: 'Win 100 fights',
      icon: 'trophy',
      target: 100,
      reward: { type: 'title', label: 'The Legend' },
    };
    const manyDefs = [...combatDefs, legend];
    renderWithRouter(
      <AchievementPanel achievements={manyDefs} progress={progress} compact />,
    );
    const link = screen.getByText('View All →');
    expect(link.closest('a')).toHaveAttribute('href', '/achievements');
  });
});
