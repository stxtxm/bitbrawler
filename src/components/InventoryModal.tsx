import { useState, useEffect } from 'react';
import { Character } from '../types/Character';
import { PixelItemAsset, ItemStats } from '../types/Item';
import { PixelIcon } from './PixelIcon';
import { PixelItemIcon } from './PixelItemIcon';
import { getItemById, getEquipmentBonuses } from '../utils/equipmentUtils';
import { canRollLootbox } from '../utils/lootboxUtils';

type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

interface InventoryModalProps {
    isOpen: boolean;
    activeCharacter: Character;
    isOfflineMode: boolean;
    onClose: () => void;
    rollLootbox: () => Promise<PixelItemAsset | null>;
    openModal: (message: string) => void;
    ensureConnection?: (message: string) => Promise<boolean>;
}

const INVENTORY_CAPACITY = 24;

const itemStatMeta: Record<keyof ItemStats, { label: string; icon: StatIconType }> = {
    strength: { label: 'STR', icon: 'strength' },
    vitality: { label: 'VIT', icon: 'vitality' },
    dexterity: { label: 'DEX', icon: 'dexterity' },
    luck: { label: 'LUK', icon: 'luck' },
    intelligence: { label: 'INT', icon: 'intelligence' },
    focus: { label: 'FOC', icon: 'focus' },
    hp: { label: 'HP', icon: 'vitality' },
};

const InventoryModal = ({
    isOpen,
    activeCharacter,
    isOfflineMode,
    onClose,
    rollLootbox,
    openModal,
    ensureConnection,
}: InventoryModalProps) => {
    const [inventoryHoveredId, setInventoryHoveredId] = useState<string | null>(null);
    const [inventorySelectedId, setInventorySelectedId] = useState<string | null>(null);
    const [lootboxRolling, setLootboxRolling] = useState(false);
    const [lootboxResult, setLootboxResult] = useState<PixelItemAsset | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setLootboxResult(null);
            setLootboxRolling(false);
            setInventoryHoveredId(null);
            setInventorySelectedId(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const inventory = activeCharacter.inventory || [];
    const inventoryFull = inventory.length >= INVENTORY_CAPACITY;
    const canRollDailyLoot = canRollLootbox(activeCharacter.lastLootRoll, Date.now());
    const previewItemId = inventoryHoveredId ?? inventorySelectedId ?? undefined;
    const previewItem = getItemById(previewItemId);
    const previewStats = previewItem
        ? (Object.entries(previewItem.stats)
            .filter(([, value]) => typeof value === 'number' && value !== 0) as [keyof ItemStats, number][])
        : [];
    const previewSlotLabel = previewItem ? previewItem.slot.toUpperCase() : '';
    const totalBonus = getEquipmentBonuses(activeCharacter);
    const bonusOrder: Array<keyof ItemStats> = ['strength', 'vitality', 'dexterity', 'luck', 'intelligence', 'focus', 'hp'];
    const totalBonusEntries = bonusOrder
        .map((key) => ({ key, value: totalBonus[key] || 0 }))
        .filter((entry) => entry.value > 0);

    const lootboxStats = lootboxResult
        ? (Object.entries(lootboxResult.stats)
            .filter(([, value]) => typeof value === 'number' && value !== 0) as [keyof ItemStats, number][])
        : [];

    const handleLootboxRoll = async () => {
        if (lootboxRolling) return;
        if (isOfflineMode) {
            openModal('Connect to battle and sync your progress.');
            return;
        }
        if (ensureConnection) {
            const canProceed = await ensureConnection('Connect to battle and sync your progress.');
            if (!canProceed) return;
        }

        setLootboxRolling(true);
        setLootboxResult(null);

        setTimeout(async () => {
            try {
                const item = await rollLootbox();
                if (item) {
                    setLootboxResult(item);
                    setInventorySelectedId(item.id);
                    setInventoryHoveredId(item.id);
                }
            } catch (error: any) {
                openModal(error.message || 'Connect to battle and sync your progress.');
            } finally {
                setLootboxRolling(false);
            }
        }, 900);
    };

    const handleCloseLootboxResult = () => {
        setLootboxResult(null);
    };

    const handleSelectItem = (itemId: string) => {
        setInventorySelectedId(itemId);
    };

    return (
        <div className="retro-modal-overlay inventory-overlay" onClick={onClose}>
            <div className={`retro-modal inventory-modal ${lootboxRolling ? 'lootbox-active' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="inventory-header">
                    <h2 className="inventory-title">INVENTORY</h2>
                    <button className="inventory-close" onClick={onClose} aria-label="Close inventory">
                        ×
                    </button>
                </div>
                <div className="inventory-roll">
                    <button
                        className="button lootbox-btn"
                        onClick={handleLootboxRoll}
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
                        {inventory.length}/{INVENTORY_CAPACITY} SLOTS
                    </div>
                </div>
                <div className="inventory-body">
                    <div className="inventory-grid">
                        {Array.from({ length: INVENTORY_CAPACITY }).map((_, index) => {
                            const itemId = inventory[index];
                            const item = getItemById(itemId);
                            if (!item) {
                                return <div key={index} className="inventory-slot empty" aria-hidden="true" />;
                            }
                            const isSelected = previewItemId === item.id;
                            return (
                                <button
                                    key={index}
                                    className={`inventory-slot item-slot rarity-${item.rarity} ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelectItem(item.id)}
                                    onMouseEnter={() => setInventoryHoveredId(item.id)}
                                    onMouseLeave={() => setInventoryHoveredId((current) => (current === item.id ? null : current))}
                                    onFocus={() => setInventoryHoveredId(item.id)}
                                    onBlur={() => setInventoryHoveredId((current) => (current === item.id ? null : current))}
                                    onTouchStart={() => setInventorySelectedId(item.id)}
                                    title={`${item.name} (${item.rarity})`}
                                    aria-label={`View ${item.name}`}
                                >
                                    <PixelItemIcon pixels={item.pixels} size={24} />
                                </button>
                            );
                        })}
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
                                        </div>
                                    </div>
                                </div>
                                <div className="inventory-item-stats">
                                    {previewStats.map(([statKey, value]) => {
                                        const meta = itemStatMeta[statKey];
                                        if (!meta) return null;
                                        return (
                                            <div key={statKey} className="inventory-stat-row">
                                                <span className="inventory-stat-icon">
                                                    <PixelIcon type={meta.icon} size={12} />
                                                </span>
                                                <span className="inventory-stat-label">{meta.label}</span>
                                                <span className="inventory-stat-value">+{value}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {totalBonusEntries.length > 0 && (
                                    <div className="inventory-bonus-summary">
                                        <div className="bonus-title">TOTAL BONUS</div>
                                        <div className="bonus-list">
                                            {totalBonusEntries.map((entry) => {
                                                const meta = itemStatMeta[entry.key];
                                                if (!meta) return null;
                                                return (
                                                    <div key={entry.key} className="bonus-chip">
                                                        <PixelIcon type={meta.icon} size={10} />
                                                        <span className="bonus-label">{meta.label}</span>
                                                        <span className="bonus-value">+{entry.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="inventory-empty-details">TAP AN ITEM TO VIEW BONUSES</div>
                        )}
                    </div>
                </div>
                {lootboxResult && (
                    <div className="lootbox-result-overlay" role="dialog" aria-label="Lootbox reward" onClick={handleCloseLootboxResult}>
                        <div className={`lootbox-result-card rarity-${lootboxResult.rarity}`} onClick={handleCloseLootboxResult}>
                            <div className="lootbox-result-glow"></div>
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
                                {lootboxStats.map(([statKey, value]) => {
                                    const meta = itemStatMeta[statKey];
                                    if (!meta) return null;
                                    return (
                                        <div key={statKey} className="lootbox-result-stat">
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
};

export default InventoryModal;
