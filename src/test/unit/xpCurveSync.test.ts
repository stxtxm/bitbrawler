import { describe, it, expect, vi, afterEach } from 'vitest';
import { getXpRequiredForNextLevel, getTotalXpForLevel } from '../../utils/xpUtils';
import { calculateOfflineIdleXp as clientOfflineXp } from '../../utils/idleXpUtils';
import {
  EARLY_SHIFT,
  IDLE_MODIFIER,
  OFFLINE_XP_MODIFIER,
  xpForNextLevel,
  totalXpForLevel,
  calculateOfflineIdleXp as serverOfflineXp,
} from '../../../api/idle-processor';
import { IDLE_CONFIG } from '../../config/idleConfig';

describe('XP curve sync between client and server API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have identical XP curve constants', () => {
    // EARLY_SHIFT must match src/utils/xpUtils.ts (client source of truth).
    // If the client curve changes, this test fails until the server is updated.
    expect(EARLY_SHIFT).toBe(3);
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
});