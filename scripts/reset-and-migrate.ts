import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bhbpvbfvuayafygdrbgb.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey!);
const MIGRATIONS_DIR = resolve(__dirname, '../supabase/migrations');

async function deleteAllData() {
  console.log('🗑️  Deleting all character data...');
  const { error } = await supabase
    .from('characters')
    .delete()
    .not('id', 'is', null);
  if (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
  console.log('✅ All characters deleted');
}

async function runMigrationSql(sql: string, label: string) {
  console.log(`📦 ${label}...`);
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log(`   ⚠️  No SUPABASE_ACCESS_TOKEN — run this SQL manually in the SQL Editor:\n${sql.slice(0, 500)}${sql.length > 500 ? '...' : ''}\n`);
    return false;
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${extractProjectRef(supabaseUrl)}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (res.ok) {
    console.log(`   ✅ Applied`);
    return true;
  }
  const body = await res.text();
  if (body.includes('already exists') || body.includes('duplicate') || body.includes('not found') || body.includes('already contains')) {
    console.log(`   ⚠️  ${body.slice(0, 200)}`);
    return true;
  }
  console.error(`   ❌ (${res.status}): ${body.slice(0, 300)}`);
  return false;
}

function extractProjectRef(url: string): string {
  const match = url.match(/https:\/\/(.+)\.supabase\.co/);
  if (!match) throw new Error(`Cannot extract project ref from URL: ${url}`);
  return match[1];
}

async function applyMigrations() {
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of migrations) {
    if (file === '20260601_update_stat_check_constraints.sql') continue; // superseded by v3.1.0
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    await runMigrationSql(sql, file);
  }
}

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set in .env');
  process.exit(1);
}

await deleteAllData();
await applyMigrations();
console.log('\n✅ Done');
