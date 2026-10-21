import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompendiumPanel } from '../../components/compendium/CompendiumPanel';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { CODEX_ENTRIES } from '../../data/codex';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import type { Character } from '../../types/Character';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;
const notify = vi.fn();

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'test-char',
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
  experience: 0,
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
  fightsLeft: 3,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 0,
  itemUpgrades: {},
  monsterKills: {},
  codex: [],
  ...overrides,
});

const setupCharacter = (character: Character | null) => {
  mockUseGame.mockReturnValue({ activeCharacter: character });
};

describe('CompendiumPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotification.mockReturnValue({ notify });
  });

  it('renders the bestiary and armory tabs', () => {
    setupCharacter(makeCharacter());
    render(<CompendiumPanel />);

    expect(screen.getByRole('tab', { name: /bestiary/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /armory/i })).toBeInTheDocument();
  });

  it('shows 0% completion for a fresh character without crashing', () => {
    setupCharacter(makeCharacter());
    render(<CompendiumPanel />);

    expect(screen.getByTestId('compendium-global-pct')).toHaveTextContent('0%');
  });

  it('computes the weighted global completion across both collections', () => {
    const seenItems = [CODEX_ENTRIES[0].id, CODEX_ENTRIES[1].id];
    setupCharacter(makeCharacter({ monsterKills: { goblin: 1 }, codex: seenItems }));
    render(<CompendiumPanel />);

    const expected = Math.round(
      ((1 + seenItems.length) / (MONSTER_ASSETS.length + CODEX_ENTRIES.length)) * 100,
    );

    expect(screen.getByTestId('compendium-global-pct')).toHaveTextContent(`${expected}%`);
  });

  it('reveals a seen monster and keeps unknown monsters hidden', () => {
    setupCharacter(makeCharacter({ monsterKills: { goblin: 2 } }));
    render(<CompendiumPanel />);

    expect(screen.getByText('Goblin')).toBeInTheDocument();
    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
  });

  it('renders the shared BestiaryCard for every bestiary entry', () => {
    setupCharacter(makeCharacter({ monsterKills: { goblin: 2 } }));
    const { container } = render(<CompendiumPanel />);

    expect(container.querySelectorAll('.bestiary-card')).toHaveLength(MONSTER_ASSETS.length);
    expect(container.querySelector('.compendium-card__visual')).toBeNull();
  });

  it('shows a discovered armory entry and its name in the armory tab', () => {
    const item = CODEX_ENTRIES[0];
    setupCharacter(makeCharacter({ codex: [item.id] }));
    render(<CompendiumPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /armory/i }));

    expect(screen.getByText(item.name)).toBeInTheDocument();
    expect(screen.getByText(item.rarity.toUpperCase())).toBeInTheDocument();
  });

  it('renders the shared ArmoryCard for every codex entry', () => {
    const item = CODEX_ENTRIES[0];
    setupCharacter(makeCharacter({ codex: [item.id] }));
    const { container } = render(<CompendiumPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /armory/i }));

    expect(container.querySelectorAll('.compendium-card--item')).toHaveLength(
      CODEX_ENTRIES.length,
    );
    expect(container.querySelector('.compendium-card__visual')).toBeNull();
  });

  it('exposes the compendium header and bestiary style hooks', () => {
    setupCharacter(makeCharacter({ monsterKills: { goblin: 2 } }));
    const { container } = render(<CompendiumPanel />);

    expect(container.querySelector('.compendium-panel')).not.toBeNull();
    expect(container.querySelector('.compendium-global')).not.toBeNull();
    expect(container.querySelector('.compendium-global__value')).not.toBeNull();
    expect(container.querySelector('.compendium-global__label')).not.toBeNull();
    expect(container.querySelector('.compendium-global__counts')).not.toBeNull();
    expect(container.querySelector('.bestiary-card')).not.toBeNull();
    expect(container.querySelector('.bestiary-card__sprite')).not.toBeNull();
    expect(container.querySelector('.bestiary-card__info')).not.toBeNull();
    expect(container.querySelector('.bestiary-card__element')).not.toBeNull();
    expect(container.querySelector('.bestiary-card__kills')).not.toBeNull();
  });

  it('exposes the armory card style hooks', () => {
    const item = CODEX_ENTRIES[0];
    setupCharacter(makeCharacter({ codex: [item.id] }));
    const { container } = render(<CompendiumPanel />);

    fireEvent.click(screen.getByRole('tab', { name: /armory/i }));

    const card = container.querySelector('.compendium-card--item');
    expect(card).not.toBeNull();
    expect(card?.querySelector('.compendium-card__art')).not.toBeNull();
    expect(card?.querySelector('.compendium-card__name')).not.toBeNull();
    expect(card?.querySelector('.compendium-card__meta')).not.toBeNull();
    expect(card?.querySelector('.compendium-icon')).not.toBeNull();
  });

  it('notifies once when a monster is discovered and never repeats it', () => {
    setupCharacter(makeCharacter());
    const { rerender } = render(<CompendiumPanel />);

    setupCharacter(makeCharacter({ monsterKills: { goblin: 1 } }));
    rerender(<CompendiumPanel />);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Nouveau : Goblin débloqué !', 'success', 3000);

    rerender(<CompendiumPanel />);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('notifies when a monster is discovered through an encounter in defeat', () => {
    setupCharacter(makeCharacter());
    const { rerender } = render(<CompendiumPanel />);

    setupCharacter(makeCharacter({ monsterEncounters: { goblin: 1 } }));
    rerender(<CompendiumPanel />);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('Nouveau : Goblin débloqué !', 'success', 3000);
  });

  it('notifies once when an item is discovered and never repeats it', () => {
    const item = CODEX_ENTRIES[0];
    setupCharacter(makeCharacter());
    const { rerender } = render(<CompendiumPanel />);

    setupCharacter(makeCharacter({ codex: [item.id] }));
    rerender(<CompendiumPanel />);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(`Nouveau : ${item.name} débloqué !`, 'success', 3000);

    rerender(<CompendiumPanel />);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not notify on the initial mount for an existing collection', () => {
    setupCharacter(makeCharacter({ monsterKills: { goblin: 1 }, codex: [CODEX_ENTRIES[0].id] }));
    render(<CompendiumPanel />);

    expect(notify).not.toHaveBeenCalled();
  });
});
