/**
 * push-notifier.ts
 *
 * Envoie une notification Web Push à chaque joueur dont la lootbox quotidienne
 * est disponible (reset Europe/Paris). Déclenché par le workflow GitHub Actions
 * `daily-reset.yml` juste après le reset quotidien.
 *
 * Anti-spam: une seule notification par joueur et par jour civil (Europe/Paris).
 * La date du dernier envoi est persistée dans le JSON `push_keys.lastPushDay`
 * (aucune migration DB requise).
 *
 * Env:
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (via supabaseAdmin)
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */
import webpush from 'web-push';
import { supabase } from './supabaseAdmin';
import {
    getTodayKey,
    isEligibleForLootbox,
    mergeLastPushDay,
    parsePushKeysJson,
    shouldSendToday,
    buildPushPayload,
} from '../src/utils/pushNotifierUtils';

const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:bitbrawler@example.com';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('❌ Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY environment variables');
    process.exit(1);
}

webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface PushCandidate {
    id: string;
    name: string | null;
    push_endpoint: string | null;
    push_keys: string | null;
    push_subscribed: boolean | null;
    last_loot_roll: number | null;
}

async function fetchCandidates(): Promise<PushCandidate[]> {
    const { data, error } = await supabase
        .from('characters')
        .select('id, name, push_endpoint, push_keys, push_subscribed, last_loot_roll')
        .eq('is_bot', false)
        .eq('push_subscribed', true)
        .not('push_endpoint', 'is', null)
        .limit(500);

    if (error) {
        throw new Error(`Failed to fetch push candidates: ${error.message}`);
    }
    return (data ?? []) as PushCandidate[];
}

async function unsubscribeCharacter(id: string): Promise<void> {
    await supabase
        .from('characters')
        .update({ push_subscribed: false, push_endpoint: null })
        .eq('id', id);
}

async function runPushNotifier() {
    console.log('📣 Starting push notifier...');
    const now = Date.now();
    const todayKey = getTodayKey(now);
    console.log(`📆 Today (Europe/Paris): ${todayKey}`);

    let candidates: PushCandidate[];
    try {
        candidates = await fetchCandidates();
    } catch (err) {
        console.error('❌ Failed to fetch candidates:', err);
        process.exit(1);
    }

    console.log(`📊 Fetched ${candidates.length} subscribed players.`);
    if (candidates.length === 0) {
        console.log('✅ No candidates. Done.');
        return;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let cleaned = 0;

    const payload = JSON.stringify(buildPushPayload(todayKey));

    for (const candidate of candidates) {
        const keys = parsePushKeysJson(candidate.push_keys);

        // Invalid subscription → clean up
        if (!keys) {
            await unsubscribeCharacter(candidate.id);
            cleaned += 1;
            console.log(`🧹 Cleaned invalid push_keys for ${candidate.name ?? candidate.id}`);
            continue;
        }

        // Lootbox not available for this player yet (already rolled today)
        if (!isEligibleForLootbox(candidate.last_loot_roll, now)) {
            skipped += 1;
            continue;
        }

        // Anti-spam: already notified today
        if (!shouldSendToday(keys.lastPushDay, todayKey)) {
            skipped += 1;
            continue;
        }

        try {
            await webpush.sendNotification(
                { endpoint: candidate.push_endpoint!, keys: { p256dh: keys.p256dh, auth: keys.auth } },
                payload
            );
            await supabase
                .from('characters')
                .update({ push_keys: mergeLastPushDay(keys, todayKey) })
                .eq('id', candidate.id);
            sent += 1;
            console.log(`✅ Push sent to ${candidate.name ?? candidate.id}`);
        } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
                // Subscription no longer valid → unsubscribe
                await unsubscribeCharacter(candidate.id);
                cleaned += 1;
                console.log(`🧹 Unsubscribed expired endpoint for ${candidate.name ?? candidate.id} (${err.statusCode})`);
            } else {
                failed += 1;
                console.warn(`⚠️ Push failed for ${candidate.name ?? candidate.id}: ${err?.message ?? err}`);
            }
        }
    }

    console.log(`✨ Done: ${sent} sent, ${skipped} skipped, ${failed} failed, ${cleaned} cleaned.`);
}

runPushNotifier()
    .then(() => {
        console.log('👋 Push notifier finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Push notifier failed:', error);
        process.exit(1);
    });
