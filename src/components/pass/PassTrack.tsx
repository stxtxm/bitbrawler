import { memo, useMemo } from 'react'
import { PASS_MAX_LEVEL, PASS_REWARDS, PASS_XP_PER_LEVEL, getPassLevel } from '../../data/seasonalPass'

interface PassTrackProps {
  xp: number
  claimed: number[]
  onClaim: (level: number) => void
}

function getRewardIcon(type: string): string {
  if (type === 'essence') return '💎'
  if (type === 'reroll') return '🔄'
  if (type === 'pity') return '🎯'
  return '🗺️'
}

function getState(level: number, claimed: number[], xp: number): 'claimed' | 'claimable' | 'locked' {
  if (claimed.includes(level)) return 'claimed'
  const lvl = getPassLevel(xp)
  if (lvl >= level) return 'claimable'
  return 'locked'
}

export const PassTrack = memo(function PassTrack({ xp, claimed, onClaim }: PassTrackProps) {
  const maxXp = useMemo(() => PASS_MAX_LEVEL * PASS_XP_PER_LEVEL, [])
  const progressPct = useMemo(() => Math.min(100, (xp / maxXp) * 100), [xp, maxXp])
  const currentLevel = useMemo(() => getPassLevel(xp), [xp])

  return (
    <div className="forge-panel shop-panel pass-panel">
      <div className="forge-panel-title">PASS</div>
      <div className="forge-panel-subtitle">Seasonal Mastery — 20 paliers</div>

      <div className="forge-essence-bar">
        <span className="forge-essence-label">PASS XP</span>
        <span className="forge-essence-value">
          {xp} / {maxXp}
        </span>
      </div>

      <div className="pass-progress-bar">
        <div className="pass-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="pass-level-badge">
        NIVEAU {currentLevel} / {PASS_MAX_LEVEL}
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
        {PASS_REWARDS.map((tier) => {
          const state = getState(tier.level, claimed, xp)
          const icon = getRewardIcon(tier.type)
          return (
            <div
              key={tier.level}
              className={`pass-tier-card shop-offer-card forge-rarity-common pass-${state} ${state === 'claimed' ? 'shop-sold' : ''}`}
              data-testid={`pass-tier-${tier.level}`}
              data-state={state}
            >
              <div className="pass-tier-number">#{tier.level}</div>
              <div className="pass-tier-icon">{icon}</div>
              <div className="pass-tier-reward-label">{tier.label}</div>
              <div className="pass-tier-type">{tier.type}</div>
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
              {state === 'locked' && <div className="pass-tier-status">LOCKED</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
})
