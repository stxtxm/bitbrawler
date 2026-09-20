import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleCombat } from '../../hooks/useIdleCombat';
import { Character } from '../../types/Character';

const { generateMock, simMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  simMock: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/monsterUtils')>();
  return {
    ...actual,
    generateMonsterForPlayer: (...args: unknown[]) => generateMock(...args),
    getReferenceMonster: vi.fn(() => ({
      level: 5, seed: 'reference', name: 'Reference', gender: 'male',
      experience: 0, strength: 10, vitality: 10, dexterity: 10, luck: 10,
      intelligence: 10, focus: 10, hp: 100, maxHp: 100, wins: 0, losses: 0,
      fightsLeft: 0, lastFightReset: 0,
      equippedItems: { weapon: null, armor: null, accessory: null },
    })),
  };
});

vi.mock('../../utils/combatUtils', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../utils/combatUtils')>();
  return {
    ...mod,
    simulateCombat: (...args: unknown[]) => simMock(...args),
    calculateCombatStats: mod.calculateCombatStats,
  };
});

vi.mock('../../data/liveOps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/liveOps')>();
  return {
    ...actual,
    isBurstActive: () => false,
  };
});

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 25,
  experience: 0,
  strength: 30,
  vitality: 30,
  dexterity: 30,
  luck: 30,
  intelligence: 30,
  focus: 30,
  hp: 200,
  maxHp: 200,
  wins: 0,
  losses: 0,
  fightsLeft: 5,
  lastFightReset: 0,
  lastActive: 0,
  equippedItems: { weapon: null, armor: null, accessory: null },
  ...overrides,
});

const weakMonster = (id: string, name: string) => ({
  character: {
    level: 1, seed: id, name, gender: 'male', experience: 0,
    strength: 1, vitality: 1, dexterity: 1, luck: 1, intelligence: 1, focus: 1,
    hp: 10, maxHp: 10, wins: 0, losses: 0, fightsLeft: 0, lastFightReset: 0,
    equippedItems: { weapon: null, armor: null, accessory: null },
  },
  def: { id, name },
});

describe('useIdleCombat packs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generateMock.mockReset();
    simMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(script: Array<'win' | 'lose'>, monsterIds: string[]) {
    let genCall = 0;
    let simCall = 0;
    const ids = [...monsterIds];
    generateMock.mockImplementation(() => {
      const id = ids[genCall % ids.length] ?? 'goblin';
      genCall++;
      return weakMonster(id, id);
    });
    simMock.mockImplementation((attacker: Character) => {
      const outcome = script[Math.min(simCall, script.length - 1)];
      simCall++;
      if (outcome === 'lose') {
        return { winner: 'defender', timeline: [{ attackerHp: 0, defenderHp: 10 }] };
      }
      return { winner: 'attacker', timeline: [{ attackerHp: (attacker.hp ?? 100) - 5, defenderHp: 0 }] };
    });
    const onCharacterUpdate = vi.fn();
    const onSyncCharacter = vi.fn();
    const onLevelUp = vi.fn();
    const { result } = renderHook(() =>
      useIdleCombat({
        character: makeCharacter(),
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );
    return { result, onCharacterUpdate };
  }

  function advanceUntilQuiescent(result: { current: { combatLog: unknown[]; currentMonster: unknown; packInfo: unknown } }, targetLog: number, maxSteps = 1500) {
    for (let i = 0; i < maxSteps; i++) {
      const r = result.current;
      if (r.combatLog.length >= targetLog && !r.currentMonster && !r.packInfo) return;
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    throw new Error(
      `stuck: log=${result.current.combatLog.length}/${targetLog} monster=${result.current.currentMonster} pack=${JSON.stringify(result.current.packInfo)}`,
    );
  }

  function samplePack(result: { current: { packInfo: unknown; combatLog: unknown[] } }, steps = 200) {
    const seen: string[] = [];
    for (let i = 0; i < steps; i++) {
      const p = result.current.packInfo as { size: number; index: number } | null;
      const key = p ? `${p.size}:${p.index}` : 'null';
      if (seen[seen.length - 1] !== key) seen.push(key);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      if (key === 'null' && seen.length > 2 && result.current.combatLog.length >= 10) break;
    }
    return seen;
  }

  it('fights 7 singles then a 3-pack on the 8th visit (level 25)', () => {
    const { result } = setup(
      Array(30).fill('win'),
      ['goblin', 'ogre', 'wraith'],
    );
    advanceUntilQuiescent(result, 7);
    expect(result.current.combatLog.length).toBe(7);
    expect(result.current.packInfo).toBeNull();
    const seen = samplePack(result);
    expect(seen).toContain('3:0');
    expect(seen).toContain('3:1');
    expect(seen).toContain('3:2');
    expect(seen[seen.length - 1]).toBe('null');
    expect(result.current.combatLog.length).toBe(10);
    expect(result.current.currentMonster).toBeNull();
  });

  it('never wounds in idle: every pack member faces arrival-shape HP', () => {
    const { result, onCharacterUpdate } = setup(
      Array(30).fill('win'),
      ['goblin', 'ogre', 'wraith'],
    );
    advanceUntilQuiescent(result, 7);
    const preCalls = simMock.mock.calls.map(([attacker]) => (attacker as Character).hp);
    advanceUntilQuiescent(result, 10);
    const packPres = simMock.mock.calls.slice(preCalls.length).map(([attacker]) => (attacker as Character).hp);
    expect(packPres.length).toBe(3);
    expect(packPres.every((hp) => hp === 200)).toBe(true);
    const lastUpdate = onCharacterUpdate.mock.calls[onCharacterUpdate.mock.calls.length - 1][0] as Character;
    expect(lastUpdate.hp).toBe(200);
  });

  it('stops the pack early on defeat, keeps partial kills, resets streak', () => {
    const script: Array<'win' | 'lose'> = [...Array(8).fill('win'), 'lose', ...Array(10).fill('win')];
    const { result } = setup(script, ['goblin', 'ogre']);
    advanceUntilQuiescent(result, 7);
    expect(result.current.currentStreak).toBe(7);
    advanceUntilQuiescent(result, 9);
    expect(result.current.combatLog.length).toBe(9);
    expect(result.current.currentStreak).toBe(0);
    expect(result.current.lastCombatResult).toBe('lose');
    expect(result.current.packInfo).toBeNull();
    expect(result.current.currentMonster).toBeNull();
  });

  it('cycles pack monsters in order on screen', () => {    const { result } = setup(Array(30).fill('win'), ['goblin', 'ogre', 'wraith']);
    advanceUntilQuiescent(result, 7);
    const seen: Array<string | null> = [];
    for (let i = 0; i < 600; i++) {
      const m = result.current.currentMonster;
      if (seen[seen.length - 1] !== m) seen.push(m);
      if (result.current.combatLog.length >= 10 && !m && !result.current.packInfo) break;
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(seen).toContain('goblin');
    expect(seen).toContain('ogre');
    expect(seen).toContain('wraith');
    expect(seen[seen.length - 1]).toBeNull();
  });

  it('crowns the 20th visit with an enraged elite (level+8, essence x2)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { result, onCharacterUpdate } = setup(Array(60).fill('win'), ['goblin']);
    // defender levels per sim call: 23 normal kills at 24, then elite at 28
    // (no level-ups mid-test: thresholds dwarf 24 kills of XP)
    advanceUntilQuiescent(result, 23);
    const defenderLevels = simMock.mock.calls.map(([, defender]) => (defender as Character).level);
    expect(defenderLevels.length).toBeGreaterThanOrEqual(23);
    expect(defenderLevels.slice(0, 23).every((lvl) => lvl === 1)).toBe(true);
    // elite banner + aura state during the elite visit
    let sawElite = false;
    for (let i = 0; i < 600; i++) {
      if (result.current.eliteName) {
        sawElite = true;
        expect(result.current.eliteElement).not.toBeNull();
        break;
      }
      if (result.current.combatLog.length >= 24) break;
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(sawElite).toBe(true);
    advanceUntilQuiescent(result, 24);
    const eliteDefenderLevels = simMock.mock.calls.slice(23).map(([, defender]) => (defender as Character).level);
    expect(eliteDefenderLevels[0]).toBe(29);
    // essence ratio elite vs previous normal kill: exactly x2 (same level)
    const snaps = onCharacterUpdate.mock.calls
      .map(([c]) => c as Character)
      .filter((c, idx, arr) => idx === 0 || c.idleTotalKills !== arr[idx - 1].idleTotalKills);
    const kill23 = snaps.find((c) => c.idleTotalKills === 23)!;
    const kill24 = snaps.find((c) => c.idleTotalKills === 24)!;
    expect(kill23).toBeDefined();
    expect(kill24).toBeDefined();
    const idx23 = snaps.indexOf(kill23);
    const prev23 = idx23 > 0 ? snaps[idx23 - 1].essence ?? 0 : 0;
    const idx24 = snaps.indexOf(kill24);
    const prev24 = snaps[idx24 - 1].essence ?? 0;
    expect(kill24.level).toBe(kill23.level);
    expect((kill24.essence ?? 0) - prev24).toBeCloseTo(((kill23.essence ?? 0) - prev23) * 2, 6);
  });
});
