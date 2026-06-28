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

  it('applies upgrade bonus to stats when item has upgrades', () => {
    const upgradedChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
      itemUpgrades: { rusty_sword: 3 },
    };
    const boosted = applyEquipmentToCharacter(upgradedChar);
    // rusty_sword: STR+1 base, +3 upgrade = STR+4 total
    expect(boosted.strength).toBe(baseCharacter.strength + 1 + 3);
  });

  it('applies upgrade bonus to each stat the item gives', () => {
    const flameChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: 'flame_dagger', armor: null, accessory: null },
      itemUpgrades: { flame_dagger: 2 },
    };
    const boosted = applyEquipmentToCharacter(flameChar);
    // flame_dagger: DEX+2, STR+1 base, +2 upgrade each = DEX+4, STR+3 total
    expect(boosted.dexterity).toBe(baseCharacter.dexterity + 2 + 2);
    expect(boosted.strength).toBe(baseCharacter.strength + 1 + 2);
  });

  it('does not apply upgrade bonus when no upgrades exist', () => {
    const noUpgradeChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
      itemUpgrades: {},
    };
    const boosted = applyEquipmentToCharacter(noUpgradeChar);
    // rusty_sword: STR+1, no upgrades
    expect(boosted.strength).toBe(baseCharacter.strength + 1);
  });

  it('applies upgrade bonus from multiple upgraded items', () => {
    const multiUpgradedChar: Character = {
      ...baseCharacter,
      equippedItems: { weapon: 'rusty_sword', armor: 'leather_vest', accessory: 'mana_ring' },
      itemUpgrades: { rusty_sword: 2, leather_vest: 1, mana_ring: 3 },
    };
    const boosted = applyEquipmentToCharacter(multiUpgradedChar);
    // rusty_sword: STR+1 + 2 = STR+3
    // leather_vest: VIT+1 + 1 = VIT+2
    // mana_ring: INT+2 + 3 = INT+5
    expect(boosted.strength).toBe(baseCharacter.strength + 1 + 2);
    expect(boosted.vitality).toBe(baseCharacter.vitality + 1 + 1);
    expect(boosted.intelligence).toBe(baseCharacter.intelligence + 2 + 3);
  });

  it('applies upgrade bonus to HP items correctly', () => {
    const hpChar: Character = {
      ...baseCharacter,
      hp: 150,
      maxHp: 150,
      equippedItems: { weapon: null, armor: 'iron_helm', accessory: null },
      itemUpgrades: { iron_helm: 2 },
    };
    const boosted = applyEquipmentToCharacter(hpChar);
    // iron_helm: VIT+1, HP+2 → +2 upgrade = VIT+3, HP+4
    expect(boosted.vitality).toBe(baseCharacter.vitality + 1 + 2);
    expect(boosted.maxHp).toBe(150 + 2 + 2); // base 150 + base HP 2 + upgrade HP 2 (upgradeLevel 2)
  });
});
