import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { COMBAT_BALANCE } from '../../config/combatBalance';

// Mock all heavy dependencies of useIdleCombat
vi.mock('../../utils/idleSnapshotUtils', () => ({
  saveIdleSnapshot: vi.fn(),
  loadIdleSnapshot: vi.fn(),
  clearIdleSnapshot: vi.fn(),
}));

vi.mock('../../utils/monsterUtils', () => ({
  generateMonsterForPlayer: vi.fn(() => ({
    character: { name: 'Goblin', level: 1, hp: 50, maxHp: 50, strength: 5, vitality: 5, dexterity: 5, luck: 3, intelligence: 3, focus: 3, experience: 0, wins: 0, losses: 0, fightsLeft: 0, lastFightReset: 0, seed: 'goblin', gender: 'male' },
    def: { id: 'GOBLIN', name: 'Goblin', specialty: 'none', tier: 1, asset: 'goblin' },
  })),
  getReferenceMonster: vi.fn(() => ({
    name: 'Ref', level: 1, hp: 50, maxHp: 50, strength: 5, vitality: 5, dexterity: 5, luck: 3, intelligence: 3, focus: 3, experience: 0, wins: 0, losses: 0, fightsLeft: 0, lastFightReset: 0,
  })),
}));

vi.mock('../../utils/combatUtils', () => ({
  simulateCombat: vi.fn(() => ({
    winner: 'attacker',
    rounds: 3,
    details: ['hit'],
    timeline: [{ attackerHp: 100, defenderHp: 50 }],
  })),
  calculateCombatStats: vi.fn(() => ({
    totalPower: 100, offense: 15, defense: 15, speed: 12, critChance: 10, magicPower: 10, focus: 10,
  })),
}));

vi.mock('../../utils/xpUtils', () => ({
  gainXp: vi.fn((char: any, xp: number) => ({
    updatedCharacter: { ...char, experience: (char.experience || 0) + xp },
    levelsGained: 0,
  })),
  getXpProgress: vi.fn(() => ({
    currentXpInLevel: 100,
    xpForNextLevel: 500,
  })),
}));

vi.mock('../../utils/idleXpUtils', () => ({
  calculateIdleXp: vi.fn(() => 50),
  calculateIdleEssence: vi.fn(() => 1),
}));

vi.mock('../../utils/equipmentUtils', () => ({
  applyEquipmentToCharacter: vi.fn((c: any) => c),
}));

vi.mock('../../utils/idleEfficiencyUtils', () => ({
  computeEfficiency: vi.fn(() => ({
    powerRatio: 1.2,
    efficiency: 1.0,
    effectiveInterval: 12000,
    xpBonusMultiplier: 1.0,
  })),
  computeDisplayData: vi.fn(() => ({
    xpPerMinute: 250,
    streakBonus: 0,
    streakMilestone: null,
  })),
  calculateNextLevelTime: vi.fn(() => null),
  calculateStatEssenceMultiplier: vi.fn(() => 1.0),
  calculateSpeedEfficiency: vi.fn(() => 1.0),
}));

vi.mock('../../config/idleConfig', () => ({
  IDLE_CONFIG: {
    TIMER_INTERVAL: 12000,
    MONSTER_APPEAR_DURATION: 1500,
    COMBAT_DURATION: 1500,
    RESULT_DURATION: 1500,
    EFFICIENCY: {
      BASE_INTERVAL: 12000,
      MIN_INTERVAL: 4500,
      SPEED_FACTOR: 0.015,
      POWER_RATIO_FACTOR: 0.3,
      MAX_POWER_RATIO: 2.5,
      XP_BONUS_RATIO: 0.2,
      STREAK_BONUS_PER_STEP: 0.01,
      STREAK_BONUS_CAP: 0.25,
      STREAK_MILESTONES: [5, 10, 25, 50, 100],
    },
  },
}));

vi.mock('../../config/gameRules', () => ({
  GAME_RULES: {
    BASE_HP: 100,
    HP_PER_VITALITY: 10,
    STATS: { POINTS_PER_LEVEL: 3, MAX_STAT: 99 },
    PVE: { XP_MODIFIER: 1.0 },
    LEVELS: { MAX: 99 },
  },
}));

describe('Idle Combat Hard Timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have fightHardTimeoutMs defined in COMBAT_BALANCE', () => {
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeDefined();
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThan(0);
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBe(60000);
  });

  it('should have fightHardTimeoutMs longer than maxDurationMs', () => {
    // The hard timeout should be a safety net, longer than the normal combat timeout
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThan(COMBAT_BALANCE.maxDurationMs);
  });

  it('should have fightHardTimeoutMs at 2x maxDurationMs', () => {
    // 60s hard timeout is 2x the 30s combat simulation timeout
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBe(COMBAT_BALANCE.maxDurationMs * 2);
  });
});
