import { memo } from 'react';
import { Character } from '../../types/Character';
import { STAT_TOOLTIPS } from '../../utils/statUtils';
import { PixelIcon } from '../PixelIcon';
import type { ArenaIdleViewModel, ArenaStatOption } from './arenaTypes';

interface StatsPanelProps {
  effectiveCharacter: Character;
  pveMode: boolean;
  statOptions: ArenaStatOption[];
  idle: ArenaIdleViewModel;
}

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return 'now';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) return `${minutes}m ${remainder}s`;
  return `${remainder}s`;
};

export const StatsPanel = memo(function StatsPanel({
  effectiveCharacter,
  pveMode,
  statOptions,
  idle,
}: StatsPanelProps) {
  const hpPercentage = effectiveCharacter.maxHp > 0
    ? (effectiveCharacter.hp / effectiveCharacter.maxHp) * 100
    : 0;

  return (
    <div className="stats-panel">
      <div className="stats-grid-compact">
        {statOptions.map((stat) => (
          <div key={stat.key} className="compact-stat" title={`${stat.label}: ${STAT_TOOLTIPS[stat.key]}`}>
            <span className="compact-stat-icon">
              <PixelIcon type={stat.icon} size={12} />
            </span>
            <span className="compact-stat-label">{stat.label}</span>
            <span className="compact-stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="stats-content">
        <div className="stat-row principal">
          <span>HP</span>
          <div className="bar-container">
            <div className="bar hp-bar" style={{ width: `${hpPercentage}%` }} />
          </div>
          <span className="stat-val">{effectiveCharacter.maxHp}</span>
        </div>
      </div>

      {idle.efficiencyData && (
        <div className="idle-efficiency">
          <div className="efficiency-primary">
            <span className="eff-rate eff-essence">
              <small>Essence/min</small>
              <strong>💎 ~{idle.efficiencyData.essencePerMinute}</strong>
            </span>
            {idle.efficiencyData.nextLevelTime != null && (
              <span className="eff-rate eff-next">
                <small>Next level</small>
                <strong>⬆ ~{formatDuration(idle.efficiencyData.nextLevelTime)}</strong>
              </span>
            )}
          </div>
          <div className="efficiency-breakdown">
            <span className="eff-stat eff-power" title="Power ratio (STR/DEX vs monster)">
              <small>Power</small>
              <strong>⚔ {idle.efficiencyData.powerRatio.toFixed(2)}x</strong>
            </span>
            <span className="eff-stat eff-speed" title="Speed ratio (DEX vs monster)">
              <small>Speed</small>
              <strong>⚡ {idle.efficiencyData.speedEfficiency.toFixed(2)}x</strong>
            </span>
            <span className="eff-stat eff-magic" title="Essence stat bonus (INT+FOC)">
              <small>Magic</small>
              <strong>🧠 {idle.efficiencyData.statEssenceMultiplier.toFixed(2)}x</strong>
            </span>
            <span className="eff-stat eff-interval" title="Time per fight">
              <small>Interval</small>
              <strong>◈ {(idle.efficiencyData.effectiveInterval / 1000).toFixed(1)}s</strong>
            </span>
          </div>
          <div className="efficiency-footer">
            {idle.currentStreak > 0 && (
              <span className="eff-streak">🔥 {idle.currentStreak}-win streak (+{(idle.efficiencyData.streakBonus * 100).toFixed(0)}%)</span>
            )}
            {idle.efficiencyData.streakMilestone != null && (
              <span className="eff-milestone">🎯 {idle.efficiencyData.streakMilestone} milestone!</span>
            )}
          </div>
        </div>
      )}

      <div className="stats-content" aria-hidden={!pveMode}>
        <div className="stats-grid-compact">
          <div className="compact-stat">
            <span className="compact-stat-icon">👾</span>
            <span className="compact-stat-label">MONSTER</span>
            <span className="compact-stat-value">{idle.currentMonster ?? '—'}</span>
          </div>
          <div className="compact-stat">
            <span className="compact-stat-icon">🎯</span>
            <span className="compact-stat-label">LAST XP</span>
            <span className="compact-stat-value">{idle.lastCombatXp > 0 ? `+${idle.lastCombatXp}` : '—'}</span>
          </div>
          <div className="compact-stat">
            <span className="compact-stat-icon">⚔</span>
            <span className="compact-stat-label">FIGHTS</span>
            <span className="compact-stat-value">{idle.idleFightsCount}</span>
          </div>
        </div>
        <div className="pve-extra-stats">
          <span className="pve-extra-item">💀 {idle.totalKills} slain</span>
          {idle.currentStreak > 0 && <span className="pve-extra-item streak">🔥 {idle.currentStreak}</span>}
        </div>
      </div>
    </div>
  );
});
