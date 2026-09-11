import { memo } from 'react'
import type { PassTier } from '../../data/seasonalPass'

export interface PassTrackProps {
  seasonId: string
  passXp: number
  currentTier: number
  progressPct: number
  claimed: number[]
  tiers: PassTier[]
  maxXp: number
  xpToNext: number
  onClaim: (tier: number) => void
  onClose?: () => void
}

function getRewardLabel(type: string, amount: number): string {
  if (type === 'essence') return `${amount} Essence`
  if (type === 'reroll') return 'Reroll gratuit'
  if (type === 'pity') return `Pity -${amount}`
  if (type === 'biome_token') return 'Token Biome'
  return `${type} x${amount}`
}

export const PassTrack = memo(function PassTrack({
  seasonId,
  passXp,
  currentTier,
  progressPct,
  claimed,
  tiers,
  maxXp,
  xpToNext,
  onClaim,
  onClose,
}: PassTrackProps) {
  return (
    <div className="pass-panel">
      <div className="pass-header">
        <div>
          <div className="pass-title">MASTERY PASS</div>
          <div className="pass-season-label">Saison {seasonId} — 20 paliers</div>
        </div>
        {onClose && (
          <button className="pass-close-btn" onClick={onClose} aria-label="Close pass track">
            ×
          </button>
        )}
      </div>

      <div className="pass-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="pass-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="pass-progress-text">
        <span>
          Tier {currentTier} / {tiers.length}
        </span>
        <span>
          {passXp} / {maxXp} XP
        </span>
        <span>{xpToNext > 0 ? `${xpToNext} XP → prochain palier` : 'MAX'}</span>
      </div>

      <div className="pass-track">
        {tiers.map(tier => {
          const isClaimed = claimed.includes(tier.level)
          const isUnlocked = passXp >= tier.xpRequired
          const canClaim = isUnlocked && !isClaimed
          return (
            <div
              key={tier.level}
              className={`pass-tier-card ${isClaimed ? 'pass-claimed' : ''} ${canClaim ? 'pass-unlocked' : ''}`}
              data-testid={`pass-tier-${tier.level}`}
            >
              <div className="pass-tier-level">LVL {tier.level}</div>
              <div className="pass-tier-xp">{tier.xpRequired} XP</div>
              <div className="pass-reward">
                <span className={`pass-reward-type pass-reward-${tier.reward.type}`}>{tier.reward.type}</span>
                <span className="pass-reward-amount">{getRewardLabel(tier.reward.type, tier.reward.amount)}</span>
              </div>
              {isClaimed ? (
                <button className="pass-claim-btn pass-claimed-btn" disabled aria-label={`Tier ${tier.level} claimed`}>
                  CLAIMED
                </button>
              ) : (
                <button
                  className="pass-claim-btn"
                  onClick={() => onClaim(tier.level)}
                  disabled={!canClaim}
                  aria-label={`Claim tier ${tier.level}`}
                >
                  {canClaim ? 'CLAIM' : 'LOCKED'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})
