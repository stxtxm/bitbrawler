import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import { getTacticalHint } from '../../utils/tacticalLens';
import { ARCHETYPE_WEAKNESSES } from '../../utils/affinityUtils';

const baseChar: Character = {
  name: 'Player',
  gender: 'male',
  seed: 'seed1',
  level: 10,
  hp: 100,
  maxHp: 100,
  strength: 10,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  experience: 0,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
};

const makeTankOpponent = (): Character => ({
  ...baseChar,
  name: 'TankBot',
  seed: 'tank-seed',
  strength: 5,
  vitality: 20,
  dexterity: 5,
  luck: 5,
  intelligence: 5,
  focus: 5,
  inventory: [],
  equippedItems: { weapon: 'stone_cleaver', armor: null, accessory: null },
});

const makeRogueOpponent = (): Character => ({
  ...baseChar,
  name: 'RogueBot',
  seed: 'rogue-seed',
  strength: 5,
  vitality: 5,
  dexterity: 20,
  luck: 5,
  intelligence: 5,
  focus: 5,
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
});

describe('tacticalLens', () => {
  it('returns null when player or opponent missing', () => {
    expect(getTacticalHint(null as unknown as Character, makeTankOpponent())).toBeNull();
    expect(getTacticalHint(baseChar, null as unknown as Character)).toBeNull();
  });

  it('detects defender archetype and weakness', () => {
    const hint = getTacticalHint(baseChar, makeTankOpponent());
    expect(hint).not.toBeNull();
    expect(hint!.defenderArchetype).toBe('tank');
    expect(hint!.defenderWeakness).toBe(ARCHETYPE_WEAKNESSES.tank);
    expect(hint!.defenderWeakness).toBe('fire');
  });

  it('exposes defender weapon element', () => {
    const opp = makeTankOpponent();
    const hint = getTacticalHint(baseChar, opp)!;
    expect(hint.defenderWeaponElement).toBe('earth');
  });

  it('hint strong when player weapon matches weakness', () => {
    const player: Character = {
      ...baseChar,
      inventory: ['ember_blade'],
      equippedItems: { weapon: 'ember_blade', armor: null, accessory: null },
    };
    const opp = makeTankOpponent();
    const hint = getTacticalHint(player, opp)!;
    expect(hint.hintKind).toBe('strong');
    expect(hint.playerWeaponElement).toBe('fire');
    expect(hint.hintText).toContain('FIRE');
    expect(hint.hintText).toContain('TANK');
    expect(hint.hintText).toContain('+15%');
    expect(hint.hasSwitchOption).toBe(false);
  });

  it('hint switch when player owns weakness element but not equipped', () => {
    const player: Character = {
      ...baseChar,
      inventory: ['ember_blade', 'rusty_sword'],
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
    };
    const opp = makeTankOpponent();
    const hint = getTacticalHint(player, opp)!;
    expect(hint.hintKind).toBe('switch');
    expect(hint.hintText).toContain('Switch vers');
    expect(hint.hintText).toContain('FIRE');
    expect(hint.hasSwitchOption).toBe(true);
  });

  it('hint switch also when weapon has different element', () => {
    const player: Character = {
      ...baseChar,
      inventory: ['ember_blade', 'tidal_blade'],
      equippedItems: { weapon: 'tidal_blade', armor: null, accessory: null },
    };
    const opp = makeTankOpponent();
    const hint = getTacticalHint(player, opp)!;
    expect(hint.hintKind).toBe('switch');
    expect(hint.playerWeaponElement).toBe('water');
    expect(hint.hasSwitchOption).toBe(true);
  });

  it('hint neutral when player has no weakness item', () => {
    const player: Character = {
      ...baseChar,
      inventory: ['rusty_sword'],
      equippedItems: { weapon: 'rusty_sword', armor: null, accessory: null },
    };
    const opp = makeTankOpponent();
    const hint = getTacticalHint(player, opp)!;
    expect(hint.hintKind).toBe('neutral');
    expect(hint.hintText).toContain('TANK');
    expect(hint.hintText).toContain('FIRE');
    expect(hint.hasSwitchOption).toBe(false);
  });

  it('hint neutral when player has no weapon equipped', () => {
    const player: Character = { ...baseChar, inventory: [], equippedItems: { weapon: null, armor: null, accessory: null } };
    const opp = makeRogueOpponent();
    const hint = getTacticalHint(player, opp)!;
    expect(hint.hintKind).toBe('neutral');
    expect(hint.defenderArchetype).toBe('rogue');
    expect(hint.defenderWeakness).toBe('earth');
    expect(hint.playerWeaponElement).toBeUndefined();
    expect(hint.hintText).toContain('ROGUE');
    expect(hint.hintText).toContain('EARTH');
  });

  it('weakness mapping covers all archetypes', () => {
    const cases: Array<{ vitality: number; strength: number; dexterity: number; intelligence: number; luck: number; focus: number; expectedWeak: string }> = [
      { strength: 20, vitality: 1, dexterity: 1, intelligence: 1, luck: 1, focus: 1, expectedWeak: 'wind' },
      { strength: 1, vitality: 20, dexterity: 1, intelligence: 1, luck: 1, focus: 1, expectedWeak: 'fire' },
      { strength: 1, vitality: 1, dexterity: 20, intelligence: 1, luck: 1, focus: 1, expectedWeak: 'earth' },
      { strength: 1, vitality: 1, dexterity: 1, intelligence: 20, luck: 1, focus: 1, expectedWeak: 'dark' },
      { strength: 1, vitality: 1, dexterity: 1, intelligence: 1, luck: 20, focus: 1, expectedWeak: 'light' },
      { strength: 1, vitality: 1, dexterity: 1, intelligence: 1, luck: 1, focus: 20, expectedWeak: 'water' },
    ];
    for (const c of cases) {
      const opp: Character = { ...baseChar, name: 'Opp', strength: c.strength, vitality: c.vitality, dexterity: c.dexterity, intelligence: c.intelligence, luck: c.luck, focus: c.focus, inventory: [], equippedItems: { weapon: null, armor: null, accessory: null } };
      const hint = getTacticalHint(baseChar, opp)!;
      expect(hint.defenderWeakness).toBe(c.expectedWeak);
    }
  });
});
