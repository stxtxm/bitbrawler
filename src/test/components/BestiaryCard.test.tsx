import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BestiaryCard } from '../../components/compendium/BestiaryCard';
import type { BestiaryEntry } from '../../utils/bestiaryUtils';

const unseen: BestiaryEntry = {
  id: 'goblin',
  name: 'Goblin',
  element: 'wind',
  seen: false,
  kills: 0,
  encounters: 0,
};

const seen: BestiaryEntry = {
  id: 'magma_golem',
  name: 'Magma Golem',
  element: 'earth',
  seen: true,
  kills: 7,
  encounters: 7,
};

describe('BestiaryCard', () => {
  it('masks an unseen monster behind a ??? silhouette without name or stats', () => {
    const { container } = render(<BestiaryCard entry={unseen} />);

    expect(screen.getByText('???')).toBeInTheDocument();
    expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    expect(screen.queryByText('Wind')).not.toBeInTheDocument();
    expect(screen.queryByText('Furtive Strike')).not.toBeInTheDocument();
    expect(screen.queryByText(/kill/i)).not.toBeInTheDocument();

    const silhouette = container.querySelector('.bestiary-card__sprite--silhouette');
    expect(silhouette).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders name, element, specialty and kills for a seen monster', () => {
    render(<BestiaryCard entry={seen} />);

    expect(screen.getByText('Magma Golem')).toBeInTheDocument();
    expect(screen.getByText('Earth')).toBeInTheDocument();
    expect(screen.getByText('Molten Shell')).toBeInTheDocument();
    expect(screen.getByText('7 kills')).toBeInTheDocument();
    expect(screen.getByLabelText('Magma Golem')).toBeInTheDocument();
  });

  it('renders a revealed volcanic monster', () => {
    render(
      <BestiaryCard
        entry={{ id: 'lava_hound', name: 'Lava Hound', element: 'fire', seen: true, kills: 1, encounters: 1 }}
      />,
    );

    expect(screen.getByText('Lava Hound')).toBeInTheDocument();
    expect(screen.getByText('Ember Rush')).toBeInTheDocument();
    expect(screen.getByText('1 kill')).toBeInTheDocument();
    expect(screen.getByLabelText('Lava Hound')).toBeInTheDocument();
  });

  it('keeps an unseen volcanic monster fully hidden', () => {
    const { container } = render(
      <BestiaryCard
        entry={{ id: 'cinder_imp', name: 'Cinder Imp', element: 'fire', seen: false, kills: 0, encounters: 0 }}
      />,
    );

    expect(screen.getByText('???')).toBeInTheDocument();
    expect(screen.queryByText('Cinder Imp')).not.toBeInTheDocument();
    expect(screen.queryByText('Fire')).not.toBeInTheDocument();
    expect(screen.queryByText('Ember Bolt')).not.toBeInTheDocument();

    const card = container.querySelector('.bestiary-card');
    expect(card).toHaveClass('medal-card--locked');
    expect(card).not.toHaveClass('medal-card--unlocked');
  });

  it('shows encounters for a monster only met in defeat', () => {
    render(
      <BestiaryCard
        entry={{ id: 'goblin', name: 'Goblin', element: 'wind', seen: true, kills: 0, encounters: 3 }}
      />,
    );

    expect(screen.getByText('3 encounters')).toBeInTheDocument();
  });

  it('marks a seen card as unlocked', () => {
    const { container } = render(<BestiaryCard entry={seen} />);

    const card = container.querySelector('.bestiary-card');
    expect(card).toHaveClass('medal-card--unlocked');
    expect(card).not.toHaveClass('medal-card--locked');
  });
});
