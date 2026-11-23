import { supabase } from '../config/supabase';
import {
  normalizeLadderStreak,
  type StreakLadderEntryInput,
  type StreakLadderTier,
} from './streakLadderUtils';

export interface StreakLadderSubmitInput {
  characterId: string;
  name: string;
  streak: number;
}

export interface StreakLadderFetchResult {
  entries: StreakLadderEntryInput[];
  available: boolean;
}

export type LadderBadgeMap = Partial<Record<string, StreakLadderTier>>;

interface StreakLadderRow {
  character_id: string;
  name: string;
  streak: number;
  updated_at: string | null;
}

interface DbErrorLike {
  code?: string;
  message?: string;
}

const TABLE = 'streak_ladder';
const DEFAULT_LIMIT = 100;
const LOCAL_ENTRY_PREFIX = 'streak_ladder_entry';
const LOCAL_BADGES_PREFIX = 'streak_ladder_badges';
const SUBMIT_GATE_PREFIX = 'streak_ladder_submitted';

const TIER_RANK: Record<StreakLadderTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

const memoryStore = new Map<string, string>();

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem !== undefined;
  } catch {
    return false;
  }
}

function readStorage(key: string): string | null {
  if (!storageAvailable()) return memoryStore.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeStorage(key: string, value: string): void {
  memoryStore.set(key, value);
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be full or blocked; the in-memory copy is enough.
  }
}

export function isMissingStreakLadderTable(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const message = error.message ?? '';
  return /streak_ladder/i.test(message) && /(does not exist|schema cache|could not find)/i.test(message);
}

export async function fetchStreakLadder(
  weekKey: string,
  limit = DEFAULT_LIMIT,
): Promise<StreakLadderFetchResult> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('character_id,name,streak,updated_at')
    .eq('week_key', weekKey)
    .order('streak', { ascending: false })
    .order('name', { ascending: true })
    .limit(limit);

  if (error) {
    return { entries: [], available: false };
  }

  const rows = (data ?? []) as StreakLadderRow[];
  return {
    available: true,
    entries: rows.map((row) => ({
      characterId: row.character_id,
      name: row.name,
      streak: normalizeLadderStreak(row.streak),
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : undefined,
    })),
  };
}

export async function submitStreakLadderEntry(
  input: StreakLadderSubmitInput,
  weekKey: string,
): Promise<boolean> {
  if (!input.characterId) return false;

  const streak = normalizeLadderStreak(input.streak);
  saveLocalLadderEntry(input.characterId, weekKey, {
    characterId: input.characterId,
    name: input.name,
    streak,
    updatedAt: Date.now(),
  });

  const { error } = await supabase.from(TABLE).upsert(
    {
      character_id: input.characterId,
      week_key: weekKey,
      name: input.name,
      streak,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'character_id,week_key' },
  );

  return !error;
}

export async function submitStreakLadderEntryIfChanged(
  input: StreakLadderSubmitInput,
  weekKey: string,
): Promise<boolean> {
  const gateKey = `${SUBMIT_GATE_PREFIX}_${input.characterId}_${weekKey}_${normalizeLadderStreak(input.streak)}`;
  if (readStorage(gateKey)) return false;

  const submitted = await submitStreakLadderEntry(input, weekKey);
  if (submitted) writeStorage(gateKey, '1');
  return submitted;
}

export function saveLocalLadderEntry(
  characterId: string,
  weekKey: string,
  entry: StreakLadderEntryInput,
): void {
  writeStorage(
    `${LOCAL_ENTRY_PREFIX}_${characterId}_${weekKey}`,
    JSON.stringify({
      characterId: entry.characterId,
      name: entry.name,
      streak: normalizeLadderStreak(entry.streak),
      updatedAt: entry.updatedAt,
    }),
  );
}

export function loadLocalLadderEntry(
  characterId: string,
  weekKey: string,
): StreakLadderEntryInput | null {
  const raw = readStorage(`${LOCAL_ENTRY_PREFIX}_${characterId}_${weekKey}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StreakLadderEntryInput>;
    if (typeof parsed.characterId !== 'string' || typeof parsed.name !== 'string') return null;
    return {
      characterId: parsed.characterId,
      name: parsed.name,
      streak: normalizeLadderStreak(parsed.streak),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

export function loadLadderBadges(characterId: string): LadderBadgeMap {
  const raw = readStorage(`${LOCAL_BADGES_PREFIX}_${characterId}`);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const badges: LadderBadgeMap = {};
    for (const [weekKey, tier] of Object.entries(parsed)) {
      if (tier === 'bronze' || tier === 'silver' || tier === 'gold') {
        badges[weekKey] = tier;
      }
    }
    return badges;
  } catch {
    return {};
  }
}

export function recordLadderBadge(
  characterId: string,
  weekKey: string,
  tier: StreakLadderTier | null,
): LadderBadgeMap {
  const badges = loadLadderBadges(characterId);
  if (!tier) return badges;
  const existing = badges[weekKey];
  if (existing && TIER_RANK[existing] >= TIER_RANK[tier]) return badges;

  const next: LadderBadgeMap = { ...badges, [weekKey]: tier };
  writeStorage(`${LOCAL_BADGES_PREFIX}_${characterId}`, JSON.stringify(next));
  return next;
}
