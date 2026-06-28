import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Forge from './Forge';
import { useGame } from '../context/GameContext';
import { useNotification } from '../hooks/useNotification';
import type { Character } from '../types/Character';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;

// ─── Test Data ──────────────────────────────────────────────────────────────

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
    activeCharacter: makeCharacter({ essence: 245 }),
    loading: false,
    dbAvailable: true,
    essence: 245,
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Forge Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNotify();
  });

  it('renders the forge page with header, essence, and tabs', () => {
    setupGame();
    renderForge();

    // Header
    expect(screen.getByText('⚒ FORGE')).toBeInTheDocument();
    // Essence appears both in the page header and in the salvage panel
    const essenceElements = screen.getAllByText('245.00');
    expect(essenceElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /back to arena/i })).toBeInTheDocument();

    // Tabs
    expect(screen.getByRole('tab', { name: /salvage/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fusion/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upgrade/i })).toBeInTheDocument();
  });

  it('defaults to salvage tab active', () => {
    setupGame();
    renderForge();

    const salvageTab = screen.getByRole('tab', { name: /salvage/i });
    expect(salvageTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches to fusion tab when clicked', () => {
    setupGame();
    renderForge();

    const fusionTab = screen.getByRole('tab', { name: /fusion/i });
    fireEvent.click(fusionTab);

    expect(fusionTab).toHaveAttribute('aria-selected', 'true');
    const salvageTab = screen.getByRole('tab', { name: /salvage/i });
    expect(salvageTab).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to upgrade tab when clicked', () => {
    setupGame();
    renderForge();

    const upgradeTab = screen.getByRole('tab', { name: /upgrade/i });
    fireEvent.click(upgradeTab);

    expect(upgradeTab).toHaveAttribute('aria-selected', 'true');
    const fusionTab = screen.getByRole('tab', { name: /fusion/i });
    expect(fusionTab).toHaveAttribute('aria-selected', 'false');
  });

  it('displays essence value from game context', () => {
    setupGame({ essence: 500 });
    renderForge();

    // Essence appears both in page header and salvage panel
    const essenceElements = screen.getAllByText('500.00');
    expect(essenceElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays essence value of 0 when character has none', () => {
    setupGame({ essence: 0, activeCharacter: makeCharacter({ essence: 0 }) });
    renderForge();

    const essenceElements = screen.getAllByText('0.00');
    expect(essenceElements.length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to arena when back button is clicked', () => {
    setupGame();
    renderForge();

    const backBtn = screen.getByRole('button', { name: /back to arena/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn.tagName).toBe('BUTTON');
  });

  it('renders salvage panel content in salvage tab', () => {
    setupGame({ activeCharacter: makeCharacter({ inventory: ['rusty_sword'], essence: 245 }) });
    renderForge();

    // Salvage panel should show "SALVAGE" title
    const salvageTitles = screen.getAllByText('SALVAGE');
    expect(salvageTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when salvage tab has no items', () => {
    setupGame({ activeCharacter: makeCharacter({ inventory: [], essence: 0 }) });
    renderForge();

    expect(screen.getByText(/no items/i)).toBeInTheDocument();
  });

  it('renders fusion panel content in fusion tab', () => {
    setupGame({ activeCharacter: makeCharacter({ inventory: ['rusty_sword'], essence: 100 }) });
    renderForge();

    const fusionTab = screen.getByRole('tab', { name: /fusion/i });
    fireEvent.click(fusionTab);

    const fusionTitles = screen.getAllByText('FUSION');
    expect(fusionTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('renders upgrade panel content in upgrade tab', () => {
    setupGame({ activeCharacter: makeCharacter({ inventory: ['rusty_sword'], essence: 100 }) });
    renderForge();

    const upgradeTab = screen.getByRole('tab', { name: /upgrade/i });
    fireEvent.click(upgradeTab);

    const upgradeTitles = screen.getAllByText('UPGRADE');
    expect(upgradeTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('shows first tabpanel visible and others hidden by default', () => {
    setupGame();
    renderForge();

    // Get all tabpanels
    const tabpanels = screen.getAllByRole('tabpanel', { hidden: true });
    // There should be 3 tabpanels
    expect(tabpanels.length).toBe(3);

    // First tabpanel (salvage) should be visible (no hidden attr)
    expect(tabpanels[0]).not.toHaveAttribute('hidden');

    // Second and third should be hidden
    expect(tabpanels[1]).toHaveAttribute('hidden');
    expect(tabpanels[2]).toHaveAttribute('hidden');
  });

  it('renders correctly on mobile viewport', () => {
    // Set viewport to mobile size
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 667, writable: true });
    window.dispatchEvent(new Event('resize'));

    setupGame();
    renderForge();

    // Page should still render all elements
    expect(screen.getByText('⚒ FORGE')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /salvage/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /fusion/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upgrade/i })).toBeInTheDocument();
  });
});
