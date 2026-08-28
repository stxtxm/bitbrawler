import { Character } from '../types/Character';
import { Element, ELEMENT_LABELS } from '../types/Item';
import { getBotArchetype, ARCHETYPE_WEAKNESSES, type BotArchetype } from './affinityUtils';
import { getEquippedItems, getItemById } from './equipmentUtils';

export interface TacticalHint {
  defenderArchetype: BotArchetype;
  defenderWeakness: Element;
  defenderWeaponElement?: Element;
  playerWeaponElement?: Element;
  playerWeaponName?: string;
  hintText: string;
  hintKind: 'strong' | 'switch' | 'neutral';
  hasSwitchOption: boolean;
}

export const getTacticalHint = (
  player: Character | null | undefined,
  opponent: Character | null | undefined
): TacticalHint | null => {
  if (!player || !opponent) return null;
  const defenderArchetype = getBotArchetype(opponent);
  const defenderWeakness = ARCHETYPE_WEAKNESSES[defenderArchetype];
  const defenderWeaponElement = getEquippedItems(opponent).find((i) => i.slot === 'weapon')?.element;
  const playerWeapon = getEquippedItems(player).find((i) => i.slot === 'weapon');
  const playerWeaponElement = playerWeapon?.element;
  const playerWeaponName = playerWeapon?.name;
  const ownedIds = [
    ...(player.inventory ?? []),
    ...Object.values(player.equippedItems ?? {}).filter((v): v is string => typeof v === 'string' && Boolean(v)),
  ];
  const ownedElements = ownedIds
    .map((id) => getItemById(id)?.element)
    .filter((e): e is Element => Boolean(e));
  const hasWeaknessOwned = ownedElements.includes(defenderWeakness);
  const hasSwitchOption = hasWeaknessOwned && playerWeaponElement !== defenderWeakness;
  let hintText: string;
  let hintKind: TacticalHint['hintKind'];
  if (playerWeaponElement === defenderWeakness) {
    hintKind = 'strong';
    hintText = `Ton ${playerWeaponName ?? 'arme'} ${ELEMENT_LABELS[playerWeaponElement].toUpperCase()} est forte vs ce ${defenderArchetype.toUpperCase()} (+15%)`;
  } else if (hasSwitchOption) {
    hintKind = 'switch';
    hintText = `Switch vers ${ELEMENT_LABELS[defenderWeakness].toUpperCase()} pour ce ${defenderArchetype.toUpperCase()} ?`;
  } else {
    hintKind = 'neutral';
    hintText = `${defenderArchetype.toUpperCase()} — faible à ${ELEMENT_LABELS[defenderWeakness].toUpperCase()}`;
  }
  return {
    defenderArchetype,
    defenderWeakness,
    defenderWeaponElement,
    playerWeaponElement,
    playerWeaponName,
    hintText,
    hintKind,
    hasSwitchOption,
  };
};
