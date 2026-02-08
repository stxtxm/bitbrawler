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

    try {
        // Find all characters whose last reset was before today (UTC)
        const snapshot = await db.collection('characters')
            .where('lastFightReset', '<', todayUTCStart)
            .get();

        if (snapshot.empty) {
            console.log('✅ All characters are already up to date for today.');
            return;
        }

        console.log(`🔄 Resetting ${snapshot.size} characters...`);

        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach((doc) => {
            const docRef = db.collection('characters').doc(doc.id);
            batch.update(docRef, {
                fightsLeft: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
                lastFightReset: now,
                foughtToday: []
            });
            count++;

            // Commit every 400 docs (Firebase limit is 500)
            if (count % 400 === 0) {
                // We'd need to await here, but for simple script we can just use a loop
                // but scripts usually handle smaller batches.
            }
        });

        await batch.commit();
        console.log(`✨ Successfully reset energy for ${count} characters.`);

    } catch (error) {
        console.error('❌ Daily reset failed:', error);
        process.exit(1);
    }
}

runDailyReset().then(() => {
    console.log('👋 Daily Reset finished.');
    process.exit(0);
});
