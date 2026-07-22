import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getInventoryItems } from '../../utils/equipmentUtils';
import { getEssenceYield } from '../../utils/forgeUtils';
import { ESSENCE_SOFT_CAP, ESSENCE_HARD_CAP } from '../../data/forgeConstants';
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
  const [essenceBump, setEssenceBump] = useState(false);
  const prevEssenceRef = useRef(essence);
  const [confirmItem, setConfirmItem] = useState<PixelItemAsset | null>(null);
  const [confirmBulk, setConfirmBulk] = useState<{ rarity: ItemRarity; items: PixelItemAsset[] } | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const inventoryItems = useMemo(() => {
    if (!activeCharacter) return [];
    return getInventoryItems(activeCharacter);
  }, [activeCharacter]);

  const grouped = useMemo(() => groupByRarity(inventoryItems), [inventoryItems]);

  const isNearSoftCap = essence >= ESSENCE_SOFT_CAP - 50 && essence < ESSENCE_SOFT_CAP;
  const isAtHardCap = essence >= ESSENCE_HARD_CAP;

  // Trigger count-up animation when essence increases
  useEffect(() => {
    if (essence > prevEssenceRef.current) {
      setEssenceBump(true);
      const timer = setTimeout(() => setEssenceBump(false), 600);
      prevEssenceRef.current = essence;
      return () => clearTimeout(timer);
    }
    prevEssenceRef.current = essence;
  }, [essence]);

  // Focus trap for confirmation dialog
  useEffect(() => {
    if ((confirmItem || confirmBulk) && confirmRef.current) {
      const firstButton = confirmRef.current.querySelector('button');
      firstButton?.focus();
    }
  }, [confirmItem, confirmBulk]);

  // Keyboard handler for confirmation dialog
  const handleConfirmKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmItem(null);
        setConfirmBulk(null);
      }
    },
    [],
  );

  const handleSalvageSingle = useCallback(
    async (itemId: string) => {
      if (salvaging.has(itemId) || !activeCharacter) return;

      setSalvaging((prev) => new Set(prev).add(itemId));
      setConfirmItem(null);

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

  const handleSalvageBulk = useCallback(
    async (rarity: ItemRarity) => {
      const items = grouped[rarity].filter((item) => !salvagedIds.has(item.id));
      if (items.length === 0 || !activeCharacter) return;

      const itemIds = items.map((i) => i.id);
      const totalYield = items.reduce((sum, item) => sum + getEssenceYield(item), 0);

      // Salvage each item sequentially
      setConfirmBulk(null);
      for (const itemId of itemIds) {
        if (salvaging.has(itemId)) continue;
        setSalvaging((prev) => new Set(prev).add(itemId));

        try {
          const result = await salvageItems(itemId);
          if (result) {
            setSalvagedIds((prev) => new Set(prev).add(itemId));
          }
        } catch {
          notify(`Failed to salvage ${items.find((i) => i.id === itemId)?.name}.`, 'error', 3000);
        } finally {
          setSalvaging((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }
      }

      notify(`Salvaged ${items.length} items → ${totalYield} Essence`, 'success', 3000);
    },
    [activeCharacter, grouped, notify, salvageItems, salvaging, salvagedIds],
  );

  const handleRequestSalvage = useCallback((item: PixelItemAsset) => {
    setConfirmItem(item);
    setConfirmBulk(null);
  }, []);

  const handleRequestBulk = useCallback((rarity: ItemRarity, items: PixelItemAsset[]) => {
    setConfirmBulk({ rarity, items });
    setConfirmItem(null);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setConfirmItem(null);
    setConfirmBulk(null);
  }, []);

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
          <span className={`forge-essence-value ${essenceBump ? 'forge-essence-count-up' : ''}`}>{essence.toFixed(2)}</span>
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
        <span className={`forge-essence-value ${essenceBump ? 'forge-essence-count-up' : ''}`}>{essence.toFixed(2)}</span>
      </div>
      {isAtHardCap && (
        <div className="forge-essence-warning forge-essence-hard-cap">
          🔴 Essence au maximum! ({ESSENCE_HARD_CAP}/{ESSENCE_HARD_CAP})
        </div>
      )}
      {isNearSoftCap && !isAtHardCap && (
        <div className="forge-essence-warning">
          ⚠ Essence near cap ({ESSENCE_SOFT_CAP}) — excess will be lost
        </div>
      )}

      <div className="forge-panel-sections">
        {RARITY_ORDER.map((rarity) => {
          const items = grouped[rarity];
          if (items.length === 0) return null;

          const allSalvaged = isRarityAllSalvaged(rarity);
          const unsalvagedCount = items.filter((item) => !salvagedIds.has(item.id)).length;

          return (
            <div
              key={rarity}
              className={`forge-rarity-group forge-rarity-${rarity} ${allSalvaged ? 'salvaged' : ''}`}
            >
              <div className="forge-rarity-header">
                <span className="forge-rarity-label">{RARITY_LABELS[rarity]}</span>
                <span className="forge-item-sub">{items.length} ITEM(S)</span>
                {unsalvagedCount > 1 && !allSalvaged && (
                  <button
                    className="forge-bulk-btn"
                    onClick={() => handleRequestBulk(rarity, items)}
                    disabled={salvaging.size > 0}
                    aria-label={`Salvage all ${rarity} items`}
                    title={`Salvage all ${unsalvagedCount} ${rarity} items for ${items
                      .filter((i) => !salvagedIds.has(i.id))
                      .reduce((sum, i) => sum + getEssenceYield(i), 0)} Essence`}
                  >
                    SALVAGE ALL
                  </button>
                )}
              </div>
              <div className="forge-rarity-grid">
                {items.map((item) => {
                  const isSalvaged = salvagedIds.has(item.id);
                  const isLoading = salvaging.has(item.id);

                  return (
                    <button
                      key={item.id}
                      className={`forge-item-card ${isSalvaged ? 'salvaged-item' : ''} ${isLoading ? 'forge-anim-break' : ''}`}
                      onClick={() => handleRequestSalvage(item)}
                      disabled={isSalvaged || isLoading || salvaging.size > 0}
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

      {/* ─── Confirmation Dialog ────────────────────────────────────────────── */}
      {(confirmItem || confirmBulk) && (
        <div
          className="forge-confirm-overlay"
          onClick={handleCancelConfirm}
          onKeyDown={handleConfirmKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm salvage"
        >
          <div
            className="forge-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            ref={confirmRef}
          >
            {confirmItem && (
              <>
                <div className="forge-confirm-title">SALVAGE ITEM?</div>
                <div className="forge-confirm-item">
                  <span className="forge-confirm-item-name">{confirmItem.name}</span>
                  <span className="forge-confirm-item-rarity">{confirmItem.rarity.toUpperCase()}</span>
                </div>
                <div className="forge-confirm-yield">
                  +{getEssenceYield(confirmItem)} Essence
                </div>
                <div className="forge-confirm-warning">This cannot be undone!</div>
                <div className="forge-confirm-actions">
                  <button
                    className="forge-confirm-cancel"
                    onClick={handleCancelConfirm}
                    aria-label="Cancel salvage"
                  >
                    CANCEL
                  </button>
                  <button
                    className="forge-confirm-ok"
                    onClick={() => handleSalvageSingle(confirmItem.id)}
                    aria-label="Confirm salvage"
                  >
                    SALVAGE
                  </button>
                </div>
              </>
            )}
            {confirmBulk && (
              <>
                <div className="forge-confirm-title">SALVAGE ALL {confirmBulk.rarity.toUpperCase()}?</div>
                <div className="forge-confirm-item">
                  <span className="forge-confirm-item-name">
                    {confirmBulk.items.length} items
                  </span>
                  <span className="forge-confirm-item-rarity">{confirmBulk.rarity.toUpperCase()}</span>
                </div>
                <div className="forge-confirm-yield">
                  +{confirmBulk.items.reduce((sum, item) => sum + getEssenceYield(item), 0)} Essence
                </div>
                <div className="forge-confirm-warning">This cannot be undone!</div>
                <div className="forge-confirm-actions">
                  <button
                    className="forge-confirm-cancel"
                    onClick={handleCancelConfirm}
                    aria-label="Cancel bulk salvage"
                  >
                    CANCEL
                  </button>
                  <button
                    className="forge-confirm-ok"
                    onClick={() => handleSalvageBulk(confirmBulk.rarity)}
                    aria-label="Confirm bulk salvage"
                  >
                    SALVAGE ALL
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
