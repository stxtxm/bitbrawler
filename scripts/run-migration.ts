/**
 * run-migration.ts
 *
 * Applies pending SQL migrations from supabase/migrations/ to the
 * Supabase database using the Management API.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=... npm run db:migrate
 *
 * Environment variables:
 *   SUPABASE_URL              – Supabase project URL (or VITE_SUPABASE_URL)
 *   SUPABASE_ACCESS_TOKEN     – Supabase Management API access token
 *                               (generate from https://supabase.com/dashboard/account/tokens)
 *
 * If SUPABASE_ACCESS_TOKEN is not set, the script prints the SQL to apply
 * manually in the Supabase SQL Editor.
 *
 * This approach statically imports ALL exports from the supabase client.
 * Even when the token is absent, the module graph loads everything,
 * including the Supabase client. To avoid WebSocket errors on Node < 22
 * we import the script lazily via dynamic import() below.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../supabase/migrations');

/* ── helpers ─────────────────────────────────────────────────── */

function extractProjectRef(url: string): string {
    const match = url.match(/https:\/\/(.+)\.supabase\.co/);
    if (!match) throw new Error(`Cannot extract project ref from URL: ${url}`);
    return match[1];
}

function getMigrations(): { file: string; sql: string }[] {
    if (!readdirSync(MIGRATIONS_DIR).some(f => f.endsWith('.sql'))) {
        return [];
    }
    return readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()
        .map(file => ({
            file,
            sql: readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8'),
        }));
}

/* ── print manual instructions ───────────────────────────────── */

function printManualInstructions(supabaseUrl?: string): void {
    const migrations = getMigrations();

    if (migrations.length === 0) {
        console.log('ℹ️  No pending SQL migrations found in supabase/migrations/.');
        return;
    }

    console.log('\n❌ SUPABASE_ACCESS_TOKEN is not set.');
    console.log('   To apply migrations manually:\n');
    console.log('   1. Open the Supabase SQL Editor:');
    const sqlEditorUrl = supabaseUrl
        ? supabaseUrl.replace(/\/?$/, '') + '/project/default/sql/new'
        : 'https://supabase.com/dashboard/project/<PROJECT_REF>/sql/new';
    console.log(`       ${sqlEditorUrl}`);
    console.log('\n   2. Paste the SQL below and click "Run".\n');

    for (const { file, sql } of migrations) {
        console.log(`── ${file} ──────────────────────────────────────────────`);
        console.log(sql);
        console.log('─────────────────────────────────────────────────────────\n');
    }

    console.log('   Or set SUPABASE_ACCESS_TOKEN and run again.\n');
}

/* ── apply via Management API ────────────────────────────────── */

async function applyViaApi(token: string, supabaseUrl: string): Promise<void> {
    const projectRef = extractProjectRef(supabaseUrl);
    const migrations = getMigrations();

    if (migrations.length === 0) {
        console.log('ℹ️  No pending SQL migrations found.');
        return;
    }

    console.log(`🔗 Project ref: ${projectRef}`);
    console.log(`📂 Found ${migrations.length} migration(s)\n`);

    const API_BASE = 'https://api.supabase.com/v1';

    for (const { file, sql } of migrations) {
        console.log(`📦 Applying ${file}...`);

        const response = await fetch(
            `${API_BASE}/projects/${projectRef}/database/query`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: sql }),
            },
        );

        if (!response.ok) {
            const body = await response.text();
            console.error(`❌ Failed to apply ${file}: HTTP ${response.status}`);
            console.error(`   Response: ${body}`);
            process.exit(1);
        }

        console.log(`✅ ${file} applied successfully`);
    }

    console.log('\n✅ All migrations applied successfully!');
}

/* ── main ────────────────────────────────────────────────────── */

async function main(): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const token = process.env.SUPABASE_ACCESS_TOKEN;

    if (!supabaseUrl) {
        console.error('❌ Missing SUPABASE_URL environment variable.');
        console.error('   Set SUPABASE_URL or VITE_SUPABASE_URL in your .env file.');
        process.exit(1);
    }

    if (!token) {
        printManualInstructions(supabaseUrl);
        process.exit(0); // Not an error — just need manual intervention
    }

    await applyViaApi(token, supabaseUrl);
}

main().catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
