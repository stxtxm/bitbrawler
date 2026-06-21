import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Character } from '../types/Character';
import { ItemSlot, ItemStats, PixelItemAsset } from '../types/Item';
import {
  equipItem,
  getEquipmentBonuses,
  getEquippedItems,
  getItemById,
  unequipItem,
} from '../utils/equipmentUtils';
import { canRollLootbox } from '../utils/lootboxUtils';
import { INVENTORY_CAPACITY } from '../utils/persistenceUtils';
import { SoundType } from './useSound';
import type {
  InventoryStatEntry,
  InventoryStatKey,
  InventoryStatMetaMap,
} from '../components/arena/arenaTypes';

const INVENTORY_STAT_KEYS: InventoryStatKey[] = [
  'strength',
  'vitality',
  'dexterity',
  'luck',
  'intelligence',
  'focus',
  'hp',
];

export const ITEM_STAT_META: InventoryStatMetaMap = {
  strength: { label: 'STR', icon: 'strength' },
  vitality: { label: 'VIT', icon: 'vitality' },
  dexterity: { label: 'DEX', icon: 'dexterity' },
  luck: { label: 'LUK', icon: 'luck' },
  intelligence: { label: 'INT', icon: 'intelligence' },
  focus: { label: 'FOC', icon: 'focus' },
  hp: { label: 'HP', icon: 'vitality' },
};

export const getItemStatEntries = (item: PixelItemAsset | null): InventoryStatEntry[] => {
  if (!item) return [];

  return INVENTORY_STAT_KEYS.flatMap((key) => {
    const value = item.stats[key];
    return typeof value === 'number' && value !== 0 ? [{ key, value }] : [];
  });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  return error instanceof Error && error.message ? error.message : fallback;
};

interface UseInventoryOptions {
  character: Character | null;
  isOfflineMode: boolean;
  connectionMessage: string;
  ensureConnection: (message: string) => Promise<boolean>;
  openModal: (message: string) => void;
  play: (sound: SoundType) => void;
  rollLootbox: () => Promise<PixelItemAsset | null>;
  setCharacter: (character: Character) => void;
  saveEquipment: (character: Character) => Promise<Character | null>;
}

export const useInventory = ({
  character,
  isOfflineMode,
  connectionMessage,
  ensureConnection,
  openModal,
  play,
  rollLootbox,
  setCharacter,
  saveEquipment,
}: UseInventoryOptions) => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventoryHoveredId, setInventoryHoveredId] = useState<string | null>(null);
  const [inventorySelectedId, setInventorySelectedId] = useState<string | null>(null);
  const [lootboxRolling, setLootboxRolling] = useState(false);
  const [lootboxResult, setLootboxResult] = useState<PixelItemAsset | null>(null);
  const rollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lootSoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRollTimers = useCallback(() => {
    if (rollTimeoutRef.current) {
      clearTimeout(rollTimeoutRef.current);
      rollTimeoutRef.current = null;
    }
    if (lootSoundTimeoutRef.current) {
      clearTimeout(lootSoundTimeoutRef.current);
      lootSoundTimeoutRef.current = null;
    }
  }, []);

  const openInventory = useCallback(() => setInventoryOpen(true), []);
  const closeInventory = useCallback(() => setInventoryOpen(false), []);

  const inventory = character?.inventory ?? [];
  const inventoryCapacity = INVENTORY_CAPACITY;
  const inventoryFull = inventory.length >= inventoryCapacity;
  const canRollDailyLoot = canRollLootbox(character?.lastLootRoll, Date.now());
  const streak = character?.lootboxStreak ?? 0;
  const previewItemId = inventoryHoveredId ?? inventorySelectedId;
  const previewItem = getItemById(previewItemId) ?? null;
  const previewStats = useMemo(() => getItemStatEntries(previewItem), [previewItem]);
  const previewSlotLabel = previewItem ? previewItem.slot.toUpperCase() : '';
  const equippedItems = useMemo(() => character ? getEquippedItems(character) : [], [character]);
  const totalBonusEntries = useMemo(() => {
    if (!character) return [];
    const totalBonus: ItemStats = getEquipmentBonuses(character);
    return INVENTORY_STAT_KEYS
      .map((key) => ({ key, value: totalBonus[key] ?? 0 }))
      .filter((entry): entry is InventoryStatEntry => entry.value > 0);
  }, [character]);

  const handleEquipItem = useCallback((itemId: string, slot: ItemSlot) => {
    if (!character) return;
    const updated = equipItem(character, itemId, slot);
    if (updated === character) return;

    const previousCharacter = character;
    setCharacter(updated);
    saveEquipment(updated).catch((error: unknown) => {
      console.error('Equipment DB save failed, rolling back:', error);
      setCharacter(previousCharacter);
    });
    setInventoryHoveredId(null);
    setInventorySelectedId(null);
  }, [character, saveEquipment, setCharacter]);

  const handleUnequipItem = useCallback((slot: ItemSlot) => {
    if (!character) return;
    const updated = unequipItem(character, slot);
    if (updated === character) return;

    const previousCharacter = character;
    setCharacter(updated);
    saveEquipment(updated).catch((error: unknown) => {
      console.error('Equipment DB save failed, rolling back:', error);
      setCharacter(previousCharacter);
    });
  }, [character, saveEquipment, setCharacter]);

  const handleLootboxRoll = useCallback(async () => {
    if (lootboxRolling) return;
    if (isOfflineMode) {
      openModal(connectionMessage);
      return;
    }

    const canProceed = await ensureConnection(connectionMessage);
    if (!canProceed) return;

    setLootboxRolling(true);
    setLootboxResult(null);
    play('lootbox');

    rollTimeoutRef.current = setTimeout(() => {
      rollTimeoutRef.current = null;
      rollLootbox()
        .then((item) => {
          if (!item) return;
          setLootboxResult(item);
          setInventorySelectedId(item.id);
          setInventoryHoveredId(item.id);
          lootSoundTimeoutRef.current = setTimeout(() => {
            lootSoundTimeoutRef.current = null;
            play('loot');
          }, 100);
        })
        .catch((error: unknown) => {
          openModal(getErrorMessage(error, connectionMessage));
        })
        .finally(() => {
          setLootboxRolling(false);
        });
    }, 900);
  }, [
    connectionMessage,
    ensureConnection,
    isOfflineMode,
    lootboxRolling,
    openModal,
    play,
    rollLootbox,
  ]);

  const handleCloseLootboxResult = useCallback(() => {
    setLootboxResult(null);
  }, []);

  const handleSelectItem = useCallback((itemId: string) => {
    setInventorySelectedId(itemId);
  }, []);

  const handleHoverItem = useCallback((itemId: string | null) => {
    setInventoryHoveredId(itemId);
  }, []);

  useEffect(() => {
    if (!inventoryOpen) {
      clearRollTimers();
      setLootboxResult(null);
      setLootboxRolling(false);
      setInventoryHoveredId(null);
      setInventorySelectedId(null);
    }
  }, [clearRollTimers, inventoryOpen]);

  useEffect(() => clearRollTimers, [clearRollTimers]);

  return {
    inventoryOpen,
    openInventory,
    closeInventory,
    inventory,
    inventoryCapacity,
    inventoryFull,
    canRollDailyLoot,
    streak,
    equippedItems,
    previewItem,
    previewSlotLabel,
    previewStats,
    totalBonusEntries,
    lootboxResult,
    lootboxRolling,
    itemStatMeta: ITEM_STAT_META,
    isOfflineMode,
    previewItemId,
    handleEquipItem,
    handleUnequipItem,
    handleLootboxRoll,
    handleCloseLootboxResult,
    handleSelectItem,
    handleHoverItem,
    onClose: closeInventory,
    onEquip: handleEquipItem,
    onUnequip: handleUnequipItem,
    onLootboxRoll: handleLootboxRoll,
    onCloseLootboxResult: handleCloseLootboxResult,
    onSelectItem: handleSelectItem,
    onHoverItem: handleHoverItem,
  };
};
