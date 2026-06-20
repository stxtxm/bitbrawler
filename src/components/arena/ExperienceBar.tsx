import { memo } from 'react';

interface ExperienceBarProps {
  xpText: string;
  xpPercentage: number;
  xpBarAnimating: boolean;
  isMaxLevel: boolean;
  showXpGain: boolean;
  lastXpGain: number | null;
}

export const ExperienceBar = memo(function ExperienceBar({
  xpText,
  xpPercentage,
  xpBarAnimating,
  isMaxLevel,
  showXpGain,
  lastXpGain,
}: ExperienceBarProps) {
  return (
    <div className="xp-section">
      <div className="xp-header">
        <span className="xp-label">EXP</span>
        <span className="xp-text">{xpText}</span>
      </div>
      <div className="xp-bar-container">
        <div
          className={`xp-bar ${xpBarAnimating ? 'animating' : ''} ${isMaxLevel ? 'max-level' : ''}`}
          style={{ width: `${xpPercentage}%` }}
        >
          <div className="xp-bar-shine" />
        </div>
        {showXpGain && lastXpGain && (
          <div className="xp-gain-popup">+{lastXpGain} XP</div>
        )}
      </div>
      {isMaxLevel && <span className="max-level-badge">★ MAX LEVEL ★</span>}
    </div>
  );
});
