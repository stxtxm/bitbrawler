import { supabase } from './supabaseAdmin';
import {
  buildStreakLadder,
  getPreviousWeekKey,
  getRetentionCutoffWeek,
  normalizeLadderStreak,
} from '../src/utils/streakLadderUtils';

interface ResetOptions {
  weekKey: string;
  dryRun: boolean;
}

interface StreakLadderRow {
  character_id: string;
  name: string;
  streak: number;
  updated_at: string | null;
}

function parseArgs(argv: string[]): ResetOptions {
  let week: string | undefined;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--week=')) {
      week = arg.slice('--week='.length);
    }
  }

  return { weekKey: week ?? getPreviousWeekKey(Date.now()), dryRun };
}

async function finalizeWeek(weekKey: string, dryRun: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('streak_ladder')
    .select('character_id,name,streak,updated_at')
    .eq('week_key', weekKey);

  if (error) {
    console.error(`❌ Lecture streak_ladder (${weekKey}) : ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const rows = (data ?? []) as StreakLadderRow[];
  const ladder = buildStreakLadder(
    rows.map((row) => ({
      characterId: row.character_id,
      name: row.name,
      streak: normalizeLadderStreak(row.streak),
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    })),
  );

  console.log(`🏆 ${weekKey} — ${ladder.length} entrée(s)${dryRun ? ' (dry-run)' : ''}`);

  for (const entry of ladder) {
    const tierLabel = entry.tier ? entry.tier.toUpperCase() : '—';
    console.log(`  #${entry.rank} ${entry.name} — ${entry.streak} J [${tierLabel}]`);

    if (dryRun || !entry.tier) continue;

    const { error: updateError } = await supabase
      .from('streak_ladder')
      .update({ tier: entry.tier })
      .eq('week_key', weekKey)
      .eq('character_id', entry.characterId);

    if (updateError) {
      console.error(`❌ Tier ${entry.name} : ${updateError.message}`);
      process.exitCode = 1;
    }
  }
}

async function pruneOldWeeks(dryRun: boolean): Promise<void> {
  const cutoff = getRetentionCutoffWeek(Date.now());
  console.log(`🧹 Purge des semaines antérieures à ${cutoff}${dryRun ? ' (dry-run)' : ''}`);

  if (dryRun) return;

  const { error } = await supabase.from('streak_ladder').delete().lt('week_key', cutoff);

  if (error) {
    console.error(`❌ Purge streak_ladder : ${error.message}`);
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  await finalizeWeek(options.weekKey, options.dryRun);
  await pruneOldWeeks(options.dryRun);
}

void main();
