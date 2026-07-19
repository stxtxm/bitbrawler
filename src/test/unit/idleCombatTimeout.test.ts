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

  it('should have fightHardTimeoutMs longer than maxDurationMs by a comfortable margin', () => {
    // 45s hard timeout provides a safety net above the 25s simulation timeout
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBeGreaterThan(COMBAT_BALANCE.maxDurationMs * 1.5);
  });
});
