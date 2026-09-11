import { memo, useMemo } from 'react';
import type { PassTier } from '../../data/seasonalPass';
import '../../styles/components/_forge.scss';

interface PassTrackProps {
  tiers: PassTier[];
  claimedTiers: number[];
  currentXp: number;
  onClaim: (tier: number) => void;
}

function getRewardIcon(type: PassTier['reward']['type']): string {
  if (type === 'essence') return '💎';
  if (type === 'reroll') return '🔄';
  if (type === 'pity') return '🎯';
  return '🗺️';
}

function getState(
  tier: PassTier,
  claimedTiers: number[],
  currentXp: number
): 'claimed' | 'claimable' | 'locked' {
  if (claimedTiers.includes(tier.level)) return 'claimed';
  if (currentXp >= tier.xpRequired) return 'claimable';
  return 'locked';
}

export const PassTrack = memo(function PassTrack({ tiers, claimedTiers, currentXp, onClaim }: PassTrackProps) {
  const maxXp = useMemo(() => {
    if (tiers.length === 0) return 1;
    return tiers[tiers.length - 1].xpRequired;
  }, [tiers]);

  const progressPct = useMemo(() => Math.min(100, (currentXp / maxXp) * 100), [currentXp, maxXp]);

  if (tiers.length === 0) return null;

  return (
    <div className="forge-panel shop-panel pass-panel">
      <div className="forge-panel-title">PASS</div>
      <div className="forge-panel-subtitle">Seasonal Mastery — 20 paliers</div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">PASS XP</span>
        <span className="forge-essence-value">
          {currentXp} / {maxXp}
        </span>
      </div>

      <div className="pass-progress-bar">
        <div className="pass-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="shop-canopy">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="shop-canopy-stripe" />
        ))}
      </div>

      <div className="shop-sign">
        <span className="shop-sign-text">~ MASTERY PASS ~</span>
        <span className="shop-sign-sub">Hybrid-Casual Overlay</span>
      </div>

      <div className="pass-grid">
        {tiers.map((tier) => {
          const state = getState(tier, claimedTiers, currentXp);
          const icon = getRewardIcon(tier.reward.type);
          return (
            <div
              key={tier.level}
              className={`pass-tier-card shop-offer-card forge-rarity-common pass-${state} ${state === 'claimed' ? 'shop-sold' : ''}`}
              data-testid={`pass-tier-${tier.level}`}
              data-state={state}
            >
              <div className="pass-tier-number">#{tier.level}</div>
              <div className="pass-tier-icon">{icon}</div>
              <div className="pass-tier-reward-label">{tier.reward.label}</div>
              <div className="pass-tier-type">{tier.reward.type}</div>
              <div className="pass-tier-xp">{tier.xpRequired} XP</div>
              {state === 'claimed' && <div className="pass-tier-status">CLAIMED</div>}
              {state === 'claimable' && (
                <button
                  className="shop-buy-btn pass-claim-btn"
                  onClick={() => onClaim(tier.level)}
                  aria-label={`Claim tier ${tier.level}`}
                >
                  CLAIM
                </button>
              )}
              {state === 'locked' && <div className="pass-tier-status pass-locked">LOCKED</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
