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

  it('should have fightHardTimeoutMs at 1.5x maxDurationMs', () => {
    // 45s hard timeout is 1.5x the 30s combat simulation timeout (reduced from 60s for better UX)
    expect(COMBAT_BALANCE.fightHardTimeoutMs).toBe(COMBAT_BALANCE.maxDurationMs * 1.5);
  });
});
