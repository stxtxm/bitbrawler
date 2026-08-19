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
  experience: 4800,
  strength: 20,
  vitality: 20,
  dexterity: 20,
  luck: 20,
  intelligence: 20,
  focus: 20,
  hp: 180,
  maxHp: 180,
  wins: 10,
  losses: 5,
  fightsLeft: 5,
  lastFightReset: 0,
  inventory: [],
  equippedItems: { weapon: null, armor: null, accessory: null },
  essence: 12,
  lastActive: Date.now() - 60_000,
  lastIdleCheck: Date.now() - 60_000,
  ...overrides,
});

const monsterDef = MONSTER_ASSETS.find((m) => m.id === 'goblin')!;

describe('useIdleCombat — offline server merge keeps a coherent level/XP pair', () => {
  beforeEach(() => {
    generateMonsterForPlayerMock.mockClear();
    generateMonsterForPlayerMock.mockReturnValue({
      character: makeCharacter({ seed: 'monster_goblin', name: 'Goblin', isBot: true, experience: 0 }),
      def: monsterDef,
    });
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('must not combine the server level with a higher local XP into an inconsistent pair (issue: endless level-ups after PvP)', async () => {
    // The server processed the absence from a STALE DB row (old PvP write)
    // and returned a level it computed for its own (lower) XP. The local
    // character holds MUCH more XP (idle gains not yet flushed).
    const serverStale = {
      level: 7,
      experience: 2600,
      maxHp: 200,
      hp: 200,
      essence: 15,
      statPoints: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ updated: serverStale, fights: 10, xp: 200, levels: 2, essence: 1 }),
    }));

    const onCharacterUpdate = vi.fn();
    renderHook(() =>
      useIdleCombat({
        character: makeCharacter(),
        isPaused: true,
        onCharacterUpdate,
        onSyncCharacter: vi.fn(),
        onLevelUp: vi.fn(),
      }),
    );

    // Flush the processOfflineOnServer microtasks (fetch + merge).
    await act(async () => {});
    await act(async () => {});

    const mergeCall = onCharacterUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as Character).experience === 4800,
    );
    expect(mergeCall).toBeTruthy();
    const merged = mergeCall![0] as Character;

    // 4800 XP justifies level 9 on the client curve
    // (getTotalXpForLevel(9) = 4478 <= 4800 < 6786 = total for level 10).
    // The old merge took max(level)=7 + max(xp)=4800 → 7/4800 → the 322 XP
    // of latent surplus re-converted into burst level-ups on the next kills.
    expect(merged.level).toBe(9);
    expect(merged.experience).toBe(4800);
    // The resources still take the best of both sides.
    expect(merged.essence).toBe(15);
    expect(merged.statPoints).toBe(1);
  });

  it('keeps the server state when the server XP is ahead of the local one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        updated: { level: 9, experience: 5200, maxHp: 260, hp: 260, essence: 20 },
        fights: 12,
        xp: 400,
        levels: 2,
        essence: 8,
      }),
    }));

    const onCharacterUpdate = vi.fn();
    renderHook(() =>
      useIdleCombat({
        character: makeCharacter(),
        isPaused: true,
        onCharacterUpdate,
        onSyncCharacter: vi.fn(),
        onLevelUp: vi.fn(),
      }),
    );

    await act(async () => {});
    await act(async () => {});

    const mergeCall = onCharacterUpdate.mock.calls.find(
      (c: unknown[]) => (c[0] as Character).experience === 5200,
    );
    expect(mergeCall).toBeTruthy();
    const merged = mergeCall![0] as Character;
    // 5200 XP justifies level 9 too (4478 <= 5200 < 6786) — and it is the
    // server's own pair, so nothing regresses.
    expect(merged.level).toBe(9);
    expect(merged.essence).toBe(20);
  });
});