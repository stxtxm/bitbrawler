import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useNotification } from '../../hooks/useNotification';
import { ITEM_ASSETS } from '../../data/itemAssets';
import { getShopOffers, canBuyOffer, isOfferSoldOut, ShopOffer } from '../../utils/shopUtils';
import { PixelItemIcon } from '../PixelItemIcon';
import '../../styles/components/_forge.scss';

interface ShopPanelProps {
  onClose: () => void;
}

export const ShopPanel = memo(function ShopPanel({ onClose }: ShopPanelProps) {
  const { activeCharacter, essence, buyShopOffer } = useGame();
  const { notify } = useNotification();

  const [buying, setBuying] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [soldOut, setSoldOut] = useState<boolean[]>([]);
  const [purchasedIndex, setPurchasedIndex] = useState<number | null>(null);
  const [showItemGlow, setShowItemGlow] = useState(false);

  const offers = useMemo<ShopOffer[]>(() => {
    if (!activeCharacter) return [];
    return getShopOffers(activeCharacter, ITEM_ASSETS);
  }, [activeCharacter]);

  useEffect(() => {
    if (!activeCharacter || offers.length === 0) return;
    const newSoldOut = offers.map((o) => isOfferSoldOut(o.index, activeCharacter));
    setSoldOut(newSoldOut);
  }, [activeCharacter, offers]);

  const handleBuyClick = useCallback((offerIndex: number, arrayIndex: number) => {
    if (buying || soldOut[arrayIndex]) return;
    setConfirmIndex(offerIndex);
  }, [buying, soldOut]);

  const handleConfirm = useCallback(async () => {
    if (confirmIndex === null || buying) return;
    setBuying(true);
    try {
      const result = await buyShopOffer(confirmIndex);
      if (result) {
        const arrIndex = offers.findIndex(o => o.index === confirmIndex);
        const updatedSoldOut = [...soldOut];
        if (arrIndex >= 0) updatedSoldOut[arrIndex] = true;
        setSoldOut(updatedSoldOut);
        setPurchasedIndex(arrIndex);
        setShowItemGlow(true);
        const purchasedOffer = offers.find(o => o.index === confirmIndex);
        notify(`${purchasedOffer ? purchasedOffer.label : 'Item'} purchased!`, 'success', 3000);
        setTimeout(() => {
          setShowItemGlow(false);
          setPurchasedIndex(null);
        }, 1200);
      } else {
        notify('Purchase failed — not enough essence or already sold out.', 'error', 3000);
      }
    } catch {
      notify('Failed to purchase. Try again.', 'error', 3000);
    } finally {
      setBuying(false);
      setConfirmIndex(null);
    }
  }, [confirmIndex, buying, buyShopOffer, notify, soldOut, offers]);

  const handleCancel = useCallback(() => {
    setConfirmIndex(null);
  }, []);

  const confirmOffer = useMemo(() => {
    if (confirmIndex === null) return null;
    return offers.find(o => o.index === confirmIndex) ?? null;
  }, [confirmIndex, offers]);

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
        {offers.map((offer, index) => {
          const isSold = soldOut[index];
          const canBuy = canBuyOffer(offer.index, activeCharacter) && !isSold && !buying;
          const isPurchasing = confirmIndex === offer.index;

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
                onClick={() => handleBuyClick(offer.index, index)}
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

      {/* Confirmation overlay */}
      {confirmOffer && (
        <div className="forge-confirm-overlay" key="confirm">
          <div className="forge-confirm-dialog">
            <div className="forge-confirm-title">Confirm Purchase</div>
            <div className="forge-confirm-item">
              <span className="forge-confirm-item-name">{confirmOffer.label}</span>
              {confirmOffer.item && (
                <span className="forge-confirm-item-rarity">{confirmOffer.item.rarity.toUpperCase()}</span>
              )}
              <span className="forge-confirm-yield">{confirmOffer.price} 💎</span>
            </div>
            <div className="forge-confirm-actions">
              <button className="forge-confirm-cancel" onClick={handleCancel}>Cancel</button>
              <button
                className="forge-confirm-ok"
                onClick={handleConfirm}
                disabled={buying}
                aria-label="Confirm purchase"
              >
                {buying ? 'PURCHASING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
