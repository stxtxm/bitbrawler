import { GAME_RULES } from '../src/config/gameRules';
import { DAILY_RESET_TIMEZONE } from '../src/utils/dailyReset';
import {
    formatZonedDateLabel,
    getZonedMidnightUtc,
    getZonedParts
} from '../src/utils/timezoneUtils';
import { Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';
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
const RESET_SCOPE = (process.env.RESET_SCOPE || 'all').toLowerCase();

async function runDailyReset() {
    console.log('⏳ Starting Global Daily Reset...');

    const now = new Date();
    const parisNow = getZonedParts(now, DAILY_RESET_TIMEZONE);
    const parisLabel = formatZonedDateLabel(parisNow);
    const parisMidnightUtc = getZonedMidnightUtc(now, DAILY_RESET_TIMEZONE);

    console.log(`🕒 Current time (UTC): ${now.toISOString()}`);
    console.log(`🕒 Current time (Paris): ${parisLabel} ${String(parisNow.hour).padStart(2, '0')}:${String(parisNow.minute).padStart(2, '0')}:${String(parisNow.second).padStart(2, '0')}`);
    console.log(`📆 Paris day start (UTC): ${new Date(parisMidnightUtc).toISOString()} (day ${parisLabel})`);

    try {
        const charactersRef = db.collection('characters');
        let docs: QueryDocumentSnapshot[] = [];
        let scopeLabel = '';

        if (RESET_SCOPE === 'all') {
            const snapshot = await charactersRef.get();
            docs = snapshot.docs;
            scopeLabel = 'full reset';
        } else {
            const timestampCutoff = Timestamp.fromMillis(parisMidnightUtc);

            // Find all characters whose last reset was before today (Paris day start),
            // including missing/null fields and legacy Timestamp values.
            const [numericSnapshot, nullSnapshot, timestampSnapshot] = await Promise.all([
                charactersRef.where('lastFightReset', '<', parisMidnightUtc).get(),
                charactersRef.where('lastFightReset', '==', null).get(),
                charactersRef.where('lastFightReset', '<', timestampCutoff).get()
            ]);

            const deduped = new Map<string, QueryDocumentSnapshot>();
            [numericSnapshot, nullSnapshot, timestampSnapshot].forEach((snap) => {
                snap.docs.forEach((doc) => deduped.set(doc.id, doc));
            });

            docs = Array.from(deduped.values());
            scopeLabel = `numeric: ${numericSnapshot.size}, missing/null: ${nullSnapshot.size}, timestamp: ${timestampSnapshot.size}`;
        }

        if (docs.length === 0) {
            if (RESET_SCOPE === 'all') {
                console.log('ℹ️ No characters found to reset.');
            } else {
                console.log(`✅ All characters are already up to date for ${parisLabel}.`);
            }
            return;
        }

        console.log(
            `🔄 Resetting ${docs.length} characters (${scopeLabel})...`
        );
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
                    foughtToday: [],
                    battleCount: 0
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
