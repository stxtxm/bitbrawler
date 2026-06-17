import { describe, it, expect } from 'vitest';
import { applyEquipmentToCharacter, getEquipmentBonuses } from '../../utils/equipmentUtils';
import { Character } from '../../types/Character';

describe('equipmentUtils', () => {
  const baseCharacter: Character = {
    seed: 'equip-seed',
    name: 'Gear Hero',
    gender: 'male',
    level: 3,
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

  it('sums equipment stat bonuses', () => {
    const bonus = getEquipmentBonuses(baseCharacter);
    expect(bonus.strength).toBeGreaterThan(0);
    expect(bonus.vitality).toBeGreaterThan(0);
    expect(bonus.intelligence).toBeGreaterThan(0);
  });

  it('applies equipment bonuses to character stats and hp', () => {
    const boosted = applyEquipmentToCharacter(baseCharacter);
    expect(boosted.strength).toBeGreaterThan(baseCharacter.strength);
    expect(boosted.vitality).toBeGreaterThan(baseCharacter.vitality);
    expect(boosted.intelligence).toBeGreaterThan(baseCharacter.intelligence);
    expect(boosted.maxHp).toBeGreaterThanOrEqual(baseCharacter.maxHp);
  });

  it('returns HP bonuses from equipped items', () => {
    const hpChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: null, armor: 'iron_helm', accessory: null },
    };
    const bonus = getEquipmentBonuses(hpChar);
    expect(bonus.hp).toBe(2);
  });

  it('applies HP bonus and clamps current hp to maxHp', () => {
    const hpChar: Character = {
      ...baseCharacter,
      hp: 150,
      maxHp: 150,
      equippedItems: { weapon: null, armor: 'iron_helm', accessory: null },
    };
    const boosted = applyEquipmentToCharacter(hpChar);
    expect(boosted.maxHp).toBe(152);
    expect(boosted.hp).toBe(152);
  });

  it('returns stat bonuses from all 7 fields when items cover them', () => {
    const fullStatsChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: 'rusty_sword', armor: 'iron_helm', accessory: 'phoenix_amulet' },
    };
    const bonus = getEquipmentBonuses(fullStatsChar);
    const statKeys = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'hp'] as const;
    const expected: Record<string, number> = {
      strength: 4, vitality: 4, dexterity: 3, luck: 3, intelligence: 3, focus: 3, hp: 2,
    };
    for (const key of statKeys) {
      expect(bonus[key]).toBe(expected[key]);
    }
  });
});
