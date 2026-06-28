import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import AchievementNotification from '../../components/AchievementNotification';
import { renderWithRouter } from '../utils/router';
import type { AchievementDef } from '../../utils/achievementUtils';

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

const mockAchievement: AchievementDef = {
  id: 'first_blood',
  category: 'combat',
  name: 'First Blood',
  description: 'Win your first fight',
  icon: 'sword',
  target: 1,
  reward: { type: 'essence', label: '+50 Essence', value: 50 },
};

describe('AchievementNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when achievement is null', () => {
    const { container } = renderWithRouter(
      <AchievementNotification achievement={null} onClose={() => {}} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders achievement name when provided', () => {
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={() => {}} />,
    );
    expect(screen.getByText('First Blood')).toBeInTheDocument();
  });

  it('renders ACHIEVEMENT UNLOCKED label', () => {
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={() => {}} />,
    );
    expect(screen.getByText('ACHIEVEMENT UNLOCKED!')).toBeInTheDocument();
  });

  it('renders the category icon', () => {
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={() => {}} />,
    );
    expect(screen.getByText('⚔️')).toBeInTheDocument();
  });

  it('has role alert for accessibility', () => {
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={() => {}} />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onClose when clicked', () => {
    const onClose = vi.fn();
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={onClose} />,
    );
    screen.getByRole('alert').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after 5 seconds', () => {
    const onClose = vi.fn();
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={onClose} />,
    );
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-dismiss before 5 seconds', () => {
    const onClose = vi.fn();
    renderWithRouter(
      <AchievementNotification achievement={mockAchievement} onClose={onClose} />,
    );
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
