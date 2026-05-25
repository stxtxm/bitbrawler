import { generateInitialStats, generateCharacterName } from '../src/utils/characterUtils';
import { calculateFightXp, gainXp } from '../src/utils/xpUtils';
import { simulateCombat } from '../src/utils/combatUtils';
import { GAME_RULES } from '../src/config/gameRules';
import { autoAllocateStatPointsRandom } from '../src/utils/statUtils';
import { ITEM_ASSETS } from '../src/data/itemAssets';
import { canRollLootbox, rollLootbox } from '../src/utils/lootboxUtils';
import { DAILY_RESET_TIMEZONE, shouldResetDaily } from '../src/utils/dailyReset';
import { getZonedMidnightUtc, getZonedParts } from '../src/utils/timezoneUtils';
import {
    buildLevelOneReserveTarget,
    getBotActivityProfile,
    getBotFightBudgetForRun,
    isEndOfDayDrainWindow
} from '../src/utils/botBehaviorUtils';
import { Character, IncomingFightHistory } from '../src/types/Character';
import { supabase } from './supabaseAdmin';
import { INVENTORY_CAPACITY, COMBAT_LOG_HISTORY_CAP } from '../src/utils/persistenceUtils';
const DB_BATCH_SIZE = 10;

/** Return a human-readable label distinguishing bots from auto-mode human players */
const logLabel = (c: Character): string => c.isBot ? 'Bot' : 'Player';

// Columns needed for bot processing (all mutating columns + identity)
const BOT_SELECT_COLUMNS = [
    'id', 'name', 'gender', 'seed', 'level', 'hp', 'max_hp',
    'strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus',
    'experience', 'wins', 'losses', 'fights_left', 'last_fight_reset',
    'stat_points', 'inventory', 'last_loot_roll', 'fight_history',
    'fought_today', 'pending_fight', 'incoming_fight_history',
    'is_bot', 'auto_mode'
].join(',');

// Columns needed for opponent matching and combat (stats-only, no mutation)
const OPPONENT_SELECT_COLUMNS = [
    'id', 'name', 'is_bot', 'level',
    'hp', 'max_hp',
    'strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus'
].join(',');

type BotSimulationOptions = {
    skipBotIds?: Set<string>;
    protectedLevelOneCount?: number;
};

type PopulationSnapshot = {
    totalBots: number;
    levelOneBots: number;
    levelOneHumans: number;
};

/** Pre-load incoming_fight_history for all potential targets at once */
async function preloadIncomingHistories(characterIds: Set<string>): Promise<Map<string, IncomingFightHistory[]>> {
    const map = new Map<string, IncomingFightHistory[]>();
    if (characterIds.size === 0) return map;
    const ids = Array.from(characterIds);
    for (let i = 0; i < ids.length; i += DB_BATCH_SIZE) {
        const batch = ids.slice(i, i + DB_BATCH_SIZE);
        const { data } = await supabase
            .from('characters')
            .select('id, incoming_fight_history')
            .in('id', batch);
        if (data) {
            for (const row of data) {
                map.set(row.id, row.incoming_fight_history ?? []);
            }
        }
    }
    return map;
}

/** Batch-append incoming fight history entries (accumulate, flush at end) */
function appendIncomingFightHistoryToCache(
    cache: Map<string, IncomingFightHistory[]>,
    targetCharacterId: string,
    entry: IncomingFightHistory
): void {
    if (!cache.has(targetCharacterId)) return;
    const existing = cache.get(targetCharacterId)!;
    cache.set(targetCharacterId, [entry, ...existing].slice(0, COMBAT_LOG_HISTORY_CAP));
}

async function flushIncomingHistories(
    cache: Map<string, IncomingFightHistory[]>
): Promise<void> {
    const entries = Array.from(cache.entries()).filter(([, v]) => v.length > 0);
    for (let i = 0; i < entries.length; i += DB_BATCH_SIZE) {
        const batch = entries.slice(i, i + DB_BATCH_SIZE);
        await Promise.all(batch.map(([id, history]) =>
            supabase
                .from('characters')
                .update({ incoming_fight_history: history })
                .eq('id', id)
                .then(r => {
                    if (r.error) console.warn(`⚠️ Failed to flush incoming history for ${id}:`, r.error);
                })
        ));
    }
}

async function measurePopulation(): Promise<PopulationSnapshot> {
    const [totalBotsResult, levelOneBotsResult, levelOneCharactersResult] = await Promise.all([
        supabase.from('characters').select('*', { count: 'exact', head: true }).eq('is_bot', true),
        supabase.from('characters').select('*', { count: 'exact', head: true }).eq('is_bot', true).eq('level', 1),
        supabase.from('characters').select('*', { count: 'exact', head: true }).eq('level', 1),
    ]);

    const totalBots = totalBotsResult.count ?? 0;
    const levelOneBots = levelOneBotsResult.count ?? 0;
    const levelOneCharacters = levelOneCharactersResult.count ?? 0;
    const levelOneHumans = Math.max(0, levelOneCharacters - levelOneBots);

    return { totalBots, levelOneBots, levelOneHumans };
}

async function runBotLogic() {
    console.log('🤖 Starting Bot Engine...');

    try {
        const populations = await measurePopulation();
        const levelOneReserveTarget = buildLevelOneReserveTarget(populations.levelOneHumans);
        console.log(
            `📊 Population snapshot | bots: ${populations.totalBots}, lvl1 bots: ${populations.levelOneBots}, lvl1 humans: ${populations.levelOneHumans}, reserve target: ${levelOneReserveTarget}`
        );
        const skipBotIds = new Set<string>();
        let totalBots = populations.totalBots;
        let lvl1Bots = populations.levelOneBots;

        if (totalBots < GAME_RULES.BOTS.MIN_POPULATION) {
            console.log('📉 Total bot population low. Spawning reinforcements...');
            const needed = GAME_RULES.BOTS.MIN_POPULATION - totalBots;
            for (let i = 0; i < needed; i++) {
                await createNewBot();
                totalBots += 1;
                lvl1Bots += 1;
            }
        }

        if (lvl1Bots < levelOneReserveTarget) {
            console.log(`📉 Lvl 1 reserve low (${lvl1Bots}/${levelOneReserveTarget}). Spawning LVL 1 bots...`);
            const needed = levelOneReserveTarget - lvl1Bots;
            for (let i = 0; i < needed; i++) {
                const newBotId = await createNewBot();
                skipBotIds.add(newBotId);
                totalBots += 1;
                lvl1Bots += 1;
            }
        }

        if (Math.random() <= GAME_RULES.BOTS.GROWTH_CHANCE) {
            console.log('📈 Scheduled bot growth triggered.');
            const newBotId = await createNewBot();
            skipBotIds.add(newBotId);
        }

        await simulateBotDailyLife({
            skipBotIds,
            protectedLevelOneCount: levelOneReserveTarget
        });

        const finalPop = await measurePopulation();
        if (finalPop.levelOneBots < GAME_RULES.BOTS.MIN_LVL1_BOTS) {
            const needed = GAME_RULES.BOTS.MIN_LVL1_BOTS - finalPop.levelOneBots;
            console.log(`🛡️ Final check: lvl1 bots = ${finalPop.levelOneBots}, spawning ${needed} more...`);
            for (let i = 0; i < needed; i++) {
                await createNewBot();
            }
            const afterPop = await measurePopulation();
            console.log(`✅ Post-spawn: ${afterPop.levelOneBots} lvl1 bots now available`);
        } else {
            console.log(`✅ Final check: ${finalPop.levelOneBots} lvl1 bots available (≥ ${GAME_RULES.BOTS.MIN_LVL1_BOTS})`);
        }

        console.log('✅ Bot Engine finished successfully');
    } catch (error) {
        console.error('❌ Bot Engine failed:', error);
        process.exit(1);
    }
}

async function createNewBot(): Promise<string> {
    const fullName = generateCharacterName().toUpperCase();

    const stats = generateInitialStats(fullName, Math.random() > 0.5 ? 'male' : 'female');

    const botRow: Record<string, any> = {
        name: fullName,
        gender: stats.gender,
        seed: stats.seed,
        level: stats.level,
        hp: stats.hp,
        max_hp: stats.maxHp,
        strength: stats.strength,
        vitality: stats.vitality,
        dexterity: stats.dexterity,
        luck: stats.luck,
        intelligence: stats.intelligence,
        focus: stats.focus ?? 10,
        is_bot: true,
        experience: 0,
        wins: 0,
        losses: 0,
        fights_left: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
        last_fight_reset: Date.now(),
        stat_points: 0,
        inventory: [],
        last_loot_roll: 0,
        fight_history: [],
        fought_today: [],
        pending_fight: null,
        incoming_fight_history: [],
        auto_mode: false,
    };

    const { data, error } = await supabase
        .from('characters')
        .insert(botRow)
        .select('id')
        .single();

    if (error || !data) {
        console.error(`❌ Failed to create bot ${fullName}:`, error);
        throw error || new Error('Failed to create bot');
    }

    console.log(`🆕 Created new bot: ${fullName} (Level ${stats.level})`);
    return data.id;
}

function convertRowToCharacter(row: any): Character {
    return {
        name: row.name,
        gender: row.gender,
        seed: row.seed,
        level: row.level ?? 1,
        hp: row.hp ?? 100,
        maxHp: row.max_hp ?? 100,
        strength: row.strength ?? 10,
        vitality: row.vitality ?? 10,
        dexterity: row.dexterity ?? 10,
        luck: row.luck ?? 10,
        intelligence: row.intelligence ?? 10,
        focus: row.focus ?? GAME_RULES.STATS.BASE_VALUE,
        experience: row.experience ?? 0,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        fightsLeft: typeof row.fights_left === 'number' && Number.isFinite(row.fights_left) ? row.fights_left : 0,
        lastFightReset: row.last_fight_reset ?? 0,
        fightHistory: row.fight_history ?? [],
        foughtToday: row.fought_today ?? [],
        statPoints: row.stat_points ?? 0,
        pendingFight: row.pending_fight ?? null,
        inventory: row.inventory ?? [],
        lastLootRoll: row.last_loot_roll ?? 0,
        incomingFightHistory: row.incoming_fight_history ?? [],
        isBot: row.is_bot ?? false,
        battleCount: 0,
        firestoreId: row.id,
        equipped: {},
    };
}

function selectProtectedLevelOneBotIds(
    bots: Character[],
    skipIds: Set<string>,
    protectedLevelOneCount: number
): Set<string> {
    const nextSkip = new Set(skipIds);
    if (protectedLevelOneCount <= 0) return nextSkip;

    const alreadyProtected = bots.filter((bot) =>
        bot.level === 1 &&
        !!bot.firestoreId &&
        nextSkip.has(bot.firestoreId)
    ).length;

    const additionalNeeded = Math.max(0, protectedLevelOneCount - alreadyProtected);
    if (additionalNeeded === 0) return nextSkip;

    const levelOnePool = bots
        .filter((bot) =>
            bot.level === 1 &&
            !!bot.firestoreId &&
            !nextSkip.has(bot.firestoreId)
        )
        .sort((a, b) => {
            const aBattles = a.battleCount ?? 0;
            const bBattles = b.battleCount ?? 0;
            if (aBattles !== bBattles) return aBattles - bBattles;
            const aEnergy = a.fightsLeft ?? 0;
            const bEnergy = b.fightsLeft ?? 0;
            return bEnergy - aEnergy;
        });

    const maxProtectable = Math.max(0, levelOnePool.length - GAME_RULES.BOTS.MIN_LVL1_ACTIVE_BOTS);
    const toProtect = Math.min(additionalNeeded, maxProtectable);

    for (let i = 0; i < toProtect; i++) {
        const bot = levelOnePool[i];
        if (bot.firestoreId) nextSkip.add(bot.firestoreId);
    }

    return nextSkip;
}

async function simulateBotDailyLife(options: BotSimulationOptions = {}) {
    const {
        skipBotIds = new Set<string>(),
        protectedLevelOneCount = GAME_RULES.BOTS.MIN_LVL1_BOTS
    } = options;

    const { data: rows, error } = await supabase
        .from('characters')
        .select(BOT_SELECT_COLUMNS)
        .or('is_bot.eq.true,auto_mode.eq.true');

    if (error) {
        console.error('❌ Failed to fetch bots:', error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('No bots found to simulate.');
        return;
    }

    const bots = rows.map(convertRowToCharacter);
    const autoModeHumans = bots.filter(b => !b.isBot);
    if (autoModeHumans.length > 0) {
        console.log(`👤 Auto-mode humans in pool: ${autoModeHumans.length} (${autoModeHumans.map(b => b.name).join(', ')})`);
    }

    const runNow = Date.now();
    const runParisHour = getZonedParts(new Date(runNow), DAILY_RESET_TIMEZONE).hour;
    const endOfDayDrain = isEndOfDayDrainWindow(runParisHour);
    const protectedIds = selectProtectedLevelOneBotIds(bots, skipBotIds, protectedLevelOneCount);
    const protectionEnabled = !endOfDayDrain;
    const fightEligibleBots = protectionEnabled
        ? bots.filter(bot => !protectedIds.has(bot.firestoreId ?? ''))
        : bots;
    const protectedCount = protectionEnabled ? bots.length - fightEligibleBots.length : 0;

    if (endOfDayDrain) {
        console.log('🌙 End-of-day catch-up window active: draining remaining fights for all bots before reset.');
    } else if (protectedCount > 0) {
        console.log(`⏸️ Protecting ${protectedCount} bots this run (starter reserve + fresh spawns).`);
    }

    console.log(`🎁 Processing daily reset/loot for ${bots.length} bots.`);
    console.log(`⚡ Simulating fight activity for ${fightEligibleBots.length} bots.`);

    const opponentsByLevel = new Map<number, Character[]>();
    let fallbackOpponentPool: Character[] | null = null;
    const loadOpponentsForLevel = async (level: number) => {
        if (opponentsByLevel.has(level)) return;
        const { data: rows } = await supabase
            .from('characters')
            .select(OPPONENT_SELECT_COLUMNS)
            .eq('level', level)
            .limit(50);
        opponentsByLevel.set(level, (rows ?? []).map(convertRowToCharacter));
    };
    const loadFallbackOpponentPool = async () => {
        if (fallbackOpponentPool) return;
        const { data: rows } = await supabase
            .from('characters')
            .select(OPPONENT_SELECT_COLUMNS)
            .limit(200);
        fallbackOpponentPool = (rows ?? []).map(convertRowToCharacter);
    };

    // Pre-load incoming fight histories for all potential opponent targets
    const allOpponentIds = new Set<string>();
    for (const bot of bots) {
        if (bot.firestoreId) allOpponentIds.add(bot.firestoreId);
    }
    const incomingHistoryCache = await preloadIncomingHistories(allOpponentIds);

    // Accumulate bot state updates for batched flush
    const pendingBotUpdates: Array<{ id: string; name: string; data: Record<string, any> }> = [];

    for (const bot of bots) {
        try {
            if (!bot.firestoreId) continue;

            if (!bot.isBot) {
                console.log(`👤 Processing auto-mode human: ${bot.name} (LVL ${bot.level}, energy: ${bot.fightsLeft})`);
            }

            const isProtected = protectionEnabled && protectedIds.has(bot.firestoreId);
            let currentBotState = { ...bot, statPoints: bot.statPoints ?? 0 };
            let fightsLeft = currentBotState.fightsLeft;
            let totalXpGained = 0;
            const startLevel = currentBotState.level;
            let didLootbox = false;
            let didReset = false;

            if (shouldResetDaily(currentBotState.lastFightReset, runNow)) {
                const parisMidnightUtc = getZonedMidnightUtc(new Date(runNow), DAILY_RESET_TIMEZONE);
                fightsLeft = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
                currentBotState.lastFightReset = parisMidnightUtc;
                currentBotState.battleCount = 0;
                didReset = true;
                console.log(`🔄 Daily reset for ${logLabel(currentBotState)} ${currentBotState.name}`);
            }

            if (canRollLootbox(currentBotState.lastLootRoll, runNow)) {
                const inventory = currentBotState.inventory || [];
                if (inventory.length < INVENTORY_CAPACITY) {
                    const item = rollLootbox(ITEM_ASSETS, { excludeIds: inventory, level: currentBotState.level });
                    if (item) {
                        currentBotState = {
                            ...currentBotState,
                            inventory: [...inventory, item.id],
                            lastLootRoll: runNow
                        };
                        didLootbox = true;
                        console.log(`🎁 ${logLabel(currentBotState)} ${currentBotState.name} opened lootbox: ${item.name} (${item.rarity})`);
                    } else {
                        console.log(`🎁 ${logLabel(currentBotState)} ${currentBotState.name} already collected all lootbox items.`);
                    }
                } else {
                    console.log(`📦 ${logLabel(currentBotState)} ${currentBotState.name} inventory full. Skipping lootbox.`);
                }
            }

            const fightBudget = isProtected
                ? 0
                : endOfDayDrain
                    ? fightsLeft
                    : getBotFightBudgetForRun({
                        fightsLeft,
                        parisHour: runParisHour,
                        profile: getBotActivityProfile(bot.firestoreId, bot.seed)
                    });
            let actionsTaken = 0;

            while (fightsLeft > 0 && actionsTaken < fightBudget) {
                await loadOpponentsForLevel(currentBotState.level);
                const pool = opponentsByLevel.get(currentBotState.level) ?? [];
                let potentialOpponents = pool.filter(c =>
                    c.firestoreId !== currentBotState.firestoreId
                );

                if (potentialOpponents.length === 0 && endOfDayDrain) {
                    await loadFallbackOpponentPool();
                    potentialOpponents = (fallbackOpponentPool ?? []).filter(c =>
                        c.firestoreId !== currentBotState.firestoreId
                    );
                    if (potentialOpponents.length > 0) {
                        console.log(`🔁 ${currentBotState.name}: fallback opponent pool used for end-of-day catch-up.`);
                    }
                }

                let opponent: Character;
                if (potentialOpponents.length > 0) {
                    opponent = potentialOpponents[Math.floor(Math.random() * potentialOpponents.length)];
                } else {
                    console.log(
                        endOfDayDrain
                            ? `⚠️ No opponents available for ${logLabel(currentBotState)} ${currentBotState.name}. Skipping remaining fights.`
                            : `⚠️ No same-level opponent for ${logLabel(currentBotState)} ${currentBotState.name} (LVL ${currentBotState.level}). Skipping fights.`
                    );
                    break;
                }

                const combat = simulateCombat(currentBotState, opponent);
                const won = combat.winner === 'attacker';
                const opponentType = opponent.isBot ? 'BOT' : 'PLAYER';
                const combatOutcome = won ? 'WIN' : 'LOSS';

                console.log(`⚔️ ${currentBotState.name} vs ${opponent.name} [${opponentType}] -> ${combatOutcome}`);

                // Cache incoming fight history in memory instead of per-fight DB round-trips
                if (opponent.firestoreId) {
                    const incomingEntry: IncomingFightHistory = {
                        date: Date.now(),
                        attackerName: currentBotState.name,
                        attackerId: currentBotState.firestoreId,
                        attackerIsBot: true,
                        won: !won,
                        source: 'bot'
                    };
                    appendIncomingFightHistoryToCache(incomingHistoryCache, opponent.firestoreId, incomingEntry);
                }

                const xpGained = calculateFightXp(currentBotState.level, won);
                totalXpGained += xpGained;

                const result = gainXp(currentBotState, xpGained);
                const pointsGained = result.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;
                const updatedBase = {
                    ...result.updatedCharacter,
                    statPoints: result.updatedCharacter.statPoints ?? currentBotState.statPoints ?? 0
                };
                const withStats = pointsGained > 0
                    ? autoAllocateStatPointsRandom(updatedBase, pointsGained)
                    : updatedBase;

                const historyEntry = {
                    date: Date.now(),
                    won,
                    opponentName: opponent.name
                };
                const existingHistory = currentBotState.fightHistory || [];
                const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

                currentBotState = {
                    ...withStats,
                    fightsLeft: fightsLeft - 1,
                    wins: won ? (currentBotState.wins || 0) + 1 : (currentBotState.wins || 0),
                    losses: won ? (currentBotState.losses || 0) : (currentBotState.losses || 0) + 1,
                    battleCount: (currentBotState.battleCount || 0) + 1,
                    fightHistory: newHistory,
                    statPoints: withStats.statPoints
                };

                fightsLeft--;
                actionsTaken++;
            }

            const shouldPersist = actionsTaken > 0 || didLootbox || didReset;
            if (shouldPersist && bot.firestoreId) {
                const finalUpdates: Record<string, any> = {
                    experience: currentBotState.experience,
                    level: currentBotState.level,
                    fights_left: currentBotState.fightsLeft,
                    wins: currentBotState.wins,
                    losses: currentBotState.losses,
                    fight_history: currentBotState.fightHistory,
                    strength: currentBotState.strength,
                    vitality: currentBotState.vitality,
                    dexterity: currentBotState.dexterity,
                    luck: currentBotState.luck,
                    intelligence: currentBotState.intelligence,
                    focus: currentBotState.focus,
                    hp: currentBotState.hp,
                    max_hp: currentBotState.maxHp,
                    last_fight_reset: currentBotState.lastFightReset,
                    stat_points: currentBotState.statPoints,
                    inventory: currentBotState.inventory,
                    last_loot_roll: currentBotState.lastLootRoll,
                };

                const sanitizedUpdates = Object.fromEntries(
                    Object.entries(finalUpdates).filter(([, value]) => value !== undefined)
                );

                // Accumulate for batched flush
                pendingBotUpdates.push({
                    id: bot.firestoreId,
                    name: bot.name,
                    data: sanitizedUpdates
                });

                const levelDiff = currentBotState.level - startLevel;
                if (actionsTaken > 0) {
                    console.log(`👊 ${logLabel(bot)} ${bot.name}: ${actionsTaken}/${fightBudget} fights, +${totalXpGained} XP. ${levelDiff > 0 ? `🆙 LVL UP +${levelDiff}` : ''} Energy left: ${currentBotState.fightsLeft}`);
                } else if (didLootbox) {
                    console.log(`📦 ${logLabel(bot)} ${bot.name} updated inventory. Energy left: ${currentBotState.fightsLeft}`);
                } else if (isProtected && fightsLeft > 0) {
                    console.log(`🛡️ ${logLabel(bot)} ${bot.name} kept in protected pool (energy: ${fightsLeft}).`);
                } else {
                    const restReason = fightBudget === 0 && fightsLeft > 0 ? 'scheduled rest' : '0 energy';
                    console.log(`💤 ${logLabel(bot)} ${bot.name} is resting (${restReason}).`);
                }
            } else {
                if (fightsLeft > 0) {
                    if (fightBudget === 0) {
                        console.log(`💤 ${logLabel(bot)} ${bot.name} skipped activity this run (energy: ${fightsLeft}).`);
                    } else {
                        console.log(`💤 ${logLabel(bot)} ${bot.name} found no opponents (energy: ${fightsLeft}).`);
                    }
                } else {
                    console.log(`💤 ${logLabel(bot)} ${bot.name} is resting (0 energy).`);
                }
            }
        } catch (botError) {
            console.warn(`⚠️ ${logLabel(bot)} ${bot.name || bot.firestoreId || 'unknown'} skipped due to error:`, botError);
        }
    }

    // Flush all accumulated updates in parallel batches
    if (pendingBotUpdates.length > 0) {
        console.log(`💾 Flushing ${pendingBotUpdates.length} bot updates in batches of ${DB_BATCH_SIZE}...`);
        for (let i = 0; i < pendingBotUpdates.length; i += DB_BATCH_SIZE) {
            const batch = pendingBotUpdates.slice(i, i + DB_BATCH_SIZE);
            await Promise.all(batch.map(({ id, name, data }) =>
                supabase
                    .from('characters')
                    .update(data)
                    .eq('id', id)
                    .then(r => {
                        if (r.error) console.warn(`⚠️ Failed to update bot ${name}:`, r.error);
                    })
            ));
        }
    }

    // Flush accumulated incoming fight histories in parallel batches
    await flushIncomingHistories(incomingHistoryCache);
}

runBotLogic();
