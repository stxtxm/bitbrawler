import { memo, useMemo } from 'react';
import { ItemSlot, PixelItemAsset } from '../../types/Item';
import { getItemStatEntries } from '../../hooks/useInventory';
import { useInventoryPanel } from '../../hooks/useInventoryPanel';
import { ESSENCE_YIELD } from '../../data/forgeConstants';
import { AffinityBadge } from '../AffinityBadge';
import { PixelIcon } from '../PixelIcon';
import { PixelItemIcon } from '../PixelItemIcon';
import StreakIndicator from '../StreakIndicator';
import { ShopPanel } from '../forge/ShopPanel';
import { PROGRESSION_GATES } from '../../config/progressionConfig';
import { LOOTBOX_PITY, PITY_THRESHOLD, getEpicBoostBonus, getEpicPityRemaining } from '../../utils/lootboxUtils';
import { EQUIPMENT_SLOTS, getRarityFrameClass } from '../../utils/equipmentPresentation';
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
  epicPityCount?: number;
  commonStreak?: number;
  pityTriggered?: boolean;
  inventoryFilterElement?: string | null;
  // Forge integration
  itemUpgradeLevels?: Record<string, number>;
  onSalvage?: (itemId: string) => void;
  essence?: number;
}

const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: '⚔️ WEAPONS',
  armor: '🛡️ ARMOR',
  accessory: '💍 ACCESSORIES',
};

const SLOT_SHORT_LABELS: Record<ItemSlot, string> = {
  weapon: 'WEAPON',
  armor: 'ARMOR',
  accessory: 'ACCESSORY',
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
  epicPityCount = 0,
  commonStreak = 0,
  pityTriggered = false,
  itemUpgradeLevels = {},
  onSalvage,
  essence = 0,
  inventoryFilterElement = null,
}: InventoryPanelProps) {
  const {
    activeTab,
    handleTabChange,
    shopUnlocked,
    groupedItems,
    equippedForPreviewSlot,
    comparison,
  } = useInventoryPanel({ inventory, equippedItems, previewItem });

  const lootboxStats = useMemo(() => getItemStatEntries(lootboxResult), [lootboxResult]);
  const isPreviewEquipped = useMemo(
    () => previewItem ? equippedItems.some((item) => item.id === previewItem.id) : false,
    [equippedItems, previewItem],
  );

  const epicRemaining = getEpicPityRemaining(epicPityCount);
  const epicBoost = getEpicBoostBonus(commonStreak);
  const epicBoostPct = (epicBoost * 100).toFixed(1);

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

        <div className="inventory-tabs">
          <button
            className={`inventory-tab ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => handleTabChange('inventory')}
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
                    🎯 {pityCount}/{PITY_THRESHOLD}
                  </span>
                )}
              </div>
              {canRollDailyLoot && (
                <div className="lootbox-pity-info">
                  <span className="lootbox-epic-guarantee" title={`Épique minimum garanti après ${LOOTBOX_PITY.EPIC_WITHIN - 1} tirages sans épique`}>
                    ✨ Épique garanti dans ≤ {epicRemaining} ouvertures
                  </span>
                  {epicBoost > 0 && (
                    <span className="lootbox-epic-boost" title="Chaque common consécutive augmente la chance épique">
                      🍀 Chance épique boostée +{epicBoostPct}% !
                    </span>
                  )}
                </div>
              )}
              <StreakIndicator streak={streak} canRoll={canRollDailyLoot} />
            </div>
            <div className="inv-loadout">
              <div className="inv-loadout-label">EQUIPPED</div>
              <div className="inv-loadout-slots">
                {EQUIPMENT_SLOTS.map((slot) => {
                  const item = equippedItems.find((equipped) => equipped.slot === slot);
                  return (
                    <div
                      key={slot}
                      className={`inv-loadout-slot ${item ? `filled ${getRarityFrameClass(item.rarity)}` : 'empty'}`}
                      data-slot={slot}
                      data-rarity={item ? item.rarity : 'empty'}
                    >
                      <span className="inv-loadout-slot-icon">{SLOT_ICONS[slot]}</span>
                      <span className="inv-loadout-slot-label">{SLOT_SHORT_LABELS[slot]}</span>
                      {item ? (
                        <div className="inv-loadout-item">
                          <button
                            className={`inv-loadout-item-select ${previewItemId === item.id ? 'selected' : ''}`}
                            onClick={() => onSelectItem(item.id)}
                            onMouseEnter={() => onHoverItem(item.id)}
                            onMouseLeave={() => onHoverItem(null)}
                            onFocus={() => onHoverItem(item.id)}
                            onBlur={() => onHoverItem(null)}
                            title={`View ${item.name}`}
                            aria-label={`View equipped ${item.name}`}
                          >
                            <PixelItemIcon pixels={item.pixels} size={22} />
                            {item.element && <AffinityBadge element={item.element} size={10} />}
                            <div className="inv-loadout-item-name">{item.name}</div>
                          </button>
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
            {inventoryFilterElement && (
              <div className="inv-filter-banner" data-testid="inventory-filter-banner">
                Filtre: {inventoryFilterElement.toUpperCase()}
              </div>
            )}

            <div className="inv-body-content">
              <div className="inv-groups">
                {EQUIPMENT_SLOTS.map((slot) => {
                  const slotItems = groupedItems[slot];
                  if (slotItems.length === 0) return null;

                  return (
                    <div key={slot} className="inv-group">
                      <div className="inv-group-label">{SLOT_LABELS[slot]}</div>
                      <div className="inv-group-grid">
                        {slotItems.map((item) => {
                          const isSelected = previewItemId === item.id;
                          const isFilterMatch = inventoryFilterElement && item.element === inventoryFilterElement;
                          return (
                            <button
                              key={item.id}
                              className={`inv-group-item ${getRarityFrameClass(item.rarity)} ${isSelected ? 'selected' : ''} ${isFilterMatch ? 'filter-match' : ''} ${(itemUpgradeLevels[item.id] ?? 0) > 0 ? `upgraded upgraded-level-${Math.min(itemUpgradeLevels[item.id] ?? 0, 5)}` : ''}`}
                              data-rarity={item.rarity}
                              onClick={() => onSelectItem(item.id)}
                              onMouseEnter={() => onHoverItem(item.id)}
                              onMouseLeave={() => onHoverItem(null)}
                              onFocus={() => onHoverItem(item.id)}
                              onBlur={() => onHoverItem(null)}
                              onTouchStart={() => onSelectItem(item.id)}
                              title={`View ${item.name}${(itemUpgradeLevels[item.id] ?? 0) > 0 ? ` (+${itemUpgradeLevels[item.id]})` : ''}`}
                              aria-label={`View ${item.name}`}
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
                    <div className={`inventory-item-head ${getRarityFrameClass(previewItem.rarity)}`} data-rarity={previewItem.rarity}>
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
                    {comparison.length > 0 && !isPreviewEquipped && equippedForPreviewSlot && (
                      <div className="inventory-comparison" data-testid="equipment-comparison">
                        <div className="inventory-comparison-title">
                          <span>VS EQUIPPED</span>
                          <span className="inventory-comparison-equipped-name">{equippedForPreviewSlot.name}</span>
                        </div>
                        <div className="inventory-comparison-rows">
                          {comparison.map(({ key, preview, equipped, delta }) => {
                            const meta = itemStatMeta[key];
                            const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'even';
                            return (
                              <div
                                key={key}
                                className="inventory-comparison-row"
                                data-stat={key}
                                data-direction={direction}
                              >
                                <span className="inventory-comparison-label">{meta.label}</span>
                                <span className="inventory-comparison-equipped">{equipped}</span>
                                <span className="inventory-comparison-arrow">→</span>
                                <span className="inventory-comparison-preview">{preview}</span>
                                <span className={`inventory-comparison-delta ${direction}`}>
                                  {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className={`inventory-forge-actions ${onSalvage ? 'with-salvage' : ''}`}>
                      {onSalvage && (
                        <div className="inventory-essence-yield">
                          <span className="essence-yield-label">SALVAGE YIELD</span>
                          <span className="essence-yield-value">+{ESSENCE_YIELD[previewItem.rarity]} Essence</span>
                        </div>
                      )}
                      <div className="inventory-detail-buttons">
                        <button
                          className="forge-action-btn"
                          onClick={() => onEquip(previewItem.id, previewItem.slot)}
                          disabled={isPreviewEquipped}
                          title={isPreviewEquipped ? 'Already equipped' : `Equip ${previewItem.name}`}
                          aria-label={`Equip ${previewItem.name}`}
                        >
                          {isPreviewEquipped ? 'EQUIPPED' : 'EQUIP'}
                        </button>
                        {onSalvage && (
                          <button
                            className="forge-action-btn danger"
                            onClick={() => onSalvage(previewItem.id)}
                            aria-label={`Salvage ${previewItem.name} for ${ESSENCE_YIELD[previewItem.rarity]} essence`}
                          >
                            SALVAGE
                          </button>
                        )}
                      </div>
                    </div>
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
              {pityTriggered && (
                <div className="lootbox-pity-toast" role="status">
                  🍀 Le destin se rééquilibre !
                </div>
              )}
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
