import { memo, useCallback, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getInventoryItems } from '../../utils/equipmentUtils';
import { getEssenceYield } from '../../utils/forgeUtils';
import { ESSENCE_SOFT_CAP } from '../../data/forgeConstants';
import type { PixelItemAsset, ItemRarity } from '../../types/Item';
import '../../styles/components/_forge.scss';

interface SalvagePanelProps {
  onClose: () => void;
}

const RARITY_ORDER: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_LABELS: Record<ItemRarity, string> = {
  common: 'COMMON',
  uncommon: 'UNCOMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

type GroupedItems = Record<ItemRarity, PixelItemAsset[]>;

function groupByRarity(items: PixelItemAsset[]): GroupedItems {
  const groups: GroupedItems = {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: [],
  };
  for (const item of items) {
    groups[item.rarity].push(item);
  }
  return groups;
}

export const SalvagePanel = memo(function SalvagePanel({ onClose }: SalvagePanelProps) {
  const { activeCharacter, salvageItems, essence } = useGame();
  const { notify } = useNotification();
  const [salvaging, setSalvaging] = useState<Set<string>>(new Set());
  const [salvagedIds, setSalvagedIds] = useState<Set<string>>(new Set());

  const inventoryItems = useMemo(() => {
    if (!activeCharacter) return [];
    return getInventoryItems(activeCharacter);
  }, [activeCharacter]);

  const grouped = useMemo(() => groupByRarity(inventoryItems), [inventoryItems]);

  const isNearSoftCap = essence >= ESSENCE_SOFT_CAP - 50 && essence < ESSENCE_SOFT_CAP;

  const handleSalvage = useCallback(
    async (itemId: string) => {
      if (salvaging.has(itemId) || !activeCharacter) return;

      setSalvaging((prev) => new Set(prev).add(itemId));

      try {
        const result = await salvageItems(itemId);
        if (result) {
          const item = inventoryItems.find((i) => i.id === itemId);
          const yieldAmount = item ? getEssenceYield(item) : 0;
          notify(`Salvaged 1 item → ${yieldAmount} Essence`, 'success', 3000);
          setSalvagedIds((prev) => new Set(prev).add(itemId));
        }
      } catch {
        notify('Failed to salvage item. Try again.', 'error', 3000);
      } finally {
        setSalvaging((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    },
    [activeCharacter, inventoryItems, notify, salvageItems, salvaging],
  );

  const isRarityAllSalvaged = useCallback(
    (rarity: ItemRarity) => {
      const items = grouped[rarity];
      return items.length > 0 && items.every((item) => salvagedIds.has(item.id));
    },
    [grouped, salvagedIds],
  );

  if (!activeCharacter) {
    return null;
  }

  // Empty inventory
  if (inventoryItems.length === 0) {
    return (
      <div className="forge-panel">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div className="forge-panel-title">SALVAGE</div>
          <button className="forge-close-btn" onClick={onClose} aria-label="Close salvage panel">
            ×
          </button>
        </div>
        <div className="forge-essence-bar">
          <span className="forge-essence-label">ESSENCE</span>
          <span className="forge-essence-value">{essence}</span>
        </div>
        <div className="forge-empty-state">
          <div className="forge-empty-text">
            No items to salvage.
            <br />
            Open the daily lootbox to get items!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-panel">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div className="forge-panel-title">SALVAGE</div>
        <button className="forge-close-btn" onClick={onClose} aria-label="Close salvage panel">
          ×
        </button>
      </div>

      <div className="forge-panel-subtitle">Break down items into Essence</div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">CURRENT ESSENCE</span>
        <span className="forge-essence-value">{essence}</span>
      </div>

      {isNearSoftCap && (
        <div className="forge-essence-warning">
          ⚠ Essence near cap ({ESSENCE_SOFT_CAP}) — excess will be lost
        </div>
      )}

      <div className="forge-panel-sections">
        {RARITY_ORDER.map((rarity) => {
          const items = grouped[rarity];
          if (items.length === 0) return null;

          const allSalvaged = isRarityAllSalvaged(rarity);

          return (
            <div
              key={rarity}
              className={`forge-rarity-group forge-rarity-${rarity} ${allSalvaged ? 'salvaged' : ''}`}
            >
              <div className="forge-rarity-header">
                <span className="forge-rarity-label">{RARITY_LABELS[rarity]}</span>
                <span className="forge-item-sub">{items.length} ITEM(S)</span>
              </div>
              <div className="forge-rarity-grid">
                {items.map((item) => {
                  const isSalvaged = salvagedIds.has(item.id);
                  const isLoading = salvaging.has(item.id);

                  return (
                    <button
                      key={item.id}
                      className={`forge-item-card ${isSalvaged ? 'salvaged-item' : ''} ${isLoading ? 'forge-anim-dissolve' : ''}`}
                      onClick={() => handleSalvage(item.id)}
                      disabled={isSalvaged || isLoading}
                      aria-label={`Salvage ${item.name}`}
                      title={`${item.name} — yields ${getEssenceYield(item)} Essence`}
                    >
                      <span className="forge-item-name">{item.name}</span>
                      <span className="forge-item-sub">{item.slot.toUpperCase()}</span>
                      <span className="forge-item-yield">+{getEssenceYield(item)} Essence</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
