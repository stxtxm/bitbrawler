export const GAME_RULES = {
    STATS: {
        TOTAL_POINTS: 66,
        BASE_VALUE: 10,
        POINTS_PER_LEVEL: 2, // Stat points per level-up
    },
    COMBAT: {
        MAX_DAILY_FIGHTS: 5,
        MAX_DAILY_PVE_FIGHTS: 5,
        XP_WIN: 135,
        XP_LOSS: 55, // Consolation prize — increased from 45 for better loss retention (~2.45:1 ratio with XP_WIN=135)
    },
    PVE: {
        XP_MODIFIER: 0.8, // PvE awards 80% of PvP XP
        STAT_MULTIPLIER: 1.6, // Monster stat multiplier for challenging fights
        HP_MULTIPLIER: 2.2, // Monster HP multiplier for longer, suspenseful battles
        LEVEL_BOOST: 1, // Monsters fight at playerLevel + this offset
    },
    IDLE: {
        XP_MODIFIER: 0.25, // Idle PvE awards 25% of PvP XP (slow but constant progression)
        COMBAT_INTERVAL_MS: 28000, // One idle combat every 28 seconds
        OFFLINE_MAX_HOURS: 24, // Max offline accumulation cap
    },
    BOTS: {
        MIN_POPULATION: 2,
        MIN_LVL1_BOTS: 10, // Ensure at least 10 lvl 1 bots
        MIN_LVL1_PROTECTED: 5, // Opponent pool: enough for 1 new player (MAX_DAILY_FIGHTS)
        MIN_LVL1_ACTIVE_BOTS: 1, // Keep 1 lvl1 bot progressing (reduced from 2)
        LVL1_RESERVE_PER_HUMAN: 1.5, // Dynamic reserve sizing for real players
        LVL1_RESERVE_BUFFER: 6, // Extra starter buffer even with few humans
        ACTIVITY_RATE: 0.20, // Percentage of bots active per run (reduced from 0.35)
        MAX_FIGHTS_PER_RUN: 2, // Avoid all-energy dumps in a single run (reduced from 3)
        END_OF_DAY_DRAIN_START_HOUR: 22, // Paris hour when bots must finish all remaining fights before reset
        GROWTH_CHANCE: 0.5, // Create a bot every other run (reduced from 1.0)
    }
} as const;
