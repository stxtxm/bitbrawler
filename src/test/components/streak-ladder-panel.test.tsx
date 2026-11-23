import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StreakLadderPanel } from '../../components/streak/StreakLadderPanel';
import type { StreakLadderEntry } from '../../utils/streakLadderUtils';

const entries: StreakLadderEntry[] = [
  { characterId: 'a', name: 'Alpha', streak: 12, rank: 1, tier: 'gold' },
  { characterId: 'b', name: 'Bravo', streak: 7, rank: 2, tier: 'silver' },
  { characterId: 'c', name: 'Charlie', streak: 4, rank: 3, tier: 'bronze' },
];

describe('StreakLadderPanel', () => {
  it('is collapsed by default and opens on toggle', () => {
    render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={entries}
        ownEntry={entries[0]}
        badges={{}}
        loading={false}
        available={true}
      />,
    );

    expect(screen.getByText('🏆 WEEKLY STREAK LADDER')).toBeInTheDocument();
    expect(screen.getByText('SEMAINE 48 · 2026')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /WEEKLY STREAK LADDER/i });
    fireEvent.click(toggle);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders ranked entries with streak and tier icons', () => {
    const { container } = render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={entries}
        ownEntry={entries[1]}
        badges={{}}
        loading={false}
        available={true}
        defaultOpen
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('12 J')).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(container.querySelector('.streak-ladder-row.own')).not.toBeNull();
  });

  it('shows the offline message when the table is missing', () => {
    render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={[]}
        ownEntry={null}
        badges={{}}
        loading={false}
        available={false}
        defaultOpen
      />,
    );

    expect(screen.getByText('LADDER OFFLINE — MIGRATION EN ATTENTE')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={[]}
        ownEntry={null}
        badges={{}}
        loading={false}
        available={true}
        defaultOpen
      />,
    );

    expect(screen.getByText('AUCUN CHALLENGER CETTE SEMAINE')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={[]}
        ownEntry={null}
        badges={{}}
        loading={true}
        available={true}
        defaultOpen
      />,
    );

    expect(screen.getByText('LOADING LADDER...')).toBeInTheDocument();
  });

  it('displays the best cosmetic badge and triggers refresh', () => {
    const onRefresh = vi.fn();
    render(
      <StreakLadderPanel
        weekKey="2026-W48"
        entries={entries}
        ownEntry={entries[0]}
        badges={{ '2026-W47': 'bronze', '2026-W48': 'gold' }}
        loading={false}
        available={true}
        defaultOpen
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText(/MEILLEUR BADGE/)).toBeInTheDocument();
    expect(screen.getByText(/GOLDEN BRAWLER/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'REFRESH' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
