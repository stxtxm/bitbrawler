import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionPanel } from '../../components/arena/ActionPanel';

const renderPanel = (overrides: Parameters<typeof ActionPanel>[0] = {}) => {
  const onFight = vi.fn();
  const onModeChange = vi.fn();
  render(
    <ActionPanel
      onFight={onFight}
      onModeChange={onModeChange}
      {...overrides}
    />,
  );
  return { onFight, onModeChange };
};

describe('ActionPanel', () => {
  it('renders PvE as an idle hunt with no manual fight button', () => {
    renderPanel({ mode: 'pve', fightsLeft: 3, canFight: true });

    expect(screen.getByText('IDLE HUNT')).toBeInTheDocument();
    expect(screen.getByText('AUTO-BATTLE RUNNING')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'FIGHT!' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /PVE/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the PvP fight CTA and triggers the fight', () => {
    const { onFight } = renderPanel({ mode: 'pvp', fightsLeft: 3, canFight: true });

    expect(screen.getByText('BATTLE ENERGY')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'FIGHT!' }));
    expect(onFight).toHaveBeenCalledTimes(1);
  });

  it('shows REST NOW when PvP energy is exhausted', () => {
    renderPanel({ mode: 'pvp', fightsLeft: 0, canFight: false });

    const rest = screen.getByRole('button', { name: 'REST NOW' });
    expect(rest).toBeDisabled();
  });

  it('switches mode through the bottom tabs', () => {
    const { onModeChange } = renderPanel({ mode: 'pve' });

    fireEvent.click(screen.getByRole('tab', { name: /PVP/ }));
    expect(onModeChange).toHaveBeenCalledWith('pvp');

    fireEvent.click(screen.getByRole('tab', { name: /BOSS/ }));
    expect(onModeChange).toHaveBeenCalledWith('boss');
  });
});
