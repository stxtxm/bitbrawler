import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getXpRequiredForNextLevel, getTotalXpForLevel } from '../../utils/xpUtils';
import { calculateIdleEssence as clientIdleEssence, calculateOfflineIdleXp as clientOfflineXp } from '../../utils/idleXpUtils';
import {
  EARLY_SHIFT,
  IDLE_MODIFIER,
  OFFLINE_XP_MODIFIER,
  ESSENCE_EARLY_GAME_MAX_LEVEL,
  ESSENCE_EARLY_GAME_MULT,
  OFFLINE_ESSENCE_MODIFIER,
  xpForNextLevel,
  totalXpForLevel,
  calculateIdleEssence as serverIdleEssence,
  calculateOfflineIdleXp as serverOfflineXp,
} from '../../../api/idle-processor';
import { IDLE_CONFIG } from '../../config/idleConfig';

describe('XP curve sync between client and server API', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-14T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks();
  });

  it('should have identical XP curve constants', () => {
    // EARLY_SHIFT must match src/utils/xpUtils.ts (client source of truth).
    // If the client curve changes, this test fails until the server is updated.
    expect(EARLY_SHIFT).toBe(0);
    expect(IDLE_MODIFIER).toBe(IDLE_CONFIG.XP_MODIFIER);
    expect(OFFLINE_XP_MODIFIER).toBe(IDLE_CONFIG.OFFLINE_XP_MODIFIER);
  });

  it('should have matching per-level XP thresholds for levels 1 through 30', () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      const client = getXpRequiredForNextLevel(lvl);
      const server = xpForNextLevel(lvl);
      expect(server).toBe(client);
    }
  });

  it('should have matching cumulative XP for levels 1 through 30', () => {
    for (let lvl = 1; lvl <= 30; lvl++) {
      const client = getTotalXpForLevel(lvl);
      const server = totalXpForLevel(lvl);
      expect(server).toBe(client);
    }
  });

  it('should award identical offline XP per fight (fixed variance)', () => {
    // Mock Math.random so variance = 1.0 on both sides
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    for (let lvl = 1; lvl <= 30; lvl++) {
      const clientWin = clientOfflineXp(true, lvl);
      const serverWin = serverOfflineXp(true, lvl);
      expect(serverWin).toBe(clientWin);

      const clientLoss = clientOfflineXp(false, lvl);
      const serverLoss = serverOfflineXp(false, lvl);
      expect(serverLoss).toBe(clientLoss);
    }
  });

  it('should keep the early-game essence constants in sync', () => {
    expect(ESSENCE_EARLY_GAME_MAX_LEVEL).toBe(IDLE_CONFIG.ESSENCE.EARLY_GAME_MAX_LEVEL);
    expect(ESSENCE_EARLY_GAME_MULT).toBe(IDLE_CONFIG.ESSENCE.EARLY_GAME_MULT);
  });

  it('should award identical early-game essence ratios (client vs server)', () => {
    for (let level = 1; level <= 12; level++) {
      const client = clientIdleEssence(true, level, 10, 10);
      const server = serverIdleEssence(true, level, 10, 10);
      expect(server).toBeCloseTo(client * OFFLINE_ESSENCE_MODIFIER, 10);
    }
  });
});