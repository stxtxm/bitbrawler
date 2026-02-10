import { GAME_RULES } from '../src/config/gameRules';
import {
    formatZonedDateLabel,
    getZonedMidnightUtc,
    getZonedParts
} from '../src/utils/timezoneUtils';
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
    console.warn('⚠️ No service account found for daily reset.');
    process.exit(0);
}

const db = initFirebaseAdmin(serviceAccount);
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
