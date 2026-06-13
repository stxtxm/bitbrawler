import { ITEM_ASSETS } from '../data/itemAssets';
import { Character } from '../types/Character';
import { ItemSlot, ItemStats, PixelItemAsset } from '../types/Item';
import { getHpForVitality } from './statUtils';

export const getItemById = (
  id: string | null | undefined,
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

export const getEquippedItems = (character: Character): PixelItemAsset[] => {
  const equipped = character.equippedItems ?? { weapon: null, armor: null, accessory: null };
  const slots: ItemSlot[] = ['weapon', 'armor', 'accessory'];
  return slots
    .map((slot) => getItemById(equipped[slot]))
    .filter((item): item is PixelItemAsset => Boolean(item));
};

export const getEquipmentBonuses = (character: Character): ItemStats => {
  const equippedItems = getEquippedItems(character);
  return equippedItems.reduce<ItemStats>((acc, item) => {
    Object.entries(item.stats).forEach(([key, value]) => {
      const statKey = key as keyof ItemStats;
      acc[statKey] = (acc[statKey] || 0) + (value || 0);
    });
    return acc;
  }, {});
};

export const equipItem = (
  character: Character,
  itemId: string,
  slot: ItemSlot
): Character => {
  const item = getItemById(itemId);
  if (!item) return character;
  if (item.slot !== slot) return character;

  const inventory = [...(character.inventory ?? [])];

  // Item must be in inventory (or already equipped in a different slot) to equip it
  if (!inventory.includes(itemId)) {
    // Check if it's already equipped in this slot — no-op
    const currentEquipped = character.equippedItems?.[slot];
    if (currentEquipped === itemId) return character;
    return character;
  }

  const equipped = { ...(character.equippedItems ?? { weapon: null, armor: null, accessory: null }) };
  const currentInSlot = equipped[slot];

  // Remove item from inventory
  const newInventory = inventory.filter((id) => id !== itemId);

  // If slot had an equipped item not already in inventory, put it back
  if (currentInSlot && !newInventory.includes(currentInSlot)) {
    newInventory.push(currentInSlot);
  }

  equipped[slot] = itemId;

  return {
    ...character,
    equippedItems: equipped,
    inventory: newInventory,
  };
};

export const unequipItem = (
  character: Character,
  slot: ItemSlot
): Character => {
  const equipped = { ...(character.equippedItems ?? { weapon: null, armor: null, accessory: null }) };
  const currentInSlot = equipped[slot];

  if (!currentInSlot) return character;

  let inventory = [...(character.inventory ?? [])];
  inventory.push(currentInSlot);
  equipped[slot] = null;

  return {
    ...character,
    equippedItems: equipped,
    inventory,
  };
};

export const autoEquipBestItems = (character: Character): Character => {
  const inventory = character.inventory ?? [];
  const equipped = { ...(character.equippedItems ?? { weapon: null, armor: null, accessory: null }) };
  const slots: ItemSlot[] = ['weapon', 'armor', 'accessory'];

  const bySlot: Record<ItemSlot, PixelItemAsset[]> = {
    weapon: [],
    armor: [],
    accessory: [],
  };

  for (const id of inventory) {
    const item = getItemById(id);
    if (item) {
      bySlot[item.slot].push(item);
    }
  }

  for (const slot of slots) {
    const items = bySlot[slot];
    if (items.length === 0) {
      // No item for this slot in inventory, skip (keep null or current)
      if (!equipped[slot]) continue;
      // If currently equipped but no longer in inventory, unequip
      if (!inventory.includes(equipped[slot])) {
        equipped[slot] = null;
      }
      continue;
    }

    // Pick the best item: highest level, then rarity, then total stat value
    const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, epic: 3 };
    const best = items.reduce((a, b) => {
      const scoreA = (a.requiredLevel || 0) + rarityOrder[a.rarity] * 10 +
        Object.values(a.stats).reduce((s, v) => s + (v ?? 0), 0);
      const scoreB = (b.requiredLevel || 0) + rarityOrder[b.rarity] * 10 +
        Object.values(b.stats).reduce((s, v) => s + (v ?? 0), 0);
      return scoreB > scoreA ? b : a;
    });

    equipped[slot] = best.id;
  }

  return {
    ...character,
    equippedItems: equipped,
  };
};

export const applyEquipmentToCharacter = (character: Character): Character => {
  const bonus = getEquipmentBonuses(character);
  const baseMaxHp = character.maxHp || getHpForVitality(character.vitality || 0, character.level || 1);
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
