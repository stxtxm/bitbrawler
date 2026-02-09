import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GAME_RULES } from '../src/config/gameRules';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
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
        const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        } else {
            console.warn('⚠️ No service account found for daily reset.');
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

async function runDailyReset() {
    console.log('⏳ Starting Global Daily Reset...');

    // Calculate the start of today in UTC
    const now = new Date();
    const todayUTCStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
    const todayLabel = new Date(todayUTCStart).toISOString().split('T')[0];
    console.log(`🕒 Current time (UTC): ${now.toISOString()}`);
    console.log(`📆 UTC day start: ${new Date(todayUTCStart).toISOString()} (day ${todayLabel})`);

    try {
        // Find all characters whose last reset was before today (UTC)
        const snapshot = await db.collection('characters')
            .where('lastFightReset', '<', todayUTCStart)
            .get();

        if (snapshot.empty) {
            console.log(`✅ All characters are already up to date for ${todayLabel}.`);
            return;
        }

        console.log(`🔄 Resetting ${snapshot.size} characters...`);

        const docs = snapshot.docs;
        const batchSize = 400;
        let totalUpdated = 0;
        let batchIndex = 0;

        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = db.batch();
            const slice = docs.slice(i, i + batchSize);
            slice.forEach((doc) => {
                const docRef = db.collection('characters').doc(doc.id);
                batch.update(docRef, {
                    fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
                    lastFightReset: todayUTCStart,
                    foughtToday: []
                });
            });

            batchIndex += 1;
            await batch.commit();
            totalUpdated += slice.length;
            console.log(`✅ Batch ${batchIndex} committed (${slice.length} characters).`);
        }

        console.log(`✨ Successfully reset energy for ${totalUpdated} characters.`);

    } catch (error) {
        console.error('❌ Daily reset failed:', error);
        process.exit(1);
    }
}

runDailyReset().then(() => {
    console.log('👋 Daily Reset finished.');
    process.exit(0);
});
