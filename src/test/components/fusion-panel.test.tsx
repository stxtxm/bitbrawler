import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FusionPanel } from '../../components/forge/FusionPanel';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getItemById } from '../../utils/equipmentUtils';
import type { Character } from '../../types/Character';
import { FUSION_COST } from '../../data/forgeConstants';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;

// ─── Test Data ──────────────────────────────────────────────────────────────

const RUSTY_SWORD = getItemById('rusty_sword')!;
const WORN_BRACERS = getItemById('worn_bracers')!;
const LUCKY_CHARM = getItemById('lucky_charm')!;
const NOVICE_WRAP = getItemById('novice_wrap')!;
const BONE_DAGGER = getItemById('bone_dagger')!;
const makeCharacter = (overrides?: Partial<Character>): Character => ({
  seed: 'test-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
  experience: 100,
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
  ...overrides,
});

const defaultNotify = vi.fn();

function setupGame(overrides: Record<string, unknown> = {}) {
  const defaults = {
    activeCharacter: null,
    loading: false,
    dbAvailable: true,
    essence: 0,
    salvageItems: vi.fn(),
    fuseItems: vi.fn(),
    upgradeItem: vi.fn(),
    ...overrides,
  };
  mockUseGame.mockReturnValue(defaults);
  return defaults;
}

function setupNotify() {
  defaultNotify.mockClear();
  mockUseNotification.mockReturnValue({ notify: defaultNotify });
}

// ─── FusionPanel ────────────────────────────────────────────────────────────

describe('FusionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('shows empty state when not enough items of same rarity', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id], // only 2 common items
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<FusionPanel onClose={vi.fn()} />);

    expect(screen.getByText(/not enough items|need at least 3/i)).toBeInTheDocument();
  });

  it('renders with items available for fusion', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id, BONE_DAGGER.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<FusionPanel onClose={vi.fn()} />);

    expect(screen.getByText('FUSION')).toBeInTheDocument();
    // Fusionable items from inventory should display
    expect(screen.getByText('Rusty Sword')).toBeInTheDocument();
    expect(screen.getByText('Worn Bracers')).toBeInTheDocument();
    expect(screen.getByText('Lucky Charm')).toBeInTheDocument();
  });

  it('shows fusion cost when items are selected', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<FusionPanel onClose={vi.fn()} />);

    // Select all 3 items by clicking toggle buttons
    const toggleBtns = screen.getAllByRole('button', { name: /toggle/i });
    expect(toggleBtns.length).toBeGreaterThanOrEqual(3);
    toggleBtns.slice(0, 3).forEach((btn) => fireEvent.click(btn));

    // Now the cost should display
    expect(screen.getByText(new RegExp(`Cost: ${FUSION_COST.common} Essence`, 'i'))).toBeInTheDocument();
  });

  it('shows disabled fuse button with insufficient essence', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 1, // Not enough for common fusion cost (5)
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<FusionPanel onClose={vi.fn()} />);

    const toggleBtns = screen.getAllByRole('button', { name: /toggle/i });
    toggleBtns.slice(0, 3).forEach((btn) => fireEvent.click(btn));

    const fuseBtn = screen.getByRole('button', { name: /fuse items/i });
    expect(fuseBtn).toBeDisabled();
  });

  it('shows fusion result toast on success', async () => {
    const resultItem = NOVICE_WRAP;
    const fuseItems = vi.fn().mockResolvedValue({
      result: resultItem,
      updatedChar: makeCharacter({
        inventory: [NOVICE_WRAP.id],
        essence: 95,
      }),
    });
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence, fuseItems });
    render(<FusionPanel onClose={vi.fn()} />);

    // Select all 3 items
    const toggleBtns = screen.getAllByRole('button', { name: /toggle/i });
    toggleBtns.slice(0, 3).forEach((btn) => fireEvent.click(btn));

    // Click fuse button (aria-label="Fuse items")
    const fuseBtn = screen.getByRole('button', { name: /fuse items/i });
    fireEvent.click(fuseBtn);

    await waitFor(() => {
      expect(fuseItems).toHaveBeenCalled();
    });
    expect(defaultNotify).toHaveBeenCalledWith(
      expect.stringContaining('Fusion successful'),
      'success',
      expect.any(Number),
    );
  });

  it('handles inventory full error', async () => {
    const fuseItems = vi.fn().mockResolvedValue({
      result: null,
      updatedChar: null,
    });
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence, fuseItems });
    render(<FusionPanel onClose={vi.fn()} />);

    // Select items and try to fuse
    const toggleBtns = screen.getAllByRole('button', { name: /toggle/i });
    toggleBtns.slice(0, 3).forEach((btn) => fireEvent.click(btn));

    const fuseBtn = screen.getByRole('button', { name: /fuse items/i });
    fireEvent.click(fuseBtn);

    await waitFor(() => {
      expect(fuseItems).toHaveBeenCalled();
    });
  });
});
