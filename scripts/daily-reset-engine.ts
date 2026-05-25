import { GAME_RULES } from '../src/config/gameRules';
import { DAILY_RESET_TIMEZONE } from '../src/utils/dailyReset';
import {
    formatZonedDateLabel,
    getZonedParts,
    getZonedMidnightUtc,
} from '../src/utils/timezoneUtils';
import { supabase } from './supabaseAdmin';

const RESET_SCOPE = (process.env.RESET_SCOPE || 'all').toLowerCase();

async function runDailyReset() {
    console.log('⏳ Starting Global Daily Reset...');

    const now = new Date();

    const parisNow = getZonedParts(now, DAILY_RESET_TIMEZONE);
    const parisResetMidnightUtc = getZonedMidnightUtc(now, DAILY_RESET_TIMEZONE);
    const parisResetDay = getZonedParts(new Date(parisResetMidnightUtc), DAILY_RESET_TIMEZONE);
    const parisNowLabel = formatZonedDateLabel(parisNow);
    const parisResetLabel = formatZonedDateLabel(parisResetDay);

    console.log(`🕒 Current time (UTC): ${now.toISOString()}`);
    console.log(`🕒 Current time (Paris): ${parisNowLabel} ${String(parisNow.hour).padStart(2, '0')}:${String(parisNow.minute).padStart(2, '0')}:${String(parisNow.second).padStart(2, '0')}`);
    console.log(`📆 Target reset day: ${parisResetLabel} (Paris midnight UTC: ${new Date(parisResetMidnightUtc).toISOString()})`);
    console.log(`📋 Reset scope: ${RESET_SCOPE}`);

    // Always check maintenance table to ensure the reset runs only once per Paris day.
    // Bypass this guard when triggered manually (workflow_dispatch) so the user can
    // re-run the reset at any time if needed.
    const eventName = (process.env.GITHUB_EVENT_NAME || '').toLowerCase();
    const isManual = eventName === 'workflow_dispatch';

    if (!isManual) {
        try {
            const { data: resetState } = await supabase
                .from('maintenance')
                .select('last_completed_key')
                .eq('id', 'dailyReset')
                .single();

            if (resetState?.last_completed_key === parisResetLabel) {
                console.log(`⏭️ Skipping reset: already completed for Paris day ${parisResetLabel}.`);
                return;
            }
        } catch {
            console.log('ℹ️ Maintenance state check skipped (table not available).');
        }
    } else {
        console.log('🔓 Manual dispatch: bypassing once-per-day guard.');
    }

    try {
        let docs: { id: string }[] = [];
        let scopeLabel = '';

        if (RESET_SCOPE === 'all') {
            const { data: all, error } = await supabase
                .from('characters')
                .select('id');

            if (error) throw error;
            docs = all ?? [];
            scopeLabel = 'full reset';
            console.log(`📊 Fetched ${docs.length} total characters for full reset.`);
        } else {
            const { data: numericDocs, error: numericError } = await supabase
                .from('characters')
                .select('id')
                .lt('last_fight_reset', parisResetMidnightUtc);

            if (numericError) throw numericError;

            const { data: nullDocs, error: nullError } = await supabase
                .from('characters')
                .select('id')
                .is('last_fight_reset', null);

            if (nullError) throw nullError;

            const deduped = new Map<string, { id: string }>();
            (numericDocs ?? []).forEach(d => deduped.set(d.id, d));
            (nullDocs ?? []).forEach(d => deduped.set(d.id, d));

            docs = Array.from(deduped.values());
            scopeLabel = `numeric: ${numericDocs?.length ?? 0}, missing/null: ${nullDocs?.length ?? 0}`;
            console.log(`📊 Incremental query: ${numericDocs?.length ?? 0} with old reset, ${nullDocs?.length ?? 0} with null reset, ${docs.length} unique.`);
        }

        if (docs.length === 0) {
            if (RESET_SCOPE === 'all') {
                console.log('ℹ️ No characters found to reset.');
            } else {
                console.log(`✅ All characters are already up to date for ${parisResetLabel}.`);
            }
            await upsertMaintenanceState(parisResetLabel, now.getTime(), parisResetMidnightUtc, 0);
            return;
        }

        console.log(
            `🔄 Resetting ${docs.length} characters (${scopeLabel})...`
        );

        const batchSize = 20;
        let totalUpdated = 0;
        let batchIndex = 0;

        for (let i = 0; i < docs.length; i += batchSize) {
            const slice = docs.slice(i, i + batchSize);
            batchIndex += 1;
            try {
                const results = await Promise.all(
                    slice.map(doc =>
                        supabase
                            .from('characters')
                            .update({
                                fights_left: GAME_RULES.COMBAT.MAX_DAILY_FIGHTS,
                                last_fight_reset: parisResetMidnightUtc,
                                fought_today: [],
                                last_loot_roll: 0,
                            })
                            .eq('id', doc.id)
                    )
                );
                const errors = results.filter(r => r.error);
                const succeeded = slice.length - errors.length;
                totalUpdated += succeeded;
                if (errors.length > 0) {
                    console.warn(`⚠️ Batch ${batchIndex}: ${errors.length}/${slice.length} updates failed. First error:`, errors[0].error);
                }
                console.log(`✅ Batch ${batchIndex} committed (${succeeded}/${slice.length} characters).`);
            } catch (batchError) {
                console.error(`❌ Batch ${batchIndex} failed (${slice.length} characters):`, batchError);
            }
        }

        if (totalUpdated > 0) {
            try {
                const sampleSize = Math.min(5, totalUpdated);
                const sampleIds = docs
                    .slice(0, sampleSize * 10)
                    .filter(() => Math.random() < 0.3)
                    .slice(0, sampleSize)
                    .map(d => d.id);

                if (sampleIds.length > 0) {
                    const sampleResults = await Promise.all(
                        sampleIds.map(id =>
                            supabase.from('characters').select('fights_left').eq('id', id).single()
                        )
                    );
                    const verified = sampleResults.filter(
                        r => r.data && r.data.fights_left === GAME_RULES.COMBAT.MAX_DAILY_FIGHTS
                    ).length;
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
        await upsertMaintenanceState(parisResetLabel, now.getTime(), parisResetMidnightUtc, totalUpdated, finalStatus);
    } catch (error) {
        console.error('❌ Daily reset failed:', error);
        process.exit(1);
    }
}

async function upsertMaintenanceState(
    lastCompletedKey: string,
    lastCompletedAt: number,
    targetParisMidnightUtc: number,
    updatedCharacters: number,
    status: string = 'completed'
) {
    const { error } = await supabase
        .from('maintenance')
        .upsert({
            id: 'dailyReset',
            last_completed_key: lastCompletedKey,
            last_completed_at: lastCompletedAt,
            last_completed_at_utc: new Date(lastCompletedAt).toISOString(),
            target_paris_midnight_utc: targetParisMidnightUtc,
            reset_window: 'manual_or_scheduled',
            scope: RESET_SCOPE,
            updated_characters: updatedCharacters,
            status,
        }, { onConflict: 'id' });

    if (error) {
        console.log('ℹ️ Maintenance state tracking skipped (table not available yet).');
    }
}

runDailyReset().then(() => {
    console.log('👋 Daily Reset finished.');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Daily reset failed:', error);
    process.exit(1);
});
