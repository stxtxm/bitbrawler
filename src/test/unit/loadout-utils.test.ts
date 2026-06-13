import { describe, it, expect } from 'vitest';
import { getEquippedItems, equipItem, unequipItem, autoEquipBestItems, getEquipmentBonuses } from '../../utils/equipmentUtils';
import { Character } from '../../types/Character';

const baseCharacter: Character = {
  seed: 'loadout-seed',
  name: 'Loadout Hero',
  gender: 'male',
  level: 5,
  experience: 120,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 180,
  maxHp: 180,
  wins: 0,
  losses: 0,
  fightsLeft: 3,
  lastFightReset: Date.now(),
  inventory: ['rusty_sword', 'leather_vest', 'mana_ring'],
  equippedItems: { weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'mana_ring' },
};

describe('getEquippedItems', () => {
  it('returns equipped item assets', () => {
    const items = getEquippedItems(baseCharacter);
    expect(items).toHaveLength(3);
    expect(items.map(i => i.id)).toEqual(['rusty_sword', 'leather_vest', 'mana_ring']);
  });

  it('returns empty array when no equipped items', () => {
    const char = { ...baseCharacter, equippedItems: { weapon: null, armor: null, accessory: null } };
    expect(getEquippedItems(char)).toHaveLength(0);
  });
});

describe('equipItem', () => {
  it('moves item from inventory to slot', () => {
    const char = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'leather_vest', 'mana_ring'],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };
    const result = equipItem(char, 'rusty_sword', 'weapon');
    expect(result.equippedItems?.weapon).toBe('rusty_sword');
    expect(result.inventory).not.toContain('rusty_sword');
    expect(result.inventory).toHaveLength(2);
  });

  it('swaps items when slot is already filled', () => {
    const result = equipItem(baseCharacter, 'leather_vest', 'armor');
    // leather_vest was already equipped in armor slot, so no change
    expect(result.equippedItems?.armor).toBe('leather_vest');
  });

  it('replaces existing equipped item and puts it back in inventory', () => {
    const char = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'leather_vest', 'mana_ring', 'oak_staff'],
      equippedItems: { weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'mana_ring' },
    };
    const result = equipItem(char, 'oak_staff', 'weapon');
    expect(result.equippedItems?.weapon).toBe('oak_staff');
    expect(result.inventory).toContain('rusty_sword');
    expect(result.inventory).not.toContain('oak_staff');
  });

  it('ignores item with wrong slot type', () => {
    const result = equipItem(baseCharacter, 'rusty_sword', 'armor');
    expect(result.equippedItems?.armor).toBe('leather_vest');
    expect(result.inventory).toContain('rusty_sword');
  });

  it('ignores non-existent item id', () => {
    const result = equipItem(baseCharacter, 'nonexistent', 'weapon');
    expect(result).toBe(baseCharacter);
  });
});

describe('unequipItem', () => {
  it('removes item from slot and puts it back in inventory', () => {
    const result = unequipItem(baseCharacter, 'weapon');
    expect(result.equippedItems?.weapon).toBeNull();
    expect(result.inventory).toContain('rusty_sword');
  });

  it('does nothing when slot is already empty', () => {
    const char = { ...baseCharacter, equippedItems: { weapon: null, armor: 'leather_vest', accessory: 'mana_ring' } };
    const result = unequipItem(char, 'weapon');
    expect(result).toBe(char);
  });
});

describe('autoEquipBestItems', () => {
  it('equips best item for each slot', () => {
    const char = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'leather_vest', 'mana_ring', 'oak_staff', 'ember_blade'],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };
    const result = autoEquipBestItems(char);
    // ember_blade is best weapon (level 5, rare, 3 STR)
    expect(result.equippedItems?.weapon).toBe('ember_blade');
    // leather_vest is best armor (level 2, common, +1 VIT) — actually there's also spiked_gauntlets in the full set
    // Wait, the inventory only has what we've set
    expect(result.equippedItems?.armor).toBe('leather_vest');
    expect(result.equippedItems?.accessory).toBe('mana_ring');
  });

  it('handles empty inventory gracefully', () => {
    const char = {
      ...baseCharacter,
      inventory: [],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };
    const result = autoEquipBestItems(char);
    expect(result.equippedItems?.weapon).toBeNull();
    expect(result.equippedItems?.armor).toBeNull();
    expect(result.equippedItems?.accessory).toBeNull();
  });
});

describe('getEquipmentBonuses with loadout', () => {
  it('only sums stats from equipped items, not all inventory', () => {
    const char = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'leather_vest', 'mana_ring', 'oak_staff'],
      equippedItems: { weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'mana_ring' },
    };
    const bonus = getEquipmentBonuses(char);
    expect(bonus.strength).toBe(1);  // rusty_sword
    expect(bonus.vitality).toBe(1);  // leather_vest
    expect(bonus.intelligence).toBe(2);  // mana_ring
    // oak_staff should NOT contribute
  });

  it('returns empty stats when no items equipped', () => {
    const char = {
      ...baseCharacter,
      inventory: ['rusty_sword', 'leather_vest', 'mana_ring'],
      equippedItems: { weapon: null, armor: null, accessory: null },
    };
    const bonus = getEquipmentBonuses(char);
    expect(bonus.strength).toBeUndefined();
    expect(bonus.vitality).toBeUndefined();
  });
});
