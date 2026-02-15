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
import { initFirebaseAdmin, loadServiceAccount } from './firebaseAdmin';

// Initialize Firebase Admin
let serviceAccount: ReturnType<typeof loadServiceAccount>;

type TimestampLike = {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
};

type BotSimulationOptions = {
    skipBotIds?: Set<string>;
    protectedLevelOneCount?: number;
};

type PopulationSnapshot = {
    totalBots: number;
    levelOneBots: number;
    levelOneHumans: number;
};

const normalizeTimestamp = (value: unknown, fallback = 0): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? fallback : parsed;
    }

    if (value && typeof value === 'object') {
        const maybe = value as TimestampLike;
        if (typeof maybe.toMillis === 'function') {
            const millis = maybe.toMillis();
            return Number.isFinite(millis) ? millis : fallback;
        }
        if (typeof maybe.seconds === 'number') {
            const nanos = typeof maybe.nanoseconds === 'number' ? maybe.nanoseconds : 0;
            return Math.floor(maybe.seconds * 1000 + nanos / 1_000_000);
        }
    }

    return fallback;
};

const normalizeIncomingFightHistory = (value: unknown): IncomingFightHistory[] => {
    if (!Array.isArray(value)) return [];

    return value
        .filter((entry): entry is IncomingFightHistory => (
            !!entry &&
            typeof entry === 'object' &&
            typeof (entry as IncomingFightHistory).date === 'number' &&
            typeof (entry as IncomingFightHistory).attackerName === 'string' &&
            typeof (entry as IncomingFightHistory).won === 'boolean'
        ));
};

try {
    serviceAccount = loadServiceAccount();
} catch (error) {
    console.error('Failed to parse service account:', error);
    process.exit(1);
}

if (!serviceAccount) {
    console.warn('⚠️ No service account found. Please set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json');
    process.exit(0);
}

const db = initFirebaseAdmin(serviceAccount);
const INVENTORY_CAPACITY = 24;
const COMBAT_LOG_HISTORY_CAP = 20;

async function appendIncomingFightHistory(targetCharacterId: string, entry: IncomingFightHistory): Promise<boolean> {
    try {
        const targetRef = db.collection('characters').doc(targetCharacterId);
        await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(targetRef);
            if (!snapshot.exists) return;

            const existing = normalizeIncomingFightHistory(snapshot.get('incomingFightHistory'));
            const nextHistory = [entry, ...existing].slice(0, COMBAT_LOG_HISTORY_CAP);
            transaction.update(targetRef, {
                incomingFightHistory: nextHistory
            });
        });
        return true;
    } catch (error) {
        console.warn(`⚠️ Failed to append incoming fight history for ${targetCharacterId}:`, error);
        return false;
    }
}

async function measurePopulation(): Promise<PopulationSnapshot> {
    const [totalBotsSnapshot, levelOneBotsSnapshot, levelOneCharactersSnapshot] = await Promise.all([
        db.collection('characters').where('isBot', '==', true).count().get(),
        db.collection('characters')
            .where('isBot', '==', true)
            .where('level', '==', 1)
            .count()
            .get(),
        db.collection('characters')
            .where('level', '==', 1)
            .count()
            .get()
    ]);

    const totalBots = totalBotsSnapshot.data().count;
    const levelOneBots = levelOneBotsSnapshot.data().count;
    const levelOneCharacters = levelOneCharactersSnapshot.data().count;
    const levelOneHumans = Math.max(0, levelOneCharacters - levelOneBots);

    return {
        totalBots,
        levelOneBots,
        levelOneHumans
    };
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

        // 1. Force population growth if below minimum
        if (totalBots < GAME_RULES.BOTS.MIN_POPULATION) {
            console.log('📉 Total bot population low. Spawning reinforcements...');
            const needed = GAME_RULES.BOTS.MIN_POPULATION - totalBots;
            for (let i = 0; i < needed; i++) {
                await createNewBot();
                totalBots += 1;
                lvl1Bots += 1;
            }
        }

        // 1b. Ensure a dynamic reserve of level 1 opponents for onboarding
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

        // 2. Baseline growth keeps roster fresh
        if (Math.random() <= GAME_RULES.BOTS.GROWTH_CHANCE) {
            console.log('📈 Scheduled bot growth triggered.');
            const newBotId = await createNewBot();
            skipBotIds.add(newBotId);
        }

        // 3. Simulate bot activity with level 1 protection (except end-of-day catch-up)
        await simulateBotDailyLife({
            skipBotIds,
            protectedLevelOneCount: levelOneReserveTarget
        });

        console.log('✅ Bot Engine finished successfully');
    } catch (error) {
        console.error('❌ Bot Engine failed:', error);
        process.exit(1);
    }
}

async function createNewBot(): Promise<string> {
    const fullName = generateCharacterName().toUpperCase();

    const stats = generateInitialStats(fullName, Math.random() > 0.5 ? 'male' : 'female');

    const botData: Character = {
        ...stats,
        isBot: true,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
        lastFightReset: Date.now(),
        battleCount: 0,
        statPoints: 0,
        inventory: [],
        equipped: {},
        lastLootRoll: 0
    };

    const docRef = await db.collection('characters').add(botData);
    console.log(`🆕 Created new bot: ${fullName} (Level ${stats.level})`);
    return docRef.id;
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
    // Fetch only bots
    const snapshot = await db.collection('characters')
        .where('isBot', '==', true)
        .get();

    if (snapshot.empty) {
        console.log('No bots found to simulate.');
        return;
    }

    const bots = snapshot.docs.map(doc => {
        const data = doc.data() as Character;
        const lastFightReset = normalizeTimestamp(data.lastFightReset, 0);
        const fightsLeft = typeof data.fightsLeft === 'number' && Number.isFinite(data.fightsLeft)
            ? data.fightsLeft
            : 0;
        const battleCount = typeof (data as { battleCount?: unknown }).battleCount === 'number'
            ? (data as { battleCount?: number }).battleCount ?? 0
            : 0;
        return {
            ...data,
            firestoreId: doc.id,
            fightsLeft,
            lastFightReset,
            battleCount,
            statPoints: data.statPoints ?? 0,
            focus: data.focus ?? GAME_RULES.STATS.BASE_VALUE,
            inventory: data.inventory ?? [],
            equipped: data.equipped ?? {},
            lastLootRoll: data.lastLootRoll ?? 0
        };
    });

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
        const snapshot = await db.collection('characters')
            .where('level', '==', level)
            .limit(50)
            .get();
        const opponents = snapshot.docs.map(doc => ({
            ...doc.data() as Character,
            firestoreId: doc.id
        }));
        opponentsByLevel.set(level, opponents);
    };
    const loadFallbackOpponentPool = async () => {
        if (fallbackOpponentPool) return;
        const snapshot = await db.collection('characters')
            .limit(200)
            .get();
        fallbackOpponentPool = snapshot.docs.map(doc => ({
            ...doc.data() as Character,
            firestoreId: doc.id
        }));
    };

    for (const bot of bots) {
        if (!bot.firestoreId) continue;

        const isProtected = protectionEnabled && protectedIds.has(bot.firestoreId);
        let currentBotState = { ...bot, statPoints: bot.statPoints ?? 0 };
        let fightsLeft = currentBotState.fightsLeft;
        let totalXpGained = 0;
        const startLevel = currentBotState.level;
        let didLootbox = false;
        let didReset = false;

        // 1. Daily Reset Logic
        if (shouldResetDaily(currentBotState.lastFightReset, runNow)) {
            const parisMidnightUtc = getZonedMidnightUtc(new Date(runNow), DAILY_RESET_TIMEZONE);
            fightsLeft = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
            currentBotState.lastFightReset = parisMidnightUtc;
            currentBotState.battleCount = 0;
            didReset = true;
            console.log(`🔄 Daily reset for bot ${currentBotState.name}`);
        }

        // 2. Daily Lootbox
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
                    console.log(`🎁 Bot ${currentBotState.name} opened lootbox: ${item.name} (${item.rarity})`);
                } else {
                    console.log(`🎁 Bot ${currentBotState.name} already collected all lootbox items.`);
                }
            } else {
                console.log(`📦 Bot ${currentBotState.name} inventory full. Skipping lootbox.`);
            }
        } else {
            console.log(`⏳ Bot ${currentBotState.name} already opened daily lootbox.`);
        }

        // 3. Fight Logic (variable pace per bot profile + day progression)
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
            // Find a suitable opponent for the bot
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
                        ? `⚠️ No opponents available for bot ${currentBotState.name}. Skipping remaining fights.`
                        : `⚠️ No same-level opponent for bot ${currentBotState.name} (LVL ${currentBotState.level}). Skipping fights.`
                );
                break;
            }

            // SIMULATE REAL COMBAT using the shared logic
            const combat = simulateCombat(currentBotState, opponent);
            const won = combat.winner === 'attacker';
            const opponentType = opponent.isBot ? 'BOT' : 'PLAYER';
            const combatOutcome = won ? 'WIN' : 'LOSS';

            console.log(`⚔️ ${currentBotState.name} vs ${opponent.name} [${opponentType}] -> ${combatOutcome}`);

            if (opponent.firestoreId) {
                const incomingEntry: IncomingFightHistory = {
                    date: Date.now(),
                    attackerName: currentBotState.name,
                    attackerId: currentBotState.firestoreId,
                    attackerIsBot: true,
                    won: !won,
                    source: 'bot'
                };
                const logged = await appendIncomingFightHistory(opponent.firestoreId, incomingEntry);
                if (logged) {
                    console.log(`📝 Logged incoming attack on ${opponent.name} [${opponentType}]`);
                }
            }

            // Calculate XP exactly like a player
            const xpGained = calculateFightXp(currentBotState.level, won);
            totalXpGained += xpGained;

            // Apply XP/Level up logic
            const result = gainXp(currentBotState, xpGained);
            const pointsGained = result.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;
            const updatedBase = {
                ...result.updatedCharacter,
                statPoints: result.updatedCharacter.statPoints ?? currentBotState.statPoints ?? 0
            };
            const withStats = pointsGained > 0
                ? autoAllocateStatPointsRandom(updatedBase, pointsGained)
                : updatedBase;

            // Update local state for next iteration
            // Record history
            const historyEntry = {
                date: Date.now(),
                won,
                opponentName: opponent.name
            };
            const existingHistory = currentBotState.fightHistory || [];
            const newHistory = [historyEntry, ...existingHistory].slice(0, 20);

            // Update local state for next iteration
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
        if (shouldPersist) {
            // Final database update
            const finalUpdates: Partial<Character> = {
                experience: currentBotState.experience,
                level: currentBotState.level,
                fightsLeft: currentBotState.fightsLeft,
                wins: currentBotState.wins,
                losses: currentBotState.losses,
                battleCount: currentBotState.battleCount,
                fightHistory: currentBotState.fightHistory,
                strength: currentBotState.strength,
                vitality: currentBotState.vitality,
                dexterity: currentBotState.dexterity,
                luck: currentBotState.luck,
                intelligence: currentBotState.intelligence,
                focus: currentBotState.focus,
                hp: currentBotState.hp,
                maxHp: currentBotState.maxHp,
                lastFightReset: currentBotState.lastFightReset,
                statPoints: currentBotState.statPoints,
                inventory: currentBotState.inventory,
                lastLootRoll: currentBotState.lastLootRoll
            };

            const sanitizedUpdates = Object.fromEntries(
                Object.entries(finalUpdates).filter(([, value]) => value !== undefined)
            );

            await db.collection('characters').doc(bot.firestoreId).update(sanitizedUpdates);

            const levelDiff = currentBotState.level - startLevel;
            if (actionsTaken > 0) {
                console.log(`👊 Bot ${bot.name}: ${actionsTaken}/${fightBudget} fights, +${totalXpGained} XP. ${levelDiff > 0 ? `🆙 LVL UP +${levelDiff}` : ''} Energy left: ${currentBotState.fightsLeft}`);
            } else if (didLootbox) {
                console.log(`📦 Bot ${bot.name} updated inventory. Energy left: ${currentBotState.fightsLeft}`);
            } else if (isProtected && fightsLeft > 0) {
                console.log(`🛡️ Bot ${bot.name} kept in protected pool (energy: ${fightsLeft}).`);
            } else {
                const restReason = fightBudget === 0 && fightsLeft > 0 ? 'scheduled rest' : '0 energy';
                console.log(`💤 Bot ${bot.name} is resting (${restReason}).`);
            }
        } else {
            if (fightsLeft > 0) {
                if (fightBudget === 0) {
                    console.log(`💤 Bot ${bot.name} skipped activity this run (energy: ${fightsLeft}).`);
                } else {
                    console.log(`💤 Bot ${bot.name} found no opponents (energy: ${fightsLeft}).`);
                }
            } else {
                console.log(`💤 Bot ${bot.name} is resting (0 energy).`);
            }
        }
    }
}

runBotLogic();
