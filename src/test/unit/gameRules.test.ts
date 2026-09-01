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

  it('COMBAT MAX_DURATION_MS is 30000 (30s cap)', () => {
    expect(GAME_RULES.COMBAT.MAX_DURATION_MS).toBe(30000);
  });

  it('PVE XP modifier gives 250% of PvP XP (bonus rewards to match PvP efficiency)', () => {
    expect(GAME_RULES.PVE.XP_MODIFIER).toBeGreaterThan(0);
    expect(GAME_RULES.PVE.XP_MODIFIER).toBe(2.5);
  });

  it('PVE stat multiplier keeps monster raw stats near player level (challenge comes from LEVEL_BOOST + monster growth)', () => {
    expect(GAME_RULES.PVE.STAT_MULTIPLIER).toBe(1.2);
  });

  it('PVE HP multiplier keeps monster HP at base + level growth (no raw HP inflation)', () => {
    expect(GAME_RULES.PVE.HP_MULTIPLIER).toBe(1.0);
  });

  it('PVE level boost provides challenge', () => {
    expect(GAME_RULES.PVE.LEVEL_BOOST).toBe(3);
  });

  it('BOTS config has positive values', () => {
    expect(GAME_RULES.BOTS.MIN_POPULATION).toBeGreaterThan(0);
    expect(GAME_RULES.BOTS.ACTIVITY_RATE).toBeGreaterThan(0);
    expect(GAME_RULES.BOTS.MAX_FIGHTS_PER_RUN).toBeGreaterThan(0);
  });

  it('BOTS population is slightly replenished for high-level matchmaking while staying lean for free tier', () => {
    expect(GAME_RULES.BOTS.GROWTH_CHANCE).toBe(0.05);
    expect(GAME_RULES.BOTS.MIN_LVL1_BOTS).toBeLessThanOrEqual(3);
    expect(GAME_RULES.BOTS.MIN_LVL1_PROTECTED).toBeLessThanOrEqual(3);
    expect(GAME_RULES.BOTS.LVL1_RESERVE_PER_HUMAN).toBeLessThanOrEqual(0.5);
    expect(GAME_RULES.BOTS.LVL1_RESERVE_BUFFER).toBeLessThanOrEqual(2);
    expect(GAME_RULES.BOTS.ACTIVITY_RATE).toBe(0.15);
    expect(GAME_RULES.BOTS.MIN_POPULATION).toBe(3);
    expect(GAME_RULES.BOTS.MAX_FIGHTS_PER_RUN).toBe(1);
  });
});
