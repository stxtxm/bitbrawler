import { generateInitialStats, generateCharacterName } from '../src/utils/characterUtils';
import { calculateFightXp, gainXp } from '../src/utils/xpUtils';
import { simulateCombat } from '../src/utils/combatUtils';
import { GAME_RULES } from '../src/config/gameRules';
import { autoAllocateStatPoints } from '../src/utils/statUtils';
import { ITEM_ASSETS } from '../src/data/itemAssets';
import { canRollLootbox, rollLootbox } from '../src/utils/lootboxUtils';
import { Character } from '../src/types/Character';
import { initFirebaseAdmin, loadServiceAccount } from './firebaseAdmin';

// Initialize Firebase Admin
let serviceAccount: ReturnType<typeof loadServiceAccount>;

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
const SIMULATION_BATCH = 30;
const MAX_ACTIVE_BOTS = 10;

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

        // 1. Force population growth if below minimum
        if (populations.total < GAME_RULES.BOTS.MIN_POPULATION) {
            console.log('📉 Total bot population low. Spawning reinforcements...');
            const needed = GAME_RULES.BOTS.MIN_POPULATION - populations.total;
            for (let i = 0; i < needed; i++) {
                await createNewBot();
            }
        }

        // 1b. Ensure minimum level 1 bots
        if (populations.lvl1 < GAME_RULES.BOTS.MIN_LVL1_BOTS) {
            console.log(`📉 Lvl 1 bot population low (${populations.lvl1}/${GAME_RULES.BOTS.MIN_LVL1_BOTS}). Spawning LVL 1 bots...`);
            const needed = GAME_RULES.BOTS.MIN_LVL1_BOTS - populations.lvl1;
            for (let i = 0; i < needed; i++) {
                await createNewBot();
            }
        }

        // 2. Guaranteed hourly growth (100% chance as per GROWTH_CHANCE: 1.0)
        if (Math.random() <= GAME_RULES.BOTS.GROWTH_CHANCE) {
            console.log('📈 Hourly bot growth triggered.');
            await createNewBot();
        }

        // 2. Simulate complete daily cycle for bots
        await simulateBotDailyLife();

        console.log('✅ Bot Engine finished successfully');
    } catch (error) {
        console.error('❌ Bot Engine failed:', error);
        process.exit(1);
    }
}

async function createNewBot() {
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
        statPoints: 0,
        inventory: [],
        equipped: {},
        lastLootRoll: 0
    };

    await db.collection('characters').add(botData);
    console.log(`🆕 Created new bot: ${fullName} (Level ${stats.level})`);
}

async function simulateBotDailyLife() {
    // Fetch only bots
    const snapshot = await db.collection('characters')
        .where('isBot', '==', true)
        .limit(SIMULATION_BATCH) // Process a smaller batch to limit writes
        .get();

    if (snapshot.empty) {
        console.log('No bots found to simulate.');
        return;
    }

    const bots = snapshot.docs.map(doc => {
        const data = doc.data() as Character;
        return {
            ...data,
            firestoreId: doc.id,
            statPoints: data.statPoints ?? 0,
            focus: data.focus ?? GAME_RULES.STATS.BASE_VALUE,
            inventory: data.inventory ?? [],
            equipped: data.equipped ?? {},
            lastLootRoll: data.lastLootRoll ?? 0
        };
    });

    // Decide activity: Increase activity to ensure at least 2 bots move if available
    const shuffle = (array: any[]) => [...array].sort(() => Math.random() - 0.5);
    const shuffledBots = shuffle(bots);

    // Reduce activity to protect free-tier quota
    const activityRate = Math.min(Math.max(GAME_RULES.BOTS.ACTIVITY_RATE ?? 0.25, 0.1), 0.4);
    const desiredActive = Math.max(1, Math.ceil(bots.length * activityRate));
    const activeCount = Math.min(bots.length, Math.min(MAX_ACTIVE_BOTS, desiredActive));
    const activeBots = shuffledBots.slice(0, activeCount);

    console.log(`⚡ Simulating activity for ${activeBots.length} bots (rate ${Math.round(activityRate * 100)}%).`);

    // Fetch potential opponents for bots (a mix of bots and real players)
    const opponentSnapshot = await db.collection('characters')
        .limit(80)
        .get();

    const allCharacters = opponentSnapshot.docs.map(doc => ({
        ...doc.data() as Character,
        firestoreId: doc.id
    }));

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
        if (now - currentBotState.lastFightReset > 24 * 60 * 60 * 1000) {
            fightsLeft = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
            currentBotState.lastFightReset = now;
            didReset = true;
            console.log(`🔄 Daily reset for bot ${currentBotState.name}`);
        }

        // 2. Daily Lootbox
        if (canRollLootbox(currentBotState.lastLootRoll, now)) {
            const inventory = currentBotState.inventory || [];
            if (inventory.length < INVENTORY_CAPACITY) {
                const item = rollLootbox(ITEM_ASSETS);
                if (item) {
                    currentBotState = {
                        ...currentBotState,
                        inventory: [...inventory, item.id],
                        lastLootRoll: now
                    };
                    didLootbox = true;
                    console.log(`🎁 Bot ${currentBotState.name} opened lootbox: ${item.name} (${item.rarity})`);
                }
            } else {
                console.log(`📦 Bot ${currentBotState.name} inventory full. Skipping lootbox.`);
            }
        } else {
            console.log(`⏳ Bot ${currentBotState.name} already opened daily lootbox.`);
        }

        // 3. Fight Logic (Perform multiple actions per hour)
        const desiredActions = Math.floor(Math.random() * 2) + 1; // 1 to 2 actions
        let actionsTaken = 0;

        while (actionsTaken < desiredActions && fightsLeft > 0) {
            // Find a suitable opponent for the bot
            const potentialOpponents = allCharacters.filter(c =>
                c.firestoreId !== currentBotState.firestoreId &&
                c.level === currentBotState.level
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
                ? autoAllocateStatPoints(updatedBase, pointsGained)
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
            console.log(`💤 Bot ${bot.name} is resting (0 energy).`);
        }
    }
}

runBotLogic();
