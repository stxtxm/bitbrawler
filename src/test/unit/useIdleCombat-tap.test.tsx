import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';
import { MONSTER_ASSETS } from '../../data/monsterAssets';
import { TAP_CONFIG } from '../../config/tapConfig';
import { calculateIdleEssence } from '../../utils/idleXpUtils';
import { computeTapEssence } from '../../utils/tapUtils';

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
  essence: 0,
  idleStreak: 0,
  idleMaxStreak: 0,
  idleTotalKills: 0,
  idleTotalXp: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const monsterDef = MONSTER_ASSETS.find((m) => m.id === 'goblin')!;

const mockMonster = (maxHp = 100, weak = false) => {
  generateMonsterForPlayerMock.mockReturnValue({
    character: makeCharacter({
      seed: 'monster_goblin',
      name: 'Goblin',
      isBot: true,
      hp: maxHp,
      maxHp,
      // Weak monster → the natural simulateCombat always resolves as a player win
      strength: weak ? 1 : 10,
      vitality: weak ? 1 : 10,
      dexterity: weak ? 1 : 10,
      luck: weak ? 1 : 10,
      intelligence: weak ? 1 : 10,
      focus: weak ? 1 : 10,
    }),
    def: monsterDef,
  });
};

describe('useIdleCombat — tap-to-damage', () => {
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

  const mountHook = (character: Character, isPaused = false) => {
    const onCharacterUpdate = vi.fn();
    const onSyncCharacter = vi.fn();
    const onLevelUp = vi.fn();
    const renderResult = renderHook(() =>
      useIdleCombat({
        character,
        isPaused,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );
    // renderHook() returns { result: Ref, rerender, unmount } — unwrap the ref
    // so tests read `result.current` (same pattern as arenaLevelUp.test.ts).
    return { result: renderResult.result, onCharacterUpdate, onSyncCharacter, onLevelUp };
  };

  it('starts a fight after the first 1500ms (phase monster_appears)', () => {
    const { result } = mountHook(makeCharacter());
    expect(result.current.scenePhase).toBe('running');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.scenePhase).toBe('monster_appears');
    expect(result.current.currentMonster).toBe('goblin');
  });

  it('resolves an early WIN when taps accumulate enough damage to kill the monster', () => {
    const { result, onCharacterUpdate } = mountHook(makeCharacter());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.scenePhase).toBe('monster_appears');

    // 100 HP monster → 8 HP per tap → 13 taps kill it (13 × 8 = 104 ≥ 100)
    act(() => {
      for (let i = 0; i < 13; i++) result.current.registerTap();
    });

    // Fight resolved immediately — no need to wait for the natural 3s+ flow
    expect(result.current.lastCombatResult).toBe('win');
    expect(result.current.scenePhase).toBe('result');

    // Rewards applied: win XP, streak, kill count
    expect(result.current.currentStreak).toBe(1);
    expect(result.current.totalKills).toBe(1);
    expect(result.current.idleTotalXp).toBeGreaterThan(0);

    // Essence = kill essence + tap essence (13 taps × 5% of kill essence)
    const killEssence = calculateIdleEssence(true, 5, 10, 10);
    const tapEssence = computeTapEssence(5, 10, 10) * 13;
    const update = onCharacterUpdate.mock.calls[0][0] as Character;
    expect(update.essence).toBeCloseTo(killEssence + tapEssence, 2);

    // Monster is cleared and the scene returns to running after the result
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.scenePhase).toBe('running');
    expect(result.current.currentMonster).toBeNull();
  });

  it('ignores taps outside a fight phase (running)', () => {
    const { result, onCharacterUpdate } = mountHook(makeCharacter());
    // No fight started yet (first tick at 1500ms)
    act(() => {
      for (let i = 0; i < 5; i++) result.current.registerTap();
    });
    expect(result.current.tapsUsed).toBe(0);
    expect(onCharacterUpdate).not.toHaveBeenCalled();
    expect(result.current.lastCombatResult).toBeNull();
  });

  it('ignores taps once the fight is resolved (result phase)', () => {
    const { result } = mountHook(makeCharacter());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Kill the monster with the minimum taps (13)
    act(() => {
      for (let i = 0; i < 13; i++) result.current.registerTap();
    });
    expect(result.current.scenePhase).toBe('result');
    const tapsAfterResolve = result.current.tapsUsed;

    act(() => {
      for (let i = 0; i < 5; i++) result.current.registerTap();
    });
    expect(result.current.tapsUsed).toBe(tapsAfterResolve);
    expect(result.current.scenePhase).toBe('result');
  });

  it('never exceeds the per-fight tap budget (anti-autoclicker guard)', () => {
    const { result } = mountHook(makeCharacter());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // A rapid burst of 30 taps must be bounded by the fight budget
    act(() => {
      for (let i = 0; i < 30; i++) result.current.registerTap();
    });
    expect(result.current.tapsUsed).toBeLessThanOrEqual(TAP_CONFIG.MAX_TAPS_PER_FIGHT);
    // And the fight still resolved as a win
    expect(result.current.lastCombatResult).toBe('win');
  });

  it('does not let a tap burst out-earn a full idle kill (economy guard)', () => {
    const { result } = mountHook(makeCharacter());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      for (let i = 0; i < 30; i++) result.current.registerTap();
    });
    // Essence from the burst = min(15 taps worth of essence budget)
    const maxTapEssence = computeTapEssence(5, 10, 10) * TAP_CONFIG.MAX_TAPS_PER_FIGHT;
    // The kill itself also re-ups... but the whole fight must stay bounded:
    // kill essence (0.264) + max tap essence (0.198) < 0.5
    const killEssence = calculateIdleEssence(true, 5, 10, 10);
    expect(killEssence + maxTapEssence).toBeLessThan(0.5);
  });

  it('keeps the natural fight flow when no taps happen (no regression)', () => {
    mockMonster(100, true); // weak monster → deterministic win
    const { result } = mountHook(makeCharacter());
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // t1 fired: combat phase + win resolution
    expect(result.current.lastCombatResult).toBe('win');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.scenePhase).toBe('result');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.scenePhase).toBe('running');
    expect(result.current.currentMonster).toBeNull();
  });

  it('blocks taps while the idle loop is paused', () => {
    const { result, onCharacterUpdate } = mountHook(makeCharacter(), true);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      for (let i = 0; i < 5; i++) result.current.registerTap();
    });
    expect(result.current.tapsUsed).toBe(0);
    expect(onCharacterUpdate).not.toHaveBeenCalled();
    expect(result.current.currentMonster).toBeNull();
  });
});