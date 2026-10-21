import { getDefaultSeasonId, usePassProgress } from '../../hooks/usePassProgress'
import { PassTrack } from './PassTrack'

interface SeasonPassPanelProps {
  onClose?: () => void
}

export function SeasonPassPanel({ onClose }: SeasonPassPanelProps) {
  const seasonId = getDefaultSeasonId()
  const progress = usePassProgress({ seasonId })

  return (
    <PassTrack
      seasonId={progress.seasonId}
      passXp={progress.passXp}
      currentTier={progress.currentTier}
      progressPct={progress.progressPct}
      claimed={progress.claimed}
      tiers={progress.tiers}
      maxXp={progress.maxXp}
      xpToNext={progress.xpToNext}
      onClaim={progress.claimTier}
      onClose={onClose}
    />
  )
}
