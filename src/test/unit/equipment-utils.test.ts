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
    inventory: ['rusty_sword', 'leather_vest', 'mana_ring']
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
});
