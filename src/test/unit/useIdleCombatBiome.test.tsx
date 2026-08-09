import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';
import { MonsterId } from '../../data/monsterAssets';
import { IDLE_CONFIG } from '../../config/idleConfig';

const VOLCANIC_MONSTERS: MonsterId[] = ['cinder_imp', 'lava_hound', 'magma_golem'];
const LEGACY_MONSTERS: MonsterId[] = ['goblin', 'ogre', 'wraith', 'slime', 'wolf', 'skeleton', 'chimera', 'dragon_spawn'];

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 30,
  experience: 5000,
  strength: 40,
  vitality: 35,
  dexterity: 30,
  luck: 25,
  intelligence: 28,
  focus: 30,
  hp: 300,
  maxHp: 300,
  wins: 10,
  losses: 2,
  fightsLeft: 5,
  lastFightReset: 0,
  ...overrides,
});

describe('useIdleCombat biome wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns volcanic monsters when the volcanic biome is active (first boss slain)', () => {
    const bossSlayer = makeCharacter({
      bossProgress: {
        bossId: 'void_titan',
        attacksLeft: 4,
        lastAttackReset: 0,
        bossHp: 0,
        bossMaxHp: 7008,
        bossLevel: 31,
        totalKills: 1,
        firstEncounterAt: 1,
      },
    });

    const { result, unmount } = renderHook(() =>
      useIdleCombat({
        character: bossSlayer,
        isPaused: false,
        onCharacterUpdate: vi.fn(),
        onSyncCharacter: vi.fn(),
      }),
    );

    act(() => {
      vi.advanceTimersByTime(IDLE_CONFIG.MONSTER_APPEAR_DURATION + 200);
    });

    expect(VOLCANIC_MONSTERS).toContain(result.current.currentMonster);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(VOLCANIC_MONSTERS).toContain(result.current.currentMonster);

    act(() => {
      unmount();
    });
  });

  it('keeps spawning legacy pool monsters while the plains biome is active', () => {
    const { result, unmount } = renderHook(() =>
      useIdleCombat({
        character: makeCharacter(),
        isPaused: false,
        onCharacterUpdate: vi.fn(),
        onSyncCharacter: vi.fn(),
      }),
    );

    const seen: MonsterId[] = [];
    for (let i = 0; i < 40; i++) {
      act(() => {
        vi.advanceTimersByTime(IDLE_CONFIG.MONSTER_APPEAR_DURATION + 300);
      });
      const monster = result.current.currentMonster;
      if (monster) seen.push(monster);
    }

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some(id => LEGACY_MONSTERS.includes(id))).toBe(true);

    act(() => {
      unmount();
    });
  });
});
