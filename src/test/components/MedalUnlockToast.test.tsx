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

  it('renders medal unlock title', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByText('Medal Unlocked!')).toBeInTheDocument();
  });

  it('renders reward text', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByText('+1 permanent STR')).toBeInTheDocument();
  });

  it('calls onDismiss after autoHideDuration', () => {
    const onDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={onDismiss} autoHideDuration={3000} />);

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not call onDismiss before autoHideDuration', () => {
    const onDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={onDismiss} autoHideDuration={4000} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders close button', () => {
    render(<MedalUnlockToast medal={mockMedal} onDismiss={vi.fn()} />);
    expect(screen.getByLabelText('Close medal notification')).toBeInTheDocument();
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<MedalUnlockToast medal={mockMedal} onDismiss={onDismiss} />);

    screen.getByLabelText('Close medal notification').click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
