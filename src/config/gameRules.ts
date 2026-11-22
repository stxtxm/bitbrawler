export const GAME_RULES = {
    /** Documentés mais non implémentés ([1387]) — paliers de terrain pour les
     *  nouveaux biomes régionaux. Implémentation à faire plus tard. */
    BIOME_MILESTONES: {
        /** Biome de feu — débloqué au lvl 20 (un combat beaucoup plus compliqué). */
        fire: 20,
        /** Biome de montagne neige — lvl 40. */
        snow_mountain: 40,
    },
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
        SPEED_OPTIONS: [1, 2, 4],
        MAX_DURATION_MS: 30000,
    },
    PVE: {
        XP_MODIFIER: 2.5,
        SURGE_XP_MODIFIER: 3.1,
        SURGE_ESSENCE_MULTIPLIER: 1.25,
        BOUNTY_TARGET: 3,
        STAT_MULTIPLIER: 2.3,
        HP_MULTIPLIER: 1.0,
        LEVEL_BOOST: 4, // Monsters fight at playerLevel + this offset
    },
    BOSS: {
        UNLOCK_LEVEL: 20, // Boss PvE unlocks at this level (void_titan) — corrigé lvl 20 [1387]
        MAX_DAILY_ATTACKS: 5, // Daily attacks against the raid boss (independent from PvP/PvE gauge)
        LEVEL_BOOST: 2, // Boss fights at playerLevel + this offset
        STAT_MULTIPLIER: 1.1, // Boss raw stats scale off the player's raw stats
        HP_MULTIPLIER: 3.0, // Boss HP = player maxHp * this (before phase/pity), single-attempt fight
        XP_MODIFIER: 4.0, // Boss kill XP payout multiplier (vs a regular fight win)
        ESSENCE_REWARD: 60, // Essence rewarded on boss kill (Phase 3 baseline)
        PITY_STEP_DEFEATS: 3, // Every N defeats increases pity reduction
        PITY_STEP_REDUCTION: 0.2, // Reduction per pity step (20%)
        PITY_CAP: 0.6, // Max pity HP reduction (60%)
        CONSOLATION_ESSENCE: 15, // Essence on defeat (baseline)
        CONSOLATION_XP: 20, // XP on defeat (baseline)
        CONSOLATION_CAP: 3, // Max consolation payouts per Paris day
    },
    BOSS_ACCESSIBILITY: {
        void_titan: {
            PHASE_1: { MAX_LEVEL: 40, HP_FACTOR: 0.25, STAT_FACTOR: 0.5, ESSENCE_REWARD: 30 },
            PHASE_2: { MAX_LEVEL: 60, HP_FACTOR: 0.5, STAT_FACTOR: 1.0, ESSENCE_REWARD: 45 },
            PHASE_3: { HP_FACTOR: 0.75, STAT_FACTOR: 1.0, ESSENCE_REWARD: 60 },
        },
    } as const,
    BOSS_TIERS: {
        void_titan: {
            // [1387] Corrigé lvl 20 — le bouton n'est plus bloqué jusqu'à 30
            UNLOCK_LEVEL: 20,
            MAX_DAILY_ATTACKS: 5,
            LEVEL_BOOST: 2,
            STAT_MULTIPLIER: 1.1,
            HP_MULTIPLIER: 3.0,
            XP_MODIFIER: 4.0,
            ESSENCE_REWARD: 60,
            REQUIRES_KILLS: 0,
            PITY_STEP_DEFEATS: 3,
            PITY_STEP_REDUCTION: 0.2,
            PITY_CAP: 0.6,
            CONSOLATION_ESSENCE: 15,
            CONSOLATION_XP: 25,
            CONSOLATION_CAP: 5,
        },
        stone_colossus: {
            // Second raid boss: débloqué après le premier kill Void Titan, ouvre le biome montagne.
            UNLOCK_LEVEL: 40,
            MAX_DAILY_ATTACKS: 5,
            LEVEL_BOOST: 3,
            STAT_MULTIPLIER: 1.35,
            HP_MULTIPLIER: 5.5,
            XP_MODIFIER: 5.0,
            ESSENCE_REWARD: 80,
            REQUIRES_KILLS: 1,
            REQUIRES_BOSS_ID: 'void_titan',
            PITY_STEP_DEFEATS: 3,
            PITY_STEP_REDUCTION: 0.2,
            PITY_CAP: 0.6,
            CONSOLATION_ESSENCE: 22,
            CONSOLATION_XP: 30,
            CONSOLATION_CAP: 4,
        },
        abyssal_monarch: {
            // Troisième raid boss: débloqué après le kill du Stone Colossus, devient le boss lvl 60.
            UNLOCK_LEVEL: 60,
            MAX_DAILY_ATTACKS: 5,
            LEVEL_BOOST: 3,
            STAT_MULTIPLIER: 1.3,
            HP_MULTIPLIER: 4.0,
            XP_MODIFIER: 6.0,
            ESSENCE_REWARD: 100,
            REQUIRES_KILLS: 1,
            REQUIRES_BOSS_ID: 'stone_colossus',
            PITY_STEP_DEFEATS: 3,
            PITY_STEP_REDUCTION: 0.2,
            PITY_CAP: 0.6,
            CONSOLATION_ESSENCE: 30,
            CONSOLATION_XP: 35,
            CONSOLATION_CAP: 3,
        },
    } as const,
    BOTS: {
        MIN_POPULATION: 5,
        MIN_LVL1_BOTS: 3,
        MIN_LVL1_PROTECTED: 3,
        MIN_LVL1_ACTIVE_BOTS: 1,
        LVL1_RESERVE_PER_HUMAN: 0.5,
        LVL1_RESERVE_BUFFER: 2,
        ACTIVITY_RATE: 0.25,
        MAX_FIGHTS_PER_RUN: 1,
        END_OF_DAY_DRAIN_START_HOUR: 22,
        GROWTH_CHANCE: 0.07,
        BURST_GROWTH_CHANCE: 0.10,
    },
    LIVEOPS: {
        BURST_EXTRA_FIGHTS: 1,
        DEPTH_IDLE_RATIO_SAMPLE: true,
    },
    ECONOMY: {
        DAILY_LOGIN_ESSENCE: 5,
        WELCOME_ESSENCE: 20,
    },
    COMEBACK: {
        SECOND_WIND_PER_LOSS: 5,
        SECOND_WIND_CAP: 25,
        LOSS_PITY_FLOOR_LOSSES: 3,
        RECOVERY_QUEST_TRIGGER_LOSSES: 3,
        RECOVERY_QUEST_WINDOW_MS: 24 * 60 * 60 * 1000,
        RECOVERY_QUEST_ESSENCE: 40,
    },
    LOOTBOX: {
        EPIC_WITHIN: 16,
        LEGENDARY_WITHIN: 30,
        EPIC_BOOST_PER_COMMON: 0.005,
        EPIC_BOOST_CAP: 0.10,
    },
} as const;

export type CombatSpeed = (typeof GAME_RULES)['COMBAT']['SPEED_OPTIONS'][number];
