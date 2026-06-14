import { describe, it, expect } from 'vitest';
import { COMBAT_BALANCE } from '../../config/combatBalance';

describe('Combat Balance Config', () => {
  it('should have a moderate offense weight to control damage output', () => {
    // Adjusted from 1.52 → 1.45 to reduce overall damage per hit
    // QA showed win rate spiked to 80% (last 5 runs) — offense was too strong
    expect(COMBAT_BALANCE.damage.offenseWeight).toBe(1.45);
  });

  it('should have a dampened comeback multiplier to prevent runaway underdog wins', () => {
    // Adjusted from 1.06 → 1.03 to reduce comeback strength
    // The underdog bonus was compounding with stat disparity to create too many upsets
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBe(1.03);
  });

  it('should have a lower hit chance ceiling to introduce more miss risk', () => {
    // Adjusted from 92 → 88 to reduce near-guaranteed hits
    // Fewer guaranteed hits means more variance and tension in fights
    expect(COMBAT_BALANCE.hitChance.max).toBe(88);
  });
});
