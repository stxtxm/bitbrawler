/**
 * telemetry-report.ts
 *
 * Lit `telemetry_events` (Supabase) et imprime les métriques de rétention
 * réelles : D1/D7 par cohorte, installs actifs par jour, distribution des
 * niveaux, achats, murs et tentatives de boss (#1230 partie 2).
 *
 * Usage:
 *   npm run telemetry:report                # 90 derniers jours
 *   npm run telemetry:report -- --days=30
 *   npm run telemetry:report -- --json      # JSON brut pour le tech-lead
 *
 * Env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (via scripts/supabaseAdmin).
 *
 * La table est créée par l'issue de migration liée à #1230. Tant qu'elle
 * n'existe pas, le script le dit et sort proprement (code 0) : ce n'est pas
 * une erreur de run, c'est une migration à exécuter.
 */
import { supabase } from './supabaseAdmin';
import {
  summarizeTelemetry,
  type TelemetryReportRow,
  type TelemetrySummary,
} from '../src/utils/telemetryReport';

const PAGE_SIZE = 1000;
const MAX_ROWS = 200_000;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const daysArg = args.find((arg) => arg.startsWith('--days='));
const days = (() => {
  const parsed = daysArg ? Number(daysArg.split('=')[1]) : 90;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 3650) : 90;
})();

const since = new Date(Date.now() - days * 86_400_000).toISOString();

class MissingTableError extends Error {
  constructor() {
    super('telemetry_events does not exist yet — run the migration issue attached to #1230.');
  }
}

async function fetchRows(): Promise<TelemetryReportRow[]> {
  const rows: TelemetryReportRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('telemetry_events')
      .select('install_id,event,created_at,level,props')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (error.code === 'PGRST205' || /relation .* does not exist/i.test(error.message)) {
        throw new MissingTableError();
      }
      throw new Error(`telemetry query failed: ${error.message}`);
    }

    const batch = (data ?? []) as TelemetryReportRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

const pct = (value: number | null): string =>
  value === null ? '—' : `${(value * 100).toFixed(1)}%`;

function printSummary(summary: TelemetrySummary): void {
  console.log(`BitBrawler telemetry — last ${days} days (${summary.firstDay ?? '—'} → ${summary.lastDay ?? '—'})`);
  console.log(`Events: ${summary.totalEvents} · installs: ${summary.totalInstalls}`);
  console.log('');

  if (summary.totalEvents === 0) {
    console.log('No telemetry rows in this window.');
    return;
  }

  console.log('Events');
  for (const { event, count } of summary.events) {
    console.log(`  ${event.padEnd(16)} ${String(count).padStart(7)}`);
  }
  console.log('');

  console.log('Active installs / day');
  for (const { day, installs } of summary.activeByDay.slice(-14)) {
    console.log(`  ${day}  ${String(installs).padStart(4)}`);
  }
  console.log('');

  console.log('Retention (session_start cohorts)');
  console.log(`  ${'day'.padEnd(12)} ${'new'.padStart(5)} ${'D1'.padStart(8)} ${'D7'.padStart(8)}`);
  for (const cohort of summary.cohorts.slice(-14)) {
    console.log(
      `  ${cohort.day.padEnd(12)} ${String(cohort.installs).padStart(5)} ${pct(cohort.d1).padStart(8)} ${pct(cohort.d7).padStart(8)}`,
    );
  }
  console.log(`  pooled D1: ${pct(summary.d1.rate)} (${summary.d1.retained}/${summary.d1.eligible})`);
  console.log(`  pooled D7: ${pct(summary.d7.rate)} (${summary.d7.retained}/${summary.d7.eligible})`);
  console.log('');

  console.log('Levels (max seen per install)');
  for (const { level, installs } of summary.levels) {
    console.log(`  lvl ${String(level).padStart(3)}  ${String(installs).padStart(4)}`);
  }
  console.log('');

  console.log(
    `Purchases: ${summary.purchases.count} by ${summary.purchases.installs} installs · avg price ${summary.purchases.avgPrice ?? '—'}`,
  );
  console.log(`Walls: ${summary.walls.map((wall) => `lvl ${wall.level} × ${wall.count}`).join(' · ') || '—'}`);
  console.log(
    `Boss: ${summary.boss.attempts} attempts by ${summary.boss.installs} installs · ${summary.boss.wins} wins (${pct(summary.boss.winRate)})`,
  );
}

async function main(): Promise<void> {
  const rows = await fetchRows();
  const summary = summarizeTelemetry(rows);
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  printSummary(summary);
}

main().catch((error: unknown) => {
  if (error instanceof MissingTableError) {
    // Not a failure: the migration has not been executed yet. Keep stdout
    // valid JSON for the tech-lead step (`--json > report.json`).
    if (asJson) console.log('{}');
    else console.log(error.message);
    process.exit(0);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
