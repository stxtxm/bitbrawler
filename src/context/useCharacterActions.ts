import { useCallback } from 'react';
import { supabase } from '../config/supabase';
import { Character } from '../types/Character';
import { applyStatPoint, StatKey } from '../utils/statUtils';
import { canRollLootbox, rollLootbox } from '../utils/lootboxUtils';
import { ITEM_ASSETS } from '../data/itemAssets';
import { PixelItemAsset } from '../types/Item';
import { normalizeCharacter, INVENTORY_CAPACITY } from '../utils/persistenceUtils';

interface UseCharacterActionsDeps {
  activeCharacter: Character | null;
  persistCharacter: (character: Character) => Character;
  handleDbError: (error: any, context: string) => void;
  logout: () => void;
}

export const useCharacterActions = ({
  activeCharacter,
  persistCharacter,
  handleDbError,
  logout,
}: UseCharacterActionsDeps) => {
  // Allocate a stat point
  const allocateStatPoint = useCallback(async (stat: StatKey): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;
    if (!activeCharacter.statPoints || activeCharacter.statPoints <= 0) return null;

    const updatedChar = normalizeCharacter(applyStatPoint(activeCharacter, stat));

    try {
      await supabase
        .from('characters')
        .update({
          [stat]: (updatedChar as any)[stat],
          hp: updatedChar.hp,
          max_hp: updatedChar.maxHp,
          stat_points: updatedChar.statPoints,
          focus: updatedChar.focus,
        })
        .eq('id', activeCharacter.id!);

      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'stat-allocate');
      throw new Error('Connection error - stat point not saved. Please check your internet connection.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Roll a lootbox
  const rollLootboxForPlayer = useCallback(async (): Promise<PixelItemAsset | null> => {
    if (!activeCharacter?.id) return null;

    const now = Date.now();
    if (!canRollLootbox(activeCharacter.lastLootRoll, now)) {
      throw new Error('Daily lootbox already opened.');
    }

    const inventory = activeCharacter.inventory || [];
    if (inventory.length >= INVENTORY_CAPACITY) {
      throw new Error('Inventory is full.');
    }

    const item = rollLootbox(ITEM_ASSETS, { excludeIds: inventory, level: activeCharacter.level });
    if (!item) {
      throw new Error('No new loot available.');
    }

    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      inventory: [...inventory, item.id],
      lastLootRoll: now,
    });

    try {
      await supabase
        .from('characters')
        .update({
          inventory: updatedChar.inventory,
          last_loot_roll: updatedChar.lastLootRoll,
          focus: updatedChar.focus,
        })
        .eq('id', activeCharacter.id!);

      persistCharacter(updatedChar);
      return item;
    } catch (error: any) {
      handleDbError(error, 'lootbox');
      throw new Error('Connection error - lootbox not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Set auto mode — also syncs isBot since auto-mode characters are functionally bots
  const setAutoMode = useCallback(async (enabled: boolean): Promise<Character | null> => {
    if (!activeCharacter?.id) return null;

    const updatedChar = normalizeCharacter({
      ...activeCharacter,
      autoMode: enabled,
      isBot: enabled,
    });

    try {
      await supabase
        .from('characters')
        .update({
          auto_mode: enabled,
          is_bot: enabled,
        })
        .eq('id', activeCharacter.id);

      persistCharacter(updatedChar);
      return updatedChar;
    } catch (error: any) {
      handleDbError(error, 'auto-mode');
      throw new Error('Connection error - auto mode not saved.');
    }
  }, [activeCharacter, handleDbError, persistCharacter]);

  // Delete character
  const deleteCharacter = useCallback(async (): Promise<boolean> => {
    if (!activeCharacter?.id) return false;

    try {
      await supabase
        .from('characters')
        .delete()
        .eq('id', activeCharacter.id);

      logout();
      return true;
    } catch (error: any) {
      handleDbError(error, 'delete-character');
      throw new Error('Connection error - character not deleted.');
    }
  }, [activeCharacter, handleDbError, logout]);

  return {
    allocateStatPoint,
    rollLootbox: rollLootboxForPlayer,
    setAutoMode,
    deleteCharacter,
  };
};
