import { generateInitialStats, generateCharacterName } from '../src/utils/characterUtils';
import { calculateFightXp, gainXp } from '../src/utils/xpUtils';
import { simulateCombat } from '../src/utils/combatUtils';
import { GAME_RULES } from '../src/config/gameRules';
import { autoAllocateStatPointsRandom } from '../src/utils/statUtils';
import { ITEM_ASSETS } from '../src/data/itemAssets';
import { canRollLootbox, rollLootbox } from '../src/utils/lootboxUtils';
import { DAILY_RESET_TIMEZONE, shouldResetDaily } from '../src/utils/dailyReset';
import { getZonedMidnightUtc } from '../src/utils/timezoneUtils';
import { Character } from '../src/types/Character';
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

async function measureBotPopulation() {
    const total = await db.collection('characters').where('isBot', '==', true).count().get();
    const lvl1 = await db.collection('characters')
        .where('isBot', '==', true)
        .where('level', '==', 1)
        .count().get();

    return {
        total: total.data().count,
        lvl1: lvl1.data().count
    };
}

async function runBotLogic() {
    console.log('🤖 Starting Bot Engine...');

    try {
        const populations = await measureBotPopulation();
        console.log(`📊 Current bot population: ${populations.total} (Lvl 1: ${populations.lvl1})`);
        const skipBotIds = new Set<string>();
        let totalBots = populations.total;
        let lvl1Bots = populations.lvl1;

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

        // 1b. Ensure minimum level 1 bots
        if (lvl1Bots < GAME_RULES.BOTS.MIN_LVL1_BOTS) {
            console.log(`📉 Lvl 1 bot population low (${lvl1Bots}/${GAME_RULES.BOTS.MIN_LVL1_BOTS}). Spawning LVL 1 bots...`);
            const needed = GAME_RULES.BOTS.MIN_LVL1_BOTS - lvl1Bots;
            for (let i = 0; i < needed; i++) {
                const newBotId = await createNewBot();
                skipBotIds.add(newBotId);
                totalBots += 1;
                lvl1Bots += 1;
            }
        }

        // 2. Guaranteed hourly growth (100% chance as per GROWTH_CHANCE: 1.0)
        if (Math.random() <= GAME_RULES.BOTS.GROWTH_CHANCE) {
            console.log('📈 Hourly bot growth triggered.');
            await createNewBot();
        }

        // 2. Simulate complete daily cycle for bots
        await simulateBotDailyLife({ skipBotIds });

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

async function simulateBotDailyLife(options: BotSimulationOptions = {}) {
    const { skipBotIds } = options;
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

    const activeBots = skipBotIds && skipBotIds.size > 0
        ? bots.filter(bot => !skipBotIds.has(bot.firestoreId ?? ''))
        : bots;
    const skippedCount = bots.length - activeBots.length;
    if (skippedCount > 0) {
        console.log(`⏸️ Skipping ${skippedCount} newly spawned LVL 1 bots (no activity yet).`);
    }

    console.log(`⚡ Simulating activity for ${activeBots.length} bots.`);

    const opponentsByLevel = new Map<number, Character[]>();
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

    for (const bot of activeBots) {
        if (!bot.firestoreId) continue;

        let currentBotState = { ...bot, statPoints: bot.statPoints ?? 0 };
        let fightsLeft = currentBotState.fightsLeft;
        const now = Date.now();
        let totalXpGained = 0;
        let startLevel = currentBotState.level;
        let didLootbox = false;
        let didReset = false;

        // 1. Daily Reset Logic
        if (shouldResetDaily(currentBotState.lastFightReset, now)) {
            const parisMidnightUtc = getZonedMidnightUtc(new Date(now), DAILY_RESET_TIMEZONE);
            fightsLeft = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
            currentBotState.lastFightReset = parisMidnightUtc;
            currentBotState.battleCount = 0;
            didReset = true;
            console.log(`🔄 Daily reset for bot ${currentBotState.name}`);
        }

        // 2. Daily Lootbox
        if (canRollLootbox(currentBotState.lastLootRoll, now)) {
            const inventory = currentBotState.inventory || [];
            if (inventory.length < INVENTORY_CAPACITY) {
                const item = rollLootbox(ITEM_ASSETS, { excludeIds: inventory, level: currentBotState.level });
                if (item) {
                    currentBotState = {
                        ...currentBotState,
                        inventory: [...inventory, item.id],
                        lastLootRoll: now
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

        // 3. Fight Logic (Use all available energy when possible)
        let actionsTaken = 0;

        while (fightsLeft > 0) {
            // Find a suitable opponent for the bot
            await loadOpponentsForLevel(currentBotState.level);
            const pool = opponentsByLevel.get(currentBotState.level) ?? [];
            const potentialOpponents = pool.filter(c =>
                c.firestoreId !== currentBotState.firestoreId
            );

            let opponent: Character;
            if (potentialOpponents.length > 0) {
                opponent = potentialOpponents[Math.floor(Math.random() * potentialOpponents.length)];
            } else {
                console.log(`⚠️ No same-level opponent for bot ${currentBotState.name} (LVL ${currentBotState.level}). Skipping fights.`);
                break;
            }

            // SIMULATE REAL COMBAT using the shared logic
            const combat = simulateCombat(currentBotState, opponent);
            const won = combat.winner === 'attacker';

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
                xpGained,
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
                console.log(`👊 Bot ${bot.name}: ${actionsTaken} fights, +${totalXpGained} XP. ${levelDiff > 0 ? `🆙 LVL UP +${levelDiff}` : ''} Energy left: ${currentBotState.fightsLeft}`);
            } else if (didLootbox) {
                console.log(`📦 Bot ${bot.name} updated inventory. Energy left: ${currentBotState.fightsLeft}`);
            } else {
                console.log(`💤 Bot ${bot.name} is resting (0 energy).`);
            }
        } else {
            if (fightsLeft > 0) {
                console.log(`💤 Bot ${bot.name} found no opponents (energy: ${fightsLeft}).`);
            } else {
                console.log(`💤 Bot ${bot.name} is resting (0 energy).`);
            }
        }
    }
}

runBotLogic();
