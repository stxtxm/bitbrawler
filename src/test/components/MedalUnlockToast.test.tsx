import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MedalUnlockToast } from '../../components/MedalUnlockToast';
import { MedalDef } from '../../utils/medalUtils';

const mockMedal: MedalDef = {
  id: 'brawler',
  category: 'combat',
  name: 'Brawler',
  description: 'Prove yourself as a real brawler',
  condition: 'Win 10 fights total',
  icon: 'strength',
  requiredProgress: 10,
  reward: { type: 'stat_point', label: '+1 permanent STR', stat: 'strength', value: 1 },
};

describe('MedalUnlockToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders medal name', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByText('Brawler')).toBeInTheDocument();
  });

  it('renders Medal Unlocked! text', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Medal Unlocked/i)).toBeInTheDocument();
  });

  it('renders medal icon', () => {
    const { container } = render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    const iconWrapper = container.querySelector('.pixel-icon-wrapper');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('auto-dismisses after 4 seconds', () => {
    const handleDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={handleDismiss} />);

    expect(handleDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not auto-dismiss before 4 seconds', () => {
    const handleDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={handleDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss when close button is clicked', () => {
    const handleDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={handleDismiss} />);

    const closeButton = screen.getByLabelText('Close medal notification');
    act(() => {
      closeButton.click();
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
  });

  it('cleans up timer on unmount', () => {
    const handleDismiss = vi.fn();
    const { unmount } = render(<MedalUnlockToast medal={mockMedal} onDismiss={handleDismiss} />);

    unmount();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(handleDismiss).not.toHaveBeenCalled();
  });

  it('renders reward text for the medal', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByText('+1 permanent STR')).toBeInTheDocument();
  });
});
