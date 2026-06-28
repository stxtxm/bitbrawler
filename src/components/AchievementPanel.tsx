import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { AchievementDef, AchievementCategory, AchievementProgressMap } from '../utils/achievementUtils';

interface AchievementPanelProps {
  achievements: AchievementDef[];
  progress: AchievementProgressMap;
  compact?: boolean;
  category?: AchievementCategory;
}

const CATEGORY_ICONS: Record<string, string> = {
  combat: '⚔️',
  pve: '👾',
  collection: '💎',
  leveling: '⬆️',
  equipment: '🛡️',
  forge: '🔨',
  secret: '❓',
};

/**
 * Renders a single achievement progress bar row.
 */
const AchievementRow = ({
  def,
  progress,
}: {
  def: AchievementDef;
  progress: AchievementProgressMap[string];
}) => {
  const prog = progress ?? { completed: false, progress: 0 };
  const pct = Math.min(100, Math.round((prog.progress / def.target) * 100));
  const isComplete = prog.completed;
  const isHidden = def.hidden && prog.progress === 0;

  return (
    <div className={`achievement-row${isComplete ? ' achievement-row--completed' : ''}`}>
      <div className="achievement-row-header">
        <span className="achievement-row-icon">
          {CATEGORY_ICONS[def.category] ?? '🏆'}
        </span>
        <div className="achievement-row-info">
          <span className="achievement-row-name">
            {isHidden ? '???' : def.name}
          </span>
          <span className="achievement-row-description">
            {isHidden ? '???' : def.description}
          </span>
        </div>
        {isComplete && <span className="achievement-row-checkmark">✓</span>}
      </div>
      <div className="achievement-row-progress-bar">
        <div
          className="achievement-row-progress-fill"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={prog.progress}
          aria-valuemin={0}
          aria-valuemax={def.target}
          aria-label={`${def.name}: ${prog.progress} / ${def.target}`}
        />
      </div>
      <div className="achievement-row-stats">
        <span className="achievement-row-progress-text">
          {isHidden ? '??? / ???' : `${prog.progress} / ${def.target}`}
        </span>
        {!isHidden && (
          <span className="achievement-row-reward" title={def.reward.label}>
            {def.reward.label}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable achievement progress panel.
 *
 * **Full mode** (default): shows up to 6 achievements sorted by nearest
 * completion first.
 *
 * **Compact mode**: shows the latest 3 completed achievements with a
 * "View All" link.
 */
const AchievementPanel = ({
  achievements,
  progress,
  compact = false,
  category,
}: AchievementPanelProps) => {
  const rows = useMemo(() => {
    if (compact) {
      // Show latest 3 completed achievements
      return achievements
        .filter((def) => progress[def.id]?.completed)
        .slice(0, 3);
    }

    // Full mode: sort by nearest completion first
    return [...achievements]
      .sort((a, b) => {
        const pa = progress[a.id]?.progress ?? 0;
        const pb = progress[b.id]?.progress ?? 0;
        const pctA = pa / a.target;
        const pctB = pb / b.target;
        // Sort by: incomplete first (descending progress), then completed
        const aDone = progress[a.id]?.completed ?? false;
        const bDone = progress[b.id]?.completed ?? false;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return pctB - pctA;
      })
      .slice(0, 6);
  }, [achievements, progress, compact]);

  if (achievements.length === 0) {
    return (
      <div className="achievement-panel">
        <p className="achievement-panel-empty">
          {category ? `No ${category} achievements yet.` : 'No achievements yet.'}
        </p>
        {compact && (
          <Link to="/achievements" className="achievement-panel-link">
            View All →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="achievement-panel">
      <div className="achievement-panel-list">
        {rows.map((def) => (
          <AchievementRow key={def.id} def={def} progress={progress[def.id]} />
        ))}
      </div>
      {compact && achievements.length > 3 && (
        <Link to="/achievements" className="achievement-panel-link">
          View All →
        </Link>
      )}
    </div>
  );
};

export default AchievementPanel;
