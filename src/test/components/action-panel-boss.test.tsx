import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionPanel } from '../../components/arena/ActionPanel';

const renderPanel = (overrides: Partial<ComponentProps<typeof ActionPanel>> = {}) => {
  const onTogglePve = vi.fn();
  const onTogglePvp = vi.fn();
  const onFight = vi.fn();

  render(
    <ActionPanel
      pveMode
      canFight
      matchmaking={false}
      hasPendingFight={false}
      autoMode={false}
      isOfflineMode={false}
      fightsLeft={5}
      bossAttacksLeft={3}
      bossUnlocked
      bossHp={7500}
      bossMaxHp={10000}
      bossLevel={32}
      bossPityStacks={2}
      bossPityReduction={0}
      onTogglePve={onTogglePve}
      onTogglePvp={onTogglePvp}
      onFight={onFight}
      {...overrides}
    />,
  );
};

describe('ActionPanel boss progression feedback', () => {
  it('shows the damage dealt and the estimated days before the kill', () => {
    renderPanel({ bossDamagePct: 25, bossEstimatedDays: 3 });

    expect(screen.getByText(/25% DAMAGE DEALT/)).toBeInTheDocument();
    expect(screen.getByText(/~3D TO KILL/)).toBeInTheDocument();
  });

  it('does not show the estimate before the first hit lands', () => {
    renderPanel({ bossDamagePct: 0, bossEstimatedDays: null });

    expect(screen.queryByText(/DAMAGE DEALT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/TO KILL/)).not.toBeInTheDocument();
  });
});
