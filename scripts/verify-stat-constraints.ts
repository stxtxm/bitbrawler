/**
 * verify-stat-constraints.ts
 *
 * Diagnostics script to check the current state of stat CHECK constraints
 * on the characters table.
 *
 * This script:
 *   1. Connects to Supabase using the service role key
 *   2. Checks if stat constraints exist by attempting an insert with boundary values
 *   3. Reports the current state
 *   4. Provides actionable guidance
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-stat-constraints.ts
 *
 * Environment variables (same as other scripts):
 *   SUPABASE_URL                – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   – Service role key (admin, bypasses RLS)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function main() {
    console.log('=== Bitbrawler Stat Constraint Checker ===\n');

    // ── 1. Check credentials ──────────────────────────────────────────
    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ Missing Supabase credentials.');
        console.log('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
        console.log('\n   Or copy .env.example to .env and fill in the values.\n');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 2. Test connectivity ──────────────────────────────────────────
    console.log('🔌 Testing Supabase connectivity...');
    const { error: pingError } = await supabase
        .from('characters')
        .select('id', { count: 'exact', head: true })
        .limit(1);

    if (pingError) {
        console.log(`❌ Cannot connect to Supabase: ${pingError.message}\n`);
        process.exit(1);
    }
    console.log('✅ Connection OK\n');

    // ── 3. Check current constraints by attempting edge-case inserts ──
    console.log('🔍 Checking stat CHECK constraints...');

    const TEST_NAME = '__STAT_CONSTRAINT_TEST__';
    const BOUNDARY_STATS = {
        // Test boundary values: MIN_VALUE=5 and MAX_VALUE=15
        min: { strength: 5, vitality: 5, dexterity: 5, luck: 5, intelligence: 5, focus: 5 },
        max: { strength: 15, vitality: 15, dexterity: 15, luck: 15, intelligence: 15, focus: 15 },
        mixed: { strength: 5, vitality: 10, dexterity: 15, luck: 8, intelligence: 12, focus: 6 },
    };

    // Delete any leftover test rows first
    await supabase.from('characters').delete().eq('name', TEST_NAME);

    let allPassed = true;
    for (const [label, stats] of Object.entries(BOUNDARY_STATS)) {
        const testRow = {
            name: TEST_NAME,
            gender: 'male',
            seed: `test-${label}-${Date.now()}`,
            level: 1,
            hp: 140,
            max_hp: 140,
            ...stats,
            is_bot: false,
            experience: 0,
            wins: 0,
            losses: 0,
            fights_left: 3,
            last_fight_reset: 0,
            stat_points: 0,
            inventory: [],
            last_loot_roll: 0,
            fight_history: [],
            fought_today: [],
            pending_fight: null,
            incoming_fight_history: [],
            auto_mode: false,
        };

        const { error: insertError } = await supabase
            .from('characters')
            .insert(testRow)
            .select('id')
            .single();

        // Clean up immediately
        await supabase.from('characters').delete().eq('name', TEST_NAME);

        if (insertError) {
            console.log(`  ❌ ${label} stats (${JSON.stringify(stats)}): FAILED`);
            console.log(`     Error: ${insertError.message}`);

            if (insertError.message?.includes('violates check constraint') || insertError.message?.includes('violates row-level')) {
                console.log('     → Constraint violation detected. Migration likely needed.\n');
            }
            allPassed = false;
        } else {
            console.log(`  ✅ ${label} stats (${JSON.stringify(stats)}): OK`);
        }
    }

    // ── 4. Summary ────────────────────────────────────────────────────
    console.log('');
    if (allPassed) {
        console.log('✅ All stat boundary values accepted!');
        console.log('   The CHECK constraints are correctly configured for the 5-15 range.\n');
        console.log('   No action needed.\n');
    } else {
        console.log('❌ Some stat values were rejected by the database.');
        console.log('   The CHECK constraints need to be updated.\n');
        console.log('   To fix, run this SQL in the Supabase SQL Editor:');
        console.log(`   ${supabaseUrl.replace('.co', '.co/dashboard/project/')}/sql/new`);
        console.log('');
        // Read the migration SQL and print it
        try {
            const migrationPath = resolve(__dirname, '../supabase/migrations/20260601_update_stat_check_constraints.sql');
            const sql = readFileSync(migrationPath, 'utf-8');
            console.log('── Migration SQL ──────────────────────────────────');
            console.log(sql);
            console.log('───────────────────────────────────────────────────');
        } catch {
            console.log('   (See supabase/migrations/20260601_update_stat_check_constraints.sql)');
        }
        console.log('');
    }

    process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
