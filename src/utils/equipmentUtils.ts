import { ITEM_ASSETS } from '../data/itemAssets';
import { Character } from '../types/Character';
import { ItemStats, PixelItemAsset } from '../types/Item';
import { getHpForVitality } from './statUtils';

export const getItemById = (
  id: string | undefined,
  items: PixelItemAsset[] = ITEM_ASSETS
): PixelItemAsset | undefined => {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
};

export const getInventoryItems = (character: Character): PixelItemAsset[] => {
  const inventory = character.inventory || [];
  return inventory
    .map((id) => getItemById(id))
    .filter((item): item is PixelItemAsset => Boolean(item));
};

export const getEquipmentBonuses = (character: Character): ItemStats => {
  const inventoryItems = getInventoryItems(character);
  return inventoryItems.reduce<ItemStats>((acc, item) => {
    Object.entries(item.stats).forEach(([key, value]) => {
      const statKey = key as keyof ItemStats;
      acc[statKey] = (acc[statKey] || 0) + (value || 0);
    });
    return acc;
  }, {});
};

export const applyEquipmentToCharacter = (character: Character): Character => {
  const bonus = getEquipmentBonuses(character);
  const baseMaxHp = character.maxHp || getHpForVitality(character.vitality || 0);
  const bonusHp = bonus.hp || 0;
  const maxHp = baseMaxHp + bonusHp;
  const hp = Math.min(character.hp + bonusHp, maxHp || character.hp + bonusHp);

  return {
    ...character,
    strength: (character.strength || 0) + (bonus.strength || 0),
    vitality: (character.vitality || 0) + (bonus.vitality || 0),
    dexterity: (character.dexterity || 0) + (bonus.dexterity || 0),
    luck: (character.luck || 0) + (bonus.luck || 0),
    intelligence: (character.intelligence || 0) + (bonus.intelligence || 0),
    focus: (character.focus || 0) + (bonus.focus || 0),
    hp,
    maxHp: maxHp || character.maxHp,
  };
};
