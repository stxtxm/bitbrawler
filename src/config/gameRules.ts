export const GAME_RULES = {
    STATS: {
        TOTAL_POINTS: 60,
        BASE_VALUE: 10,
        MIN_VALUE: 6, // Updated based on recent balancing
        MAX_VALUE: 14,
        POINTS_PER_LEVEL: 1, // Stat point per level-up
    },
    COMBAT: {
        MAX_DAILY_FIGHTS: 5,
        XP_WIN: 100,
        XP_LOSS: 25, // Consolation prize
    },
    BOTS: {
        MIN_POPULATION: 2,
        MIN_LVL1_BOTS: 10, // Ensure at least 10 lvl 1 bots
        MIN_LVL1_ACTIVE_BOTS: 2, // Keep a few lvl1 bots progressing naturally
        LVL1_RESERVE_PER_HUMAN: 1.5, // Dynamic reserve sizing for real players
        LVL1_RESERVE_BUFFER: 6, // Extra starter buffer even with few humans
        ACTIVITY_RATE: 0.35, // Percentage of bots active per run
        MAX_FIGHTS_PER_RUN: 3, // Avoid all-energy dumps in a single run
        END_OF_DAY_DRAIN_START_HOUR: 22, // Paris hour when bots must finish all remaining fights before reset
        GROWTH_CHANCE: 1.0, // Create a bot every scheduled run
    }
} as const;
