import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  ACHIEVEMENT_CATEGORIES,
  getAchievementsByCategory,
  getCompletedCount,
  getTotalAchievementCount,
  getDefaultAchievementProgress,
  type AchievementDef,
  type AchievementCategory,
  type AchievementProgressMap,
} from '../utils/achievementUtils';
import AchievementNotification from '../components/AchievementNotification';

// ─── Helpers ──────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  combat: '⚔️',
  pve: '👾',
  collection: '💎',
  leveling: '⬆️',
  equipment: '🛡️',
  forge: '🔨',
  secret: '❓',
};

const CATEGORY_LABELS: Record<string, string> = {
  combat: 'Combat',
  pve: 'PvE',
  collection: 'Collection',
  leveling: 'Leveling',
  equipment: 'Equipment',
  forge: 'Forge',
  secret: 'Secret',
};

/**
 * Build a consistent progress map from the character's achievement progress.
 */
const buildProgressMap = (
  character: { achievementProgress?: Record<string, { completed: boolean; progress: number; target: number; unlockedAt?: number }> } | null,
): AchievementProgressMap => {
  if (!character?.achievementProgress) return getDefaultAchievementProgress();
  return character.achievementProgress as AchievementProgressMap;
};

/**
 * Determine whether a secret category should be visible.
 * Secrets with at least one achievement that has progress > 0 are shown.
 */
const isSecretVisible = (
  grouped: Record<AchievementCategory, AchievementDef[]>,
  progress: AchievementProgressMap,
): boolean => {
  const secrets = grouped.secret ?? [];
  return secrets.some((def) => {
    const p = progress[def.id];
    return p && p.progress > 0;
  });
};

// ─── Sub‑components ───────────────────────────────────────────────────────

interface CategorySectionProps {
  categoryKey: AchievementCategory;
  label: string;
  icon: string;
  achievements: AchievementDef[];
  progress: AchievementProgressMap;
  defaultOpen: boolean;
}

const CategorySection = ({
  categoryKey,
  label,
  icon,
  achievements,
  progress,
  defaultOpen,
}: CategorySectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  if (achievements.length === 0) {
    return null;
  }

  const completed = achievements.filter((a) => progress[a.id]?.completed).length;

  return (
    <div className={`achievement-category${open ? ' achievement-category--open' : ''}`}>
      <button
        className="achievement-category-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`category-${categoryKey}`}
      >
        <span className="achievement-category-icon">{icon}</span>
        <span className="achievement-category-label">{label}</span>
        <span className="achievement-category-count">
          {completed}/{achievements.length}
        </span>
        <span className={`achievement-category-chevron${open ? ' achievement-category-chevron--open' : ''}`}>
          ▶
        </span>
      </button>
      {open && (
        <div id={`category-${categoryKey}`} className="achievement-category-body">
          {achievements.map((def) => {
            const prog = progress[def.id] ?? { completed: false, progress: 0 };
            const pct = Math.min(100, Math.round((prog.progress / def.target) * 100));
            const isComplete = prog.completed;
            const isHidden = def.hidden && prog.progress === 0;

            return (
              <div
                key={def.id}
                className={`achievement-card${isComplete ? ' achievement-card--completed' : ''}`}
              >
                <div className="achievement-card-header">
                  <span className="achievement-card-icon">
                    {CATEGORY_ICONS[def.category] ?? '🏆'}
                  </span>
                  <div className="achievement-card-info">
                    <span className="achievement-card-name">
                      {isHidden ? '???' : def.name}
                    </span>
                    <span className="achievement-card-description">
                      {isHidden ? '???' : def.description}
                    </span>
                  </div>
                  {isComplete && <span className="achievement-card-checkmark">✓</span>}
                </div>
                <div className="achievement-card-progress-bar">
                  <div
                    className="achievement-card-progress-fill"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={prog.progress}
                    aria-valuemin={0}
                    aria-valuemax={def.target}
                    aria-label={`${def.name}: ${prog.progress} / ${def.target}`}
                  />
                </div>
                <div className="achievement-card-footer">
                  <span className="achievement-card-progress-text">
                    {isHidden ? '??? / ???' : `${prog.progress} / ${def.target}`}
                  </span>
                  {!isHidden && (
                    <span className="achievement-card-reward" title={def.reward.label}>
                      {def.reward.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────

const Achievements = () => {
  const navigate = useNavigate();
  const { activeCharacter } = useGame();
  const [notification, setNotification] = useState<AchievementDef | null>(null);

  const progress = useMemo(() => buildProgressMap(activeCharacter), [activeCharacter]);
  const grouped = useMemo(() => getAchievementsByCategory(), []);

  const totalCompleted = useMemo(() => getCompletedCount(progress), [progress]);
  const totalCount = getTotalAchievementCount();
  const completionPct = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

  const secretVisible = useMemo(
    () => isSecretVisible(grouped, progress),
    [grouped, progress],
  );

  // If no character, show an empty state
  if (!activeCharacter) {
    return (
      <div className="container retro-container achievements-page">
        <header className="game-header">
          <h1 className="hero-text">ACHIEVEMENTS</h1>
        </header>
        <main id="main-content" className="achievements-content">
          <div className="empty-state">
            <p>NO CHARACTER FOUND</p>
            <p className="sub-text">Create a character to start earning achievements.</p>
            <button className="button retro-btn" onClick={() => navigate('/create-character')}>
              CREATE CHARACTER
            </button>
          </div>
        </main>
        <div className="actions">
          <button className="button secondary" onClick={() => navigate('/')}>
            BACK TO MENU
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container retro-container achievements-page">
      <AchievementNotification
        achievement={notification}
        onClose={() => setNotification(null)}
      />

      <header className="game-header">
        <h1 className="hero-text">ACHIEVEMENTS</h1>
        <p className="subtitle">COMPLETIONIST PROGRESS</p>
      </header>

      <main id="main-content" className="achievements-content">
        {/* Stats bar */}
        <div className="achievements-stats">
          <span className="achievements-stats-text">
            {totalCompleted} / {totalCount} achievements completed
          </span>
          <span className="achievements-stats-pct">{completionPct}%</span>
        </div>

        {/* Progress overview bar */}
        <div className="achievements-overall-bar">
          <div
            className="achievements-overall-fill"
            style={{ width: `${completionPct}%` }}
            role="progressbar"
            aria-valuenow={totalCompleted}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`Overall progress: ${totalCompleted} of ${totalCount} achievements`}
          />
        </div>

        {/* Category sections */}
        <div className="achievements-categories">
          {ACHIEVEMENT_CATEGORIES.map((cat) => {
            if (cat === 'secret' && !secretVisible) return null;

            return (
              <CategorySection
                key={cat}
                categoryKey={cat}
                label={CATEGORY_LABELS[cat] ?? cat}
                icon={CATEGORY_ICONS[cat] ?? '🏆'}
                achievements={grouped[cat] ?? []}
                progress={progress}
                defaultOpen={cat !== 'secret'}
              />
            );
          })}
        </div>
      </main>

      <div className="actions">
        <button className="button secondary" onClick={() => navigate('/')}>
          BACK TO MENU
        </button>
      </div>
    </div>
  );
};

export default Achievements;
