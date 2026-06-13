import { describe, it, expect } from 'vitest';
import { getBotArchetype, getAffinityMultiplier, ARCHETYPE_WEAKNESSES, ELEMENT_ADVANTAGES } from '../../utils/affinityUtils';
import { Character } from '../../types/Character';
import { Element } from '../../types/Item';

const baseChar: Character = {
  seed: 'test',
  name: 'Test',
  gender: 'male',
  level: 1,
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
};

describe('getBotArchetype', () => {
  it('identifies bruiser from strength', () => {
    const char = { ...baseChar, strength: 20, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10 };
    expect(getBotArchetype(char)).toBe('bruiser');
  });

  it('identifies tank from vitality', () => {
    const char = { ...baseChar, strength: 10, vitality: 20, dexterity: 10, luck: 10, intelligence: 10, focus: 10 };
    expect(getBotArchetype(char)).toBe('tank');
  });

  it('identifies rogue from dexterity', () => {
    const char = { ...baseChar, strength: 10, vitality: 10, dexterity: 20, luck: 10, intelligence: 10, focus: 10 };
    expect(getBotArchetype(char)).toBe('rogue');
  });

  it('identifies mage from intelligence', () => {
    const char = { ...baseChar, strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 20, focus: 10 };
    expect(getBotArchetype(char)).toBe('mage');
  });

  it('identifies lucky from luck', () => {
    const char = { ...baseChar, strength: 10, vitality: 10, dexterity: 10, luck: 20, intelligence: 10, focus: 10 };
    expect(getBotArchetype(char)).toBe('lucky');
  });

  it('identifies zen from focus', () => {
    const char = { ...baseChar, strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 20 };
    expect(getBotArchetype(char)).toBe('zen');
  });

  it('falls back to bruiser on ties (first max stat)', () => {
    const char = { ...baseChar, strength: 15, vitality: 15, dexterity: 10, luck: 10, intelligence: 10, focus: 10 };
    // strength and vitality tie, strength comes first → bruiser
    expect(getBotArchetype(char)).toBe('bruiser');
  });
});

describe('getAffinityMultiplier', () => {
  it('returns 1 when no element', () => {
    expect(getAffinityMultiplier(null, 'tank')).toBe(1);
    expect(getAffinityMultiplier(undefined, 'tank')).toBe(1);
  });

  it('returns 1 when no archetype', () => {
    expect(getAffinityMultiplier('fire', null)).toBe(1);
  });

  it('returns 1.15 for super effective element', () => {
    expect(getAffinityMultiplier('fire', 'tank')).toBe(1.15);
    expect(getAffinityMultiplier('wind', 'bruiser')).toBe(1.15);
    expect(getAffinityMultiplier('earth', 'rogue')).toBe(1.15);
    expect(getAffinityMultiplier('dark', 'mage')).toBe(1.15);
    expect(getAffinityMultiplier('light', 'lucky')).toBe(1.15);
    expect(getAffinityMultiplier('water', 'zen')).toBe(1.15);
  });

  it('returns 1 for non-super-effective element', () => {
    expect(getAffinityMultiplier('water', 'tank')).toBe(1);
    expect(getAffinityMultiplier('fire', 'rogue')).toBe(1);
    expect(getAffinityMultiplier('wind', 'mage')).toBe(1);
  });

  it('all elements have a valid archetype weakness mapping', () => {
    const elements: Element[] = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
    for (const el of elements) {
      expect(ARCHETYPE_WEAKNESSES[ELEMENT_ADVANTAGES[el]]).toBe(el);
    }
  });
});
