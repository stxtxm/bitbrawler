export const GAME_RULES = {
    STATS: {
        TOTAL_POINTS: 66,
        BASE_VALUE: 10,
        POINTS_PER_LEVEL: 1, // Stat points per level-up
    },
    COMBAT: {
        MAX_DAILY_FIGHTS: 5,
        MAX_DAILY_PVE_FIGHTS: 5,
        XP_WIN: 90,
        XP_LOSS: 30,
    },
    PVE: {
        XP_MODIFIER: 2.5,
        STAT_MULTIPLIER: 1.2,
        HP_MULTIPLIER: 1.0,
        LEVEL_BOOST: 3, // Monsters fight at playerLevel + this offset
    },
    BOSS: {
        UNLOCK_LEVEL: 30, // Boss PvE unlocks at this level
        MAX_DAILY_ATTACKS: 5, // Daily attacks against the raid boss (independent from PvP/PvE gauge)
        LEVEL_BOOST: 2, // Boss fights at playerLevel + this offset
        STAT_MULTIPLIER: 1.2, // Boss raw stats scale off the player's raw stats
        HP_MULTIPLIER: 12.0, // Boss persistent HP pool = player maxHp * this
        XP_MODIFIER: 4.0, // Boss kill XP payout multiplier (vs a regular fight win)
        ESSENCE_REWARD: 60, // Essence rewarded on boss kill
    },
    BOTS: {
        MIN_POPULATION: 1,
        MIN_LVL1_BOTS: 3, // Minimal lvl 1 starter reserve (strongly reduced for Supabase free tier)
        MIN_LVL1_PROTECTED: 3, // Opponent pool: small but playable for a new player
        MIN_LVL1_ACTIVE_BOTS: 1, // Keep 1 lvl1 bot progressing (reduced from 2)
        LVL1_RESERVE_PER_HUMAN: 0.5, // Dynamic reserve sizing for real players (strongly reduced)
        LVL1_RESERVE_BUFFER: 2, // Extra starter buffer even with few humans (reduced from 6)
        ACTIVITY_RATE: 0.08, // Percentage of bots active per run (strongly reduced to near-idle floor)
        MAX_FIGHTS_PER_RUN: 1, // At most 1 fight per run per bot (was 2)
        END_OF_DAY_DRAIN_START_HOUR: 22, // Paris hour when bots must finish all remaining fights before reset
        GROWTH_CHANCE: 0, // No spontaneous bot creation per run — stops population drift
    }
} as const;
