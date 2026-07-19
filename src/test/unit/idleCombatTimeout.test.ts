import { describe, it, expect } from 'vitest';
import { COMBAT_BALANCE } from '../../config/combatBalance';

describe('Idle Combat Hard Timeout', () => {

  it('should have fightHardTimeoutMs defined in COMBAT_BALANCE', () => {
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeDefined();
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThan(0);
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBe(45000);
  });

  it('should have fightHardTimeoutMs longer than maxDurationMs', () => {
    // The hard timeout should be a safety net, longer than the normal combat timeout
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThan(COMBAT_BALANCE.maxDurationMs);
  });

  it('should have fightHardTimeoutMs with enough buffer above maxDurationMs', () => {
    // Hard timeout is the safety net — must be at least 1.5x the simulation timeout
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThanOrEqual(COMBAT_BALANCE.maxDurationMs * 1.5);
  });
});
