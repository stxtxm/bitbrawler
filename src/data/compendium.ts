import { BIOMES, type BiomeId } from './biomes';
import { CODEX_ENTRIES, type CodexEntry } from './codex';
import { ITEM_ASSETS } from './itemAssets';
import { MONSTER_ASSETS, type MonsterId } from './monsterAssets';
import type { Element } from '../types/Item';

export type CompendiumTab = 'bestiary' | 'armory';

export const COMPENDIUM_BIOME_LABELS: Record<BiomeId, string> = {
  plains: 'Plains',
  volcanic: 'Volcanic',
  abyssal: 'Abyssal Rift',
};

export interface BestiaryEntry {
  id: MonsterId;
  name: string;
  element: Element;
  specialty: string;
  biome: BiomeId;
  biomeLabel: string;
  minLevel?: number;
  maxLevel?: number;
  baseHp: number;
}

export interface ArmoryEntry extends CodexEntry {
  pixels: number[][];
}

const BIOME_BY_MONSTER = new Map<MonsterId, BiomeId>();

for (const biome of BIOMES) {
  for (const monsterId of biome.monsterPool) {
    BIOME_BY_MONSTER.set(monsterId, biome.id);
  }
}

export const BESTIARY_ENTRIES: BestiaryEntry[] = MONSTER_ASSETS.map((monster) => {
  const biome = BIOME_BY_MONSTER.get(monster.id) ?? 'plains';
  return {
    id: monster.id,
    name: monster.name,
    element: monster.element,
    specialty: monster.specialty,
    biome,
    biomeLabel: COMPENDIUM_BIOME_LABELS[biome],
    minLevel: monster.minLevel,
    maxLevel: monster.maxLevel,
    baseHp: monster.baseStats.hp,
  };
});

export const BESTIARY_BY_ID: Record<MonsterId, BestiaryEntry> = Object.fromEntries(
  BESTIARY_ENTRIES.map((entry) => [entry.id, entry]),
) as Record<MonsterId, BestiaryEntry>;

const ITEM_BY_ID = new Map(ITEM_ASSETS.map((item) => [item.id, item]));

export const ARMORY_ENTRIES: ArmoryEntry[] = CODEX_ENTRIES.map((entry) => ({
  ...entry,
  pixels: ITEM_BY_ID.get(entry.id)?.pixels ?? [],
}));

export const ARMORY_BY_ID: Record<string, ArmoryEntry> = Object.fromEntries(
  ARMORY_ENTRIES.map((entry) => [entry.id, entry]),
);

export const COMPENDIUM_TOTAL = BESTIARY_ENTRIES.length + ARMORY_ENTRIES.length;

export function getBestiaryEntry(id: string): BestiaryEntry | undefined {
  return BESTIARY_BY_ID[id as MonsterId];
}

export function getArmoryEntry(id: string): ArmoryEntry | undefined {
  return ARMORY_BY_ID[id];
}
