import type { Character } from '../types/Character';
import type { Element } from '../types/Item';
import { MONSTER_ASSETS } from '../data/monsterAssets';

export type BestiaryEntry = {
  id: string;
  name: string;
  element: Element;
  seen: boolean;
  kills: number;
};

export type BestiaryProgress = {
  entries: BestiaryEntry[];
  seen: number;
  total: number;
  completionPct: number;
};

type BestiaryCharacter = Pick<Character, 'monsterKills'>;

export function getBestiaryProgress(character: BestiaryCharacter): BestiaryProgress {
  const monsterKills = character.monsterKills ?? {};

  const entries: BestiaryEntry[] = MONSTER_ASSETS.map((monster) => {
    const kills = monsterKills[monster.id] ?? 0;
    return {
      id: monster.id,
      name: monster.name,
      element: monster.element,
      seen: kills > 0,
      kills,
    };
  });

  const total = MONSTER_ASSETS.length;
  const seen = entries.filter((entry) => entry.seen).length;
  const completionPct = total > 0 ? Math.round((seen / total) * 100) : 0;

  return { entries, seen, total, completionPct };
}
