import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Forge from '../../pages/Forge';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getItemById } from '../../utils/equipmentUtils';
import type { Character } from '../../types/Character';
import { ESSENCE_SOFT_CAP } from '../../data/forgeConstants';

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
const FLAME_DAGGER = getItemById('flame_dagger')!;

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

function renderForge() {
  return render(
    <MemoryRouter initialEntries={['/forge']}>
      <Forge />
    </MemoryRouter>,
  );
}

// ─── Forge Page Tests ───────────────────────────────────────────────────────

describe('Forge Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('renders the Forge page with all tabs', () => {
    const char = makeCharacter({ inventory: [], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Title
    expect(screen.getByText('FORGE')).toBeInTheDocument();

    // Tab labels appear — may also appear in panel titles
    const salvageLabels = screen.getAllByText('SALVAGE');
    expect(salvageLabels.length).toBeGreaterThanOrEqual(1);
    const fusionLabels = screen.getAllByText('FUSION');
    expect(fusionLabels.length).toBeGreaterThanOrEqual(1);
    const upgradeLabels = screen.getAllByText('UPGRADE');
    expect(upgradeLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the essence counter', () => {
    const char = makeCharacter({ inventory: [], essence: 42 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    const essenceValues = screen.getAllByText(/42/);
    expect(essenceValues.length).toBeGreaterThanOrEqual(1);
    // Essence label appears in both header and salvage panel
    const essenceLabels = screen.getAllByText(/ESSENCE/);
    expect(essenceLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows essence near cap warning', () => {
    const char = makeCharacter({
      inventory: [FLAME_DAGGER.id],
      essence: ESSENCE_SOFT_CAP - 10,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    const nearCapElements = screen.getAllByText(/near cap/i);
    expect(nearCapElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays the Salvage panel by default', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Salvage panel should show items
    expect(screen.getByText(/Rusty Sword/i)).toBeInTheDocument();
  });

  it('switches to Fusion tab and shows fusion panel', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Click Fusion tab
    const fusionTab = screen.getByText('FUSION');
    fireEvent.click(fusionTab);

    // Should show fusion content
    expect(screen.getByText(/combine 3 items/i)).toBeInTheDocument();
  });

  it('switches to Upgrade tab and shows upgrade panel', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 100 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Click Upgrade tab
    const upgradeTab = screen.getByText('UPGRADE');
    fireEvent.click(upgradeTab);

    // Should show upgrade content
    expect(screen.getByText(/select an item to upgrade/i)).toBeInTheDocument();
  });

  it('shows empty salvage state when inventory is empty', () => {
    const char = makeCharacter({ inventory: [], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it('shows back to arena button', () => {
    const char = makeCharacter({ inventory: [], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    const backButtons = screen.getAllByText(/BACK TO ARENA|←/);
    expect(backButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render when no active character (redirects)', () => {
    setupGame({ activeCharacter: null });
    const { container } = renderForge();
    // Should render nothing (Navigate component redirects)
    expect(container.textContent).toBe('');
  });
});

// ─── ForgeEssenceDisplay ────────────────────────────────────────────────────

describe('ForgeEssenceDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders essence value', () => {
    const char = makeCharacter({ inventory: [], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Essence appears in both header and panel — check at least one
    const essenceValues = screen.getAllByText('50');
    expect(essenceValues.length).toBeGreaterThanOrEqual(1);
  });

  it('shows soft cap warning when essence is near cap', () => {
    const char = makeCharacter({
      inventory: [FLAME_DAGGER.id],
      essence: ESSENCE_SOFT_CAP - 10,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    const nearCapElements = screen.getAllByText(/near cap/i);
    expect(nearCapElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows maxed indicator when essence is at cap', () => {
    const char = makeCharacter({
      inventory: [FLAME_DAGGER.id],
      essence: ESSENCE_SOFT_CAP,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    const maxedElements = screen.getAllByText(/MAXED/i);
    expect(maxedElements.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── SalvagePanel in Forge ──────────────────────────────────────────────────

describe('SalvagePanel (inside Forge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('shows items grouped by rarity', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, FLAME_DAGGER.id],
      essence: 50,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Salvage tab is default, should show items
    expect(screen.getByText(/Rusty Sword/i)).toBeInTheDocument();
    expect(screen.getByText(/Worn Bracers/i)).toBeInTheDocument();
    expect(screen.getByText(/Flame Dagger/i)).toBeInTheDocument();
  });

  it('shows essence yield per item', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 50 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Rusty Sword is common, yields 5 essence — find yield text in item card
    const yieldTexts = screen.getAllByText(/[+]5 Essence/);
    expect(yieldTexts.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── FusionPanel in Forge ───────────────────────────────────────────────────

describe('FusionPanel (inside Forge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('shows empty state when not enough items', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Switch to Fusion tab
    fireEvent.click(screen.getByText('FUSION'));

    expect(screen.getByText(/not enough items|need at least 3/i)).toBeInTheDocument();
  });

  it('shows items available for fusion selection', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id, WORN_BRACERS.id, LUCKY_CHARM.id],
      essence: 100,
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Switch to Fusion tab
    fireEvent.click(screen.getByText('FUSION'));

    expect(screen.getByText(/Rusty Sword/i)).toBeInTheDocument();
    expect(screen.getByText(/Worn Bracers/i)).toBeInTheDocument();
    expect(screen.getByText(/Lucky Charm/i)).toBeInTheDocument();
  });
});

// ─── UpgradePanel in Forge ──────────────────────────────────────────────────

describe('UpgradePanel (inside Forge)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('shows items in inventory for selection', () => {
    const char = makeCharacter({ inventory: [RUSTY_SWORD.id], essence: 100 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Switch to Upgrade tab
    fireEvent.click(screen.getByText('UPGRADE'));

    expect(screen.getByText(/Rusty Sword/i)).toBeInTheDocument();
  });

  it('shows disabled state when inventory is empty', () => {
    const char = makeCharacter({ inventory: [], essence: 100 });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Switch to Upgrade tab
    fireEvent.click(screen.getByText('UPGRADE'));

    expect(screen.getByText(/no items|nothing to upgrade/i)).toBeInTheDocument();
  });

  it('shows upgrade details when item is selected', () => {
    const char = makeCharacter({
      inventory: [RUSTY_SWORD.id],
      essence: 100,
      itemUpgrades: { rusty_sword: 2 },
    });
    setupGame({ activeCharacter: char, essence: char.essence });
    renderForge();

    // Switch to Upgrade tab
    fireEvent.click(screen.getByText('UPGRADE'));

    // Select the item
    const selectBtn = screen.getByRole('button', { name: /select.*rusty sword/i });
    fireEvent.click(selectBtn);

    // Check for upgrade level indicator
    expect(screen.getByText(/[+]2 \/ 5/)).toBeInTheDocument();
  });
});
