import { describe, it, expect } from 'vitest';
import {
  SALVAGE_JACKPOT_RATE,
  SALVAGE_JACKPOT_MEGA_RATE,
  SALVAGE_SURGE_JACKPOT_RATE,
  SALVAGE_SURGE_MEGA_RATE,
  ESSENCE_YIELD,
} from '../../data/forgeConstants';
import {
  rollSalvageJackpot,
  salvageItem,
  salvageItems,
  canSalvageItem,
} from '../../utils/forgeUtils';
import { PixelItemAsset } from '../../types/Item';
import { Character } from '../../types/Character';

const makeItem = (id: string, rarity: PixelItemAsset['rarity'] = 'common'): PixelItemAsset => ({
  id,
  name: id,
  rarity,
  slot: 'weapon',
  stats: { strength: 1 },
  pixels: [[1]],
  requiredLevel: 1,
});

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

describe('forgeConstants jackpot rates', () => {
  it('exports SALVAGE_JACKPOT_RATE = 0.05', () => {
    expect(SALVAGE_JACKPOT_RATE).toBe(0.05);
  });
  it('exports SALVAGE_JACKPOT_MEGA_RATE = 0.01', () => {
    expect(SALVAGE_JACKPOT_MEGA_RATE).toBe(0.01);
  });
  it('exports SALVAGE_SURGE_JACKPOT_RATE = 0.10', () => {
    expect(SALVAGE_SURGE_JACKPOT_RATE).toBe(0.10);
  });
  it('exports SALVAGE_SURGE_MEGA_RATE = 0.02', () => {
    expect(SALVAGE_SURGE_MEGA_RATE).toBe(0.02);
  });
  it('does not break ESSENCE_YIELD', () => {
    expect(ESSENCE_YIELD.common).toBe(5);
    expect(ESSENCE_YIELD.epic).toBe(80);
  });
});

describe('rollSalvageJackpot', () => {
  it('rng 0.03 → x2', () => {
    const r = rollSalvageJackpot(() => 0.03, false);
    expect(r.multiplier).toBe(2);
    expect(r.isJackpot).toBe(true);
  });
  it('rng 0.005 → x10', () => {
    const r = rollSalvageJackpot(() => 0.005, false);
    expect(r.multiplier).toBe(10);
    expect(r.isJackpot).toBe(true);
  });
  it('rng 0.5 → x1', () => {
    const r = rollSalvageJackpot(() => 0.5, false);
    expect(r.multiplier).toBe(1);
    expect(r.isJackpot).toBe(false);
  });
  it('surge double taux: rng 0.08 normal x1 but surge x2', () => {
    const normal = rollSalvageJackpot(() => 0.08, false);
    expect(normal.multiplier).toBe(1);
    const surge = rollSalvageJackpot(() => 0.08, true);
    expect(surge.multiplier).toBe(2);
    expect(surge.isJackpot).toBe(true);
  });
  it('surge mega: rng 0.015 normal x2 but surge x10', () => {
    const normal = rollSalvageJackpot(() => 0.015, false);
    expect(normal.multiplier).toBe(2);
    const surge = rollSalvageJackpot(() => 0.015, true);
    expect(surge.multiplier).toBe(10);
  });
  it('is pure and uses injected rng', () => {
    const r1 = rollSalvageJackpot(() => 0.005, false);
    const r2 = rollSalvageJackpot(() => 0.005, false);
    expect(r1).toEqual(r2);
  });
  it('defaults to Math.random when no rng provided', () => {
    const r = rollSalvageJackpot();
    expect([1, 2, 10]).toContain(r.multiplier);
  });
});

describe('salvage jackpot yield', () => {
  it('common 5 → 10 with x2, 50 with x10', () => {
    const common = makeItem('c', 'common');
    const charBase = makeCharacter({ inventory: ['c'], essence: 0 });
    const withX2 = salvageItem('c', charBase, [common], () => 0.03, false);
    expect(withX2.essence).toBe(10);
    const charBase2 = makeCharacter({ inventory: ['c'], essence: 0 });
    const withX10 = salvageItem('c', charBase2, [common], () => 0.005, false);
    expect(withX10.essence).toBe(50);
  });
  it('epic 80 → 160 with x2, 800 with x10', () => {
    const epic = makeItem('e', 'epic');
    const charBase = makeCharacter({ inventory: ['e'], essence: 0 });
    const withX2 = salvageItem('e', charBase, [epic], () => 0.03, false);
    expect(withX2.essence).toBe(160);
    const charBase2 = makeCharacter({ inventory: ['e'], essence: 0 });
    const withX10 = salvageItem('e', charBase2, [epic], () => 0.005, false);
    expect(withX10.essence).toBe(800);
  });
  it('surge double taux affects salvageItem yield', () => {
    const common = makeItem('c', 'common');
    const charNormal = makeCharacter({ inventory: ['c'], essence: 0 });
    const normal = salvageItem('c', charNormal, [common], () => 0.08, false);
    expect(normal.essence).toBe(5);
    const charSurge = makeCharacter({ inventory: ['c'], essence: 0 });
    const surge = salvageItem('c', charSurge, [common], () => 0.08, true);
    expect(surge.essence).toBe(10);
  });
  it('salvageItems with jackpot multiplier', () => {
    const items = [makeItem('a', 'common'), makeItem('b', 'common')];
    const totalX2 = salvageItems(items, () => 0.03, false);
    expect(totalX2).toBe(20);
    const totalX10 = salvageItems(items, () => 0.005, false);
    expect(totalX10).toBe(100);
    const totalX1 = salvageItems(items, () => 0.5, false);
    expect(totalX1).toBe(10);
  });
  it('salvageItem conserve inventaire/equipped guard', () => {
    const item = makeItem('rusty_sword', 'common');
    const charEquipped = makeCharacter({
      inventory: ['rusty_sword'],
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
      essence: 0,
    });
    expect(canSalvageItem('rusty_sword', charEquipped)).toBe(false);
    const result = salvageItem('rusty_sword', charEquipped, [item], () => 0.03, false);
    expect(result).toBe(charEquipped);
    expect(result.essence).toBe(0);
    const charNotInInv = makeCharacter({ inventory: [], essence: 0 });
    const result2 = salvageItem('rusty_sword', charNotInInv, [item], () => 0.005, false);
    expect(result2).toBe(charNotInInv);
  });
  it('increments forgeStats.jackpotCount when jackpot', () => {
    const item = makeItem('c', 'common');
    const char: any = makeCharacter({ inventory: ['c'], essence: 0 });
    char.forgeStats = { jackpotCount: 2 };
    const withJackpot = salvageItem('c', char, [item], () => 0.03, false) as any;
    expect(withJackpot.forgeStats.jackpotCount).toBe(3);
    const char2: any = makeCharacter({ inventory: ['c'], essence: 0 });
    char2.forgeStats = { jackpotCount: 5 };
    const without = salvageItem('c', char2, [item], () => 0.5, false) as any;
    expect(without.forgeStats.jackpotCount).toBe(5);
  });
  it('noop when forgeStats absent', () => {
    const item = makeItem('c', 'common');
    const char = makeCharacter({ inventory: ['c'], essence: 0 });
    const result: any = salvageItem('c', char, [item], () => 0.03, false);
    expect(result.forgeStats).toBeUndefined();
  });
  it('retrocompat: salvageItem without rng still works (base yield)', () => {
    const item = makeItem('c', 'common');
    const char = makeCharacter({ inventory: ['c'], essence: 0 });
    const result = salvageItem('c', char, [item]);
    expect(result.essence).toBe(5);
    expect(result.inventory).not.toContain('c');
  });
});
