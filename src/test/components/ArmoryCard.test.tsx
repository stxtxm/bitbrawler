import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArmoryCard } from '../../components/compendium/ArmoryCard';
import { CODEX_ENTRIES } from '../../data/codex';

const rustySword = CODEX_ENTRIES.find((entry) => entry.id === 'rusty_sword')!;
const rustySwordIndex = CODEX_ENTRIES.findIndex((entry) => entry.id === 'rusty_sword');
const nextEntry = CODEX_ENTRIES[rustySwordIndex + 1];

describe('ArmoryCard', () => {
  it('renders ??? and hides the item name when locked', () => {
    render(<ArmoryCard entry={rustySword} discovered={false} />);

    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
    expect(screen.queryByText(rustySword.name)).not.toBeInTheDocument();
    expect(screen.queryByText(rustySword.rarity.toUpperCase())).not.toBeInTheDocument();
  });

  it('renders the item name, rarity and icon when discovered', () => {
    const { container } = render(<ArmoryCard entry={rustySword} discovered />);

    expect(screen.getByText(rustySword.name)).toBeInTheDocument();
    expect(screen.getByText(rustySword.rarity.toUpperCase())).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows the neighborhood hint when a neighbor is discovered', () => {
    render(
      <ArmoryCard
        entry={rustySword}
        discovered={false}
        seenIds={new Set([nextEntry.id])}
      />,
    );

    expect(screen.getByTestId('armory-hint')).toHaveTextContent('✦');
    expect(screen.queryByText(rustySword.name)).not.toBeInTheDocument();
  });

  it('falls back to ??? when no neighbor is discovered', () => {
    render(<ArmoryCard entry={rustySword} discovered={false} seenIds={new Set()} />);

    expect(screen.getByTestId('armory-hint')).toHaveTextContent('???');
  });
});
