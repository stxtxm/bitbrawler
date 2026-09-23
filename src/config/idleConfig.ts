export const IDLE_CONFIG = {
  TIMER_INTERVAL: 12000,
  XP_MODIFIER: 0.50,
  OFFLINE_XP_MODIFIER: 0.50,
  MAX_OFFLINE_HOURS: 24,
  MAX_IDLE_FIGHTS: 50,
  HP_REGEN_ON_RESUME: 1.0,
  MONSTER_APPEAR_DURATION: 1500,
  COMBAT_DURATION: 1500,
  RESULT_DURATION: 1500,
  ESSENCE: {
    BASE_RATE: 0.18,
    LOSS_RATIO: 0.3,
    LEVEL_SCALE: 0.03,
  },
  EFFICIENCY: {
    BASE_INTERVAL: 12000,
    MIN_INTERVAL: 4500,
    SPEED_FACTOR: 0.015,
    POWER_RATIO_FACTOR: 0.3,
    MAX_POWER_RATIO: 2.5,
    XP_BONUS_RATIO: 0.2,
    STREAK_BONUS_PER_STEP: 0.01,
    STREAK_BONUS_CAP: 0.25,
    STREAK_MILESTONES: [5, 10, 25, 50, 100],
  },
  BURST: {
    // Weekend Burst makes idle excellent instead of pausing it:
    // live-only essence bonus (XP formulas stay server-synced).
    ESSENCE_MULT: 1.5,
  },
  PACK: {
    // Multi-enemy packs (sequential fights in one visit). Idle never wounds:
    // every member faces arrival-shape HP. Deterministic schedule: every 8th
    // visit (every 4th in burst), no RNG consumed.
    MIN_LEVEL: 8,
    MAX_SIZE: 3,
  },
  ELITE: {
    // Enraged elites: level+8, bonus essence, from this level up.
    MIN_LEVEL: 15,
    CHANCE: 0.05,
    CHANCE_BURST: 0.10,
    LEVEL_BOOST: 8,
    ESSENCE_MULT: 2,
  },
} as const
