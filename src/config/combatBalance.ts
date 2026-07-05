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
    critCap: 30,
    totalPowerFocusWeight: 0.85,
  },
  levelScaling: {
    perLevel: 0.012,
    maxBonus: 0.22,
  },
  roundLimit: 25,
  maxDurationMs: 30000,
  /** Hard watchdog timeout for the overall fight cycle (incl. UI animation).
   *  If a fight exceeds this wall-clock limit, the combat loop force-finishes
   *  and resets the scene to prevent indefinite hangs.
   *  Reduced from 60s to 45s for better UX — fewer QA timeouts. */
  fightHardTimeoutMs: 45000,
  /** Threshold (in ms) after which an auto-resolve warning appears during combat.
   *  When combat exceeds this duration, players see a suggestion to skip to result. */
  autoResolveWarningMs: 30000,
  comeback: {
    hpThresholdRatio: 0.35,
    hitBonus: 2,
    damageMultiplier: 1.25,
  },
  initiative: {
    baseChance: 0.5,
    speedWeight: 0.004,
    minChance: 0.4,
    maxChance: 0.6,
  },
  hitChance: {
    base: 75,
    speedWeight: 0.4,
    focusWeight: 0.35,
    min: 68,
    max: 95,
  },
  damage: {
    offenseWeight: 2.0,
    defenseWeight: 0.25,
    min: 15,
    critMultiplier: 1.30,
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
    chanceWeight: 0.30,
    maxChance: 12,
    damageMultiplier: 1.12,
  },
  affinity: {
    damageBonus: 0.15,
  },
} as const;

export type CombatBalance = typeof COMBAT_BALANCE;
