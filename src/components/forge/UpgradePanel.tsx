import { memo, useCallback, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { getInventoryItems } from '../../utils/equipmentUtils';
import { canUpgrade } from '../../utils/forgeUtils';
import { UPGRADE_COST, MAX_UPGRADE_LEVEL, ESSENCE_SOFT_CAP } from '../../data/forgeConstants';
import '../../styles/components/_forge.scss';

interface UpgradePanelProps {
  onClose: () => void;
}

export const UpgradePanel = memo(function UpgradePanel({ onClose }: UpgradePanelProps) {
  const { activeCharacter, essence, upgradeItem } = useGame();
  const { notify } = useNotification();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [showGlow, setShowGlow] = useState(false);

  const inventoryItems = useMemo(() => {
    if (!activeCharacter) return [];
    return getInventoryItems(activeCharacter);
  }, [activeCharacter]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return inventoryItems.find((item) => item.id === selectedId) ?? null;
  }, [selectedId, inventoryItems]);

  const selectedUpgradeLevel = useMemo(() => {
    if (!selectedId || !activeCharacter) return 0;
    return activeCharacter.itemUpgrades?.[selectedId] ?? 0;
  }, [selectedId, activeCharacter]);

  const isMaxLevel = selectedUpgradeLevel >= MAX_UPGRADE_LEVEL;

  const canPerformUpgrade = useMemo(() => {
    if (!selectedId || !activeCharacter) return false;
    return canUpgrade(selectedId, activeCharacter);
  }, [activeCharacter, selectedId]);

  const insufficientEssence = essence < UPGRADE_COST;

  const isNearSoftCap = useMemo(() => {
    // For upgrade, we don't gain essence, but warn if they're near cap
    return essence >= ESSENCE_SOFT_CAP - 50 && essence < ESSENCE_SOFT_CAP;
  }, [essence]);

  const handleSelect = useCallback(
    (itemId: string) => {
      if (upgrading) return;
      setSelectedId((prev) => (prev === itemId ? null : itemId));
    },
    [upgrading],
  );

  const handleUpgrade = useCallback(async () => {
    if (!canPerformUpgrade || upgrading || !selectedId) return;

    setUpgrading(true);

    try {
      const result = await upgradeItem(selectedId);

      if (!result) {
        if (insufficientEssence) {
          notify('Not enough essence!', 'error', 3000);
        } else {
          notify('Upgrade failed. Try again.', 'error', 3000);
        }
        setUpgrading(false);
        return;
      }

      // Show glow animation
      setShowGlow(true);

      const newLevel = (result.itemUpgrades?.[selectedId] ?? 0);
      notify(`Upgrade success! ${selectedItem?.name} now +${newLevel}`, 'success', 3000);

      setTimeout(() => {
        setShowGlow(false);
        setUpgrading(false);
      }, 800);
    } catch {
      notify('Upgrade failed due to connection error.', 'error', 3000);
      setUpgrading(false);
    }
  }, [canPerformUpgrade, insufficientEssence, notify, selectedId, selectedItem, upgradeItem, upgrading]);

  if (!activeCharacter) {
    return null;
  }

  // Empty inventory
  if (inventoryItems.length === 0) {
    return (
      <div className="forge-panel">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div className="forge-panel-title">UPGRADE</div>
          <button className="forge-close-btn" onClick={onClose} aria-label="Close upgrade panel">
            ×
          </button>
        </div>
        <div className="forge-essence-bar">
          <span className="forge-essence-label">ESSENCE</span>
<span key={`essence-${essence}`} className="forge-essence-value forge-essence-animate">{essence}</span>
        </div>
        <div className="forge-empty-state">
          <div className="forge-empty-text">
            No items to upgrade.
            <br />
            Get items from the daily lootbox first!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-panel">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div className="forge-panel-title">UPGRADE</div>
        <button className="forge-close-btn" onClick={onClose} aria-label="Close upgrade panel">
          ×
        </button>
      </div>

      <div className="forge-panel-subtitle">Enhance an item&apos;s power with Essence</div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">ESSENCE</span>
        <span className="forge-essence-value">{essence}</span>
      </div>

      {isNearSoftCap && (
        <div className="forge-essence-warning">
          ⚠ Essence near cap ({ESSENCE_SOFT_CAP}) — spend some before upgrading
        </div>
      )}

      <div className="forge-selection-hint">
        Select an item to upgrade
      </div>

      {/* Inventory grid */}
      <div className="forge-rarity-grid">
        {inventoryItems.map((item) => {
          const isSelected = selectedId === item.id;
          const level = activeCharacter.itemUpgrades?.[item.id] ?? 0;
          const isMaxed = level >= MAX_UPGRADE_LEVEL;

          return (
            <button
              key={item.id}
              className={`forge-item-card forge-rarity-${item.rarity} ${isSelected ? 'selected' : ''} ${isMaxed ? 'maxed' : ''} ${upgrading ? 'disabled' : ''}`}
              onClick={() => handleSelect(item.id)}
              disabled={upgrading}
              aria-label={`Select ${item.name} for upgrade`}
            >
              <span className="forge-item-name">{item.name}</span>
              <span className="forge-item-sub">{item.slot.toUpperCase()}</span>
              <span className="forge-item-yield">
                {isMaxed ? 'MAX LEVEL' : `+${level}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected item details */}
      {selectedItem && (
        <div className={`forge-upgrade-details ${showGlow ? 'forge-anim-glow' : ''}`}>
          <div className="forge-upgrade-row">
            <span className="forge-upgrade-label">Item</span>
            <span className="forge-upgrade-value">{selectedItem.name}</span>
          </div>
          <div className="forge-upgrade-row">
            <span className="forge-upgrade-label">Level</span>
            <div className="forge-upgrade-level-bar">
              {Array.from({ length: MAX_UPGRADE_LEVEL + 1 }, (_, i) => (
                <div
                  key={i}
                  className={`forge-upgrade-dot ${
                    i < selectedUpgradeLevel ? 'filled' : ''
                  } ${i === selectedUpgradeLevel ? 'current' : ''}`}
                />
              ))}
            </div>
          </div>
          <div className="forge-upgrade-row">
            <span className="forge-upgrade-label">Current</span>
            <span className="forge-upgrade-value">
              +{selectedUpgradeLevel} / {MAX_UPGRADE_LEVEL}
            </span>
          </div>
          {!isMaxLevel && (
            <div className="forge-upgrade-row">
              <span className="forge-upgrade-label">Cost</span>
              <span className="forge-upgrade-value">{UPGRADE_COST} Essence</span>
            </div>
          )}
          {isMaxLevel && (
            <div className="forge-upgrade-row">
              <span className="forge-upgrade-label" style={{ color: '#ffcc00' }}>STATUS</span>
              <span className="forge-upgrade-value" style={{ color: '#ffcc00' }}>MAX LEVEL REACHED</span>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="forge-action-bar">
        <div className="forge-action-info">
          {selectedItem ? (
            isMaxLevel ? (
              <span className="forge-action-label">Item is already at maximum level</span>
            ) : insufficientEssence ? (
              <span className="forge-action-label" style={{ color: '#ff3333' }}>
                Not enough essence! Need {UPGRADE_COST}, have {essence}.
              </span>
            ) : (
              <span className="forge-action-label">
                Upgrade cost: {UPGRADE_COST} Essence
              </span>
            )
          ) : (
            <span className="forge-action-label">Select an item from above</span>
          )}
        </div>
        <button
          className="forge-action-btn"
          onClick={handleUpgrade}
          disabled={!canPerformUpgrade || upgrading}
          aria-label="Upgrade item"
        >
          {upgrading ? 'UPGRADING...' : isMaxLevel ? 'MAXED' : 'UPGRADE'}
        </button>
      </div>
    </div>
  );
});
