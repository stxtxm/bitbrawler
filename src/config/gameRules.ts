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
        SPEED_OPTIONS: [1, 2],
        MAX_DURATION_MS: 30000,
    },
    PVE: {
        XP_MODIFIER: 2.5,
        SURGE_XP_MODIFIER: 3.1,
        SURGE_ESSENCE_MULTIPLIER: 1.25,
        BOUNTY_TARGET: 3,
        STAT_MULTIPLIER: 1.2,
        HP_MULTIPLIER: 1.0,
        LEVEL_BOOST: 3, // Monsters fight at playerLevel + this offset
    },
    BOSS: {
        UNLOCK_LEVEL: 30, // Boss PvE unlocks at this level (void_titan)
        MAX_DAILY_ATTACKS: 5, // Daily attacks against the raid boss (independent from PvP/PvE gauge)
        LEVEL_BOOST: 2, // Boss fights at playerLevel + this offset
        STAT_MULTIPLIER: 1.2, // Boss raw stats scale off the player's raw stats
        HP_MULTIPLIER: 12.0, // Boss persistent HP pool = player maxHp * this
        XP_MODIFIER: 4.0, // Boss kill XP payout multiplier (vs a regular fight win)
        ESSENCE_REWARD: 60, // Essence rewarded on boss kill
        PITY_HP_REDUCTION: 0.12, // Per-stack multiplicative HP reduction (0.88×) on consecutive defeats
        PITY_FLOOR: 6.0, // Minimum HP multiplier even at max pity (half the baseline)
        CONSOLATION_ESSENCE: 15, // Essence on defeat (ESSENCE_REWARD × 0.25)
        CONSOLATION_CAP: 3, // Max consolation payouts per Paris day
    },
    BOSS_TIERS: {
        void_titan: {
            UNLOCK_LEVEL: 30,
            MAX_DAILY_ATTACKS: 5,
            LEVEL_BOOST: 2,
            STAT_MULTIPLIER: 1.2,
            HP_MULTIPLIER: 12.0,
            XP_MODIFIER: 4.0,
            ESSENCE_REWARD: 60,
            REQUIRES_KILLS: 0,
            PITY_HP_REDUCTION: 0.12,
            PITY_FLOOR: 6.0,
            CONSOLATION_ESSENCE: 15,
            CONSOLATION_CAP: 3,
        },
        abyssal_monarch: {
            UNLOCK_LEVEL: 58,
            MAX_DAILY_ATTACKS: 5,
            LEVEL_BOOST: 4,
            STAT_MULTIPLIER: 1.55,
            HP_MULTIPLIER: 24.0,
            XP_MODIFIER: 9.0,
            ESSENCE_REWARD: 180,
            REQUIRES_KILLS: 1,
            PITY_HP_REDUCTION: 0.12,
            PITY_FLOOR: 12.0,
            CONSOLATION_ESSENCE: 45,
            CONSOLATION_CAP: 3,
        },
    } as const,
    BOTS: {
        MIN_POPULATION: 3,
        MIN_LVL1_BOTS: 3,
        MIN_LVL1_PROTECTED: 3,
        MIN_LVL1_ACTIVE_BOTS: 1,
        LVL1_RESERVE_PER_HUMAN: 0.5,
        LVL1_RESERVE_BUFFER: 2,
        ACTIVITY_RATE: 0.15,
        MAX_FIGHTS_PER_RUN: 1,
        END_OF_DAY_DRAIN_START_HOUR: 22,
        GROWTH_CHANCE: 0.05,
        BURST_GROWTH_CHANCE: 0.10,
    },
    LIVEOPS: {
        BURST_EXTRA_FIGHTS: 1,
        DEPTH_IDLE_RATIO_SAMPLE: true,
    }
} as const;

export type CombatSpeed = (typeof GAME_RULES)['COMBAT']['SPEED_OPTIONS'][number];
