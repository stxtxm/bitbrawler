import { beforeEach, describe, expect, it } from 'vitest';
import { rerollShopOffers } from '../../utils/shopUtils';
import { clearShopPurchases, grantFreeReroll, getFreeRerolls } from '../../utils/shopStorage';
import { ITEM_ASSETS } from '../../data/itemAssets';
import type { Character } from '../../types/Character';

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'test-char',
  seed: 'seed-1',
  name: 'Hero',
  gender: 'male',
  level: 10,
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
  fightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  essence: 0,
  itemUpgrades: {},
  ...overrides,
});

describe('shop free reroll bonus', () => {
  beforeEach(() => {
    clearShopPurchases();
  });

  it('grants and tracks free rerolls', () => {
    grantFreeReroll('test-char', '2026-11-24');
    expect(getFreeRerolls('test-char', '2026-11-24')).toBe(1);
  });

  it('allows reroll without essence when a free reroll is available', () => {
    grantFreeReroll('test-char', '2026-11-24');
    const result = rerollShopOffers(makeCharacter({ essence: 0 }), ITEM_ASSETS, '2026-11-24');
    expect(result).not.toBeNull();
    expect(result?.character.essence).toBe(0);
  });

  it('consumes free reroll only after caller marks it used through storage flow', () => {
    grantFreeReroll('test-char', '2026-11-24');
    const result = rerollShopOffers(makeCharacter({ essence: 0 }), ITEM_ASSETS, '2026-11-24');
    expect(result).not.toBeNull();
    expect(getFreeRerolls('test-char', '2026-11-24')).toBe(1);
  });
});
