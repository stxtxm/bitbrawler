import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import type { Character } from '../../types/Character';
import { MONSTER_ASSETS } from '../../data/monsterAssets';

const { generateMonsterForPlayerMock } = vi.hoisted(() => ({
  generateMonsterForPlayerMock: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', () => ({
  generateMonsterForPlayer: (...args: unknown[]) => generateMonsterForPlayerMock(...args),
  getReferenceMonster: vi.fn(() => ({
    level: 5,
    seed: 'reference',
    name: 'Reference',
    gender: 'male',
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
    fightsLeft: 0,
    lastFightReset: 0,
    equippedItems: { weapon: null, armor: null, accessory: null },
  })),
}));

vi.mock('../../utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/combatUtils')>();
  return {
    ...actual,
    simulateCombat: vi.fn(() => ({
      winner: 'attacker' as const,
      rounds: 2,
      details: [],
      timeline: [],
    })),
  };
});

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Hero',
  gender: 'male',
  level: 5,
  experience: 200,
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
  lastFightReset: 0,
  lastActive: Date.now(),
  lastIdleCheck: Date.now(),
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const goblinDef = MONSTER_ASSETS.find((monster) => monster.id === 'goblin')!;

describe('useIdleCombat — compendium tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    generateMonsterForPlayerMock.mockReturnValue({
      character: makeCharacter({ name: 'Goblin', isBot: true }),
      def: goblinDef,
    });
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('records the encountered monster and its kill after a win', () => {
    const updates: Character[] = [];
    renderHook(() => useIdleCombat({
      character: makeCharacter(),
      isPaused: false,
      onCharacterUpdate: (character) => updates.push(character),
      onSyncCharacter: vi.fn(),
      onLevelUp: vi.fn(),
    }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const latest = updates[updates.length - 1];
    expect(latest?.monsterEncounters?.goblin).toBe(1);
    expect(latest?.monsterKills?.goblin).toBe(1);
  });
});
