import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';

type IdleCombatProps = Parameters<typeof useIdleCombat>[0];

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Hero',
  gender: 'male',
  level: 2,
  experience: 130,
  strength: 12,
  vitality: 10,
  dexterity: 10,
  luck: 10,
  intelligence: 10,
  focus: 10,
  hp: 120,
  maxHp: 120,
  wins: 1,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: Date.now(),
  fightHistory: [],
  foughtToday: [],
  statPoints: 0,
  inventory: [],
  lastLootRoll: 0,
  lootboxStreak: 0,
  incomingFightHistory: [],
  isBot: false,
  autoMode: false,
  equippedItems: { weapon: null, armor: null, accessory: null },
  essence: 5,
  lastActive: Date.now(),
  lastIdleCheck: Date.now(),
  idleStreak: 0,
  idleMaxStreak: 0,
  idleTotalKills: 0,
  idleTotalXp: 0,
  ...overrides,
});

const { generateMonsterForPlayerMock } = vi.hoisted(() => ({
  generateMonsterForPlayerMock: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', () => ({
  generateMonsterForPlayer: (...args: unknown[]) => generateMonsterForPlayerMock(...args),
  getReferenceMonster: vi.fn(
    (): Character => ({
      seed: 'ref',
      name: 'Ref',
      gender: 'male',
      level: 2,
      experience: 0,
      strength: 8,
      vitality: 8,
      dexterity: 8,
      luck: 8,
      intelligence: 8,
      focus: 8,
      hp: 60,
      maxHp: 60,
      wins: 0,
      losses: 0,
      fightsLeft: 0,
      lastFightReset: 0,
      equippedItems: { weapon: null, armor: null, accessory: null },
    })
  ),
}));

describe('FX loop reproduction — onLevelUp must fire only on REAL crossings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('10 kills à ~50 XP au lvl 2 : une annonce par vrai franchissement, jamais deux pour le même niveau', async () => {
    const weakMonster = {
      character: makeCharacter({ level: 2, hp: 30, maxHp: 30, strength: 8 }),
      def: { id: 'SLIME', name: 'Slime' },
    };
    generateMonsterForPlayerMock.mockReturnValue(weakMonster);

    const onLevelUp = vi.fn();
    const updates: Character[] = [];
    const setCharacter = vi.fn((c: Character) => {
      updates.push(JSON.parse(JSON.stringify(c)) as Character);
    });

    const props: IdleCombatProps = {
      character: makeCharacter({ level: 2, experience: 130 }),
      isPaused: false,
      onCharacterUpdate: (c: Character) => {
        props.character = c;
        setCharacter(c);
      },
      onSyncCharacter: vi.fn(),
      onLevelUp,
    };
    const { rerender } = renderHook((p: IdleCombatProps) => useIdleCombat(p), {
      initialProps: props,
    });

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      rerender(props);
    }

    const calls = onLevelUp.mock.calls as Array<[number, number]>;
    const finalUpdate = updates[updates.length - 1];

    expect(finalUpdate).toBeDefined();
    expect(finalUpdate.level).toBeGreaterThanOrEqual(2);
    expect(finalUpdate.experience).toBeGreaterThan(130);

    expect(calls.length).toBeLessThanOrEqual(2);

    for (let i = 1; i < calls.length; i++) {
      expect(calls[i][1]).toBeGreaterThan(calls[i - 1][1]);
    }
  });
});
