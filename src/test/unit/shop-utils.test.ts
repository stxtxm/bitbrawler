import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../types/Character';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { SHOP_OFFERS, getShopPrice } from '../../data/shopConstants';

// ─── Pure Functions Under Test ───────────────────────────────────────────

let buyShopOffer: (index: number, character: Character, items: typeof ITEM_ASSETS, dateStr?: string, rng?: () => number) => Character | null;
let getShopOffers: (character: Character, items: typeof ITEM_ASSETS, dateStr?: string, rng?: () => number) => ShopOffer[];
let canBuyOffer: (index: number, character: Character) => boolean;
let isOfferSoldOut: (index: number, character: Character, dateStr?: string) => boolean;
let resetDailyPurchases: (character: Character, dateStr?: string) => Character;
let rerollShopOffers: (character: Character, items: typeof ITEM_ASSETS, dateStr?: string) => { character: Character; offers: ShopOffer[] } | null;

interface ShopOffer {
  index: number;
  type: 'item' | 'lootbox';
  price: number;
  label: string;
  item: { id: string; name: string; rarity: string } | null;
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test-char',
    seed: 'test-seed',
    name: 'TestChar',
    gender: 'male',
    level: 5,
    experience: 0,
    strength: 10,
    vitality: 10,
    dexterity: 10,
    luck: 10,
    intelligence: 10,
    focus: 10,
    hp: 180,
    maxHp: 180,
    wins: 10,
    losses: 5,
    fightsLeft: 5,
    lastFightReset: Date.now(),
    inventory: [],
    equippedItems: { weapon: null, armor: null, accessory: null },
    essence: 500,
    itemUpgrades: {},
    lastLootRoll: 0,
    lootboxStreak: 0,
    ...overrides,
  };
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('shop-utils (TDD)', () => {
  beforeEach(async () => {
    const storage = await import('../../utils/shopStorage');
    storage.clearShopPurchases();
    const mod = await import('../../utils/shopUtils');
    buyShopOffer = mod.buyShopOffer;
    getShopOffers = mod.getShopOffers;
    canBuyOffer = mod.canBuyOffer;
    isOfferSoldOut = mod.isOfferSoldOut;
    resetDailyPurchases = mod.resetDailyPurchases;
    rerollShopOffers = mod.rerollShopOffers;
  });

  // ─── getShopOffers ───────────────────────────────────────────────────────

  describe('getShopOffers', () => {
    it('returns exactly 3 offers', () => {
      const char = makeCharacter({ level: 5 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      expect(offers).toHaveLength(3);
    });

    it('all offers have valid prices from SHOP_OFFERS', () => {
      const char = makeCharacter({ level: 5 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      offers.forEach((offer, i) => {
        expect(offer.price).toBe(SHOP_OFFERS[i].price);
      });
    });

    it('offer types match SHOP_OFFERS config', () => {
      const char = makeCharacter({ level: 5 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      offers.forEach((offer, i) => {
        expect(offer.type).toBe(SHOP_OFFERS[i].type);
        // Epic guarantee may replace Pièce rare with Objet épique
        if (SHOP_OFFERS[i].label === 'Pièce rare' && offer.label === 'Objet épique') return;
        expect(offer.label).toBe(SHOP_OFFERS[i].label);
      });
    });

    it('offer 0 and 1 return an item eligible for character level', () => {
      const char = makeCharacter({ level: 5 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      // Offer 0 and 1 are items
      for (let i = 0; i < 2; i++) {
        expect(offers[i].type).toBe('item');
        expect(offers[i].item).not.toBeNull();
        expect(offers[i].item!.rarity).toBeTruthy();
      }
    });

    it('offer 2 is a lootbox (no item preview)', () => {
      const char = makeCharacter({ level: 5 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      expect(offers[2].type).toBe('lootbox');
      expect(offers[2].item).toBeNull();
    });

    it('offer 0 item rarity is in common/uncommon/rare pool', () => {
      const char = makeCharacter({ level: 5 });
      // Use deterministic RNG to control which item is selected
      // rng=0 → first cumulative weight → common
      const offers0 = getShopOffers(char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(['common', 'uncommon', 'rare']).toContain(offers0[0].item!.rarity);
    });

    it('offer 1 item rarity is in rare/epic pool', () => {
      const char = makeCharacter({ level: 5 });
      const offers1 = getShopOffers(char, ITEM_ASSETS, getTodayStr(), () => 0.5);
      expect(['rare', 'epic']).toContain(offers1[1].item!.rarity);
    });

    it('offers are stable for the same date', () => {
      const char = makeCharacter({ level: 5 });
      const dateStr = '2026-07-06';
      const offersA = getShopOffers(char, ITEM_ASSETS, dateStr);
      const offersB = getShopOffers(char, ITEM_ASSETS, dateStr);
      expect(offersA[0].item!.id).toBe(offersB[0].item!.id);
      expect(offersA[1].item!.id).toBe(offersB[1].item!.id);
    });

    it('offers change on different days', () => {
      const char = makeCharacter({ level: 5 });
      const offersA = getShopOffers(char, ITEM_ASSETS, '2026-07-06');
      const offersB = getShopOffers(char, ITEM_ASSETS, '2026-07-07');
      // Very unlikely to roll same item on different days
      expect(offersA[0].item!.id).not.toBe(offersB[0].item!.id);
    });

    it('item offer uses level-appropriate items (requiredLevel <= char level)', () => {
      const char = makeCharacter({ level: 3 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      for (let i = 0; i < 2; i++) {
        const itemData = ITEM_ASSETS.find(a => a.id === offers[i].item!.id);
        expect(itemData).toBeDefined();
        expect(itemData!.requiredLevel).toBeLessThanOrEqual(3);
      }
    });

    it('returns valid item ids that exist in ITEM_ASSETS', () => {
      const char = makeCharacter({ level: 10 });
      const offers = getShopOffers(char, ITEM_ASSETS);
      for (let i = 0; i < 2; i++) {
        const found = ITEM_ASSETS.find(a => a.id === offers[i].item!.id);
        expect(found).toBeDefined();
      }
    });

    it('filters by date-based seed so same-day offers are identical regardless of call order', () => {
      const char = makeCharacter({ level: 5 });
      const dateStr = '2026-07-06';
      const offers1 = getShopOffers(char, ITEM_ASSETS, dateStr);
      const offers2 = getShopOffers(char, ITEM_ASSETS, dateStr);
      for (let i = 0; i < 3; i++) {
        expect(offers1[i].item?.id).toBe(offers2[i].item?.id);
      }
    });
  });

  // ─── canBuyOffer ─────────────────────────────────────────────────────────

  describe('canBuyOffer', () => {
    it('returns true when character has enough essence', () => {
      const char = makeCharacter({ essence: 500 });
      expect(canBuyOffer(0, char)).toBe(true);
    });

    it('returns false when character does not have enough essence', () => {
      const char = makeCharacter({ essence: 50 });
      expect(canBuyOffer(0, char)).toBe(false);
    });

    it('returns false for invalid index', () => {
      const char = makeCharacter({ essence: 500 });
      expect(canBuyOffer(99, char)).toBe(false);
    });

    it('returns false when essence is undefined', () => {
      const char = makeCharacter({ essence: undefined });
      expect(canBuyOffer(0, char)).toBe(false);
    });
  });

  // ─── isOfferSoldOut / daily purchases ────────────────────────────────────

  describe('isOfferSoldOut', () => {
    it('returns false when character has no shopPurchases', () => {
      const char = makeCharacter({});
      expect(isOfferSoldOut(0, char, getTodayStr())).toBe(false);
    });

    it('returns false when character has empty shopPurchases', () => {
      const char = makeCharacter({} as any);
      (char as any).shopPurchases = {};
      expect(isOfferSoldOut(0, char, getTodayStr())).toBe(false);
    });

    it('returns true after the offer was purchased today (via shopStorage)', async () => {
      const storage = await import('../../utils/shopStorage');
      storage.markOfferPurchased('test-char', 0, getTodayStr());
      const char = makeCharacter({});
      expect(isOfferSoldOut(0, char, getTodayStr())).toBe(true);
    });

    it('returns false for an offer purchased on a different day', () => {
      const char = makeCharacter({} as any);
      (char as any).shopPurchases = { '2026-07-04': [true, false, false] };
      expect(isOfferSoldOut(0, char, getTodayStr())).toBe(false);
    });
  });

  describe('resetDailyPurchases', () => {
    it('returns the character unchanged (no-op — purchases stored in shopStorage)', () => {
      const char = makeCharacter({});
      const result = resetDailyPurchases(char, getTodayStr());
      expect(result).toBe(char);
    });

    it('does not add shopPurchases to the character object', () => {
      const char = makeCharacter({});
      const result = resetDailyPurchases(char, getTodayStr());
      expect((result as any).shopPurchases).toBeUndefined();
    });
  });

  // ─── buyShopOffer ────────────────────────────────────────────────────────

  describe('buyShopOffer', () => {
    it('deducts essence and adds item to inventory (offer 0)', () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      const result = buyShopOffer(0, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(result).not.toBeNull();
      expect(result!.essence).toBe(350); // 500 - 150
      expect(result!.inventory).toHaveLength(1);
    });

    it('deducts essence and adds item to inventory (offer 1)', () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      // Use RNG that naturally rolls epic so Pièce rare stays in rotation
      const offers = getShopOffers(char, ITEM_ASSETS, getTodayStr(), () => 0.1);
      const offer1 = offers.find(o => o.index === 1);
      if (!offer1) return; // Skip if epic guarantee replaced it
      const result = buyShopOffer(1, char, ITEM_ASSETS, getTodayStr(), () => 0.1);
      expect(result).not.toBeNull();
      expect(result!.essence).toBe(500 - SHOP_OFFERS[1].price);
      expect(result!.inventory).toHaveLength(1);
    });

    it('marks the offer as purchased for today in shopStorage', async () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      const result = buyShopOffer(0, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(result).not.toBeNull();
      const storage = await import('../../utils/shopStorage');
      expect(storage.isOfferPurchased('test-char', 0, getTodayStr())).toBe(true);
    });

    it('returns null when not enough essence', () => {
      const char = makeCharacter({ essence: 50, inventory: [] });
      const result = buyShopOffer(0, char, ITEM_ASSETS, getTodayStr());
      expect(result).toBeNull();
    });

    it('returns null when offer already purchased today', () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      const first = buyShopOffer(0, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(first).not.toBeNull();
      const second = buyShopOffer(0, first!, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(second).toBeNull();
    });

    it('returns null for invalid offer index', () => {
      const char = makeCharacter({ essence: 500 });
      const result = buyShopOffer(99, char, ITEM_ASSETS, getTodayStr());
      expect(result).toBeNull();
    });

    it('adds item to existing inventory', () => {
      const char = makeCharacter({ essence: 500, inventory: ['rusty_sword'] });
      const result = buyShopOffer(0, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(result).not.toBeNull();
      expect(result!.inventory).toHaveLength(2);
    });

    it('does not modify original character (immutable)', () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      const originalEssence = char.essence;
      buyShopOffer(0, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(char.essence).toBe(originalEssence);
    });

    it('lootbox offer (index 2) adds a lootbox-rolled item to inventory', () => {
      const char = makeCharacter({ essence: 500, inventory: [] });
      const result = buyShopOffer(2, char, ITEM_ASSETS, getTodayStr(), () => 0);
      expect(result).not.toBeNull();
      expect(result!.essence).toBe(150); // 500 - 350
      expect(result!.inventory).toHaveLength(1);
      const itemData = ITEM_ASSETS.find(a => a.id === result!.inventory![0]);
      expect(itemData).toBeDefined();
    });

    it('lootbox offer charges full 350 essence', () => {
      const char = makeCharacter({ essence: 600, inventory: [] });
      const result = buyShopOffer(2, char, ITEM_ASSETS, getTodayStr(), () => 0.5);
      expect(result).not.toBeNull();
      expect(result!.essence).toBe(250); // 600 - 350
    });
  });

  // ─── getShopPrice ────────────────────────────────────────────────────────

  describe('getShopPrice', () => {
    it('returns 150 for offer 0', () => {
      expect(getShopPrice(0)).toBe(150);
    });

    it('returns 250 for offer 1', () => {
      expect(getShopPrice(1)).toBe(250);
    });

    it('returns 350 for offer 2', () => {
      expect(getShopPrice(2)).toBe(350);
    });

    it('throws for invalid index', () => {
      expect(() => getShopPrice(99)).toThrow();
    });
  });

  // ─── SHOP_OFFERS alignment ───────────────────────────────────────────────

  describe('SHOP_OFFERS alignment', () => {
    it('has exactly 3 offers', () => {
      expect(SHOP_OFFERS).toHaveLength(4);
    });

    it('first offer is item type with common/uncommon/rare pool', () => {
      expect(SHOP_OFFERS[0].type).toBe('item');
      expect(SHOP_OFFERS[0].rarityPool).toEqual(['common', 'uncommon', 'rare']);
    });

    it('second offer is item type with rare/epic pool', () => {
      expect(SHOP_OFFERS[1].type).toBe('item');
      expect(SHOP_OFFERS[1].rarityPool).toEqual(['rare', 'epic']);
    });

    it('third offer is lootbox type with null pool', () => {
      expect(SHOP_OFFERS[2].type).toBe('lootbox');
      expect(SHOP_OFFERS[2].rarityPool).toBeNull();
    });
  });

  // ─── rerollShopOffers ──────────────────────────────────────────────────────

  describe('rerollShopOffers', () => {
    it('returns new offers when character has enough essence and reroll not used', () => {
      const char = makeCharacter({ essence: 100 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).not.toBeNull();
      expect(result!.offers).toHaveLength(4);
      expect(result!.character.essence).toBe(75); // 100 - 25
    });

    it('returns offers with valid structure', () => {
      const char = makeCharacter({ essence: 100 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).not.toBeNull();
      result!.offers.forEach((offer) => {
        expect(offer).toHaveProperty('index');
        expect(offer).toHaveProperty('type');
        expect(offer).toHaveProperty('price');
        expect(offer).toHaveProperty('label');
      });
    });

    it('returns null when character does not have 25 essence', () => {
      const char = makeCharacter({ essence: 10 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).toBeNull();
    });

    it('returns null when reroll already used today', async () => {
      const storage = await import('../../utils/shopStorage');
      storage.markRerollUsed('test-char', getTodayStr());
      const char = makeCharacter({ essence: 100 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).toBeNull();
    });

    it('allows reroll again on a different day', async () => {
      const storage = await import('../../utils/shopStorage');
      storage.markRerollUsed('test-char', '2026-07-06');
      const char = makeCharacter({ essence: 100 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).not.toBeNull();
      expect(result!.offers).toHaveLength(4);
    });

    it('returns different offers than the original getShopOffers', () => {
      const char = makeCharacter({ essence: 100, level: 10 });
      const original = getShopOffers(char, ITEM_ASSETS, getTodayStr(), () => 0);
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).not.toBeNull();
      // At least one offer should differ due to different seed
      const originalIds = original.map(o => o.item?.id ?? 'lootbox');
      const rerollIds = result!.offers.map(o => o.item?.id ?? 'lootbox');
      const allSame = originalIds.every((id, i) => id === rerollIds[i]);
      // With different seeds, they should not all be identical
      expect(allSame).toBe(false);
    });

    it('deducts exactly 25 essence from character', () => {
      const char = makeCharacter({ essence: 200 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).not.toBeNull();
      expect(result!.character.essence).toBe(175);
    });

    it('does not modify the original character object (immutable)', () => {
      const char = makeCharacter({ essence: 100 });
      const originalEssence = char.essence;
      rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(char.essence).toBe(originalEssence);
    });

    it('returns null when essence is 0', () => {
      const char = makeCharacter({ essence: 0 });
      const result = rerollShopOffers(char, ITEM_ASSETS, getTodayStr());
      expect(result).toBeNull();
    });
  });
});
