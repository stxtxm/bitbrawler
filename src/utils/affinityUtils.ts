import { Character } from '../types/Character';
import { Element } from '../types/Item';
import { COMBAT_BALANCE } from '../config/combatBalance';

export type BotArchetype = 'bruiser' | 'tank' | 'rogue' | 'mage' | 'lucky' | 'zen';

export const ARCHETYPE_LABELS: Record<BotArchetype, string> = {
  bruiser: 'Bruiser',
  tank: 'Tank',
  rogue: 'Rogue',
  mage: 'Mage',
  lucky: 'Lucky',
  zen: 'Zen',
};

// Each archetype is weak to a specific element
export const ARCHETYPE_WEAKNESSES: Record<BotArchetype, Element> = {
  bruiser: 'wind',
  tank: 'fire',
  rogue: 'earth',
  mage: 'dark',
  lucky: 'light',
  zen: 'water',
};

// Each element beats one archetype and is beaten by another
export const ELEMENT_ADVANTAGES: Record<Element, BotArchetype> = {
  fire: 'tank',
  water: 'zen',
  wind: 'bruiser',
  earth: 'rogue',
  light: 'lucky',
  dark: 'mage',
};

export const getBotArchetype = (character: Character): BotArchetype => {
  const stats: [string, number][] = [
    ['strength', character.strength ?? 0],
    ['vitality', character.vitality ?? 0],
    ['dexterity', character.dexterity ?? 0],
    ['intelligence', character.intelligence ?? 0],
    ['luck', character.luck ?? 0],
    ['focus', character.focus ?? 0],
  ];

  const maxStat = stats.reduce((a, b) => (a[1] >= b[1] ? a : b));

  switch (maxStat[0]) {
    case 'strength': return 'bruiser';
    case 'vitality': return 'tank';
    case 'dexterity': return 'rogue';
    case 'intelligence': return 'mage';
    case 'luck': return 'lucky';
    case 'focus': return 'zen';
    default: return 'bruiser';
  }
};

export const getAffinityMultiplier = (
  attackerElement: Element | null | undefined,
  defenderArchetype: BotArchetype | null
): number => {
  if (!attackerElement || !defenderArchetype) return 1;

  const weakness = ARCHETYPE_WEAKNESSES[defenderArchetype];
  if (attackerElement === weakness) {
    return 1 + COMBAT_BALANCE.affinity.damageBonus;
  }

  return 1;
};
