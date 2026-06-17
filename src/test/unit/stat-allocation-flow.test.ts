import { describe, it, expect } from 'vitest';
import { Character } from '../../types/Character';
import { applyStatPoint, grantStatPoints, autoAllocateStatPoints, StatKey } from '../../utils/statUtils';

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

  it('autoAllocateStatPoints distributes correctly', () => {
    // All 6 stats at same value to avoid flaky random-pick races
    const char = makeCharacter({
      statPoints: 4,
      strength: 5,
      vitality: 5,
      dexterity: 5,
      luck: 5,
      intelligence: 5,
      focus: 5,
    });
    const updated = autoAllocateStatPoints(char, 4);
    // All 4 points should be consumed
    expect(updated.statPoints).toBe(0);
    // Total stat sum increased by 4
    expect(updated.strength + updated.vitality + updated.dexterity + updated.luck + updated.intelligence + updated.focus)
      .toBe(5 * 6 + 4);
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

  it('allocates beyond previous MAX_VALUE (15)', () => {
    const char = makeCharacter({ statPoints: 2, strength: 15 });
    const updated = applyStatPoint(char, 'strength');
    expect(updated.strength).toBe(16);
    expect(updated.statPoints).toBe(1);
  });

  it('allocates at very high values (no cap)', () => {
    const char = makeCharacter({ statPoints: 5, strength: 50 });
    const updated = applyStatPoint(char, 'strength');
    expect(updated.strength).toBe(51);
    expect(updated.statPoints).toBe(4);
  });

  it('allocates at 100+', () => {
    const char = makeCharacter({ statPoints: 3, luck: 100, dexterity: 100, intelligence: 100 });
    const updated = applyStatPoint(char, 'luck');
    expect(updated.luck).toBe(101);
    expect(updated.statPoints).toBe(2);
  });

  it('sequential allocations across all 6 stats', () => {
    let char = makeCharacter({ statPoints: 6, strength: 10, vitality: 10, dexterity: 10, luck: 10, intelligence: 10, focus: 10 });
    const stats: StatKey[] = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'];
    for (const stat of stats) {
      char = applyStatPoint(char, stat);
    }
    expect(char.statPoints).toBe(0);
    expect(char.strength).toBe(11);
    expect(char.vitality).toBe(11);
    expect(char.dexterity).toBe(11);
    expect(char.luck).toBe(11);
    expect(char.intelligence).toBe(11);
    expect(char.focus).toBe(11);
  });

  it('does not mutate the original character object', () => {
    const char = makeCharacter({ statPoints: 1, strength: 10 });
    const updated = applyStatPoint(char, 'strength');
    expect(char.strength).toBe(10); // original unchanged
    expect(char.statPoints).toBe(1);
    expect(updated.strength).toBe(11);
    expect(updated.statPoints).toBe(0);
  });
});
