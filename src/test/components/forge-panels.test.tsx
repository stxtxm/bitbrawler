import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SalvagePanel } from '../../components/forge/SalvagePanel';
import { FusionPanel } from '../../components/forge/FusionPanel';
import { UpgradePanel } from '../../components/forge/UpgradePanel';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getItemById } from '../../utils/equipmentUtils';
import type { Character } from '../../types/Character';
import {
  ESSENCE_YIELD,
  FUSION_COST,
  UPGRADE_COST,
  MAX_UPGRADE_LEVEL,
  ESSENCE_SOFT_CAP,
} from '../../data/forgeConstants';

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
const WOODEN_TALISMAN = getItemById('wooden_talisman')!;
const FLAME_DAGGER = getItemById('flame_dagger')!;
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

// ─── SalvagePanel ──────────────────────────────────────────────────────────

describe('SalvagePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('renders empty state when inventory is empty', () => {
    const char = makeCharacter({ inventory: [] });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<SalvagePanel onClose={vi.fn()} />);

    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it('groups items by rarity showing rarity labels', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, NOVICE_WRAP.id, WOODEN_TALISMAN.id],
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<SalvagePanel onClose={vi.fn()} />);

    const headers = screen.getAllByText(/COMMON|UNCOMMON|RARE/);
    expect(headers.length).toBeGreaterThanOrEqual(3);
  });

  it('shows essence yield per item', () => {
    const char = makeCharacter({ inventory: [FLAME_DAGGER.id] });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<SalvagePanel onClose={vi.fn()} />);

    expect(screen.getByText((content) => content.includes('250'))).toBeInTheDocument();
    expect(screen.getByText(/Flame Dagger/)).toBeInTheDocument();
  });

  it('calls salvageItems and shows toast on salvage', async () => {
    const salvageItems = vi.fn().mockResolvedValue(
      makeCharacter({ inventory: [], essence: ESSENCE_YIELD.common }),
    );
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 5 });
    setupGame({ activeCharacter: char, essence: char.essence, salvageItems });
    render(<SalvagePanel onClose={vi.fn()} />);

    // Click salvage button — shows confirmation dialog
    const salvageBtn = screen.getByRole('button', { name: /salvage.*rusty sword/i });
    fireEvent.click(salvageBtn);

    // Confirmation dialog should appear
    const confirmBtn = screen.getByRole('button', { name: /confirm salvage/i });
    expect(confirmBtn).toBeInTheDocument();

    // Click confirm
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(salvageItems).toHaveBeenCalledWith(RUSTY_SWORD.id);
    });
    expect(defaultNotify).toHaveBeenCalledWith(
      expect.stringContaining('Salvaged'),
      'success',
      expect.any(Number),
    );
  });

  it('shows essence soft cap warning when near cap', () => {
    const char = makeCharacter({
      inventory: [FLAME_DAGGER.id],
      essence: ESSENCE_SOFT_CAP - 10,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<SalvagePanel onClose={vi.fn()} />);

    expect(screen.getByText(/essence.*cap|cap.*essence|soft.*cap/i)).toBeInTheDocument();
  });

  it('shows 0 essence state', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 0 });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<SalvagePanel onClose={vi.fn()} />);

    // Should still show essence as 0 but items are salvageable
    const essenceValues = screen.getAllByText('0');
    expect(essenceValues.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Rusty Sword/)).toBeInTheDocument();
  });
});

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

// ─── UpgradePanel ──────────────────────────────────────────────────────────

describe('UpgradePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('shows disabled state when inventory is empty', () => {
    const char = makeCharacter({ inventory: [] });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    expect(screen.getByText(/no items|empty|nothing to upgrade/i)).toBeInTheDocument();
  });

  it('displays items in inventory for selection', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 100 });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    expect(screen.getByText(/Rusty Sword/)).toBeInTheDocument();
  });

  it('shows upgrade details when item is selected', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 100,
      itemUpgrades: { rusty_sword: 2 },
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    // Select the item
    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    // The "Current" row shows the level (use getAllByText and check for the right one)
    const currentTexts = screen.getAllByText(/[+]2 \/ 5/);
    expect(currentTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('disables button and shows max level indicator when item is maxed', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 100,
      itemUpgrades: { rusty_sword: MAX_UPGRADE_LEVEL },
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    // Select the maxed item
    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    // Check for maxed indicator in the details panel (there may be multiple "MAX" elements)
    const maxedElements = screen.getAllByText(/MAX LEVEL REACHED|MAXED/);
    expect(maxedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows upgrade failure toast when upgrade returns null', async () => {
    const upgradeItem = vi.fn().mockResolvedValue(null);
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: UPGRADE_COST * 2,
    });
    setupGame({ activeCharacter: char, essence: char.essence, upgradeItem });
    render(<UpgradePanel onClose={vi.fn()} />);

    // Select the item
    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    // Get the upgrade action button (aria-label="Upgrade item")
    const upgradeActionBtn = screen.getByRole('button', { name: /upgrade item/i });

    fireEvent.click(upgradeActionBtn);

    await waitFor(() => {
      expect(upgradeItem).toHaveBeenCalledWith(RUSTY_SWORD.id);
    });
  });

  it('shows essence soft cap warning when near cap', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: ESSENCE_SOFT_CAP - 10,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    expect(screen.getByText(/essence.*cap|cap.*essence|soft.*cap/i)).toBeInTheDocument();
  });

  it('shows disabled upgrade button with 0 essence', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 0,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    const upgradeActionBtn = screen.getByRole('button', { name: /upgrade item/i });
    expect(upgradeActionBtn).toBeDisabled();
  });

  it('shows upgrade level on items in the grid', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 100,
      itemUpgrades: { rusty_sword: 3 },
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    render(<UpgradePanel onClose={vi.fn()} />);

    // The item should show +3 in the grid
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('performs upgrade and shows success toast', async () => {
    const upgradeItem = vi.fn().mockResolvedValue(
      makeCharacter({
        inventory: [RUSTY_SWORD.id],
        essence: 75,
        itemUpgrades: { rusty_sword: 1 },
      }),
    );
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence, upgradeItem });
    render(<UpgradePanel onClose={vi.fn()} />);

    // Select item
    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    // Get upgrade action button (aria-label="Upgrade item")
    const upgradeActionBtn = screen.getByRole('button', { name: /upgrade item/i });

    fireEvent.click(upgradeActionBtn);

    await waitFor(() => {
      expect(upgradeItem).toHaveBeenCalledWith(RUSTY_SWORD.id);
    });
    expect(defaultNotify).toHaveBeenCalledWith(
      expect.stringContaining('Upgrade success'),
      'success',
      expect.any(Number),
    );
  });
});
