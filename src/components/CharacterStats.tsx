import { Character } from '../types/Character';
import { PixelCharacter } from './PixelCharacter';
import { PixelIcon } from './PixelIcon';
import { formatXpDisplay } from '../utils/xpUtils';

type StatIconType = 'strength' | 'vitality' | 'dexterity' | 'luck' | 'intelligence' | 'focus';

interface CharacterStatsProps {
    activeCharacter: Character;
    effectiveCharacter: Character;
    xpProgress: { percentage: number };
    xpBarAnimating: boolean;
    showXpGain: boolean;
    lastXpGain: number | null;
    isMaxLevel: boolean;
    pendingStatPoints: number;
    statOptions: Array<{ key: string; label: string; value: number; hint: string; icon: StatIconType }>;
    handleOpenLevelUp: () => void;
}

const CharacterStats = ({
    activeCharacter,
    effectiveCharacter,
    xpProgress,
    xpBarAnimating,
    showXpGain,
    lastXpGain,
    isMaxLevel,
    pendingStatPoints,
    statOptions,
    handleOpenLevelUp,
}: CharacterStatsProps) => {
    return (
        <div className="character-display">
            <div className="avatar-box">
                <PixelCharacter seed={activeCharacter.seed} gender={activeCharacter.gender} scale={window.innerWidth < 600 ? 16 : 12} />
            </div>

            <div className="xp-section">
                <div className="xp-header">
                    <span className="xp-label">EXP</span>
                    <span className="xp-text">{formatXpDisplay(activeCharacter)}</span>
                </div>
                <div className="xp-bar-container">
                    <div
                        className={`xp-bar ${xpBarAnimating ? 'animating' : ''} ${isMaxLevel ? 'max-level' : ''}`}
                        style={{ width: `${xpProgress.percentage}%` }}
                    >
                        <div className="xp-bar-shine"></div>
                    </div>
                    {showXpGain && lastXpGain && (
                        <div className="xp-gain-popup">+{lastXpGain} XP</div>
                    )}
                </div>
                {isMaxLevel && <span className="max-level-badge">★ MAX LEVEL ★</span>}
            </div>

            <div className="stats-panel">
                <div className="stat-row principal">
                    <span>HP</span>
                    <div className="bar-container">
                        <div className="bar hp-bar" style={{ width: '100%' }}></div>
                    </div>
                    <span className="stat-val">{effectiveCharacter.maxHp}</span>
                </div>
                <div className="stats-grid-compact">
                    {statOptions.map((stat) => (
                        <div key={stat.key} className="compact-stat">
                            <span className="compact-stat-icon">
                                <PixelIcon type={stat.icon} size={12} />
                            </span>
                            <span className="compact-stat-label">{stat.label}</span>
                            <span className="compact-stat-value">{stat.value}</span>
                        </div>
                    ))}
                </div>
                {pendingStatPoints > 0 && (
                    <button
                        className="button secondary-btn stat-allocate-btn"
                        onClick={handleOpenLevelUp}
                    >
                        SPEND POINT
                    </button>
                )}
            </div>
        </div>
    );
};

export default CharacterStats;
