import { memo, useMemo, useState } from 'react';
import { ItemSlot, PixelItemAsset } from '../../types/Item';
import { getItemById } from '../../utils/equipmentUtils';
import { getItemStatEntries } from '../../hooks/useInventory';
import { ESSENCE_YIELD } from '../../data/forgeConstants';
import { AffinityBadge } from '../AffinityBadge';
import { PixelIcon } from '../PixelIcon';
import { PixelItemIcon } from '../PixelItemIcon';
import StreakIndicator from '../StreakIndicator';
import { ShopPanel } from '../forge/ShopPanel';
import { useGame } from '../../context/GameContext';
import { PROGRESSION_GATES, isFeatureUnlocked } from '../../config/progressionConfig';
import type {
  InventoryStatEntry,
  InventoryStatMetaMap,
} from './arenaTypes';

interface InventoryPanelProps {
  inventory: string[];
  inventoryCapacity: number;
  equippedItems: PixelItemAsset[];
  previewItem: PixelItemAsset | null;
  previewSlotLabel: string;
  previewStats: InventoryStatEntry[];
  totalBonusEntries: InventoryStatEntry[];
  lootboxResult: PixelItemAsset | null;
  lootboxRolling: boolean;
  canRollDailyLoot: boolean;
  inventoryFull: boolean;
  streak: number;
  itemStatMeta: InventoryStatMetaMap;
  isOfflineMode: boolean;
  onClose: () => void;
  onEquip: (itemId: string, slot: ItemSlot) => void;
  onUnequip: (slot: ItemSlot) => void;
  onLootboxRoll: () => void;
  onCloseLootboxResult: () => void;
  onSelectItem: (itemId: string) => void;
  onHoverItem: (id: string | null) => void;
  previewItemId: string | null;
  pityCount?: number;
  // Forge integration
  itemUpgradeLevels?: Record<string, number>;
  onSalvage?: (itemId: string) => void;
  essence?: number;
}

const ITEM_SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory'];

const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: '⚔️ WEAPONS',
  armor: '🛡️ ARMOR',
  accessory: '💍 ACCESSORIES',
};

const SLOT_ICONS: Record<ItemSlot, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
};

export const InventoryPanel = memo(function InventoryPanel({
  inventory,
  inventoryCapacity,
  equippedItems,
  previewItem,
  previewSlotLabel,
  previewStats,
  totalBonusEntries,
  lootboxResult,
  lootboxRolling,
  canRollDailyLoot,
  inventoryFull,
  streak,
  itemStatMeta,
  isOfflineMode,
  onClose,
  onEquip,
  onUnequip,
  onLootboxRoll,
  onCloseLootboxResult,
  onSelectItem,
  onHoverItem,
  previewItemId,
  pityCount = 0,
  itemUpgradeLevels = {},
  onSalvage,
  essence = 0,
}: InventoryPanelProps) {
  const groupedItems = useMemo(() => {
    const bySlot: Record<ItemSlot, PixelItemAsset[]> = {
      weapon: [],
      armor: [],
      accessory: [],
    };

    inventory.forEach((id) => {
      const item = getItemById(id);
      if (item) bySlot[item.slot].push(item);
    });

    return bySlot;
  }, [inventory]);

  const lootboxStats = useMemo(() => getItemStatEntries(lootboxResult), [lootboxResult]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'shop'>('inventory');

  const { activeCharacter } = useGame();
  const level = activeCharacter?.level ?? 1;
  const shopUnlocked = isFeatureUnlocked(level, PROGRESSION_GATES.SHOP_UNLOCK_LEVEL);

  const handleTabChange = useMemo(() => (tab: 'inventory' | 'shop') => {
    if (tab === 'shop' && !shopUnlocked) return;
    setActiveTab(tab);
  }, [shopUnlocked]);

  return (
    <div className="retro-modal-overlay inventory-overlay" onClick={onClose}>
      <div
        className={`retro-modal inventory-modal ${lootboxRolling ? 'lootbox-active' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="inventory-header">
          <h2 className="inventory-title">INVENTORY</h2>
          <button className="inventory-close" onClick={onClose} aria-label="Close inventory">
            ×
          </button>
        </div>

        <div className="inventory-roll">
          <button
            className="button lootbox-btn"
            onClick={onLootboxRoll}
            disabled={lootboxRolling || !canRollDailyLoot || inventoryFull || isOfflineMode}
            aria-label="Daily lootbox roll"
          >
            <PixelIcon type="chest" size={18} />
            <span>
              {lootboxRolling
                ? 'OPENING...'
                : inventoryFull
                  ? 'INVENTORY FULL'
                  : canRollDailyLoot
                    ? 'DAILY LOOTBOX'
                    : 'COME BACK TOMORROW'}
            </span>
          </button>
          <div className="lootbox-status">
            <span>{inventory.length}/{inventoryCapacity} SLOTS</span>
            {pityCount > 0 && canRollDailyLoot && (
              <span className="lootbox-pity-counter" title="Consecutive lootboxes without a legendary">
                🎯 {pityCount}/{75}
              </span>
            )}
          </div>
          <StreakIndicator streak={streak} canRoll={canRollDailyLoot} />
        </div>

        <div className="inventory-tabs">
          <button
            className={`inventory-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
            role="tab"
            aria-selected={activeTab === 'inventory'}
          >
            🎒 INVENTORY
          </button>
          <button
            className={`inventory-tab ${!shopUnlocked ? 'locked' : ''} ${activeTab === 'shop' ? 'active' : ''}`}
            onClick={() => handleTabChange('shop')}
            role="tab"
            aria-selected={activeTab === 'shop'}
            disabled={!shopUnlocked}
            title={shopUnlocked ? 'Shop' : `Unlocks at LVL ${PROGRESSION_GATES.SHOP_UNLOCK_LEVEL}`}
          >
            {shopUnlocked ? '🏪 SHOP' : `🔒 SHOP LVL ${PROGRESSION_GATES.SHOP_UNLOCK_LEVEL}`}
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <div className="inventory-body">
            <div className="inv-loadout">
              <div className="inv-loadout-label">EQUIPPED</div>
              <div className="inv-loadout-slots">
                {ITEM_SLOTS.map((slot) => {
                  const item = equippedItems.find((equipped) => equipped.slot === slot);
                  return (
                    <div key={slot} className={`inv-loadout-slot ${item ? 'filled' : 'empty'}`}>
                      <span className="inv-loadout-slot-icon">{SLOT_ICONS[slot]}</span>
                      {item ? (
                        <div className="inv-loadout-item">
                          <PixelItemIcon pixels={item.pixels} size={22} />
                          {item.element && <AffinityBadge element={item.element} size={10} />}
                          <div className="inv-loadout-item-name">{item.name}</div>
                          <button
                            className="inv-unequip-btn"
                            onClick={() => onUnequip(slot)}
                            title="Unequip"
                            aria-label={`Unequip ${item.name}`}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="inv-loadout-empty">EMPTY</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="inv-body-content">
              <div className="inv-groups">
                {ITEM_SLOTS.map((slot) => {
                  const slotItems = groupedItems[slot];
                  if (slotItems.length === 0) return null;

                  return (
                    <div key={slot} className="inv-group">
                      <div className="inv-group-label">{SLOT_LABELS[slot]}</div>
                      <div className="inv-group-grid">
                        {slotItems.map((item) => {
                          const isSelected = previewItemId === item.id;
                          return (
                            <button
                              key={item.id}
                              className={`inv-group-item rarity-${item.rarity} ${isSelected ? 'selected' : ''} ${(itemUpgradeLevels[item.id] ?? 0) > 0 ? `upgraded upgraded-level-${Math.min(itemUpgradeLevels[item.id] ?? 0, 5)}` : ''}`}
                              onClick={() => {
                                onEquip(item.id, slot);
                                onSelectItem(item.id);
                              }}
                              onMouseEnter={() => onHoverItem(item.id)}
                              onMouseLeave={() => onHoverItem(null)}
                              onFocus={() => onHoverItem(item.id)}
                              onBlur={() => onHoverItem(null)}
                              onTouchStart={() => onSelectItem(item.id)}
                              title={`Equip ${item.name}${(itemUpgradeLevels[item.id] ?? 0) > 0 ? ` (+${itemUpgradeLevels[item.id]})` : ''}`}
                              aria-label={`Equip ${item.name}`}
                            >
                              <PixelItemIcon pixels={item.pixels} size={22} />
                              {item.element && <AffinityBadge element={item.element} size={8} />}
                              {(itemUpgradeLevels[item.id] ?? 0) > 0 && (
                                <span className="inv-upgrade-badge">+{itemUpgradeLevels[item.id]}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {inventory.length === 0 && (
                  <div className="inv-empty">No items in inventory. Open the daily lootbox!</div>
                )}
              </div>

              <div className={`inventory-details ${previewItem ? '' : 'empty'}`}>
                {previewItem ? (
                  <>
                    <div className={`inventory-item-head rarity-${previewItem.rarity}`}>
                      <PixelItemIcon pixels={previewItem.pixels} size={30} />
                      <div className="inventory-item-meta">
                        <div className="inventory-item-name">{previewItem.name}</div>
                        <div className="inventory-item-sub">
                          <span className="inventory-item-slot">{previewSlotLabel}</span>
                          <span className="inventory-item-rarity">{previewItem.rarity.toUpperCase()}</span>
                          {(itemUpgradeLevels[previewItem.id] ?? 0) > 0 && (
                            <span className="inventory-item-upgrade">+{itemUpgradeLevels[previewItem.id]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="inventory-item-stats">
                      {previewStats.map(({ key, value }) => {
                        const meta = itemStatMeta[key];
                        return (
                          <div key={key} className="inventory-stat-row">
                            <span className="inventory-stat-icon">
                              <PixelIcon type={meta.icon} size={12} />
                            </span>
                            <span className="inventory-stat-label">{meta.label}</span>
                            <span className="inventory-stat-value">+{value}</span>
                          </div>
                        );
                      })}
                    </div>
                    {onSalvage && (
                      <div className="inventory-forge-actions">
                        <div className="inventory-essence-yield">
                          <span className="essence-yield-label">SALVAGE YIELD</span>
                          <span className="essence-yield-value">+{ESSENCE_YIELD[previewItem.rarity]} Essence</span>
                        </div>
                        <button
                          className="forge-action-btn danger"
                          onClick={() => onSalvage(previewItem.id)}
                          aria-label={`Salvage ${previewItem.name} for ${ESSENCE_YIELD[previewItem.rarity]} essence`}
                        >
                          SALVAGE
                        </button>
                      </div>
                    )}
                    {essence > 0 && (
                      <div className="inventory-essence-total">
                        <span className="essence-total-label">ESSENCE</span>
                        <span className="essence-total-value">{essence.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="inventory-empty-details">TAP AN ITEM TO VIEW BONUSES</div>
                )}

                {totalBonusEntries.length > 0 && (
                  <div className="inventory-bonus-summary">
                    <div className="bonus-title">TOTAL BONUS</div>
                    <div className="bonus-list">
                      {totalBonusEntries.map(({ key, value }) => {
                        const meta = itemStatMeta[key];
                        return (
                          <div key={key} className="bonus-chip">
                            <PixelIcon type={meta.icon} size={10} />
                            <span className="bonus-label">{meta.label}</span>
                            <span className="bonus-value">+{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : shopUnlocked ? (
          <div className="inventory-shop-tab">
            <ShopPanel onClose={onClose} />
          </div>
        ) : (
          <div className="inventory-shop-tab inventory-shop-locked">
            <div className="shop-locked-message">
              <span className="shop-locked-icon">🔒</span>
              <p className="shop-locked-text">Shop unlocks at LVL {PROGRESSION_GATES.SHOP_UNLOCK_LEVEL}</p>
              <p className="shop-locked-hint">Fight battles and level up to access the 8-Bit Emporium!</p>
            </div>
          </div>
        )}

        {lootboxResult && (
          <div
            className={`lootbox-result-overlay ${lootboxResult.rarity === 'legendary' ? 'lootbox-result-overlay-legendary' : ''}`}
            role="dialog"
            aria-label="Lootbox reward"
            onClick={onCloseLootboxResult}
          >
            <div className={`lootbox-result-card rarity-${lootboxResult.rarity} ${lootboxResult.rarity === 'epic' ? 'rare-reveal-epic' : ''} ${lootboxResult.rarity === 'legendary' ? 'rare-reveal-legendary' : ''}`} onClick={onCloseLootboxResult}>
              <div className="lootbox-result-glow" />
              <div className="lootbox-result-title">NEW ITEM</div>
              <div className="lootbox-result-item">
                <div className="lootbox-result-icon">
                  <PixelItemIcon pixels={lootboxResult.pixels} size={64} />
                </div>
                <div className="lootbox-result-meta">
                  <div className="lootbox-result-name">{lootboxResult.name}</div>
                  <div className="lootbox-result-rarity">{lootboxResult.rarity.toUpperCase()}</div>
                </div>
              </div>
              <div className="lootbox-result-stats">
                {lootboxStats.map(({ key, value }) => {
                  const meta = itemStatMeta[key];
                  return (
                    <div key={key} className="lootbox-result-stat">
                      <PixelIcon type={meta.icon} size={12} />
                      <span className="lootbox-stat-label">{meta.label}</span>
                      <span className="lootbox-stat-value">+{value}</span>
                    </div>
                  );
                })}
              </div>
              <div className="lootbox-result-hint">TAP TO CONTINUE</div>
            </div>
          </div>
        )}

        {lootboxRolling && (
          <div className="lootbox-overlay">
            <div className="lootbox-anim">
              <PixelIcon type="chest" size={46} />
              <div className="lootbox-text">OPENING...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
