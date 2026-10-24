import { memo } from 'react'
import { usePixelSeason } from '../../hooks/usePixelSeason'
import { getPixelSeasonTierThreshold } from '../../data/pixelSeason'

export interface PixelSeasonPanelProps {
  now?: Date
  onClose?: () => void
}

export const PixelSeasonPanel = memo(function PixelSeasonPanel({ now, onClose }: PixelSeasonPanelProps) {
  const season = usePixelSeason({ now })
  const { calendar } = season

  return (
    <div className="season-panel">
      <div className="season-header">
        <div>
          <div className="season-title">PIXEL SEASON</div>
          <div className="season-theme">{season.theme.name}</div>
          <div className="season-season-label">
            Saison {season.seasonId} — {season.theme.tagline}
          </div>
        </div>
        {onClose && (
          <button className="season-close-btn" onClick={onClose} aria-label="Close season pass">
            ×
          </button>
        )}
      </div>

      <div className="season-calendar">
        {calendar.phase === 'active' ? (
          <span>{calendar.activeDaysLeft} jours restants</span>
        ) : (
          <span>Repos — {calendar.restDaysLeft} jour(s) avant la prochaine saison</span>
        )}
        <span>{season.premiumUnlocked ? 'PREMIUM ACTIF' : 'TRACK GRATUIT'}</span>
      </div>

      <div
        className="season-progress-bar"
        role="progressbar"
        aria-valuenow={season.progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="season-progress-fill" style={{ width: `${season.progressPct}%` }} />
      </div>
      <div className="season-progress-text">
        <span>Tier {season.tier} / {season.maxTier}</span>
        <span>{season.points} / {season.maxPoints} PTS</span>
        <span>{season.pointsToNext > 0 ? `${season.pointsToNext} PTS → prochain palier` : 'MAX'}</span>
      </div>

      <div className="season-section">
        <div className="season-section-title">MISSIONS DE SAISON</div>
        <div className="season-missions">
          {season.missions.map((mission) => {
            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100))
            return (
              <div
                key={mission.id}
                className={`season-mission ${mission.complete ? 'season-mission-complete' : ''}`}
                data-testid={`season-mission-${mission.id}`}
              >
                <div className="season-mission-label">{mission.label}</div>
                <div className="season-mission-meta">
                  <span>{mission.progress} / {mission.target}</span>
                  <span>+{mission.points} PTS</span>
                </div>
                <div className="season-mission-bar">
                  <div className="season-mission-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="season-track">
        <div className="season-section-title">TRACK GRATUIT</div>
        <div className="season-grid">
          {season.freeRewards.map((reward) => (
            <div
              key={reward.tier}
              className={`season-tier-card ${reward.claimed ? 'season-claimed' : ''} ${reward.claimable ? 'season-unlocked' : ''}`}
              data-testid={`season-free-tier-${reward.tier}`}
            >
              <div className="season-tier-level">PALIER {reward.tier}</div>
              <div className="season-tier-reward">{reward.label}</div>
              <div className="season-tier-threshold">
                {reward.unlocked ? 'DEBLOQUE' : `${getPixelSeasonTierThreshold(reward.tier)} PTS`}
              </div>
              <button
                className="season-claim-btn"
                onClick={() => season.claimFree(reward.tier)}
                disabled={!reward.claimable}
                aria-label={`Claim free tier ${reward.tier}`}
              >
                {reward.claimed ? 'CLAIMED' : reward.claimable ? 'CLAIM' : 'LOCKED'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="season-track season-premium-track">
        <div className="season-section-title">TRACK PREMIUM — COSMETIQUES</div>
        {!season.premiumUnlocked && (
          <div className="season-premium-locked">PREMIUM VERROUILLE — COSMETIQUES UNIQUEMENT</div>
        )}
        <div className="season-grid">
          {season.premiumRewards.map((reward) => (
            <div
              key={reward.tier}
              className={`season-tier-card season-premium-card ${reward.claimed ? 'season-claimed' : ''} ${reward.claimable ? 'season-unlocked' : ''}`}
              data-testid={`season-premium-tier-${reward.tier}`}
            >
              <div className="season-tier-level">PALIER {reward.tier}</div>
              <div className={`season-tier-reward season-reward-${reward.type}`}>{reward.label}</div>
              <div className="season-tier-threshold">
                {reward.unlocked ? 'DEBLOQUE' : `${getPixelSeasonTierThreshold(reward.tier)} PTS`}
              </div>
              <button
                className="season-claim-btn"
                onClick={() => season.claimPremium(reward.tier)}
                disabled={!reward.claimable}
                aria-label={`Claim premium tier ${reward.tier}`}
              >
                {reward.claimed ? 'CLAIMED' : reward.claimable ? 'CLAIM' : 'LOCKED'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="season-leaderboard">
        <div className="season-section-title">LIGUE SAISONNIERE</div>
        {season.leaderboard.map((entry) => (
          <div
            key={`${entry.rank}-${entry.name}`}
            className={`season-leaderboard-row ${entry.isPlayer ? 'season-leaderboard-player' : ''}`}
          >
            <span className="season-leaderboard-rank">#{entry.rank}</span>
            <span className="season-leaderboard-name">{entry.name}</span>
            <span className="season-leaderboard-points">{entry.points} PTS</span>
          </div>
        ))}
      </div>
    </div>
  )
})
