import { GAME_RULES } from '../src/config/gameRules';
import { DAILY_RESET_TIMEZONE } from '../src/utils/dailyReset';
import {
    formatZonedDateLabel,
    getZonedParts,
    getZonedMidnightUtc,
    isWithinZonedMidnightWindow
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
const RESET_SCOPE = (process.env.RESET_SCOPE || 'incremental').toLowerCase();
const RESET_WINDOW_MINUTES = 45;
const RESET_WINDOW_LABEL = `00:00-00:${String(RESET_WINDOW_MINUTES).padStart(2, '0')}`;
const RESET_STATE_COLLECTION = 'maintenance';
const RESET_STATE_DOC_ID = 'dailyReset';

async function runDailyReset() {
    console.log('⏳ Starting Global Daily Reset...');

    const now = new Date();
    const forceRun = process.env.RESET_FORCE === '1' || process.env.RESET_FORCE === 'true';

    const parisNow = getZonedParts(now, DAILY_RESET_TIMEZONE);
    if (!forceRun && !isWithinZonedMidnightWindow(now, DAILY_RESET_TIMEZONE, RESET_WINDOW_MINUTES)) {
        console.log(`⏭️ Skipping reset: outside Paris midnight window (${RESET_WINDOW_LABEL}).`);
        return;
    }

    // The workflow is triggered twice (22:00 and 23:00 UTC) to cover DST.
    // Only one of those corresponds to Paris midnight; the midnight window guard above
    // prevents running one hour early/late and avoids draining fresh fights in the bot catch-up window.
    const parisResetMidnightUtc = getZonedMidnightUtc(now, DAILY_RESET_TIMEZONE);
    const parisResetDay = getZonedParts(new Date(parisResetMidnightUtc), DAILY_RESET_TIMEZONE);
    const parisNowLabel = formatZonedDateLabel(parisNow);
    const parisResetLabel = formatZonedDateLabel(parisResetDay);
    const resetStateRef = db.collection(RESET_STATE_COLLECTION).doc(RESET_STATE_DOC_ID);

    console.log(`🕒 Current time (UTC): ${now.toISOString()}`);
    console.log(`🕒 Current time (Paris): ${parisNowLabel} ${String(parisNow.hour).padStart(2, '0')}:${String(parisNow.minute).padStart(2, '0')}:${String(parisNow.second).padStart(2, '0')}`);
    console.log(`📆 Target reset day: ${parisResetLabel} (Paris midnight UTC: ${new Date(parisResetMidnightUtc).toISOString()})`);

    try {
        if (!forceRun) {
            const resetState = await resetStateRef.get();
            const lastCompletedKey = resetState.exists ? resetState.get('lastCompletedKey') : null;
            if (lastCompletedKey === parisResetLabel) {
                console.log(`⏭️ Skipping reset: already completed for Paris day ${parisResetLabel}.`);
                return;
            }
        }

        const charactersRef = db.collection('characters');
        let docs: QueryDocumentSnapshot[] = [];
        let scopeLabel = '';

        if (RESET_SCOPE === 'all') {
            const snapshot = await charactersRef.get();
            docs = snapshot.docs;
            scopeLabel = 'full reset';
        } else {
            const timestampCutoff = Timestamp.fromMillis(parisResetMidnightUtc);

            // Find all characters whose last reset was before today (Paris day start),
            // including missing/null fields and legacy Timestamp values.
            const [numericSnapshot, nullSnapshot, timestampSnapshot] = await Promise.all([
                charactersRef.where('lastFightReset', '<', parisResetMidnightUtc).get(),
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
                console.log(`✅ All characters are already up to date for ${parisResetLabel}.`);
            }
            await resetStateRef.set({
                lastCompletedKey: parisResetLabel,
                lastCompletedAt: now.getTime(),
                lastCompletedAtUtc: now.toISOString(),
                targetParisMidnightUtc: parisResetMidnightUtc,
                window: RESET_WINDOW_LABEL,
                scope: RESET_SCOPE,
                updatedCharacters: 0
            }, { merge: true });
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
                    lastFightReset: parisResetMidnightUtc,
                    foughtToday: [],
                    battleCount: 0
                });
            });

            batchIndex += 1;
            try {
                await batch.commit();
                totalUpdated += slice.length;
                console.log(`✅ Batch ${batchIndex} committed (${slice.length} characters).`);
            } catch (batchError) {
                console.error(`❌ Batch ${batchIndex} failed (${slice.length} characters):`, batchError);
            }
        }

        // Spot check: verify a sample of characters received the reset
        if (totalUpdated > 0) {
            try {
                const sampleSize = Math.min(5, totalUpdated);
                const sampleIds = docs
                    .slice(0, sampleSize * 10)
                    .filter(() => Math.random() < 0.3)
                    .slice(0, sampleSize)
                    .map(d => d.id);

                if (sampleIds.length > 0) {
                    const sampleSnap = await Promise.all(
                        sampleIds.map(id => db.collection('characters').doc(id).get())
                    );
                    const verified = sampleSnap.filter(s => s.exists && s.get('fightsLeft') === GAME_RULES.COMBAT.MAX_DAILY_FIGHTS).length;
                    if (verified === sampleIds.length) {
                        console.log(`✅ Spot check: ${verified}/${sampleIds.length} characters verified (fightsLeft = ${GAME_RULES.COMBAT.MAX_DAILY_FIGHTS})`);
                    } else {
                        console.warn(`⚠️ Spot check: ${verified}/${sampleIds.length} characters have correct fightsLeft. Check logs.`);
                    }
                }
            } catch (spotError) {
                console.warn('⚠️ Spot check query failed:', spotError);
            }
        }

        const finalStatus = totalUpdated > 0 ? 'completed' : 'no_updates';
        console.log(`✨ ${finalStatus === 'completed' ? `Successfully reset energy for ${totalUpdated} characters.` : 'No characters needed reset.'}`);
        await resetStateRef.set({
            lastCompletedKey: parisResetLabel,
            lastCompletedAt: now.getTime(),
            lastCompletedAtUtc: now.toISOString(),
            targetParisMidnightUtc: parisResetMidnightUtc,
            window: RESET_WINDOW_LABEL,
            scope: RESET_SCOPE,
            updatedCharacters: totalUpdated,
            status: finalStatus,
            batchErrors: batchIndex > 0 && totalUpdated < docs.length ? 'partial' : 'none'
        }, { merge: true });

    } catch (error) {
        console.error('❌ Daily reset failed:', error);
        process.exit(1);
    }
}

runDailyReset().then(() => {
    console.log('👋 Daily Reset finished.');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Daily reset failed:', error);
    process.exit(1);
});
