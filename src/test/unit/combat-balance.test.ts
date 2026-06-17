import { describe, it, expect } from 'vitest';
import { COMBAT_BALANCE } from '../../config/combatBalance';

describe('Combat Balance Config', () => {
  it('should have a reduced offense weight (1.38) to lower damage output', () => {
    // Adjusted from 1.45 → 1.38 to further reduce overall damage per hit
    // QA showed win rate 80% (last 5 runs) even after 1.45 rebalance — still too high
    expect(COMBAT_BALANCE.damage.offenseWeight).toBe(1.38);
  });

  it('should have a lower crit multiplier (1.30) to reduce burst damage', () => {
    // Adjusted from 1.45 → 1.30 so crits are less decisive
    // High burst was contributing to snowball wins
    expect(COMBAT_BALANCE.damage.critMultiplier).toBe(1.30);
  });

  it('should have a lower base hit chance (68) to increase miss rate', () => {
    // Adjusted from 72 → 68 so overall accuracy drops further
    // More misses create more tension and reduce attacker dominance
    expect(COMBAT_BALANCE.hitChance.base).toBe(68);
  });

  it('should have a dampened comeback multiplier to prevent runaway underdog wins', () => {
    // Adjusted from 1.06 → 1.03 (unchanged) to reduce comeback strength
    // The underdog bonus was compounding with stat disparity to create too many upsets
    expect(COMBAT_BALANCE.comeback.damageMultiplier).toBe(1.03);
  });

  it('should have a lower hit chance ceiling to introduce more miss risk', () => {
    // Adjusted from 92 → 88 (unchanged) to reduce near-guaranteed hits
    // Fewer guaranteed hits means more variance and tension in fights
    expect(COMBAT_BALANCE.hitChance.max).toBe(88);
  });

  it('should have a reduced base hit chance to lower overall accuracy', () => {
    // Adjusted from 72 → 68 to increase miss probability for both sides
    // This creates more dramatic fight swings and slightly favors defenders
    // QA showed win rate surged to 80% after overlay fix — reducing base hit
    // chance compensates by making fights less predictable
    expect(COMBAT_BALANCE.hitChance.base).toBe(68);
  });
});
