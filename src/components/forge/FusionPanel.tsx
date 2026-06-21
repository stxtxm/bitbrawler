import { memo, useCallback, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getInventoryItems } from '../../utils/equipmentUtils';
import { canFuse } from '../../utils/forgeUtils';
import { FUSION_COST, FUSION_INPUT_COUNT } from '../../data/forgeConstants';
import { RARITY_RANK } from '../../utils/lootboxUtils';
import type { PixelItemAsset, ItemRarity } from '../../types/Item';
import '../../styles/components/_forge.scss';

interface FusionPanelProps {
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

export const FusionPanel = memo(function FusionPanel({ onClose }: FusionPanelProps) {
  const { activeCharacter, essence, fuseItems } = useGame();
  const { notify } = useNotification();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fusing, setFusing] = useState(false);
  const [showResult, setShowResult] = useState<PixelItemAsset | null>(null);
  const [luckyProc, setLuckyProc] = useState(false);

  const inventoryItems = useMemo(() => {
    if (!activeCharacter) return [];
    return getInventoryItems(activeCharacter);
  }, [activeCharacter]);

  const grouped = useMemo(() => groupByRarity(inventoryItems), [inventoryItems]);

  const selectedItems = useMemo(() => {
    return inventoryItems.filter((item) => selectedIds.has(item.id));
  }, [inventoryItems, selectedIds]);

  const selectedRarity = useMemo(() => {
    if (selectedItems.length !== FUSION_INPUT_COUNT) return null;
    const firstRarity = selectedItems[0].rarity;
    if (selectedItems.every((item) => item.rarity === firstRarity)) {
      return firstRarity;
    }
    return null;
  }, [selectedItems]);

  const canPerformFusion = useMemo(() => {
    const char = activeCharacter;
    if (!char || selectedItems.length !== FUSION_INPUT_COUNT) return false;
    return canFuse(selectedItems, char);
  }, [activeCharacter, selectedItems]);

  const fusionCost = useMemo(() => {
    if (!selectedRarity) return 0;
    return FUSION_COST[selectedRarity];
  }, [selectedRarity]);

  const insufficientEssence = useMemo(() => {
    if (!selectedRarity) return false;
    const cost = FUSION_COST[selectedRarity];
    return essence < cost;
  }, [selectedRarity, essence]);

  const nextRarityRank = selectedRarity ? (RARITY_RANK[selectedRarity] ?? 0) + 1 : null;
  const nextRarity = useMemo(() => {
    if (nextRarityRank === null) return null;
    const entries = Object.entries(RARITY_RANK) as [ItemRarity, number][];
    for (const [rarity, rank] of entries) {
      if (rank === nextRarityRank) return rarity;
    }
    return null;
  }, [nextRarityRank]);

  const handleToggleItem = useCallback(
    (itemId: string) => {
      if (fusing) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else if (next.size < FUSION_INPUT_COUNT) {
          // When adding, ensure all items share the same rarity
          if (next.size === 0) {
            next.add(itemId);
          } else {
            const firstItem = inventoryItems.find((i) => next.values().next().value === i.id);
            const newItem = inventoryItems.find((i) => i.id === itemId);
            if (firstItem && newItem && firstItem.rarity === newItem.rarity) {
              next.add(itemId);
            } else {
              // Reset selection and start fresh with this item
              return new Set([itemId]);
            }
          }
        }
        return next;
      });
    },
    [fusing, inventoryItems],
  );

  const handleFusion = useCallback(async () => {
    if (!canPerformFusion || fusing || !activeCharacter) return;

    setFusing(true);
    setShowResult(null);

    try {
      const { result, updatedChar } = await fuseItems(selectedItems);

      if (!updatedChar || !result) {
        // Check if inventory was full
        const inventoryItemsCount = activeCharacter.inventory?.length ?? 0;
        if (inventoryItemsCount >= 20) {
          notify('Inventory full! Free up space before fusing.', 'error', 4000);
        } else {
          notify('Fusion failed — no matching result item available.', 'error', 4000);
        }
        setFusing(false);
        return;
      }

      // Check if lucky proc (result is 2 tiers higher than input)
      const inputRank = RARITY_RANK[selectedItems[0].rarity];
      const resultRank = RARITY_RANK[result.rarity];
      const isLucky = resultRank > inputRank + 1;

      setLuckyProc(isLucky);
      setShowResult(result);

      if (isLucky) {
        notify(`✨ Lucky Fusion! ${selectedItems[0].name} → ${result.name}!`, 'success', 4000);
      } else {
        notify(`Fusion successful! ${selectedItems[0].name} → ${result.name}!`, 'success', 3000);
      }

      // Clear selection after animation
      setTimeout(() => {
        setSelectedIds(new Set());
        setShowResult(null);
        setLuckyProc(false);
        setFusing(false);
      }, 1500);
    } catch {
      notify('Fusion failed due to connection error.', 'error', 3000);
      setFusing(false);
    }
  }, [activeCharacter, canPerformFusion, fuseItems, fusing, notify, selectedItems]);

  if (!activeCharacter) {
    return null;
  }

  // Check if any rarity has at least 3 items
  const hasAnyFusionable = Object.values(grouped).some((items) => items.length >= FUSION_INPUT_COUNT);

  return (
    <div className="forge-panel" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div className="forge-panel-title">FUSION</div>
        <button className="forge-close-btn" onClick={onClose} aria-label="Close fusion panel">
          ×
        </button>
      </div>

      <div className="forge-panel-subtitle">Combine 3 items of the same rarity into a higher-tier item</div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">ESSENCE</span>
        <span className="forge-essence-value">{essence}</span>
      </div>

      {!hasAnyFusionable && (
        <div className="forge-empty-state">
          <div className="forge-empty-text">
            Not enough items to fuse.
            <br />
            You need at least 3 items of the same rarity.
          </div>
        </div>
      )}

      {hasAnyFusionable && (
        <>
          <div className="forge-selection-hint">
            Select {FUSION_INPUT_COUNT} items of the same rarity ({selectedIds.size}/{FUSION_INPUT_COUNT} selected)
          </div>

          <div className="forge-panel-sections">
            {RARITY_ORDER.map((rarity) => {
              const items = grouped[rarity];
              if (items.length < FUSION_INPUT_COUNT) return null;

              // Skip legendary — can't fuse legendary items
              if (rarity === 'legendary') return null;

              return (
                <div key={rarity} className={`forge-rarity-group forge-rarity-${rarity}`}>
                  <div className="forge-rarity-header">
                    <span className="forge-rarity-label">{RARITY_LABELS[rarity]}</span>
                    <span className="forge-item-sub">{items.length} ITEM(S)</span>
                  </div>
                  <div className="forge-rarity-grid">
                    {items.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const selectIndex = isSelected
                        ? [...selectedIds].indexOf(item.id) + 1
                        : 0;

                      return (
                        <button
                          key={item.id}
                          className={`forge-item-card ${isSelected ? 'selected' : ''} ${fusing ? 'disabled' : ''}`}
                          onClick={() => handleToggleItem(item.id)}
                          disabled={fusing}
                          aria-label={`Toggle ${item.name} for fusion`}
                        >
                          {isSelected && selectIndex > 0 && (
                            <span className="forge-count-badge">{selectIndex}</span>
                          )}
                          <span className="forge-item-name">{item.name}</span>
                          <span className="forge-item-sub">{item.slot.toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedItems.length === FUSION_INPUT_COUNT && selectedRarity && (
            <div className="forge-fusion-preview">
              <span className="forge-item-name">{selectedItems[0].rarity.toUpperCase()} ITEMS</span>
              <span className="forge-fusion-arrow">→</span>
              <div className="forge-fusion-result">
                <span className="forge-fusion-result-label">RESULT</span>
                <span className="forge-item-name">
                  {nextRarity ? nextRarity.toUpperCase() : '???'}
                </span>
              </div>
            </div>
          )}

          <div className="forge-action-bar">
            <div className="forge-action-info">
              <span className="forge-action-label">
                {selectedRarity
                  ? `Fusion Cost: ${fusionCost} Essence`
                  : `Select ${FUSION_INPUT_COUNT} items of the same rarity`}
              </span>
              {insufficientEssence && selectedRarity && (
                <span className="forge-essence-warning" style={{ fontSize: '0.45rem', margin: 0, textAlign: 'left' }}>
                  Not enough essence! Need {fusionCost}, have {essence}.
                </span>
              )}
            </div>
            <button
              className={`forge-action-btn ${!canPerformFusion ? '' : ''}`}
              onClick={handleFusion}
              disabled={!canPerformFusion || fusing || insufficientEssence}
              aria-label="Fuse items"
            >
              {fusing ? 'FUSING...' : 'FUSE'}
            </button>
          </div>
        </>
      )}

      {/* Result overlay */}
      {showResult && (
        <div className="forge-result-overlay" onClick={() => {}}>
          <div className={`forge-result-card ${fusing ? 'forge-anim-swirl' : ''}`}>
            <div className={`forge-result-rarity ${showResult.rarity}`}>
              {luckyProc ? '✨ LUCKY FUSION! ✨' : 'FUSION SUCCESS!'}
            </div>
            <div className="forge-result-name">{showResult.name}</div>
            <div className="forge-result-rarity">{showResult.rarity.toUpperCase()}</div>
            <div className="forge-result-hint">✦</div>
          </div>
        </div>
      )}
    </div>
  );
});
