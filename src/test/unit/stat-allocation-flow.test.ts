import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import { applyStatPoint, grantStatPoints, autoAllocateStatPoints } from '../../utils/statUtils';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test-char',
    seed: 'test-seed',
    name: 'Test Hero',
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
    statPoints: 0,
    inventory: [],
    lastLootRoll: 0,
    equippedItems: { weapon: null, armor: null, accessory: null },
    ...overrides,
  };
}

describe('Stat allocation flow (level-up simulation)', () => {
  it('grants 2 stat points on level-up', () => {
    const char = makeCharacter({ statPoints: 0 });
    const updated = grantStatPoints(char, 2);
    expect(updated.statPoints).toBe(2);
  });

  it('allocateStatPoint consumes one point and increments stat', () => {
    const char = makeCharacter({ statPoints: 2, strength: 10 });
    const updated = applyStatPoint(char, 'strength');
    expect(updated.statPoints).toBe(1);
    expect(updated.strength).toBe(11);
  });

  it('allocating 2 points in same stat works', () => {
    let char = makeCharacter({ statPoints: 2, strength: 10 });
    char = applyStatPoint(char, 'strength');
    char = applyStatPoint(char, 'strength');
    expect(char.statPoints).toBe(0);
    expect(char.strength).toBe(12);
  });

  it('allocating points to different stats works', () => {
    let char = makeCharacter({ statPoints: 2, strength: 10, vitality: 10 });
    char = applyStatPoint(char, 'strength');
    char = applyStatPoint(char, 'vitality');
    expect(char.statPoints).toBe(0);
    expect(char.strength).toBe(11);
    expect(char.vitality).toBe(11);
  });

  it('does not allocate when statPoints is 0', () => {
    const char = makeCharacter({ statPoints: 0, strength: 10 });
    const updated = applyStatPoint(char, 'strength');
    expect(updated).toBe(char); // same reference = no change
    expect(updated.strength).toBe(10);
  });

  it('does not allocate beyond MAX_VALUE (15)', () => {
    const char = makeCharacter({ statPoints: 2, strength: 15 });
    const updated = applyStatPoint(char, 'strength');
    expect(updated).toBe(char); // no change
    expect(updated.statPoints).toBe(2); // point not consumed
  });

  it('autoAllocateStatPoints distributes correctly', () => {
    // 3 stats at low values, 3 stats already high
    const char = makeCharacter({
      statPoints: 4,
      strength: 5,
      vitality: 5,
      dexterity: 5,
      luck: 14,
      intelligence: 14,
      focus: 14,
    });
    const updated = autoAllocateStatPoints(char, 4);
    // All 4 points should be consumed
    expect(updated.statPoints).toBe(0);
    // Total stat sum increased by 4
    expect(updated.strength + updated.vitality + updated.dexterity + updated.luck + updated.intelligence + updated.focus)
      .toBe(5 + 5 + 5 + 14 + 14 + 14 + 4);
  });

  it('HP increases when vitality is allocated', () => {
    const char = makeCharacter({ statPoints: 1, vitality: 10, maxHp: 180, hp: 180 });
    const updated = applyStatPoint(char, 'vitality');
    expect(updated.vitality).toBe(11);
    expect(updated.maxHp).toBe(188); // +8 HP per vitality
    expect(updated.hp).toBe(188);
  });

  it('1st level character (all stats within range) can allocate normally', () => {
    // Simulate a brand-new level 1 character winning first fight and leveling to 2
    const freshChar = makeCharacter({
      level: 1,
      strength: 7,
      vitality: 7,
      dexterity: 12,
      luck: 10,
      intelligence: 8,
      focus: 9,
      statPoints: 2, // just been granted from level-up
    });

    let char = freshChar;
    char = applyStatPoint(char, 'strength');
    expect(char.statPoints).toBe(1);
    expect(char.strength).toBe(8);

    char = applyStatPoint(char, 'vitality');
    expect(char.statPoints).toBe(0);
    expect(char.vitality).toBe(8);
  });

  it('allocating to a stat that would exceed MAX_VALUE preserves the point', () => {
    // Edge case: user tries to allocate to an already-capped stat
    const char = makeCharacter({ statPoints: 2, strength: 15, dexterity: 8 });

    // Try to allocate to capped stat — should be rejected
    const afterCapped = applyStatPoint(char, 'strength');
    expect(afterCapped).toBe(char);
    expect(afterCapped.strength).toBe(15);
    expect(afterCapped.statPoints).toBe(2);

    // Allocate to a valid stat instead
    const afterValid = applyStatPoint(char, 'dexterity');
    expect(afterValid.statPoints).toBe(1);
    expect(afterValid.dexterity).toBe(9);
  });
});
