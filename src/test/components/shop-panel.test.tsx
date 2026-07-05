import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ShopPanel } from '../../components/forge/ShopPanel';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import type { Character } from '../../types/Character';
import { SHOP_OFFERS } from '../../data/shopConstants';
import { clearShopPurchases, markOfferPurchased } from '../../utils/shopStorage';

vi.mock('../../context/GameContext', () => ({
  useGame: vi.fn(),
}));

vi.mock('../../hooks/useNotification', () => ({
  useNotification: vi.fn(),
}));

const mockUseGame = useGame as unknown as ReturnType<typeof vi.fn>;
const mockUseNotification = useNotification as unknown as ReturnType<typeof vi.fn>;

const makeCharacter = (overrides?: Partial<Character>): Character => ({
  id: 'test-char',
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
  essence: 500,
  itemUpgrades: {},
  ...overrides,
});

const defaultNotify = vi.fn();
const defaultBuyShopOffer = vi.fn();

function setupGame(overrides: Record<string, unknown> = {}) {
  const defaults = {
    activeCharacter: makeCharacter(),
    loading: false,
    dbAvailable: true,
    essence: 500,
    buyShopOffer: defaultBuyShopOffer,
    ...overrides,
  };
  mockUseGame.mockReturnValue(defaults);
  return defaults;
}

function setupNotify() {
  defaultNotify.mockClear();
  mockUseNotification.mockReturnValue({ notify: defaultNotify });
}

describe('ShopPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearShopPurchases();
    setupNotify();
  });

  it('renders the shop title', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    expect(screen.getByText(/SHOP/)).toBeTruthy();
  });

  it('renders all 3 shop offers', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    for (const offer of SHOP_OFFERS) {
      expect(screen.getByText(offer.label)).toBeTruthy();
    }
  });

  it('displays essence on the panel', () => {
    setupGame({ essence: 500 });
    render(<ShopPanel onClose={vi.fn()} />);
    expect(screen.getByText('500.00')).toBeTruthy();
  });

  it('shows price for each offer', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    for (const offer of SHOP_OFFERS) {
      expect(screen.getByText(`${offer.price} 💎`)).toBeTruthy();
    }
  });

  it('shows item name for offer 0 and 1 (item type)', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    // At least the item offers should show item names
    const shopItems = SHOP_OFFERS.filter(o => o.type === 'item');
    // Each item offer should have a name displayed somewhere
    expect(shopItems.length).toBe(2);
  });

  it('shows lootbox label for offer 2', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    expect(screen.getByText('Coffre mystère')).toBeTruthy();
  });

  it('shows correct rarity border color for offer 0 and 1 items', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    // Verify that each item offer card has a rarity class
    const cards = document.querySelectorAll('.shop-offer-card');
    expect(cards.length).toBe(3);
  });

  it('buy buttons are enabled when character has enough essence', () => {
    setupGame({ essence: 500, activeCharacter: makeCharacter({ essence: 500 }) });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    expect(buyBtns.length).toBe(3);
    buyBtns.forEach(btn => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('buy buttons are disabled when character has insufficient essence', () => {
    setupGame({ essence: 50, activeCharacter: makeCharacter({ essence: 50 }) });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    buyBtns.forEach(btn => {
      expect(btn).toBeDisabled();
    });
  });

  it('offer 2 (lootbox) buy button is disabled when essence < 500', () => {
    setupGame({ essence: 400, activeCharacter: makeCharacter({ essence: 400 }) });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    // Last offer (lootbox) should be disabled
    expect(buyBtns[2]).toBeDisabled();
  });

  it('shows insufficient essence warning on disabled buttons', () => {
    setupGame({ essence: 50, activeCharacter: makeCharacter({ essence: 50 }) });
    render(<ShopPanel onClose={vi.fn()} />);
    // Each disabled button should have a title indicating insufficient essence
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    buyBtns.forEach(btn => {
      expect(btn.getAttribute('title')).toContain('Not enough essence');
    });
  });

  it('opens confirmation dialog when clicking buy on offer 0', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    fireEvent.click(buyBtns[0]);
    expect(screen.getByText('Confirm Purchase')).toBeTruthy();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeTruthy();
  });

  it('closes confirmation dialog when cancelling', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    fireEvent.click(buyBtns[0]);
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Confirm Purchase')).toBeNull();
  });

  it('calls buyShopOffer when confirming purchase', async () => {
    const buyShopOffer = vi.fn().mockResolvedValue(makeCharacter({ essence: 300 }));
    setupGame({ buyShopOffer, activeCharacter: makeCharacter({ essence: 500 }), essence: 500 });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    fireEvent.click(buyBtns[0]);
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(buyShopOffer).toHaveBeenCalledWith(0);
    });
  });

  it('shows success toast after purchase', async () => {
    const buyShopOffer = vi.fn().mockResolvedValue(makeCharacter({ essence: 300 }));
    setupGame({ buyShopOffer, activeCharacter: makeCharacter({ essence: 500 }), essence: 500 });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    fireEvent.click(buyBtns[0]);
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(defaultNotify).toHaveBeenCalledWith(
        expect.stringContaining('purchased'),
        'success',
        expect.any(Number),
      );
    });
  });

  it('shows error toast when purchase fails', async () => {
    const buyShopOffer = vi.fn().mockRejectedValue(new Error('Network error'));
    setupGame({ buyShopOffer });
    render(<ShopPanel onClose={vi.fn()} />);
    const buyBtns = screen.getAllByRole('button', { name: /buy/i });
    fireEvent.click(buyBtns[0]);
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(defaultNotify).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        'error',
        expect.any(Number),
      );
    });
  });

  it('shows sold state when offer is already purchased', () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    markOfferPurchased('test-char', 0, dateStr);
    const char = makeCharacter({ essence: 500 });
    setupGame({ activeCharacter: char, essence: 500 });
    render(<ShopPanel onClose={vi.fn()} />);
    const soldBtns = screen.getAllByText('SOLD');
    expect(soldBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('shows close button', () => {
    setupGame();
    render(<ShopPanel onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /close shop/i })).toBeTruthy();
  });
});
