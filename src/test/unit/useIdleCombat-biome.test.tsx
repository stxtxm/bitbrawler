import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';
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

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 5,
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
  lastFightReset: 0,
  lastActive: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const makeBossProgress = (totalKills: number) => ({
  bossId: 'void_titan',
  attacksLeft: 5,
  lastAttackReset: 0,
  bossHp: 1000,
  bossMaxHp: 1000,
  bossLevel: 10,
  totalKills,
  firstEncounterAt: 0,
});

const monsterDef = MONSTER_ASSETS.find((m) => m.id === 'goblin')!;

const mockMonster = () => {
  generateMonsterForPlayerMock.mockReturnValue({
    character: makeCharacter({ seed: 'monster_goblin', name: 'Goblin', isBot: true }),
    def: monsterDef,
  });
};

describe('useIdleCombat — biome propagation', () => {
  beforeEach(() => {
    generateMonsterForPlayerMock.mockClear();
    mockMonster();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mountHook = (character: Character) => {
    const onCharacterUpdate = vi.fn();
    const onSyncCharacter = vi.fn();
    const onLevelUp = vi.fn();
    return renderHook(() =>
      useIdleCombat({
        character,
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );
  };

  it('runs the combat tick in the volcanic biome once the first boss is slain', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(1) });
    mountHook(character);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(generateMonsterForPlayerMock).toHaveBeenCalledWith(5, 'volcanic');
  });

  it('runs the combat tick in the plains biome before the first boss kill', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(0) });
    mountHook(character);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(generateMonsterForPlayerMock).toHaveBeenCalledWith(5, 'plains');
  });

  it('uses the current character biome during background catch-up fights', () => {
    const character = makeCharacter({ bossProgress: makeBossProgress(1) });
    mountHook(character);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(13000);
    });

    generateMonsterForPlayerMock.mockClear();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const calls = generateMonsterForPlayerMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => {
      expect(call[1]).toBe('volcanic');
    });
  });

  it('uses the volcanic biome for offline catch-up once the first boss is slain', async () => {
    const character = makeCharacter({
      bossProgress: makeBossProgress(1),
      lastActive: Date.now() - 60_000,
    });
    mountHook(character);

    await act(async () => {
      // Let the rejected fetch settle, then the local fallback runs synchronously.
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    });

    const calls = generateMonsterForPlayerMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => {
      expect(call[1]).toBe('volcanic');
    });
  });
});
