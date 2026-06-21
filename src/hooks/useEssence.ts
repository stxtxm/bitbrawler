import { useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { PixelItemAsset } from '../types/Item';

/**
 * Hook that provides essence balance and forge actions from GameContext.
 *
 * @returns Essence balance, add/spend actions, and forge operations.
 */
export const useEssence = () => {
  const {
    essence,
    addEssence,
    spendEssence,
    salvageItems,
    fuseItems,
    upgradeItem,
  } = useGame();

  const handleSalvage = useCallback(
    (itemId: string) => salvageItems(itemId),
    [salvageItems],
  );

  const handleFuse = useCallback(
    (items: PixelItemAsset[]) => fuseItems(items),
    [fuseItems],
  );

  const handleUpgrade = useCallback(
    (itemId: string) => upgradeItem(itemId),
    [upgradeItem],
  );

  return {
    essence,
    addEssence,
    spendEssence,
    salvageItem: handleSalvage,
    fuseItems: handleFuse,
    upgradeItem: handleUpgrade,
    hasEssence: (amount: number) => essence >= amount,
    canAfford: (amount: number) => essence >= amount,
  };
};
