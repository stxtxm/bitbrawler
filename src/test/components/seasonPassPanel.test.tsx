import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeasonPassPanel } from '../../components/pass/SeasonPassPanel';
import { clearPassProgress, savePassProgress } from '../../utils/passStorage';

vi.mock('../../context/GameContext', () => ({
  useGame: () => ({ activeCharacter: { id: 'pass-char', seed: 'pass-seed' } }),
}));

const currentSeasonId = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

describe('SeasonPassPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPassProgress();
  });

  it('renders the pass track wired to the stored progress', () => {
    savePassProgress(currentSeasonId(), { xp: 220, claimed: [] }, 'pass-char');
    render(<SeasonPassPanel />);
    expect(screen.getByText(/MASTERY PASS/)).toBeTruthy();
    expect(screen.getByText(/Tier 2 \/ 20/)).toBeTruthy();
    expect(screen.getByText(/220 \/ 4900 XP/)).toBeTruthy();
    expect(screen.getByTestId('pass-tier-20')).toBeTruthy();
  });

  it('claims an unlocked tier through the hook', () => {
    savePassProgress(currentSeasonId(), { xp: 100, claimed: [] }, 'pass-char');
    render(<SeasonPassPanel />);
    const claimButtons = screen.getAllByRole('button', { name: /claim tier/i });
    const unlocked = claimButtons.find((button) => !button.hasAttribute('disabled'));
    expect(unlocked).toBeTruthy();
    fireEvent.click(unlocked!);
    expect(screen.getByText('CLAIMED')).toBeTruthy();
  });

  it('calls onClose from the pass close button', () => {
    const onClose = vi.fn();
    render(<SeasonPassPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close pass/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
