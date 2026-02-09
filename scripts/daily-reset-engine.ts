import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GAME_RULES } from '../src/config/gameRules';
import {
    formatZonedDateLabel,
    getZonedMidnightUtc,
    getZonedParts,
    isWithinZonedMidnightWindow
} from '../src/utils/timezoneUtils';
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
const PARIS_TIMEZONE = 'Europe/Paris';

async function runDailyReset() {
    console.log('⏳ Starting Global Daily Reset...');

    const now = new Date();
    const parisNow = getZonedParts(now, PARIS_TIMEZONE);
    const parisLabel = formatZonedDateLabel(parisNow);
    const parisMidnightUtc = getZonedMidnightUtc(now, PARIS_TIMEZONE);

    console.log(`🕒 Current time (UTC): ${now.toISOString()}`);
    console.log(`🕒 Current time (Paris): ${parisLabel} ${String(parisNow.hour).padStart(2, '0')}:${String(parisNow.minute).padStart(2, '0')}:${String(parisNow.second).padStart(2, '0')}`);
    console.log(`📆 Paris day start (UTC): ${new Date(parisMidnightUtc).toISOString()} (day ${parisLabel})`);

    // Only run near Paris midnight to avoid accidental resets.
    if (!isWithinZonedMidnightWindow(now, PARIS_TIMEZONE, 10)) {
        console.log('⏭️ Not within Paris midnight window. Skipping daily reset.');
        return;
    }

    try {
        // Find all characters whose last reset was before today (UTC)
        const snapshot = await db.collection('characters')
            .where('lastFightReset', '<', parisMidnightUtc)
            .get();

        if (snapshot.empty) {
            console.log(`✅ All characters are already up to date for ${parisLabel}.`);
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
                    lastFightReset: parisMidnightUtc,
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
