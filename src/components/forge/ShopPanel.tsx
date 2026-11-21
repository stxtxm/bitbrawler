import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { useSound } from '../../hooks/useSound';
import { getItemStatEntries, ITEM_STAT_META } from '../../hooks/useInventory';
import { SHOP_OFFERS, REROLL_COST } from '../../data/shopConstants';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { getShopOffers, canBuyOffer, isOfferSoldOut, type ShopOffer } from '../../utils/shopUtils';
import { isRerollUsed } from '../../utils/shopStorage';
import { PixelIcon } from '../PixelIcon';
import { PixelItemIcon } from '../PixelItemIcon';
import type { PixelItemAsset } from '../../types/Item';
import '../../styles/components/_forge.scss';

interface ShopPanelProps {
  onClose: () => void;
}

export const ShopPanel = memo(function ShopPanel({ onClose }: ShopPanelProps) {
  const { activeCharacter, essence, buyShopOffer, rerollShopOffers } = useGame();
  const { notify } = useNotification();
  const { play } = useSound();

  const [buying, setBuying] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [soldOut, setSoldOut] = useState<boolean[]>(() => SHOP_OFFERS.map(() => false));
  const [purchasedIndex, setPurchasedIndex] = useState<number | null>(null);
  const [showItemGlow, setShowItemGlow] = useState(false);
  const [showRerollConfirm, setShowRerollConfirm] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [rerolledOffers, setRerolledOffers] = useState<ShopOffer[] | null>(null);
  const [rerollUsed, setRerollUsed] = useState(false);
  const [revealItem, setRevealItem] = useState<PixelItemAsset | null>(null);

  const offers = useMemo<ShopOffer[]>(() => {
    if (!activeCharacter) return [];
    if (rerolledOffers) return rerolledOffers;
    return getShopOffers(activeCharacter, ITEM_ASSETS);
  }, [activeCharacter, rerolledOffers]);

  useEffect(() => {
    if (!activeCharacter) return;
    const newSoldOut = SHOP_OFFERS.map((_, i) => isOfferSoldOut(i, activeCharacter));
    setSoldOut(newSoldOut);
    const charId = activeCharacter.id ?? activeCharacter.seed;
    setRerollUsed(isRerollUsed(charId));
    // Reset rerolled offers if character changes
    setRerolledOffers(null);
  }, [activeCharacter]);

  const handleBuyClick = useCallback((index: number) => {
    if (buying || soldOut[index]) return;
    setConfirmIndex(index);
  }, [buying, soldOut]);

  const handleConfirm = useCallback(async () => {
    if (confirmIndex === null || buying) return;
    setBuying(true);
    try {
      const purchase = await buyShopOffer(confirmIndex);
      if (purchase) {
        const updatedSoldOut = [...soldOut];
        updatedSoldOut[confirmIndex] = true;
        setSoldOut(updatedSoldOut);
        setPurchasedIndex(confirmIndex);
        setShowItemGlow(true);
        play('purchase');
        const offerConfig = SHOP_OFFERS[confirmIndex];
        if (offerConfig.type === 'lootbox' && purchase.grantedItem) {
          // Reveal the rolled item — the card shows what the Coffre mystère contained
          notify(`${offerConfig.label} purchased!`, 'success', 3000);
          setRevealItem(purchase.grantedItem);
        } else if (purchase.grantedItem) {
          notify(`${offerConfig.label} purchased! → ${purchase.grantedItem.name}`, 'success', 3000);
        } else {
          notify(`${offerConfig.label} purchased!`, 'success', 3000);
        }
        setTimeout(() => {
          setShowItemGlow(false);
          setPurchasedIndex(null);
        }, 1200);
      } else {
        play('error');
        notify('Purchase failed — not enough essence or already sold out.', 'error', 3000);
      }
    } catch {
      play('error');
      notify('Failed to purchase. Try again.', 'error', 3000);
    } finally {
      setBuying(false);
      setConfirmIndex(null);
    }
  }, [confirmIndex, buying, buyShopOffer, notify, play, soldOut]);

  const handleCloseReveal = useCallback(() => {
    setRevealItem(null);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirmIndex(null);
  }, []);

  const handleRerollClick = useCallback(() => {
    if (rerolling || rerollUsed) return;
    if ((activeCharacter?.essence ?? 0) < REROLL_COST) {
      play('error');
      notify(`Not enough essence to reroll (${REROLL_COST} 🜁).`, 'error', 3000);
      return;
    }
    setShowRerollConfirm(true);
  }, [rerolling, rerollUsed, activeCharacter, notify, play]);

  const handleRerollConfirm = useCallback(async () => {
    if (rerolling) return;
    setRerolling(true);
    try {
      const newOffers = await rerollShopOffers();
      if (newOffers) {
        setRerolledOffers(newOffers);
        setRerollUsed(true);
        play('reroll');
        notify(`Shop offers rerolled! (-${REROLL_COST} 🜁)`, 'success', 3000);
      } else {
        play('error');
        notify('Reroll failed — not enough essence or already used today.', 'error', 3000);
      }
    } catch {
      play('error');
      notify('Failed to reroll. Try again.', 'error', 3000);
    } finally {
      setRerolling(false);
      setShowRerollConfirm(false);
    }
  }, [rerolling, rerollShopOffers, notify, play]);

  const handleRerollCancel = useCallback(() => {
    setShowRerollConfirm(false);
  }, []);

  const canReroll = !rerollUsed && !rerolling && (activeCharacter?.essence ?? 0) >= REROLL_COST;

  if (!activeCharacter) return null;

  if (offers.length === 0) {
    return (
      <div className="forge-panel">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div className="forge-panel-title">SHOP</div>
          <button className="forge-close-btn" onClick={onClose} aria-label="Close shop panel">
            ×
          </button>
        </div>
        <div className="forge-essence-bar">
          <span className="forge-essence-label">ESSENCE</span>
          <span className="forge-essence-value">{essence.toFixed(2)}</span>
        </div>
        <div className="forge-empty-state">
          <div className="forge-empty-text">No offers available today.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="forge-panel shop-panel">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div className="forge-panel-title">🏪 SHOP</div>
        <button className="forge-close-btn" onClick={onClose} aria-label="Close shop panel">
          ×
        </button>
      </div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">ESSENCE</span>
        <span className="forge-essence-value">{essence.toFixed(2)}</span>
        </div>

      {/* Canopy / Awning */}
      <div className="shop-canopy">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="shop-canopy-stripe" />
        ))}
      </div>

      {/* Shop sign */}
      <div className="shop-sign">
        <span className="shop-sign-text">~ 8-BIT EMPORIUM ~</span>
        <span className="shop-sign-sub">Daily Wares</span>
      </div>

      <div className="shop-welcome">Welcome, traveler! Browse my wares...</div>

      {/* Candle decorations */}
      <div className="shop-candle shop-candle-left" />
      <div className="shop-candle shop-candle-right" />

      {/* Offers grid */}
      <div className="shop-vitrine">
        {offers.map((offer) => {
          // Config index (not array position): epic-replacement puts index 3 at position 1
          const index = offer.index;
          const isSold = soldOut[index];
          const canBuy = canBuyOffer(index, activeCharacter) && !isSold && !buying;
          const isPurchasing = confirmIndex === index;

          return (
            <div
              key={index}
              className={`shop-offer-card forge-rarity-${offer.item?.rarity ?? 'common'} ${isSold ? 'shop-sold' : ''} ${purchasedIndex === index && showItemGlow ? 'shop-anim-purchased' : ''}`}
            >
              {/* Item preview area */}
              <div className={`shop-offer-preview shop-rarity-bg-${offer.item?.rarity ?? 'common'}`}>
                {offer.type === 'lootbox' ? (
                  <div className="shop-lootbox-icon">📦</div>
                ) : (
                  (() => {
                    const itemData = ITEM_ASSETS.find(a => a.id === offer.item!.id);
                    return itemData ? (
                      <PixelItemIcon pixels={itemData.pixels} size={48} />
                    ) : (
                      <div className="shop-item-placeholder" />
                    );
                  })()
                )}
              </div>

              {/* Offer label */}
              <div className="shop-offer-label">{offer.label}</div>

              {offer.item && (
                <>
                  <div className="shop-offer-name">{offer.item.name}</div>
                  <div className={`shop-offer-rarity shop-rarity-${offer.item.rarity}`}>
                    {offer.item.rarity.toUpperCase()}
                  </div>
                </>
              )}

              {offer.type === 'lootbox' && (
                <div className="shop-offer-desc">Random item (simple roll)</div>
              )}

              {/* Stats */}
              {offer.item && (
                <div className="shop-offer-stats">
                  {(() => {
                    const itemData = ITEM_ASSETS.find(a => a.id === offer.item!.id);
                    if (!itemData) return null;
                    return Object.entries(itemData.stats).map(([key, val]) => {
                      if (!val) return null;
                      const label = key === 'strength' ? 'STR' : key === 'vitality' ? 'VIT' : key === 'dexterity' ? 'DEX' : key === 'luck' ? 'LUK' : key === 'intelligence' ? 'INT' : key === 'focus' ? 'FOC' : key === 'hp' ? 'HP' : key.toUpperCase();
                      return <span key={key} className="shop-stat">{label}+{val}</span>;
                    });
                  })()}
                </div>
              )}

              {/* Price */}
              <div className="shop-price">{offer.price} 💎</div>

              {/* Buy / Sold button */}
              <button
                className={`shop-buy-btn ${isSold ? 'shop-sold-btn' : ''}`}
                onClick={() => handleBuyClick(index)}
                disabled={!canBuy}
                title={!canBuy && !isSold ? 'Not enough essence' : ''}
                aria-label={`Buy ${offer.label}`}
              >
                {isSold ? 'SOLD' : buying && isPurchasing ? '...' : 'BUY'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Reroll button */}
      <div className="shop-reroll-row">
        <button
          className={`shop-reroll-btn ${rerollUsed ? 'shop-reroll-used' : ''}`}
          onClick={handleRerollClick}
          disabled={!canReroll}
          title={rerollUsed ? 'Already rerolled today' : !canReroll ? `Need ${REROLL_COST} 🜁` : `Reroll offers for ${REROLL_COST} 🜁`}
          aria-label="Reroll shop offers"
        >
          {rerollUsed ? 'REROLLED' : rerolling ? 'REROLLING...' : `RELANCE (${REROLL_COST} 🜁)`}
        </button>
      </div>

      {/* Reroll confirmation overlay */}
      {showRerollConfirm && (
        <div className="forge-confirm-overlay">
          <div className="forge-confirm-dialog">
            <div className="forge-confirm-title">Confirm Reroll</div>
            <div className="forge-confirm-item">
              <span className="forge-confirm-item-name">Refresh all offers</span>
              <span className="forge-confirm-yield">{REROLL_COST} 🜁</span>
            </div>
            <div className="forge-confirm-warning">This will replace all 3 offers with new ones.</div>
            <div className="forge-confirm-actions">
              <button className="forge-confirm-cancel" onClick={handleRerollCancel}>Cancel</button>
              <button
                className="forge-confirm-ok"
                onClick={handleRerollConfirm}
                disabled={rerolling}
                aria-label="Confirm reroll"
                data-click-sound="none"
              >
                {rerolling ? 'REROLLING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase confirmation overlay */}
      {confirmIndex !== null && (() => {
        const confirmOffer = offers.find(o => o.index === confirmIndex);
        return (
          <div className="forge-confirm-overlay">
            <div className="forge-confirm-dialog">
              <div className="forge-confirm-title">Confirm Purchase</div>
              <div className="forge-confirm-item">
                <span className="forge-confirm-item-name">{confirmOffer?.label ?? SHOP_OFFERS[confirmIndex].label}</span>
                {confirmOffer?.item && (
                  <span className="forge-confirm-item-rarity">{confirmOffer.item.rarity.toUpperCase()}</span>
                )}
                <span className="forge-confirm-yield">{SHOP_OFFERS[confirmIndex].price} 💎</span>
              </div>
              <div className="forge-confirm-actions">
                <button className="forge-confirm-cancel" onClick={handleCancel}>Cancel</button>
                <button
                  className="forge-confirm-ok"
                  onClick={handleConfirm}
                  disabled={buying}
                  aria-label="Confirm purchase"
                  data-click-sound="none"
                >
                  {buying ? 'PURCHASING...' : 'CONFIRM'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lootbox reveal — shows the item the Coffre mystère contained */}
      {revealItem && (
        <div
          className={`lootbox-result-overlay ${revealItem.rarity === 'legendary' ? 'lootbox-result-overlay-legendary' : ''}`}
          role="dialog"
          aria-label="Lootbox reward"
          onClick={handleCloseReveal}
        >
          <div
            className={`lootbox-result-card rarity-${revealItem.rarity} ${revealItem.rarity === 'epic' ? 'rare-reveal-epic' : ''} ${revealItem.rarity === 'legendary' ? 'rare-reveal-legendary' : ''}`}
            onClick={handleCloseReveal}
          >
            <div className="lootbox-result-glow" />
            <div className="lootbox-result-title">NEW ITEM</div>
            <div className="lootbox-result-item">
              <div className="lootbox-result-icon">
                <PixelItemIcon pixels={revealItem.pixels} size={64} />
              </div>
              <div className="lootbox-result-meta">
                <div className="lootbox-result-name">{revealItem.name}</div>
                <div className="lootbox-result-rarity">{revealItem.rarity.toUpperCase()}</div>
              </div>
            </div>
            <div className="lootbox-result-stats">
              {getItemStatEntries(revealItem).map(({ key, value }) => {
                const meta = ITEM_STAT_META[key];
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
    </div>
  );
});
