import { useState } from 'react';
import { STREAK_LADDER_DESCRIPTION, STREAK_LADDER_TIERS } from '../../data/streakLadder';
import {
  formatLadderWeekLabel,
  getBestTier,
  type StreakLadderEntry,
} from '../../utils/streakLadderUtils';
import type { LadderBadgeMap } from '../../utils/streakLadderStorage';

export interface StreakLadderPanelProps {
  weekKey: string;
  entries: StreakLadderEntry[];
  ownEntry: StreakLadderEntry | null;
  badges: LadderBadgeMap;
  loading: boolean;
  available: boolean;
  defaultOpen?: boolean;
  onRefresh?: () => void;
}

const MAX_VISIBLE_ENTRIES = 10;

export function StreakLadderPanel({
  weekKey,
  entries,
  ownEntry,
  badges,
  loading,
  available,
  defaultOpen = false,
  onRefresh,
}: StreakLadderPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const visibleEntries = entries.slice(0, MAX_VISIBLE_ENTRIES);
  const bestTier = getBestTier(Object.values(badges));
  const bestBadge = bestTier ? STREAK_LADDER_TIERS[bestTier] : null;

  return (
    <section className="streak-ladder-panel" aria-label="Weekly Streak Ladder">
      <button
        type="button"
        className="streak-ladder-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="streak-ladder-title">🏆 WEEKLY STREAK LADDER</span>
        <span className="streak-ladder-week">{formatLadderWeekLabel(weekKey)}</span>
        {ownEntry && <span className="streak-ladder-own-rank">#{ownEntry.rank}</span>}
        <span className="streak-ladder-chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="streak-ladder-body">
          <p className="streak-ladder-description">{STREAK_LADDER_DESCRIPTION}</p>

          {!available ? (
            <p className="streak-ladder-offline">LADDER OFFLINE — MIGRATION EN ATTENTE</p>
          ) : loading ? (
            <p className="streak-ladder-loading blink">LOADING LADDER...</p>
          ) : visibleEntries.length === 0 ? (
            <p className="streak-ladder-empty">AUCUN CHALLENGER CETTE SEMAINE</p>
          ) : (
            <ol className="streak-ladder-list">
              {visibleEntries.map((entry) => {
                const isOwn = ownEntry?.characterId === entry.characterId;
                const tier = entry.tier ? STREAK_LADDER_TIERS[entry.tier] : null;
                return (
                  <li
                    key={entry.characterId}
                    className={`streak-ladder-row${isOwn ? ' own' : ''}${tier ? ` ${tier.id}` : ''}`}
                  >
                    <span className="streak-ladder-rank">{entry.rank}</span>
                    <span className="streak-ladder-name">{entry.name}</span>
                    <span className="streak-ladder-streak">{entry.streak} J</span>
                    <span className="streak-ladder-tier" aria-label={tier ? tier.label : 'SANS TIER'}>
                      {tier ? tier.icon : '—'}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {bestBadge && (
            <p className="streak-ladder-best">
              MEILLEUR BADGE : {bestBadge.icon} {bestBadge.cosmetic}
            </p>
          )}

          {onRefresh && (
            <button
              type="button"
              className="streak-ladder-refresh"
              onClick={() => void onRefresh()}
              disabled={loading}
            >
              REFRESH
            </button>
          )}
        </div>
      )}
    </section>
  );
}
