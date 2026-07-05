import { getStreakBonus, STREAK_TIERS, StreakBonus } from '../utils/lootboxUtils';
import { PixelIcon } from './PixelIcon';

interface StreakIndicatorProps {
  streak: number;
  canRoll: boolean;
  compact?: boolean;
}

function getNextTier(streak: number): { minDays: number; bonus: StreakBonus } | null {
  for (const tier of STREAK_TIERS) {
    if (streak < tier.minDays) {
      return { minDays: tier.minDays, bonus: tier.bonus };
    }
  }
  return null;
}

function getTierProgress(streak: number): { current: number; max: number } | null {
  const next = getNextTier(streak);
  if (!next) return null;

  // Find current tier start
  let currentTierStart = 1;
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (streak >= STREAK_TIERS[i].minDays) {
      currentTierStart = STREAK_TIERS[i].minDays;
      break;
    }
  }

  const progress = streak - currentTierStart;
  const max = next.minDays - currentTierStart;
  return { current: progress, max };
}

function getTierLabel(bonus: StreakBonus): string {
  if (bonus.doubleRoll) return 'DOUBLE ROLL';
  if (bonus.minRarity) {
    if (bonus.weightBonus > 0) return `${bonus.label} / ${bonus.minRarity.toUpperCase()}+`;
    return `${bonus.minRarity.toUpperCase()}+`;
  }
  if (bonus.weightBonus > 0) return bonus.label;
  return 'BASE';
}

function getStreakColorClass(streak: number): string {
  if (streak >= 10) return 'streak-rainbow';
  if (streak >= 5) return 'streak-gold';
  if (streak >= 3) return 'streak-silver';
  return 'streak-gray';
}

function isMilestone(streak: number): boolean {
  return streak === 3 || streak === 5 || streak === 10;
}

const StreakIndicator: React.FC<StreakIndicatorProps> = ({ streak, canRoll, compact = false }) => {
  const bonus = getStreakBonus(streak);
  const nextTier = getNextTier(streak);
  const progress = getTierProgress(streak);
  const streakColorClass = getStreakColorClass(streak);
  const showMilestone = isMilestone(streak);

  if (compact) {
    return (
      <div className={`streak-indicator compact ${streakColorClass} ${!canRoll ? 'streak-idle' : ''}`}>
        <PixelIcon type="trophy" size={12} />
        <span className="streak-count">{streak}</span>
      </div>
    );
  }

  return (
    <div className={`streak-indicator ${streakColorClass} ${!canRoll ? 'streak-idle' : ''}`}>
      <div className="streak-header">
        <PixelIcon type="trophy" size={14} />
        <span className="streak-title">STREAK</span>
        <span className="streak-count">{streak} DAYS</span>
      </div>

      <div className="streak-tier-label">
        {getTierLabel(bonus)}
      </div>

      {showMilestone && (
        <div className="streak-milestone-burst" aria-hidden="true">
          <span className="burst-star s1">✦</span>
          <span className="burst-star s2">✦</span>
          <span className="burst-star s3">✦</span>
          <span className="burst-star s4">✦</span>
          <span className="burst-star s5">✦</span>
          <span className="burst-star s6">✦</span>
          <span className="burst-star s7">✦</span>
          <span className="burst-star s8">✦</span>
        </div>
      )}

      {nextTier && progress && progress.max > 0 && (
        <div className="streak-progress-container">
          <div
            className="streak-progress-bar"
            style={{ width: `${(progress.current / progress.max) * 100}%` }}
          />
          <span className="streak-progress-text">
            {nextTier.minDays - streak} DAYS TO {getTierLabel(nextTier.bonus)}
          </span>
        </div>
      )}

      {!canRoll && streak > 0 && (
        <div className="streak-warning">
          <PixelIcon type="close" size={10} />
          CLAIM TODAY TO KEEP STREAK
        </div>
      )}
    </div>
  );
};

export default StreakIndicator;
