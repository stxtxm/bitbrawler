import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompendiumPanel } from '../../components/compendium/CompendiumPanel';
import type { Character } from '../../types/Character';

const character: Character = {
  id: 'hero-id',
  seed: 'seed',
  name: 'Hero',
  gender: 'male',
  level: 5,
  experience: 200,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 100,
  maxHp: 100,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
  inventory: ['rusty_sword'],
  equippedItems: { weapon: null, armor: null, accessory: null },
  monsterKills: { goblin: 4 },
  monsterEncounters: { goblin: 6 },
  codex: ['rusty_sword'],
};

describe('CompendiumPanel', () => {
  it('opens on the bestiary with discovered and unknown monsters', () => {
    render(<CompendiumPanel character={character} />);

    expect(screen.getByRole('tab', { name: /Bestiary/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getByText('Kills: 4')).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
  });

  it('switches to the armory and reveals seen items', () => {
    render(<CompendiumPanel character={character} />);

    fireEvent.click(screen.getByRole('tab', { name: /Armory/i }));

    expect(screen.getByText('Rusty Sword')).toBeInTheDocument();
    expect(screen.getByText('COMMON')).toBeInTheDocument();
  });

  it('renders a zero state without a character', () => {
    render(<CompendiumPanel character={null} />);
    expect(screen.getByText(/NO CHARACTER/i)).toBeInTheDocument();
  });
});
