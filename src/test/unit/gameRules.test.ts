import { describe, it, expect } from 'vitest';
import { GAME_RULES } from '../../config/gameRules';

describe('Game rules', () => {
  it('POINTS_PER_LEVEL is positive', () => {
    expect(GAME_RULES.STATS.POINTS_PER_LEVEL).toBeGreaterThan(0);
  });

  it('COMBAT XP_WIN is greater than XP_LOSS', () => {
    expect(GAME_RULES.COMBAT.XP_WIN).toBeGreaterThan(GAME_RULES.COMBAT.XP_LOSS);
  });

  it('has daily fight limits', () => {
    expect(GAME_RULES.COMBAT.MAX_DAILY_FIGHTS).toBeGreaterThan(0);
    expect(GAME_RULES.COMBAT.MAX_DAILY_PVE_FIGHTS).toBeGreaterThan(0);
  });

  it('PVE XP modifier gives 80% of PvP XP', () => {
    expect(GAME_RULES.PVE.XP_MODIFIER).toBeGreaterThan(0);
    expect(GAME_RULES.PVE.XP_MODIFIER).toBeLessThan(1);
    expect(GAME_RULES.PVE.XP_MODIFIER).toBe(0.80);
  });

  it('PVE stat multiplier makes monsters harder', () => {
    expect(GAME_RULES.PVE.STAT_MULTIPLIER).toBeGreaterThan(1);
  });

  it('PVE stat multiplier makes monsters challenging (target win rate ~65-75%)', () => {
    expect(GAME_RULES.PVE.STAT_MULTIPLIER).toBe(6.5);
  });

  it('PVE HP multiplier extends fights', () => {
    expect(GAME_RULES.PVE.HP_MULTIPLIER).toBeGreaterThan(1);
  });

  it('PVE HP multiplier extends battles for more challenge (target ~70% win rate)', () => {
    expect(GAME_RULES.PVE.HP_MULTIPLIER).toBe(7.0);
  });

  it('PVE level boost provides challenge', () => {
    expect(GAME_RULES.PVE.LEVEL_BOOST).toBe(2);
  });

  it('BOTS config has positive values', () => {
    expect(GAME_RULES.BOTS.MIN_POPULATION).toBeGreaterThan(0);
    expect(GAME_RULES.BOTS.ACTIVITY_RATE).toBeGreaterThan(0);
    expect(GAME_RULES.BOTS.MAX_FIGHTS_PER_RUN).toBeGreaterThan(0);
  });
});
