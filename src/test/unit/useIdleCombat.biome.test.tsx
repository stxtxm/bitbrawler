import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Character } from '../../types/Character';
import { BossProgress } from '../../utils/bossUtils';
import { useIdleCombat } from '../../hooks/useIdleCombat';

const mocks = vi.hoisted(() => ({
  generateMonsterForPlayer: vi.fn(),
  getReferenceMonster: vi.fn(),
  generateMonster: vi.fn(),
  getRandomMonsterId: vi.fn(),
  getMonsterDef: vi.fn(),
  simulateCombat: vi.fn(),
  calculateCombatStats: vi.fn(),
  computeEfficiency: vi.fn(),
  computeDisplayData: vi.fn(),
  calculateNextLevelTime: vi.fn(),
  calculateStatEssenceMultiplier: vi.fn(),
  calculateSpeedEfficiency: vi.fn(),
  gainXp: vi.fn(),
  getXpProgress: vi.fn(),
  calculateIdleXp: vi.fn(),
  calculateOfflineIdleXp: vi.fn(),
  calculateIdleEssence: vi.fn(),
  applyEquipmentToCharacter: vi.fn(),
  saveIdleSnapshot: vi.fn(),
  loadIdleSnapshot: vi.fn(),
  clearIdleSnapshot: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', () => ({
  generateMonsterForPlayer: mocks.generateMonsterForPlayer,
  getReferenceMonster: mocks.getReferenceMonster,
  generateMonster: mocks.generateMonster,
  getRandomMonsterId: mocks.getRandomMonsterId,
  getMonsterDef: mocks.getMonsterDef,
}));

vi.mock('../../utils/combatUtils', () => ({
  simulateCombat: mocks.simulateCombat,
  calculateCombatStats: mocks.calculateCombatStats,
}));

vi.mock('../../utils/idleEfficiencyUtils', () => ({
  computeEfficiency: mocks.computeEfficiency,
  computeDisplayData: mocks.computeDisplayData,
  calculateNextLevelTime: mocks.calculateNextLevelTime,
  calculateStatEssenceMultiplier: mocks.calculateStatEssenceMultiplier,
  calculateSpeedEfficiency: mocks.calculateSpeedEfficiency,
}));

vi.mock('../../utils/xpUtils', () => ({
  gainXp: mocks.gainXp,
  getXpProgress: mocks.getXpProgress,
}));

vi.mock('../../utils/idleXpUtils', () => ({
  calculateIdleXp: mocks.calculateIdleXp,
  calculateOfflineIdleXp: mocks.calculateOfflineIdleXp,
  calculateIdleEssence: mocks.calculateIdleEssence,
}));

vi.mock('../../utils/equipmentUtils', () => ({
  applyEquipmentToCharacter: mocks.applyEquipmentToCharacter,
}));

vi.mock('../../utils/idleSnapshotUtils', () => ({
  saveIdleSnapshot: mocks.saveIdleSnapshot,
  loadIdleSnapshot: mocks.loadIdleSnapshot,
  clearIdleSnapshot: mocks.clearIdleSnapshot,
}));

const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'hero-id',
  seed: 'hero-seed',
  name: 'Test Hero',
  gender: 'male',
  level: 3,
  experience: 120,
  strength: 8,
  vitality: 7,
  dexterity: 6,
  luck: 5,
  intelligence: 4,
  focus: 5,
  hp: 44,
  maxHp: 56,
  wins: 2,
  losses: 1,
  fightsLeft: 3,
  lastFightReset: 0,
  lastActive: 0,
  ...overrides,
});

const bossSlain = (): BossProgress => ({
  bossId: 'void_titan',
  attacksLeft: 4,
  lastAttackReset: 0,
  bossHp: 0,
  bossMaxHp: 7008,
  bossLevel: 31,
  totalKills: 1,
  firstEncounterAt: 1,
});

const mockMonster = () => ({
  character: {
    id: 'monster-goblin',
    seed: 'monster_goblin',
    name: 'Goblin',
    gender: 'male' as const,
    level: 3,
    experience: 0,
    strength: 5,
    vitality: 5,
    dexterity: 5,
    luck: 5,
    intelligence: 5,
    focus: 5,
    hp: 30,
    maxHp: 30,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    lastFightReset: 0,
    isBot: true,
    equippedItems: { weapon: null, armor: null, accessory: null },
  },
  def: { id: 'goblin', name: 'Goblin' },
});

// Stable callback identities — recreating them per render would re-trigger
// every effect whose deps reference them (offline catch-up loops forever).
const onCharacterUpdate = vi.fn();
const onSyncCharacter = vi.fn();
const onLevelUp = vi.fn();

describe('useIdleCombat — biome propagation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.generateMonsterForPlayer.mockReturnValue(mockMonster());
    mocks.getReferenceMonster.mockReturnValue(mockMonster().character);
    mocks.simulateCombat.mockReturnValue({ winner: 'attacker', attackerHp: 100, defenderHp: 0 });
    mocks.calculateCombatStats.mockReturnValue({
      totalPower: 100,
      offense: 40,
      defense: 30,
      speed: 20,
      critChance: 0.1,
      magicPower: 10,
      focus: 10,
    });
    mocks.computeEfficiency.mockReturnValue({
      powerRatio: 1.5,
      efficiency: 1.5,
      effectiveInterval: 4500,
      xpBonusMultiplier: 1.2,
    });
    mocks.computeDisplayData.mockReturnValue({
      xpPerMinute: 100,
      streakBonus: 0,
      streakMilestone: null,
      totalKills: 0,
      currentStreak: 0,
    });
    mocks.calculateNextLevelTime.mockReturnValue(125);
    mocks.calculateStatEssenceMultiplier.mockReturnValue(1);
    mocks.calculateSpeedEfficiency.mockReturnValue(1);
    mocks.gainXp.mockImplementation((char: Character) => ({
      updatedCharacter: char,
      levelsGained: 0,
    }));
    mocks.getXpProgress.mockReturnValue({ currentXpInLevel: 0, xpForNextLevel: 100 });
    mocks.calculateIdleXp.mockReturnValue(20);
    mocks.calculateOfflineIdleXp.mockReturnValue(10);
    mocks.calculateIdleEssence.mockReturnValue(5);
    mocks.applyEquipmentToCharacter.mockImplementation((char: Character) => char);
    mocks.loadIdleSnapshot.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('propagates the volcanic biome during idle ticks once the first boss is slain', () => {
    const bossSlayer = makeCharacter({ bossProgress: bossSlain() });

    renderHook(() =>
      useIdleCombat({
        character: bossSlayer,
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mocks.generateMonsterForPlayer).toHaveBeenCalledWith(
      bossSlayer.level,
      'volcanic',
    );
  });

  it('propagates the plains biome during idle ticks before the first boss kill', () => {
    const hero = makeCharacter();

    renderHook(() =>
      useIdleCombat({
        character: hero,
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mocks.generateMonsterForPlayer).toHaveBeenCalledWith(hero.level, 'plains');
  });

  it('propagates the volcanic biome during local offline catch-up', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('idle-processor unreachable')),
    );
    const bossSlayer = makeCharacter({
      bossProgress: bossSlain(),
      lastActive: Date.now() - 40_000,
    });

    renderHook(() =>
      useIdleCombat({
        character: bossSlayer,
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.generateMonsterForPlayer).toHaveBeenCalledWith(
      bossSlayer.level,
      'volcanic',
    );
    vi.unstubAllGlobals();
  });

  it('propagates the volcanic biome during background catch-up fights', () => {
    const bossSlayer = makeCharacter({ bossProgress: bossSlain() });

    renderHook(() =>
      useIdleCombat({
        character: bossSlayer,
        isPaused: false,
        onCharacterUpdate,
        onSyncCharacter,
        onLevelUp,
      }),
    );

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Every monster generation across ticks + background catch-up uses the
    // volcanic biome (never the default plains pool).
    const calls = mocks.generateMonsterForPlayer.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, biomeId] of calls) {
      expect(biomeId).toBe('volcanic');
    }
  });
});
