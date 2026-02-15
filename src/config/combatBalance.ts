export const COMBAT_BALANCE = {
  statBaseline: 10,
  diminishingExponent: 0.85,
  statWeights: {
    offense: 1.85,
    defense: 2.0,
    speed: 1.6,
    magicPower: 1.6,
    focus: 1.35,
    critChance: 1.35,
    critCap: 28,
    totalPowerFocusWeight: 0.6,
  },
  levelScaling: {
    perLevel: 0.012,
    maxBonus: 0.22,
  },
  roundLimit: 50,
  comeback: {
    hpThresholdRatio: 0.35,
    hitBonus: 4,
    damageMultiplier: 1.1,
  },
  initiative: {
    baseChance: 0.5,
    speedWeight: 0.004,
    minChance: 0.4,
    maxChance: 0.6,
  },
  hitChance: {
    base: 72,
    speedWeight: 0.4,
    focusWeight: 0.25,
    min: 60,
    max: 92,
  },
  damage: {
    offenseWeight: 1.18,
    defenseWeight: 0.55,
    min: 4,
    critMultiplier: 1.45,
  },
  magic: {
    baseChance: 5,
    powerWeight: 0.32,
    focusWeight: 0.08,
    maxChance: 30,
    damageWeight: 0.55,
  },
  focusVariance: {
    baseRange: 0.2,
    stabilityWeight: 0.002,
    maxStability: 0.08,
  },
  focusSurge: {
    chanceWeight: 0.22,
    maxChance: 8,
    damageMultiplier: 1.08,
  },
} as const;

export type CombatBalance = typeof COMBAT_BALANCE;
