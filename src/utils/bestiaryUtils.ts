import type { Character } from '../types/Character';
import type { Element } from '../types/Item';
import { MONSTER_ASSETS } from '../data/monsterAssets';

export type BestiaryEntry = {
  id: string;
  name: string;
  element: Element;
  seen: boolean;
  kills: number;
  encounters: number;
};

export type BestiaryProgress = {
  entries: BestiaryEntry[];
  seen: number;
  total: number;
  completionPct: number;
};

export type MonsterCounters = Record<string, number>;

type BestiaryCharacter = Pick<Character, 'monsterKills' | 'monsterEncounters'>;

const sanitizeCount = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
};

export function mergeMonsterCounters(
  current?: MonsterCounters | null,
  incoming?: MonsterCounters | null,
): MonsterCounters {
  const merged: MonsterCounters = {};
  for (const source of [current, incoming]) {
    if (!source) continue;
    for (const [monsterId, value] of Object.entries(source)) {
      const count = sanitizeCount(value);
      if (count > merged[monsterId] || merged[monsterId] === undefined) {
        merged[monsterId] = Math.max(merged[monsterId] ?? 0, count);
      }
    }
  }
  return merged;
}

export function incrementMonsterCounter(
  counters: MonsterCounters | undefined,
  monsterId: string,
  amount = 1,
): MonsterCounters {
  if (!monsterId) return { ...(counters ?? {}) };
  const increment = sanitizeCount(amount);
  if (increment === 0) return { ...(counters ?? {}) };
  return {
    ...(counters ?? {}),
    [monsterId]: sanitizeCount(counters?.[monsterId]) + increment,
  };
}

export function getBestiaryProgress(character: BestiaryCharacter): BestiaryProgress {
  const monsterKills = character.monsterKills ?? {};
  const monsterEncounters = mergeMonsterCounters(character.monsterEncounters, monsterKills);

  const entries: BestiaryEntry[] = MONSTER_ASSETS.map((monster) => {
    const kills = sanitizeCount(monsterKills[monster.id]);
    const encounters = Math.max(sanitizeCount(monsterEncounters[monster.id]), kills);
    return {
      id: monster.id,
      name: monster.name,
      element: monster.element,
      seen: encounters > 0,
      kills,
      encounters,
    };
  });

  const total = MONSTER_ASSETS.length;
  const seen = entries.filter((entry) => entry.seen).length;
  const completionPct = total > 0 ? Math.round((seen / total) * 100) : 0;

  return { entries, seen, total, completionPct };
}
