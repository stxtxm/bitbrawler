import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateInitialStats, generateCharacterName } from '../src/utils/characterUtils';
import { calculateFightXp, gainXp } from '../src/utils/xpUtils';
import { GAME_RULES } from '../src/config/gameRules';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Character } from '../src/types/Character';

// Load environment variables (for local dev)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let serviceAccount: any;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf-8');
            serviceAccount = JSON.parse(decoded);
        } catch {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
    } else {
        // Local development fallback
        const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        } else {
            console.warn('⚠️ No service account found. Please set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json');
            process.exit(0);
        }
    }
} catch (error) {
    console.error('Failed to parse service account:', error);
    process.exit(1);
}

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

async function measureBotPopulation() {
    const snapshot = await db.collection('characters').where('isBot', '==', true).count().get();
    return snapshot.data().count;
}

async function runBotLogic() {
    console.log('🤖 Starting Bot Engine...');

    try {
        const botCount = await measureBotPopulation();
        console.log(`📊 Current bot population: ${botCount}`);

        // 1. Force population growth if below minimum
        if (botCount < GAME_RULES.BOTS.MIN_POPULATION) {
            console.log('📉 Bot population low. Spawning reinforcements...');
            const needed = GAME_RULES.BOTS.MIN_POPULATION - botCount;
            for (let i = 0; i < needed; i++) {
                await createNewBot();
            }
        } else {
            // 2. Guaranteed hourly growth (100% chance as per GROWTH_CHANCE: 1.0)
            if (Math.random() <= GAME_RULES.BOTS.GROWTH_CHANCE) {
                console.log('📈 Hourly bot growth triggered.');
                await createNewBot();
            }
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
    const fullName = generateCharacterName();

    const stats = generateInitialStats(fullName, Math.random() > 0.5 ? 'male' : 'female');

    const botData: Character = {
        ...stats,
        isBot: true,
        experience: 0,
        wins: 0,
        losses: 0,
        fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
        lastFightReset: Date.now()
    };

    await db.collection('characters').add(botData);
    console.log(`🆕 Created new bot: ${fullName} (Level ${stats.level})`);
}

async function simulateBotDailyLife() {
    // Fetch only bots
    const snapshot = await db.collection('characters')
        .where('isBot', '==', true)
        .limit(50) // Process up to 50 bots at a time
        .get();

    if (snapshot.empty) {
        console.log('No bots found to simulate.');
        return;
    }

    const bots = snapshot.docs.map(doc => {
        const data = doc.data() as Character;
        return {
            ...data,
            firestoreId: doc.id
        };
    });

    // Decide activity based on configured rate (or 50% for high activity)
    // Use a bit of randomness to vary load
    const activeBots = bots.filter(() => Math.random() > 0.5);

    console.log(`⚡ Simulating activity for ${activeBots.length} bots...`);

    for (const bot of activeBots) {
        if (!bot.firestoreId) continue;

        let updates: Partial<Character> = {};
        let fightsLeft = bot.fightsLeft;
        const now = Date.now();

        // 1. Daily Reset Logic
        if (now - bot.lastFightReset > 24 * 60 * 60 * 1000) {
            fightsLeft = GAME_RULES.COMBAT.MAX_DAILY_FIGHTS;
            updates.lastFightReset = now;
            console.log(`🔄 Daily reset for bot ${bot.name}`);
        }

        // 2. Fight Logic (only if energy remains)
        if (fightsLeft > 0) {
            // Simulate real combat outcome
            const won = Math.random() > 0.5; // Fair 50/50 win rate against "virtual" opponents

            // Calculate XP exactly like a player
            const xpGained = calculateFightXp(bot.level, won);

            // Apply XP/Level up logic
            const result = gainXp(bot, xpGained);

            updates = {
                ...updates,
                experience: result.updatedCharacter.experience,
                level: result.updatedCharacter.level,
                fightsLeft: fightsLeft - 1,
                wins: won ? (bot.wins || 0) + 1 : (bot.wins || 0),
                losses: won ? (bot.losses || 0) : (bot.losses || 0) + 1,
                // Update stats if leveled up
                // Simple auto-distribution logic: +1 to main stats
                strength: result.leveledUp ? bot.strength + 1 : bot.strength,
                vitality: result.leveledUp ? bot.vitality + 1 : bot.vitality,
                dexterity: result.leveledUp ? bot.dexterity + 1 : bot.dexterity,
                hp: result.leveledUp ? bot.hp + 5 : bot.hp,
                maxHp: result.leveledUp ? bot.maxHp + 5 : bot.maxHp
            };

            if (result.leveledUp) {
                console.log(`🆙 Bot ${bot.name} leveled up to ${result.newLevel}!`);
            } else {
                console.log(`👊 Bot ${bot.name} ${won ? 'won' : 'lost'} and gained ${xpGained} XP. Energy left: ${updates.fightsLeft}`);
            }

            // Save updates
            await db.collection('characters').doc(bot.firestoreId).update(updates);
        } else {
            console.log(`💤 Bot ${bot.name} is resting (0 energy).`);
        }
    }
}

runBotLogic();
