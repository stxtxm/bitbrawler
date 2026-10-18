import { useCallback, useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import type { ItemSlot, PixelItemAsset } from '../types/Item';
import { getItemById } from '../utils/equipmentUtils';
import { PROGRESSION_GATES, isFeatureUnlocked } from '../config/progressionConfig';
import {
  buildEquipmentComparison,
  EQUIPMENT_SLOTS,
  getEquippedItemForSlot,
  type StatComparisonEntry,
} from '../utils/equipmentPresentation';

export type InventoryTab = 'inventory' | 'shop';

export type GroupedInventory = Record<ItemSlot, PixelItemAsset[]>;

interface UseInventoryPanelOptions {
  inventory: string[];
  equippedItems: PixelItemAsset[];
  previewItem: PixelItemAsset | null;
}

interface UseInventoryPanelResult {
  activeTab: InventoryTab;
  handleTabChange: (tab: InventoryTab) => void;
  shopUnlocked: boolean;
  groupedItems: GroupedInventory;
  equippedForPreviewSlot: PixelItemAsset | null;
  comparison: StatComparisonEntry[];
}

export function useInventoryPanel({
  inventory,
  equippedItems,
  previewItem,
}: UseInventoryPanelOptions): UseInventoryPanelResult {
  const [activeTab, setActiveTab] = useState<InventoryTab>('inventory');
  const { activeCharacter } = useGame();
  const level = activeCharacter?.level ?? 1;
  const shopUnlocked = isFeatureUnlocked(level, PROGRESSION_GATES.SHOP_UNLOCK_LEVEL);

  const groupedItems = useMemo<GroupedInventory>(() => {
    const bySlot = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot, [] as PixelItemAsset[]]),
    ) as GroupedInventory;

    inventory.forEach((id) => {
      const item = getItemById(id);
      if (item) bySlot[item.slot].push(item);
    });

    return bySlot;
  }, [inventory]);

  const handleTabChange = useCallback(
    (tab: InventoryTab) => {
      if (tab === 'shop' && !shopUnlocked) return;
      setActiveTab(tab);
    },
    [shopUnlocked],
  );

  const equippedForPreviewSlot = useMemo(
    () => (previewItem ? getEquippedItemForSlot(equippedItems, previewItem.slot) : null),
    [equippedItems, previewItem],
  );

  const comparison = useMemo(
    () => buildEquipmentComparison(previewItem, equippedForPreviewSlot),
    [previewItem, equippedForPreviewSlot],
  );

  return {
    activeTab,
    handleTabChange,
    shopUnlocked,
    groupedItems,
    equippedForPreviewSlot,
    comparison,
  };
}
