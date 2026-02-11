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
        MIN_LVL1_BOTS: 3, // Ensure at least 3 lvl 1 bots
        ACTIVITY_RATE: 0.35, // Percentage of bots active per run
        GROWTH_CHANCE: 1.0, // Create a bot every scheduled run
    }
} as const;
