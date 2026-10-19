import type { Character } from '../types/Character';
import { MONSTER_ASSETS, type MonsterId } from '../data/monsterAssets';
import {
  ARMORY_ENTRIES,
  BESTIARY_ENTRIES,
  COMPENDIUM_TOTAL,
  type ArmoryEntry,
  type BestiaryEntry,
} from '../data/compendium';
import { getCodexIds } from './codexUtils';
import { notifyCompendiumUnlock } from './compendiumEvents';

export interface BestiaryProgress {
  entry: BestiaryEntry;
  encountered: boolean;
  encounters: number;
  kills: number;
}

export interface ArmoryProgress {
  entry: ArmoryEntry;
  seen: boolean;
  owned: boolean;
}

export interface CompendiumProgress {
  bestiary: { discovered: number; total: number; pct: number };
  armory: { discovered: number; total: number; pct: number };
  total: number;
  discovered: number;
  completionPct: number;
}

type CounterMap = Record<string, number>;

function readCount(map: CounterMap | undefined, id: string): number {
  const raw = map?.[id];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function recordMonsterEncounter(
  character: Character,
  monsterId: string,
  won: boolean,
): Character {
  const id = monsterId as MonsterId;
  const previousKills = character.monsterKills ?? {};
  const previousEncounters = character.monsterEncounters ?? {};
  const kills = readCount(previousKills, monsterId);
  const encounters = readCount(previousEncounters, monsterId);
  const isFirstEncounter = kills === 0 && encounters === 0;

  const monsterEncounters: CounterMap = {
    ...previousEncounters,
    [monsterId]: encounters + 1,
  };
  const monsterKills: CounterMap = won
    ? { ...previousKills, [monsterId]: kills + 1 }
    : { ...previousKills };

  if (isFirstEncounter) {
    const def = MONSTER_ASSETS.find((monster) => monster.id === id);
    notifyCompendiumUnlock({
      kind: 'bestiary',
      id: monsterId,
      name: def?.name ?? monsterId,
    });
  }

  return { ...character, monsterKills, monsterEncounters };
}

export function getBestiaryProgress(character: Character | null | undefined): BestiaryProgress[] {
  const kills = character?.monsterKills ?? {};
  const encounters = character?.monsterEncounters ?? {};

  return BESTIARY_ENTRIES.map((entry) => {
    const killCount = readCount(kills, entry.id);
    const encounterCount = readCount(encounters, entry.id);
    return {
      entry,
      encountered: killCount > 0 || encounterCount > 0,
      encounters: encounterCount,
      kills: killCount,
    };
  });
}

function collectSeenArmoryIds(character: Character | null | undefined): Set<string> {
  const seen = new Set<string>(getCodexIds((character ?? {}) as Character));
  for (const itemId of character?.inventory ?? []) seen.add(itemId);
  const equipped = character?.equippedItems;
  if (equipped) {
    for (const itemId of Object.values(equipped)) {
      if (itemId) seen.add(itemId);
    }
  }
  return seen;
}

function collectOwnedArmoryIds(character: Character | null | undefined): Set<string> {
  const owned = new Set<string>(character?.inventory ?? []);
  const equipped = character?.equippedItems;
  if (equipped) {
    for (const itemId of Object.values(equipped)) {
      if (itemId) owned.add(itemId);
    }
  }
  return owned;
}

export function getArmoryProgress(character: Character | null | undefined): ArmoryProgress[] {
  const seen = collectSeenArmoryIds(character);
  const owned = collectOwnedArmoryIds(character);

  return ARMORY_ENTRIES.map((entry) => ({
    entry,
    seen: seen.has(entry.id),
    owned: owned.has(entry.id),
  }));
}

export function getCompendiumProgress(character: Character | null | undefined): CompendiumProgress {
  const bestiary = getBestiaryProgress(character);
  const armory = getArmoryProgress(character);
  const bestiaryDiscovered = bestiary.filter((entry) => entry.encountered).length;
  const armoryDiscovered = armory.filter((entry) => entry.seen).length;
  const discovered = bestiaryDiscovered + armoryDiscovered;
  const total = COMPENDIUM_TOTAL;

  return {
    bestiary: {
      discovered: bestiaryDiscovered,
      total: bestiary.length,
      pct: percentage(bestiaryDiscovered, bestiary.length),
    },
    armory: {
      discovered: armoryDiscovered,
      total: armory.length,
      pct: percentage(armoryDiscovered, armory.length),
    },
    total,
    discovered,
    completionPct: percentage(discovered, total),
  };
}
