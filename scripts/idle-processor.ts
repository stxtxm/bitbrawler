import { Character } from '../src/types/Character';
import { generateMonster, getRandomMonsterId, getReferenceMonster } from '../src/utils/monsterUtils';
import { simulateCombat, calculateCombatStats } from '../src/utils/combatUtils';
import { gainXp } from '../src/utils/xpUtils';
import { GAME_RULES } from '../src/config/gameRules';
import { autoAllocateStatPointsRandom } from '../src/utils/statUtils';
import { applyEquipmentToCharacter } from '../src/utils/equipmentUtils';
import { computeEfficiency, calculateOfflineFightsWithEfficiency } from '../src/utils/idleEfficiencyUtils';
import { calculateIdleXp } from '../src/utils/idleXpUtils';
import { IDLE_CONFIG } from '../src/config/idleConfig';
import { supabase } from './supabaseAdmin';

const IDLE_WINDOW_MINUTES = 2;
const DB_BATCH_SIZE = 10;

const SELECT_COLUMNS = [
  'id', 'name', 'level', 'hp', 'max_hp',
  'strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus',
  'experience', 'stat_points', 'last_idle_check',
  'auto_mode', 'is_bot', 'equipped_items',
  'idle_streak', 'idle_max_streak', 'idle_total_kills', 'idle_total_xp',
  'essence', 'last_active',
].join(',');

function convertRowToCharacter(row: any): Character {
  return {
    id: row.id,
    name: row.name,
    gender: 'male',
    seed: row.id ?? 'idle-processor',
    level: row.level ?? 1,
    hp: row.hp ?? 100,
    maxHp: row.max_hp ?? 100,
    strength: row.strength ?? 10,
    vitality: row.vitality ?? 10,
    dexterity: row.dexterity ?? 10,
    luck: row.luck ?? 10,
    intelligence: row.intelligence ?? 10,
    focus: row.focus ?? GAME_RULES.STATS.BASE_VALUE,
    experience: row.experience ?? 0,
    wins: 0,
    losses: 0,
    fightsLeft: 0,
    lastFightReset: 0,
    statPoints: row.stat_points ?? 0,
    isBot: row.is_bot ?? false,
    autoMode: row.auto_mode ?? false,
    equippedItems: row.equipped_items ?? { weapon: null, armor: null, accessory: null },
    idleStreak: row.idle_streak ?? 0,
    idleMaxStreak: row.idle_max_streak ?? 0,
    idleTotalKills: row.idle_total_kills ?? 0,
    idleTotalXp: row.idle_total_xp ?? 0,
    essence: row.essence ?? 0,
    lastActive: row.last_active ? new Date(row.last_active).getTime() : 0,
    lastIdleCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
  };
}

interface IdleChar {
  id: string
  char: Character
  lastCheck: number
}

async function fetchIdleCandidates(): Promise<IdleChar[]> {
  const cutoff = new Date(Date.now() - IDLE_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('characters')
    .select(SELECT_COLUMNS)
    .lt('last_idle_check', cutoff)
    .is('pending_fight', null)
    .limit(500);

  if (error) {
    console.error('Failed to fetch idle candidates:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row: any) => ({
    id: row.id as string,
    char: convertRowToCharacter(row),
    lastCheck: row.last_idle_check ? new Date(row.last_idle_check).getTime() : 0,
  }));
}

function simulateIdleGains(
  char: Character,
  idleMs: number
): Character | null {
  if (idleMs <= 30_000) return null;

  const effectiveChar = applyEquipmentToCharacter(char);
  const playerStats = calculateCombatStats(char);
  const refMonster = getReferenceMonster(char.level);
  const monsterStats = calculateCombatStats(refMonster);
  const eff = computeEfficiency(playerStats, monsterStats, effectiveChar.dexterity);
  const effectiveInterval = eff.effectiveInterval;

  const fights = calculateOfflineFightsWithEfficiency(
    Date.now() - idleMs,
    Date.now(),
    effectiveInterval,
  );
  if (fights <= 0) return null;

  let current = { ...char };
  let streak = current.idleStreak ?? 0;
  let kills = current.idleTotalKills ?? 0;
  let idleTotal = current.idleTotalXp ?? 0;
  let essenceAccum = 0;
  let _leveledUp = false;

  for (let i = 0; i < fights; i++) {
    const monsterId = getRandomMonsterId();
    const monster = generateMonster(monsterId, current.level);
    const combat = simulateCombat(current, monster);
    const won = combat.winner === 'attacker';

    const baseXp = calculateIdleXp(won, current.level);
    const xpBonus = eff.xpBonusMultiplier - 1;
    const streakBonus = Math.min(
      streak * IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_PER_STEP,
      IDLE_CONFIG.EFFICIENCY.STREAK_BONUS_CAP,
    );
    const finalXp = Math.floor(baseXp * (1 + xpBonus) * (1 + streakBonus));

    const essenceRate = IDLE_CONFIG.ESSENCE.BASE_RATE * (won ? 1 : IDLE_CONFIG.ESSENCE.LOSS_RATIO)
    const essenceScaling = 1 + (current.level - 1) * IDLE_CONFIG.ESSENCE.LEVEL_SCALE
    essenceAccum += essenceRate * essenceScaling

    const result = gainXp(current, finalXp);
    if (result.levelsGained > 0) _leveledUp = true;

    const pointsGained = result.levelsGained * GAME_RULES.STATS.POINTS_PER_LEVEL;

    if (won) { streak++; kills++; } else { streak = 0; }
    idleTotal += finalXp;

    const updated = {
      ...result.updatedCharacter,
      idleStreak: streak,
      idleMaxStreak: Math.max(streak, current.idleMaxStreak ?? 0),
      idleTotalKills: kills,
      idleTotalXp: idleTotal,
      statPoints: (result.updatedCharacter.statPoints ?? 0) + pointsGained,
    };

    current = updated.autoMode && pointsGained > 0
      ? autoAllocateStatPointsRandom(updated, pointsGained)
      : updated;
  }

  const essenceDelta = Math.min(Math.floor(essenceAccum), 500 - (current.essence ?? 0))
  if (essenceDelta > 0) {
    current = { ...current, essence: (current.essence ?? 0) + essenceDelta }
  }

  return current;
}

async function processCharacter(candidate: IdleChar): Promise<void> {
  const idleMs = Date.now() - candidate.lastCheck;
  const updated = simulateIdleGains(candidate.char, idleMs);

  if (!updated) {
    // No idle gains, just advance the watermark
    const { error } = await supabase
      .from('characters')
      .update({ last_idle_check: new Date().toISOString() })
      .eq('id', candidate.id);

    if (error) console.warn(`Failed to advance watermark for ${candidate.id}:`, error);
    return;
  }

  const levelDiff = updated.level - candidate.char.level;
  const xpDiff = (updated.experience ?? 0) - (candidate.char.experience ?? 0);
  const essenceDiff = (updated.essence ?? 0) - (candidate.char.essence ?? 0);

  console.log(
    `  ${candidate.char.name}: ${levelDiff > 0 ? `⬆ LVL +${levelDiff}, ` : ''}+${xpDiff} XP, ${essenceDiff > 0 ? `⚡ +${essenceDiff} Essence, ` : ''}streak ${updated.idleStreak}, kills ${updated.idleTotalKills}`
  );

  const updates: Record<string, any> = {
    last_idle_check: new Date().toISOString(),
    experience: updated.experience,
    level: updated.level,
    hp: updated.hp,
    max_hp: updated.maxHp,
    strength: updated.strength,
    vitality: updated.vitality,
    dexterity: updated.dexterity,
    luck: updated.luck,
    intelligence: updated.intelligence,
    focus: updated.focus,
    stat_points: updated.statPoints,
    idle_streak: updated.idleStreak,
    idle_max_streak: updated.idleMaxStreak,
    idle_total_kills: updated.idleTotalKills,
    idle_total_xp: updated.idleTotalXp,
    essence: updated.essence,
  };

  const { error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', candidate.id);

  if (error) {
    console.warn(`Failed to update ${candidate.char.name} (${candidate.id}):`, error);
  }
}

async function run() {
  console.log('⏰ Idle Processor starting...');

  const candidates = await fetchIdleCandidates();
  if (candidates.length === 0) {
    console.log('No idle characters to process.');
    return;
  }

  console.log(`Found ${candidates.length} characters with idle time to process.`);

  let processed = 0;
  for (let i = 0; i < candidates.length; i += DB_BATCH_SIZE) {
    const batch = candidates.slice(i, i + DB_BATCH_SIZE);
    await Promise.all(batch.map(processCharacter));
    processed += batch.length;
    console.log(`  Batch complete: ${processed}/${candidates.length}`);
  }

  console.log(`✅ Idle Processor finished. Processed ${processed} characters.`);
}

run().catch((err) => {
  console.error('❌ Idle Processor failed:', err);
  process.exit(1);
});
